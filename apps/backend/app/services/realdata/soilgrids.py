"""ISRIC SoilGrids 2.0 soil property ESTIMATES at a field centroid (no API key).

Uses the SoilGrids WCS (maps.isric.org) with a 7x7-pixel window per property/depth.
In testing (2026-10-19) the REST API returned all-null values even for valid
pixels, and reading the VRTs over /vsicurl took minutes.
SoilGrids masks built-up areas and water, so when the centroid pixel is masked we
take the median of valid pixels within NEIGHBOURHOOD_RADIUS_PX (~750 m) and say so.

These are modelled ~250 m estimates. They NEVER overwrite farmer-entered or lab
N/P/K/pH; they are returned alongside them for context.

Unit conversions (``SOILGRIDS_CONVERSIONS``) and ``classify_texture_usda`` are
adapted from OpenFarm ``services/api/app/tasks/soil.py``.
Copyright (c) 2026, OpenFarm Contributors. BSD-3-Clause, see LICENSE-OpenFarm.txt.
Changes: fixed WCS subsetting (OpenFarm passes the Y subset as an ignored
``SUBSETY`` param), neighbourhood fallback for masked pixels, top-3 depths only.
"""

from __future__ import annotations

import json
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

WCS_URL = "https://maps.isric.org/mapserv"
SOURCE_LABEL = "ISRIC SoilGrids 2.0 (maps.isric.org WCS)"
RESOLUTION_LABEL = "estimated, ~250 m resolution"
DEPTHS = [("0-5cm", 0, 5), ("5-15cm", 5, 15), ("15-30cm", 15, 30)]
NEIGHBOURHOOD_RADIUS_PX = 3          # 7x7 window of 250 m pixels
NODATA = -32768
WCS_NODATA = 0          # masked pixels come back as 0 in WCS GeoTIFFs (no nodata tag)
MAX_WORKERS = 6
HTTP_TIMEOUT_S = 30

# stored_value * factor = conventional unit (ISRIC FAQ; same table as OpenFarm)
SOILGRIDS_CONVERSIONS: Dict[str, Tuple[str, float, str]] = {
    "phh2o": ("ph_h2o", 0.1, "pH"),
    "soc": ("soc_g_kg", 0.1, "g/kg"),
    "clay": ("clay_pct", 0.1, "%"),
    "sand": ("sand_pct", 0.1, "%"),
    "silt": ("silt_pct", 0.1, "%"),
    "bdod": ("bulk_density_kg_dm3", 0.01, "kg/dm3"),
    "nitrogen": ("total_nitrogen_g_kg", 0.01, "g/kg"),
    "cec": ("cec_cmol_kg", 0.1, "cmol(c)/kg"),
}


# ── Pure helpers (unit-tested) ───────────────────────────────────────

def classify_texture_usda(sand: Optional[float], silt: Optional[float], clay: Optional[float]) -> Optional[str]:
    """USDA texture triangle (OpenFarm tasks/soil.py::_classify_texture)."""
    if sand is None or silt is None or clay is None:
        return None
    total = sand + silt + clay
    if total <= 0:
        return None
    sand, silt, clay = sand * 100 / total, silt * 100 / total, clay * 100 / total
    if clay >= 40:
        if silt >= 40:
            return "silty clay"
        if sand >= 45:
            return "sandy clay"
        return "clay"
    if clay >= 27:
        if 20 <= sand < 45:
            return "clay loam"
        if sand < 20:
            return "silty clay loam"
        return "sandy clay loam"
    if clay >= 7:
        if 28 <= silt < 50 and sand <= 52:
            return "loam"
        if silt >= 50:
            return "silt loam" if clay >= 12 else "silt"
        if 43 <= sand <= 52:
            return "loam" if silt >= 28 else "sandy loam"
        if sand > 52:
            return "sandy loam"
        return "loam"
    if silt >= 80:
        return "silt"
    if silt >= 50:
        return "silt loam"
    if sand >= 85:
        return "sand" if sand >= 90 else "loamy sand"
    return "sandy loam"


def to_app_texture(usda: Optional[str]) -> Optional[str]:
    """Map USDA class to the coarse labels used by SoilReport.soil_texture."""
    if not usda:
        return None
    if "clay" in usda and "loam" not in usda:
        return "Clayey"
    if usda in ("sand", "loamy sand", "sandy loam"):
        return "Sandy"
    if usda in ("silt", "silt loam"):
        return "Silt"
    return "Loamy"


def sample_window(window: np.ndarray, nodata: float = NODATA) -> Tuple[Optional[float], str, int]:
    """Centre pixel if valid, else median of valid neighbours. Returns (value, method, n)."""
    c = window.shape[0] // 2, window.shape[1] // 2
    centre = window[c]
    if centre != nodata:
        return float(centre), "centroid pixel", 1
    valid = window[window != nodata]
    if valid.size == 0:
        return None, "no valid pixels (built-up/water mask)", 0
    return float(np.median(valid)), "median of valid pixels within ~750 m", int(valid.size)


def depth_weighted(layers: List[Dict[str, Any]], key: str) -> Optional[float]:
    num = den = 0.0
    for (label, top, bottom), layer in zip(DEPTHS, layers):
        v = layer.get(key)
        if v is not None:
            num += v * (bottom - top)
            den += bottom - top
    return round(num / den, 2) if den else None


# ── Network ─────────────────────────────────────────────────────────

def _read_one(prop: str, depth: str, lat: float, lon: float) -> Tuple[str, str, Optional[float], str, int]:
    import io
    import rasterio
    import requests
    from pyproj import Transformer

    x, y = Transformer.from_crs("EPSG:4326", "ESRI:54052", always_xy=True).transform(lon, lat)
    half = (NEIGHBOURHOOD_RADIUS_PX + 0.5) * 250.0
    crs = "http://www.opengis.net/def/crs/EPSG/0/152160"   # Interrupted Goode Homolosine
    params = [
        ("map", f"/map/{prop}.map"), ("SERVICE", "WCS"), ("VERSION", "2.0.1"),
        ("REQUEST", "GetCoverage"), ("COVERAGEID", f"{prop}_{depth}_mean"), ("FORMAT", "image/tiff"),
        # Two SUBSET params (a dict would collapse them; OpenFarm's "SUBSETY" key is ignored by WCS).
        ("SUBSET", f"X({x - half},{x + half})"), ("SUBSET", f"Y({y - half},{y + half})"),
        ("SUBSETTINGCRS", crs), ("OUTPUTCRS", crs),
    ]
    last_err = None
    for _attempt in range(3):
        try:
            resp = requests.get(WCS_URL, params=params, timeout=HTTP_TIMEOUT_S)
            if resp.status_code == 200 and "tiff" in resp.headers.get("content-type", ""):
                with rasterio.open(io.BytesIO(resp.content)) as ds:
                    win = ds.read(1)
                    nodata = ds.nodata if ds.nodata is not None else WCS_NODATA
                value, method, n = sample_window(win, nodata)
                return prop, depth, value, method, n
            last_err = f"HTTP {resp.status_code} {resp.headers.get('content-type')}"
        except Exception as exc:
            last_err = str(exc)
    raise RuntimeError(f"SoilGrids WCS {prop} {depth}: {last_err}")


def fetch_soil_estimate(lat: float, lon: float) -> Dict[str, Any]:
    jobs = [(p, d) for p in SOILGRIDS_CONVERSIONS for d, _, _ in DEPTHS]
    errors: List[str] = []

    def safe(job):
        try:
            return _read_one(job[0], job[1], lat, lon)
        except Exception as exc:  # one failed property must not sink the estimate
            errors.append(str(exc))
            return job[0], job[1], None, "request failed", 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        results = list(pool.map(safe, jobs))

    layers: Dict[str, Dict[str, Any]] = {d: {"depth": d} for d, _, _ in DEPTHS}
    methods = set()
    min_pixels = None
    for prop, depth, raw, method, n in results:
        name, factor, _unit = SOILGRIDS_CONVERSIONS[prop]
        layers[depth][name] = round(raw * factor, 3) if raw is not None else None
        methods.add(method)
        min_pixels = n if min_pixels is None else min(min_pixels, n)
    layer_list = [layers[d] for d, _, _ in DEPTHS]

    if all(v is None for l in layer_list for k, v in l.items() if k != "depth"):
        reason = ("SoilGrids requests failed: " + "; ".join(errors[:2])) if errors else \
            "SoilGrids has no valid pixels here (built-up or water mask)."
        return {"status": "unavailable", "source": SOURCE_LABEL, "lat": lat, "lon": lon, "reason": reason}

    top = {name: depth_weighted(layer_list, name) for name, _f, _u in SOILGRIDS_CONVERSIONS.values()}
    usda = classify_texture_usda(top.get("sand_pct"), top.get("silt_pct"), top.get("clay_pct"))
    return {
        "status": "estimated",
        "label": RESOLUTION_LABEL,
        "source": SOURCE_LABEL,
        "lat": lat, "lon": lon,
        "layers": layer_list,
        "topsoil_0_30cm": top,
        "units": {v[0]: v[2] for v in SOILGRIDS_CONVERSIONS.values()},
        "texture_class_usda": usda,
        "suggested_app_texture": to_app_texture(usda),
        "sampling": {"methods": sorted(methods), "min_valid_pixels": min_pixels},
        "errors": errors,
        "notes": [
            "Modelled estimate from global soil maps; not a soil test.",
            "total_nitrogen is total soil N (g/kg), not plant-available N (kg/ha).",
            "Farmer-entered or lab N/P/K/pH always take precedence and are never overwritten.",
        ],
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


def get_soil_estimate(lat: float, lon: float, db=None) -> Dict[str, Any]:
    """Cached (SoilGrids is a static product, so no TTL)."""
    from app.models.vegetation import SoilEstimateCache
    from app.db.database import SessionLocal

    lat_r, lon_r = round(lat, 3), round(lon, 3)
    own = db is None
    db = db or SessionLocal()
    try:
        hit = db.query(SoilEstimateCache).filter(SoilEstimateCache.lat == lat_r,
                                                 SoilEstimateCache.lon == lon_r).first()
        if hit:
            payload = json.loads(hit.payload)
            payload["cache"] = "hit"
            return payload
        payload = fetch_soil_estimate(lat_r, lon_r)
        if payload["status"] == "estimated":
            db.add(SoilEstimateCache(lat=lat_r, lon=lon_r, payload=json.dumps(payload)))
            db.commit()
        payload["cache"] = "miss"
        return payload
    except Exception as exc:
        logger.warning("soilgrids_failed: %s", exc)
        return {"status": "unavailable", "source": SOURCE_LABEL, "lat": lat_r, "lon": lon_r,
                "reason": f"SoilGrids request failed: {exc}"}
    finally:
        if own:
            db.close()
