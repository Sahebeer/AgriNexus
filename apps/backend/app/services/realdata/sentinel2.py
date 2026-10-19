"""Real Sentinel-2 L2A vegetation indices for a field polygon.

Pipeline: Element84 Earth Search STAC search -> per-scene windowed COG reads
(red, nir, green, blue, SCL) in the tile's native UTM grid -> BOA scale/offset
-> SCL cloud/shadow mask -> field mask -> NDVI/EVI/SAVI/NDWI zonal stats.
Results are cached per (field geometry, scene) in ``vegetation_index_observations``.

Adapted from OpenFarm ``services/api/app/tasks/pipeline.py`` (search_scenes,
read_band_windowed, compute_zonal_stats) and ``tasks/indices.py`` (formulas).
Copyright (c) 2026, OpenFarm Contributors. BSD-3-Clause, see LICENSE-OpenFarm.txt.
Changes vs. OpenFarm: converts DNs to reflectance (OpenFarm used raw DNs, which
is fine for ratio indices but wrong for EVI's +1 term), adds SCL pixel masking (OpenFarm had none), reads in native
CRS with nearest-neighbour SCL instead of bilinear reprojection, measures
valid-pixel % against the field mask rather than the buffered bbox, and drops
COG writing / MinIO / Celery.
"""

from __future__ import annotations

import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor, wait
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import requests
from shapely.geometry import mapping, shape
from shapely.geometry.base import BaseGeometry

from app.services.realdata.geometry import geometry_key

logger = logging.getLogger(__name__)

# GDAL settings for fast HTTP range reads of public COGs (same as OpenFarm).
os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif,.TIF,.tiff")
os.environ.setdefault("GDAL_HTTP_MERGE_CONSECUTIVE_RANGES", "YES")
os.environ.setdefault("GDAL_HTTP_MULTIPLEX", "YES")
os.environ.setdefault("VSI_CACHE", "TRUE")
os.environ.setdefault("VSI_CACHE_SIZE", "5000000")

# ── Tunables ─────────────────────────────────────────────────────────
STAC_API_URL = os.environ.get("STAC_API_URL", "https://earth-search.aws.element84.com/v1")
STAC_COLLECTION = "sentinel-2-l2a"
SOURCE_LABEL = "element84-earth-search/sentinel-2-l2a"

LOOKBACK_DAYS = 365
# Scene-level prefilter only; pixels are masked individually with SCL, so a
# 60 %-cloudy tile can still be clear over a small field.
MAX_SCENE_CLOUD_PCT = 70.0
# A scene is used only if at least this share of the field's pixels survives masking.
MIN_VALID_PIXEL_PCT = 60.0
BIN_DAYS = 7              # keep at most one scene per 7-day bin (best one)
MAX_SCENES = 40           # cap scenes processed per request
MAX_WORKERS = 8
TIME_BUDGET_S = 120.0     # stop starting new work after this; next call resumes from cache
HTTP_TIMEOUT_S = 30

# Sentinel-2 Scene Classification Layer classes treated as invalid.
# 0 no data, 1 saturated/defective, 3 cloud shadow, 8 cloud medium prob,
# 9 cloud high prob, 10 thin cirrus, 11 snow/ice.
SCL_INVALID_CLASSES = (0, 1, 3, 8, 9, 10, 11)

BANDS = {"red": "red", "nir": "nir", "green": "green", "blue": "blue"}
SAVI_L = 0.5


# ── Pure maths (unit-tested) ─────────────────────────────────────────

def to_reflectance(dn: np.ndarray, scale: float = 0.0001, offset: float = 0.0,
                   nodata: Optional[float] = 0) -> np.ndarray:
    """Convert L2A digital numbers to surface reflectance; nodata -> NaN."""
    arr = dn.astype(np.float32) * np.float32(scale) + np.float32(offset)
    if nodata is not None:
        arr[dn == nodata] = np.nan
    return arr


def compute_indices(red: np.ndarray, nir: np.ndarray,
                    green: Optional[np.ndarray] = None,
                    blue: Optional[np.ndarray] = None) -> Dict[str, np.ndarray]:
    """Vegetation indices from reflectance arrays (formulas from OpenFarm indices.py)."""
    out: Dict[str, np.ndarray] = {}
    with np.errstate(divide="ignore", invalid="ignore"):
        out["ndvi"] = np.clip((nir - red) / (nir + red), -1.0, 1.0)
        out["savi"] = np.clip(((nir - red) / (nir + red + SAVI_L)) * (1.0 + SAVI_L), -1.5, 1.5)
        if green is not None:
            out["ndwi"] = np.clip((green - nir) / (green + nir), -1.0, 1.0)
        if blue is not None:
            out["evi"] = np.clip(2.5 * (nir - red) / (nir + 6.0 * red - 7.5 * blue + 1.0), -1.0, 1.0)
    return out


def scl_valid_mask(scl: np.ndarray) -> np.ndarray:
    """True where the SCL class is usable (clear land/vegetation/water/dark area)."""
    return ~np.isin(scl, SCL_INVALID_CLASSES)


def zonal_stats(index: np.ndarray, field_mask: np.ndarray, valid_mask: np.ndarray) -> Dict[str, Any]:
    """Stats over pixels inside the field that are valid and finite.

    valid_pixel_pct is relative to the number of pixels inside the field
    (OpenFarm divided by the buffered bounding box, which overstated quality).
    """
    field_px = int(field_mask.sum())
    use = field_mask & valid_mask & np.isfinite(index)
    n = int(use.sum())
    pct = round(100.0 * n / field_px, 2) if field_px else 0.0
    if n == 0:
        return {"field_pixel_count": field_px, "valid_pixel_count": 0, "valid_pixel_pct": pct,
                "mean": None, "median": None, "p10": None, "p90": None, "std": None}
    vals = index[use]
    return {
        "field_pixel_count": field_px,
        "valid_pixel_count": n,
        "valid_pixel_pct": pct,
        "mean": round(float(vals.mean()), 4),
        "median": round(float(np.median(vals)), 4),
        "p10": round(float(np.percentile(vals, 10)), 4),
        "p90": round(float(np.percentile(vals, 90)), 4),
        "std": round(float(vals.std()), 4),
    }


def select_scenes(features: List[Dict[str, Any]], field: BaseGeometry,
                  bin_days: int = BIN_DAYS, max_scenes: int = MAX_SCENES) -> List[Dict[str, Any]]:
    """Pick the best scene per time bin.

    Same acquisition is often published on two overlapping MGRS tiles; prefer
    the tile whose footprint fully contains the field, then lowest cloud.
    """
    best: Dict[int, Tuple[Tuple, Dict[str, Any]]] = {}
    for feat in features:
        props = feat.get("properties", {})
        dt = props.get("datetime")
        if not dt:
            continue
        d = datetime.fromisoformat(dt.replace("Z", "+00:00")).date()
        try:
            contains = shape(feat["geometry"]).contains(field)
        except Exception:
            contains = False
        cloud = float(props.get("eo:cloud_cover", 100.0))
        rank = (0 if contains else 1, cloud)
        bin_id = d.toordinal() // bin_days
        if bin_id not in best or rank < best[bin_id][0]:
            best[bin_id] = (rank, {"feature": feat, "date": d, "cloud": cloud, "contains": contains})
    chosen = [v[1] for _, v in sorted(best.items())]
    return chosen[-max_scenes:]  # most recent N


# ── STAC search ──────────────────────────────────────────────────────

def search_stac(field: BaseGeometry, start: date, end: date) -> List[Dict[str, Any]]:
    """Search Earth Search for L2A items intersecting the field (follows paging)."""
    body: Dict[str, Any] = {
        "collections": [STAC_COLLECTION],
        # bbox rather than the polygon: STAC rejects rings with repeated vertices, and
        # select_scenes() / per-pixel masks still use the exact field geometry.
        "bbox": list(field.bounds),
        "datetime": f"{start.isoformat()}T00:00:00Z/{end.isoformat()}T23:59:59Z",
        "query": {"eo:cloud_cover": {"lt": MAX_SCENE_CLOUD_PCT}},
        "limit": 100,
    }
    url = f"{STAC_API_URL}/search"
    features: List[Dict[str, Any]] = []
    for _ in range(10):  # hard page cap
        resp = requests.post(url, json=body, timeout=HTTP_TIMEOUT_S)
        resp.raise_for_status()
        data = resp.json()
        features.extend(data.get("features", []))
        nxt = next((l for l in data.get("links", []) if l.get("rel") == "next"), None)
        if not nxt:
            break
        if nxt.get("body"):
            body = nxt["body"]
        url = nxt.get("href", url)
    return features


# ── Scene processing (network) ───────────────────────────────────────

def effective_offset(props: Dict[str, Any], declared_offset: float) -> float:
    """Reflectance offset to apply to DNs.

    Earth Search items with ``earthsearch:boa_offset_applied: true`` already have
    the baseline-04.00 -1000 DN offset removed from the pixels, yet still declare
    ``offset: -0.1`` in raster:bands. Applying it again drives dark-red pixels
    negative and pins NDVI to 1.0 (verified on S2B_43QCC_20261015_0_L2A).
    """
    if props.get("earthsearch:boa_offset_applied") is True:
        return 0.0
    return declared_offset


def _asset(feat: Dict[str, Any], key: str) -> Tuple[str, float, float, Optional[float]]:
    a = feat["assets"][key]
    rb = (a.get("raster:bands") or [{}])[0]
    offset = effective_offset(feat.get("properties", {}), float(rb.get("offset", 0.0)))
    return a["href"], float(rb.get("scale", 1.0)), offset, rb.get("nodata", 0)


def process_scene(feat: Dict[str, Any], field: BaseGeometry,
                  zones: Optional[List[BaseGeometry]] = None) -> Dict[str, Any]:
    """Read one scene's bands over the field and return zonal stats for all indices.
    With ``zones`` (WGS84 polygons), also returns per-zone NDVI/NDWI clipped to the field."""
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.features import geometry_mask
    from rasterio.windows import bounds as window_bounds, from_bounds as window_from_bounds
    from pyproj import Transformer
    from shapely.ops import transform as shp_transform

    red_href, *_ = _asset(feat, "red")
    with rasterio.open(red_href) as src:
        crs = src.crs
        to_utm = Transformer.from_crs("EPSG:4326", crs, always_xy=True).transform
        field_utm = shp_transform(to_utm, field)
        minx, miny, maxx, maxy = field_utm.buffer(20).bounds
        win = window_from_bounds(minx, miny, maxx, maxy, transform=src.transform)
        win = win.round_offsets().round_lengths()
        win_transform = src.window_transform(win)
        shape_hw = (int(win.height), int(win.width))
        # Pixel-snapped bounds of the 10 m window; every band (incl. 20 m SCL) reads these.
        minx, miny, maxx, maxy = window_bounds(win, src.transform)

    field_mask = geometry_mask([mapping(field_utm)], out_shape=shape_hw,
                               transform=win_transform, invert=True)
    if field_mask.sum() == 0:
        # Field narrower than a pixel centre spacing: fall back to touched pixels.
        field_mask = geometry_mask([mapping(field_utm)], out_shape=shape_hw,
                                   transform=win_transform, invert=True, all_touched=True)

    refl: Dict[str, np.ndarray] = {}
    for name, key in BANDS.items():
        href, scale, offset, nodata = _asset(feat, key)
        with rasterio.open(href) as src:
            w = window_from_bounds(minx, miny, maxx, maxy, transform=src.transform)
            dn = src.read(1, window=w, out_shape=shape_hw, boundless=True,
                          fill_value=nodata if nodata is not None else 0,
                          resampling=Resampling.nearest)
        refl[name] = to_reflectance(dn, scale, offset, nodata)

    scl_href = feat["assets"]["scl"]["href"]
    with rasterio.open(scl_href) as src:
        w = window_from_bounds(minx, miny, maxx, maxy, transform=src.transform)
        scl = src.read(1, window=w, out_shape=shape_hw, boundless=True, fill_value=0,
                       resampling=Resampling.nearest)

    valid = scl_valid_mask(scl)
    for arr in refl.values():
        valid &= np.isfinite(arr)
    valid &= (refl["red"] > 0) & (refl["nir"] > 0)  # non-physical reflectance

    idx = compute_indices(refl["red"], refl["nir"], refl["green"], refl["blue"])
    ndvi = zonal_stats(idx["ndvi"], field_mask, valid)
    others = {k: zonal_stats(v, field_mask, valid)["mean"] for k, v in idx.items() if k != "ndvi"}
    out = {"ndvi": ndvi, **{f"{k}_mean": v for k, v in others.items()}}
    if zones is not None:
        out["zones"] = []
        for z in zones:
            part = shp_transform(to_utm, z).intersection(field_utm)
            if part.is_empty or part.area <= 0:
                out["zones"].append(None)
                continue
            zmask = geometry_mask([mapping(part)], out_shape=shape_hw, transform=win_transform, invert=True)
            if zmask.sum() == 0:
                zmask = geometry_mask([mapping(part)], out_shape=shape_hw, transform=win_transform,
                                      invert=True, all_touched=True)
            zs = zonal_stats(idx["ndvi"], zmask, valid)
            zs["ndwi_mean"] = zonal_stats(idx["ndwi"], zmask, valid)["mean"]
            out["zones"].append(zs)
    return out


_zone_cache: Dict[Tuple[str, str], List[Optional[Dict[str, Any]]]] = {}


def zone_index_stats(scene_id: str, field: BaseGeometry,
                     zones: List[BaseGeometry]) -> List[Optional[Dict[str, Any]]]:
    """Per-zone NDVI/NDWI for one already-selected scene (STAC item fetched by id, cached in-process)."""
    key = (scene_id, field.wkt + "|" + "|".join(z.wkt for z in zones))
    if key not in _zone_cache:
        resp = requests.get(f"{STAC_API_URL}/collections/{STAC_COLLECTION}/items/{scene_id}",
                            timeout=HTTP_TIMEOUT_S)
        resp.raise_for_status()
        _zone_cache[key] = process_scene(resp.json(), field, zones)["zones"]
    return _zone_cache[key]


# ── Cache-aware orchestration ────────────────────────────────────────

def _row_to_dict(r) -> Dict[str, Any]:
    return {
        "date": r.observation_date.isoformat(),
        "scene_id": r.scene_id,
        "scene_cloud_pct": r.scene_cloud_pct,
        "valid_pixel_pct": r.valid_pixel_pct,
        "field_pixel_count": r.field_pixel_count,
        "ndvi": {"mean": r.ndvi_mean, "median": r.ndvi_median, "p10": r.ndvi_p10,
                 "p90": r.ndvi_p90, "std": r.ndvi_std},
        "evi": r.evi_mean, "savi": r.savi_mean, "ndwi": r.ndwi_mean,
        "source": r.source,
        "fetched_at": r.fetched_at.isoformat() if r.fetched_at else None,
    }


def get_vegetation_series(field: BaseGeometry, db=None, farm_id: Optional[int] = None,
                          lookback_days: int = LOOKBACK_DAYS,
                          time_budget_s: float = TIME_BUDGET_S) -> Dict[str, Any]:
    """Return real per-scene index stats for the field, computing uncached scenes.

    ``status`` is "real" when Sentinel-2 data was found, "unavailable" when the
    STAC search failed and nothing is cached (caller decides on a demo fallback).
    """
    from app.models.vegetation import VegetationIndexObservation as VIO
    from app.db.database import SessionLocal

    own_session = db is None
    db = db or SessionLocal()
    t0 = time.monotonic()
    key = geometry_key(field)
    end = date.today()
    start = end - timedelta(days=lookback_days)
    notes: List[str] = []
    try:
        cached = {r.scene_id: r for r in db.query(VIO).filter(VIO.geom_key == key).all()}

        search_ok = True
        try:
            features = search_stac(field, start, end)
            scenes = select_scenes(features, field)
        except Exception as exc:
            search_ok = False
            scenes = []
            notes.append(f"STAC search failed: {exc}")
            logger.warning("stac_search_failed: %s", exc)

        todo = [s for s in scenes if s["feature"]["id"] not in cached]
        new_rows: List[VIO] = []
        if todo:
            pool = ThreadPoolExecutor(max_workers=MAX_WORKERS)
            futs = {pool.submit(process_scene, s["feature"], field): s for s in todo}
            remaining = max(1.0, time_budget_s - (time.monotonic() - t0))
            done, pending = wait(futs, timeout=remaining)
            pool.shutdown(wait=False, cancel_futures=True)
            if pending:
                notes.append(f"{len(pending)} scenes not processed within the time budget; "
                             f"they will be computed on the next request.")
            for fut in done:
                s = futs[fut]
                row = VIO(geom_key=key, farm_id=farm_id, scene_id=s["feature"]["id"],
                          observation_date=s["date"], scene_cloud_pct=round(s["cloud"], 2),
                          source=SOURCE_LABEL)
                try:
                    res = fut.result()
                    nd = res["ndvi"]
                    row.valid_pixel_pct = nd["valid_pixel_pct"]
                    row.field_pixel_count = nd["field_pixel_count"]
                    if nd["mean"] is None or nd["valid_pixel_pct"] < MIN_VALID_PIXEL_PCT:
                        row.status = "low_valid"
                    else:
                        row.status = "ok"
                        row.ndvi_mean, row.ndvi_median = nd["mean"], nd["median"]
                        row.ndvi_p10, row.ndvi_p90, row.ndvi_std = nd["p10"], nd["p90"], nd["std"]
                        row.evi_mean, row.savi_mean = res.get("evi_mean"), res.get("savi_mean")
                        row.ndwi_mean = res.get("ndwi_mean")
                except Exception as exc:
                    # Transient read errors are not cached so the scene is retried later.
                    logger.warning("scene_failed %s: %s", s["feature"]["id"], exc)
                    notes.append(f"scene {s['feature']['id']} failed: {exc}")
                    continue
                new_rows.append(row)

        if new_rows:
            existing = {sid for (sid,) in db.query(VIO.scene_id).filter(VIO.geom_key == key).all()}
            for row in new_rows:
                if row.scene_id not in existing:
                    db.add(row)
            try:
                db.commit()
            except Exception as exc:  # concurrent request inserted the same scene
                db.rollback()
                notes.append(f"cache write skipped: {exc}")

        rows = (db.query(VIO)
                .filter(VIO.geom_key == key, VIO.observation_date >= start)
                .order_by(VIO.observation_date.asc()).all())
        if farm_id is not None:
            for r in rows:
                if r.farm_id is None:
                    r.farm_id = farm_id
            db.commit()

        ok = [_row_to_dict(r) for r in rows if r.status == "ok"]
        rejected = [r for r in rows if r.status != "ok"]
        status = "real" if ok else ("unavailable" if not search_ok else "no_valid_scenes")
        return {
            "status": status,
            "source": SOURCE_LABEL if ok else None,
            "geom_key": key,
            "period": {"start": start.isoformat(), "end": end.isoformat()},
            "thresholds": {"min_valid_pixel_pct": MIN_VALID_PIXEL_PCT,
                           "max_scene_cloud_pct": MAX_SCENE_CLOUD_PCT,
                           "scl_masked_classes": list(SCL_INVALID_CLASSES)},
            "scenes_considered": len(scenes) if search_ok else None,
            "scenes_rejected_low_valid": len(rejected),
            "observations": ok,
            "latest": ok[-1] if ok else None,
            "notes": notes,
            "elapsed_s": round(time.monotonic() - t0, 1),
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        if own_session:
            db.close()
