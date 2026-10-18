"""Agricultural weather indices at the field centroid from Open-Meteo (no API key).

- GDD: daily max(0, (Tmax+Tmin)/2 - base), from OpenFarm ``tasks/weather.py::_calculate_gdd``.
- 30-day water balance: sum(precipitation - FAO-56 ET0) over the last 30 days
  (same definition as OpenFarm ``_update_water_balance``).
- Drought index: ADAPTED. OpenFarm divides the 30-day sum by the std of *daily*
  balances inside the same window, which has no climatological reference. We use a
  standardized anomaly: (current 30-day balance - mean of the same 30-day calendar
  window in the previous N years) / std of those years. SPEI-like, not a fitted SPEI.

Copyright (c) 2026, OpenFarm Contributors (GDD / water-balance definitions).
BSD-3-Clause, see LICENSE-OpenFarm.txt.
"""

from __future__ import annotations

import json
import logging
import statistics
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Sequence

import requests

logger = logging.getLogger(__name__)

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
DAILY_VARS = ["temperature_2m_max", "temperature_2m_min", "precipitation_sum", "et0_fao_evapotranspiration"]

GDD_BASE_C = 10.0
WATER_BALANCE_WINDOW_DAYS = 30
CLIMATOLOGY_YEARS = 10
HTTP_TIMEOUT_S = 20
CACHE_TTL_HOURS = 6


# ── Pure maths (unit-tested) ─────────────────────────────────────────

def daily_gdd(t_max: Optional[float], t_min: Optional[float], base: float = GDD_BASE_C) -> Optional[float]:
    if t_max is None or t_min is None:
        return None
    return max(0.0, (float(t_max) + float(t_min)) / 2.0 - base)


def water_balance(precip: Sequence[Optional[float]], et0: Sequence[Optional[float]]) -> float:
    return sum((p or 0.0) - (e or 0.0) for p, e in zip(precip, et0))


def standardized_anomaly(current: float, reference: Sequence[float]) -> Optional[float]:
    if len(reference) < 3:
        return None
    sd = statistics.pstdev(reference)
    if sd == 0:
        return 0.0
    return (current - statistics.mean(reference)) / sd


def drought_category(z: Optional[float]) -> str:
    if z is None:
        return "unknown"
    if z <= -2.0:
        return "extreme drought"
    if z <= -1.5:
        return "severe drought"
    if z <= -1.0:
        return "moderate drought"
    if z < 1.0:
        return "near normal"
    if z < 1.5:
        return "moderately wet"
    return "very wet"


def compute_indices(days: List[Dict[str, Any]], today: date,
                    sowing_date: Optional[date] = None) -> Dict[str, Any]:
    """days: [{date, tmax, tmin, precip, et0}] sorted ascending, spanning >= 1 year + 30 days."""
    by_date = {d["date"]: d for d in days}
    end = max(d for d in by_date if d <= today)
    win = [by_date[end - timedelta(days=i)] for i in range(WATER_BALANCE_WINDOW_DAYS)
           if (end - timedelta(days=i)) in by_date]
    wb_now = water_balance([d["precip"] for d in win], [d["et0"] for d in win])

    reference = []
    for y in range(1, CLIMATOLOGY_YEARS + 1):
        try:
            ref_end = end.replace(year=end.year - y)
        except ValueError:  # 29 Feb
            ref_end = end.replace(year=end.year - y, day=28)
        ref = [by_date.get(ref_end - timedelta(days=i)) for i in range(WATER_BALANCE_WINDOW_DAYS)]
        if all(r is not None for r in ref):
            reference.append(water_balance([r["precip"] for r in ref], [r["et0"] for r in ref]))
    z = standardized_anomaly(wb_now, reference)

    last30 = [daily_gdd(d["tmax"], d["tmin"]) for d in win]
    gdd_30 = sum(g for g in last30 if g is not None)
    gdd_season = None
    if sowing_date and sowing_date <= end:
        gdd_season = sum(daily_gdd(d["tmax"], d["tmin"]) or 0.0
                         for dt, d in by_date.items() if sowing_date <= dt <= end)

    return {
        "as_of": end.isoformat(),
        "gdd_base_c": GDD_BASE_C,
        "gdd_last_30d": round(gdd_30, 1),
        "gdd_since_sowing": round(gdd_season, 1) if gdd_season is not None else None,
        "precip_30d_mm": round(sum(d["precip"] or 0.0 for d in win), 1),
        "et0_30d_mm": round(sum(d["et0"] or 0.0 for d in win), 1),
        "water_balance_30d_mm": round(wb_now, 1),
        "drought_index": round(z, 2) if z is not None else None,
        "drought_category": drought_category(z),
        "drought_method": f"standardized anomaly of 30-day P-ET0 vs same window in {len(reference)} prior years",
        "climatology_years_used": len(reference),
    }


# ── Network ─────────────────────────────────────────────────────────

def _parse(daily: Dict[str, List]) -> List[Dict[str, Any]]:
    out = []
    for i, t in enumerate(daily.get("time", [])):
        out.append({
            "date": date.fromisoformat(t),
            "tmax": daily["temperature_2m_max"][i], "tmin": daily["temperature_2m_min"][i],
            "precip": daily["precipitation_sum"][i], "et0": daily["et0_fao_evapotranspiration"][i],
        })
    return out


def fetch_daily(lat: float, lon: float, today: date) -> List[Dict[str, Any]]:
    """ERA5 archive for the climatology + forecast endpoint (past_days) for the archive lag."""
    start = date(today.year - CLIMATOLOGY_YEARS, 1, 1) - timedelta(days=WATER_BALANCE_WINDOW_DAYS + 5)
    arch = requests.get(ARCHIVE_URL, params={
        "latitude": lat, "longitude": lon, "start_date": start.isoformat(),
        "end_date": (today - timedelta(days=1)).isoformat(), "daily": ",".join(DAILY_VARS),
        "timezone": "auto"}, timeout=HTTP_TIMEOUT_S)
    arch.raise_for_status()
    days = {d["date"]: d for d in _parse(arch.json().get("daily", {})) if d["tmax"] is not None}
    recent = requests.get(FORECAST_URL, params={
        "latitude": lat, "longitude": lon, "past_days": 14, "forecast_days": 1,
        "daily": ",".join(DAILY_VARS), "timezone": "auto"}, timeout=HTTP_TIMEOUT_S)
    recent.raise_for_status()
    for d in _parse(recent.json().get("daily", {})):
        if d["date"] <= today and d["tmax"] is not None and d["date"] not in days:
            days[d["date"]] = d   # fills the ~5-day ERA5 lag
    return [days[k] for k in sorted(days)]


def get_agro_indices(lat: float, lon: float, sowing_date: Optional[date] = None, db=None) -> Dict[str, Any]:
    """Indices with provenance; cached in ``weather_index_snapshots`` for CACHE_TTL_HOURS."""
    from app.models.vegetation import WeatherIndexSnapshot
    from app.db.database import SessionLocal

    today = date.today()
    lat_r, lon_r = round(lat, 3), round(lon, 3)
    sow_key = sowing_date.isoformat() if sowing_date else ""
    own = db is None
    db = db or SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=CACHE_TTL_HOURS)
        hit = (db.query(WeatherIndexSnapshot)
               .filter(WeatherIndexSnapshot.lat == lat_r, WeatherIndexSnapshot.lon == lon_r,
                       WeatherIndexSnapshot.sowing_key == sow_key)
               .order_by(WeatherIndexSnapshot.fetched_at.desc()).first())
        if hit and hit.fetched_at and hit.fetched_at.replace(tzinfo=hit.fetched_at.tzinfo or timezone.utc) > cutoff:
            payload = json.loads(hit.payload)
            payload["cache"] = "hit"
            return payload

        days = fetch_daily(lat_r, lon_r, today)
        payload = compute_indices(days, today, sowing_date)
        payload.update({
            "source": "open-meteo (ERA5 archive + forecast past_days)",
            "lat": lat_r, "lon": lon_r,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        })
        db.add(WeatherIndexSnapshot(lat=lat_r, lon=lon_r, sowing_key=sow_key, payload=json.dumps(payload)))
        db.commit()
        payload["cache"] = "miss"
        return payload
    except Exception as exc:
        logger.warning("agro_weather_failed: %s", exc)
        return {"source": "unavailable", "error": str(exc), "lat": lat_r, "lon": lon_r}
    finally:
        if own:
            db.close()
