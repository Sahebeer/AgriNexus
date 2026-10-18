"""Pure-logic tests for SoilGrids estimates (WCS mocked)."""

import io

import numpy as np
import pytest

from app.services.realdata import soilgrids as sg


def test_texture_triangle_known_points():
    assert sg.classify_texture_usda(24, 34, 42) == "clay"          # Nashik vertisol
    assert sg.classify_texture_usda(92, 5, 3) == "sand"
    assert sg.classify_texture_usda(40, 40, 20) == "loam"
    assert sg.classify_texture_usda(20, 65, 15) == "silt loam"
    assert sg.classify_texture_usda(None, 40, 20) is None
    assert sg.to_app_texture("clay") == "Clayey"
    assert sg.to_app_texture("sandy loam") == "Sandy"
    assert sg.to_app_texture("clay loam") == "Loamy"


def test_sample_window_centre_then_neighbourhood_then_none():
    w = np.full((7, 7), 70, dtype=np.int16)
    assert sg.sample_window(w, 0) == (70.0, "centroid pixel", 1)
    w[3, 3] = 0
    w[0, :] = 80
    val, method, n = sg.sample_window(w, 0)
    assert method.startswith("median") and n == 48 and val == 70.0
    assert sg.sample_window(np.zeros((7, 7)), 0)[0] is None


def test_depth_weighting_uses_layer_thickness():
    layers = [{"ph_h2o": 6.0}, {"ph_h2o": 7.0}, {"ph_h2o": 8.0}]    # 5, 10, 15 cm thick
    assert sg.depth_weighted(layers, "ph_h2o") == pytest.approx((6 * 5 + 7 * 10 + 8 * 15) / 30, abs=0.01)
    assert sg.depth_weighted([{}, {}, {}], "ph_h2o") is None


def _tiff_bytes(value):
    import rasterio
    from rasterio.transform import from_origin
    buf = io.BytesIO()
    arr = np.full((7, 7), value, dtype=np.int16)
    with rasterio.MemoryFile() as mem:
        with mem.open(driver="GTiff", width=7, height=7, count=1, dtype="int16",
                      transform=from_origin(0, 0, 250, 250)) as ds:
            ds.write(arr, 1)
        buf.write(mem.read())
    return buf.getvalue()


class _Resp:
    def __init__(self, content):
        self.status_code = 200
        self.headers = {"content-type": "image/tiff"}
        self.content = content


def test_fetch_converts_units_and_never_touches_farmer_data(monkeypatch):
    raw = {"phh2o": 72, "soc": 96, "clay": 420, "sand": 240, "silt": 340,
           "bdod": 155, "nitrogen": 123, "cec": 333}

    def fake_get(url, params, timeout):
        cov = dict(params)["COVERAGEID"]
        return _Resp(_tiff_bytes(raw[cov.split("_")[0]]))

    import requests
    monkeypatch.setattr(requests, "get", fake_get)
    res = sg.fetch_soil_estimate(20.0788, 74.1115)
    top = res["topsoil_0_30cm"]
    assert res["status"] == "estimated" and res["label"] == "estimated, ~250 m resolution"
    assert top["ph_h2o"] == pytest.approx(7.2)
    assert top["clay_pct"] == pytest.approx(42.0)
    assert top["bulk_density_kg_dm3"] == pytest.approx(1.55)
    assert top["total_nitrogen_g_kg"] == pytest.approx(1.23)
    assert res["texture_class_usda"] == "clay"
    assert not any(k in res for k in ("nitrogen", "phosphorus", "potassium"))   # no N/P/K overwrite keys


def test_fetch_all_masked_is_unavailable(monkeypatch):
    import requests
    monkeypatch.setattr(requests, "get", lambda url, params, timeout: _Resp(_tiff_bytes(0)))
    res = sg.fetch_soil_estimate(30.9, 75.85)
    assert res["status"] == "unavailable" and "mask" in res["reason"]
