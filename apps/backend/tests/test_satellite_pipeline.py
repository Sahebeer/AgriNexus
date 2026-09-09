"""
AgriNexus AI - Satellite SAR Pipeline Tests
Tests:
- Sentinel-1 SAR provider interface
- Radiometric calibration & decibel index derivation (VV, VH, VV/VH ratio, RVI)
- Temporal dynamics and anomaly detection
- Baseline agricultural SAR model classification
"""

import pytest
from datetime import date, timedelta

from ml.satellite.preprocessing.calibration import (
    calculate_sar_indices,
    linear_to_db,
    db_to_linear
)
from ml.satellite.features import extract_temporal_features
from ml.satellite.model import AgriculturalSARModel
from app.services.sar.provider import Sentinel1STACProvider


def test_linear_and_db_conversion():
    # 0.1 linear intensity should be -10 dB
    db = linear_to_db(0.1)
    assert abs(db - (-10.0)) < 1e-4

    # -20 dB should be 0.01 linear intensity
    lin = db_to_linear(-20.0)
    assert abs(lin - 0.01) < 1e-4


def test_sar_polarization_indices():
    vv = -12.0
    vh = -18.0
    indices = calculate_sar_indices(vv, vh)

    assert indices["vv_db"] == -12.0
    assert indices["vh_db"] == -18.0
    # VV / VH dB difference: -12.0 - (-18.0) = 6.0 dB
    assert indices["vv_vh_ratio"] == 6.0
    # Radar vegetation index should be bounded between 0 and 1
    assert 0.0 <= indices["radar_vegetation_index"] <= 1.0


def test_sar_temporal_feature_extraction():
    # Sequence of 3 observations with increasing moisture (VV surge)
    history = [
        {"acquisition_date": "2026-08-01", "vv": -14.0, "vh": -19.0, "vv_vh_ratio": 5.0},
        {"acquisition_date": "2026-08-13", "vv": -13.5, "vh": -18.5, "vv_vh_ratio": 5.0},
        {"acquisition_date": "2026-08-25", "vv": -10.5, "vh": -18.0, "vv_vh_ratio": 7.5}
    ]

    temporal = extract_temporal_features(history)
    assert temporal["has_temporal_history"] is True
    assert temporal["observations_count"] == 3
    # Delta VV between last two passes: -10.5 - (-13.5) = +3.0 dB
    assert temporal["delta_vv"] == 3.0
    assert temporal["trend"] in ["moisture_increase", "vegetation_expansion"]


def test_sar_baseline_model_prediction():
    model = AgriculturalSARModel()

    # Normal vegetative condition
    res_normal = model.predict(vv_db=-12.0, vh_db=-18.0, vv_vh_ratio=6.0, rvi=0.55, delta_vv=0.2, delta_vh=0.1)
    assert res_normal["condition"] == "normal"
    assert res_normal["confidence"] >= 0.80

    # Moisture surge
    res_moist = model.predict(vv_db=-7.0, vh_db=-17.0, vv_vh_ratio=10.0, rvi=0.45, delta_vv=3.5, delta_vh=0.0)
    assert res_moist["condition"] == "excess_moisture"

    # Drought stress
    res_drought = model.predict(vv_db=-17.5, vh_db=-21.0, vv_vh_ratio=3.5, rvi=0.30, delta_vv=-2.2, delta_vh=-0.5)
    assert res_drought["condition"] == "moisture_deficit"


def test_sentinel1_stac_provider():
    provider = Sentinel1STACProvider()
    today = date.today()
    passes = provider.search(
        geometry={"type": "Point", "coordinates": [75.85, 30.90]},
        start_date=today - timedelta(days=15),
        end_date=today
    )
    assert len(passes) > 0
    assert passes[0]["satellite"] == "Sentinel-1"

    downloaded = provider.download(passes[0])
    assert "vv" in downloaded
    assert "vh" in downloaded
    assert downloaded["status"] == "calibrated"
