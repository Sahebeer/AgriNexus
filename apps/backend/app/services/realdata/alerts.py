"""Evidence-carrying field alerts from real NDVI and weather indices.

Rules (thresholds adapted from OpenFarm ``tasks/indices.py`` AlertDefaults and
``tasks/pipeline.py::run_alerts``; Copyright (c) 2026, OpenFarm Contributors,
BSD-3-Clause, see LICENSE-OpenFarm.txt):
  - ndvi_drop:   latest valid NDVI vs previous valid reading dropped >= NDVI_DROP_PCT
                 (OpenFarm compares to a rolling mean; we compare to the previous
                 reading as specified, and require both readings to be clean).
  - ndvi_low:    latest NDVI mean < NDVI_LOW (high severity below NDVI_LOW_HIGH).
  - drought:     30-day water-balance anomaly <= DROUGHT_Z.
Alerts are suppressed (and reported as such) when the valid-pixel % is low.
Confidence values are transparent heuristics, NOT calibrated probabilities.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

NDVI_DROP_PCT = 15.0
NDVI_LOW = 0.3
NDVI_LOW_HIGH = 0.15
NDVI_DROP_MIN_BASE = 0.2       # ignore "drops" from an already-bare field
ALERT_MIN_VALID_PCT = 80.0     # stricter than the 60 % used to accept a scene
MAX_PAIR_GAP_DAYS = 45
DROUGHT_Z = -1.0


def _clamp(x: float) -> float:
    return round(max(0.1, min(0.95, x)), 2)


def evaluate_alerts(field_id: Optional[int], observations: List[Dict[str, Any]],
                    agri: Optional[Dict[str, Any]] = None,
                    sowing_date: Optional[date] = None, today: Optional[date] = None) -> Dict[str, Any]:
    """observations: ascending list of {date, scene_id, valid_pixel_pct, ndvi: {mean, p10, p90}}."""
    today = today or date.today()
    alerts: List[Dict[str, Any]] = []
    suppressed: List[Dict[str, Any]] = []

    clean = [o for o in observations if (o.get("valid_pixel_pct") or 0) >= ALERT_MIN_VALID_PCT
             and o.get("ndvi", {}).get("mean") is not None]
    if observations and len(clean) < len(observations) and observations[-1] not in clean:
        last = observations[-1]
        suppressed.append({"index": "ndvi", "reason":
                           f"latest scene {last['date']} has only {last.get('valid_pixel_pct')}% valid pixels "
                           f"(< {ALERT_MIN_VALID_PCT}%); NDVI alerts use the last clean scene"})

    # ── NDVI drop vs previous clean reading ──
    if len(clean) >= 2:
        prev, cur = clean[-2], clean[-1]
        p, c = prev["ndvi"]["mean"], cur["ndvi"]["mean"]
        gap = (date.fromisoformat(cur["date"]) - date.fromisoformat(prev["date"])).days
        if p >= NDVI_DROP_MIN_BASE and p > 0:
            drop = (p - c) / p * 100.0
            if drop >= NDVI_DROP_PCT:
                if gap > MAX_PAIR_GAP_DAYS:
                    suppressed.append({"index": "ndvi", "reason": f"NDVI fell {drop:.0f}% but readings are {gap} days apart"})
                else:
                    conf = 0.6 + (0.15 if drop >= 25 else 0) \
                        + (0.1 if min(prev["valid_pixel_pct"], cur["valid_pixel_pct"]) >= 95 else 0) \
                        - (0.2 if gap > 20 else 0)
                    alerts.append({
                        "field_id": field_id, "index": "ndvi", "rule": "ndvi_drop",
                        "severity": "high" if drop >= 30 else ("medium" if drop >= 20 else "low"),
                        "title": f"NDVI dropped {drop:.0f}% between scenes",
                        "date_range": {"start": prev["date"], "end": cur["date"]},
                        "evidence": {"previous": {"date": prev["date"], "scene_id": prev["scene_id"], "ndvi_mean": p,
                                                  "valid_pixel_pct": prev["valid_pixel_pct"]},
                                     "current": {"date": cur["date"], "scene_id": cur["scene_id"], "ndvi_mean": c,
                                                 "valid_pixel_pct": cur["valid_pixel_pct"]},
                                     "drop_pct": round(drop, 1), "threshold_pct": NDVI_DROP_PCT, "gap_days": gap},
                        "evidence_text": (f"Sentinel-2 NDVI mean {p:.2f} on {prev['date']} ({prev['scene_id']}) -> "
                                          f"{c:.2f} on {cur['date']} ({cur['scene_id']}), -{drop:.0f}% in {gap} days; "
                                          f"valid pixels {prev['valid_pixel_pct']:.0f}% / {cur['valid_pixel_pct']:.0f}%."),
                        "confidence": _clamp(conf),
                        "recommended_action": ("Scout the field within 2-3 days: check for water stress, pest or disease "
                                               "patches, lodging, or harvest. Compare with the irrigation log."),
                    })
    elif observations and not clean:
        suppressed.append({"index": "ndvi", "reason": f"no scene with >= {ALERT_MIN_VALID_PCT}% valid pixels"})

    # ── Low NDVI ──
    if clean:
        cur = clean[-1]
        m = cur["ndvi"]["mean"]
        if m < NDVI_LOW:
            in_season = None
            if sowing_date:
                das = (date.fromisoformat(cur["date"]) - sowing_date).days
                in_season = 30 <= das <= 150
            conf = 0.6 if in_season else 0.35
            alerts.append({
                "field_id": field_id, "index": "ndvi", "rule": "ndvi_low",
                "severity": "high" if m < NDVI_LOW_HIGH else "medium",
                "title": f"Low vegetation cover (NDVI {m:.2f})",
                "date_range": {"start": cur["date"], "end": cur["date"]},
                "evidence": {"date": cur["date"], "scene_id": cur["scene_id"], "ndvi_mean": m,
                             "ndvi_p10": cur["ndvi"].get("p10"), "ndvi_p90": cur["ndvi"].get("p90"),
                             "valid_pixel_pct": cur["valid_pixel_pct"], "threshold": NDVI_LOW,
                             "sowing_date": sowing_date.isoformat() if sowing_date else None,
                             "in_expected_canopy_window": in_season},
                "evidence_text": (f"Sentinel-2 NDVI mean {m:.2f} (p10 {cur['ndvi'].get('p10')}, p90 {cur['ndvi'].get('p90')}) "
                                  f"on {cur['date']} ({cur['scene_id']}), below {NDVI_LOW}."
                                  + ("" if in_season else " Could be fallow, recently sown or harvested.")),
                "confidence": conf,
                "recommended_action": ("If the crop should be at canopy stage, inspect for poor germination, nutrient "
                                       "deficiency or water stress; otherwise confirm the sowing date in the profile."),
            })

    # ── Drought (weather) ──
    if agri and agri.get("drought_index") is not None:
        z = agri["drought_index"]
        if z <= DROUGHT_Z:
            yrs = agri.get("climatology_years_used", 0)
            alerts.append({
                "field_id": field_id, "index": "drought_index", "rule": "drought",
                "severity": "high" if z <= -1.5 else "medium",
                "title": f"Dry spell: {agri.get('drought_category')}",
                "date_range": {"start": None, "end": agri.get("as_of")},
                "evidence": {k: agri.get(k) for k in ("as_of", "precip_30d_mm", "et0_30d_mm", "water_balance_30d_mm",
                                                       "drought_index", "drought_method", "source", "lat", "lon")},
                "evidence_text": (f"Open-Meteo: {agri.get('precip_30d_mm')} mm rain vs {agri.get('et0_30d_mm')} mm ET0 in "
                                  f"the 30 days to {agri.get('as_of')} (balance {agri.get('water_balance_30d_mm')} mm), "
                                  f"anomaly z = {z} vs {yrs} prior years."),
                "confidence": 0.7 if yrs >= 8 else 0.5,
                "recommended_action": ("Prioritise irrigation for moisture-sensitive stages; mulch to cut evaporation; "
                                       "defer fertiliser top-dressing until soil moisture improves."),
            })

    return {"field_id": field_id, "alerts": alerts, "suppressed": suppressed,
            "rules": {"ndvi_drop_pct": NDVI_DROP_PCT, "ndvi_low": NDVI_LOW, "drought_z": DROUGHT_Z,
                      "min_valid_pixel_pct": ALERT_MIN_VALID_PCT},
            "confidence_note": "Heuristic confidence, not validated against field observations.",
            "generated_on": today.isoformat()}


def alerts_from_cache(db, farm) -> Optional[Dict[str, Any]]:
    """Alerts using only cached data (no network). Used by the advisor so chat never blocks."""
    import json
    from app.models.vegetation import VegetationIndexObservation as VIO, WeatherIndexSnapshot
    from app.services.realdata.geometry import centroid_latlon, geometry_key, parse_field_geometry
    from app.services.realdata.sentinel2 import _row_to_dict

    if not farm.boundary_geojson:
        return None
    try:
        geom = parse_field_geometry(farm.boundary_geojson)
    except Exception:
        return None
    rows = (db.query(VIO).filter(VIO.geom_key == geometry_key(geom), VIO.status == "ok")
            .order_by(VIO.observation_date.asc()).all())
    lat, lon = centroid_latlon(geom)
    snap = (db.query(WeatherIndexSnapshot)
            .filter(WeatherIndexSnapshot.lat == round(lat, 3), WeatherIndexSnapshot.lon == round(lon, 3))
            .order_by(WeatherIndexSnapshot.fetched_at.desc()).first())
    agri = json.loads(snap.payload) if snap else None
    if not rows and not agri:
        return None
    return evaluate_alerts(farm.id, [_row_to_dict(r) for r in rows], agri, farm.sowing_date)
