"""Pure-logic tests for agro-weather indices (no network)."""

from datetime import date, timedelta

import pytest

from app.services.realdata import agro_weather as aw


def test_daily_gdd():
    assert aw.daily_gdd(30, 20, base=10) == 15
    assert aw.daily_gdd(8, 2, base=10) == 0          # never negative
    assert aw.daily_gdd(None, 20) is None


def test_water_balance_treats_missing_as_zero():
    assert aw.water_balance([10, None, 5], [4, 4, None]) == pytest.approx(7)


def test_standardized_anomaly_and_categories():
    assert aw.standardized_anomaly(0, [10, 20, 30]) == pytest.approx((0 - 20) / 8.16496, rel=1e-4)
    assert aw.standardized_anomaly(5, [1, 2]) is None    # too few reference years
    assert aw.drought_category(-2.5) == "extreme drought"
    assert aw.drought_category(-1.2) == "moderate drought"
    assert aw.drought_category(0.0) == "near normal"
    assert aw.drought_category(None) == "unknown"


def _synthetic_days(today, dry_this_year):
    days = []
    d = date(today.year - aw.CLIMATOLOGY_YEARS, 1, 1) - timedelta(days=40)
    while d <= today:
        recent = (today - d).days < 30
        precip = 0.0 if (recent and dry_this_year) else 3.0
        days.append({"date": d, "tmax": 30.0, "tmin": 20.0, "precip": precip,
                     "et0": 4.0 + (0.1 * (d.year % 3))})   # small year-to-year variance
        d += timedelta(days=1)
    return days


def test_compute_indices_flags_dry_month_against_climatology():
    today = date(2026, 10, 19)
    res = aw.compute_indices(_synthetic_days(today, dry_this_year=True), today, sowing_date=date(2026, 10, 1))
    assert res["water_balance_30d_mm"] < -100
    assert res["drought_index"] < -2
    assert res["climatology_years_used"] == aw.CLIMATOLOGY_YEARS
    assert res["gdd_last_30d"] == pytest.approx(30 * 15)
    assert res["gdd_since_sowing"] == pytest.approx(19 * 15)


def test_compute_indices_normal_month_is_near_normal():
    today = date(2026, 10, 19)
    res = aw.compute_indices(_synthetic_days(today, dry_this_year=False), today)
    assert res["drought_category"] == "near normal"
    assert res["gdd_since_sowing"] is None
