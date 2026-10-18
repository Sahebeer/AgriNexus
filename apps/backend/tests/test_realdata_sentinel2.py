"""Pure-logic tests for the real Sentinel-2 pipeline (no network)."""

import numpy as np
import pytest
from shapely.geometry import box

from app.services.realdata import sentinel2 as s2
from app.services.realdata.geometry import GeometryError, area_summary, geometry_key, parse_field_geometry


def test_reflectance_scale_and_nodata():
    dn = np.array([[0, 1000, 5000]], dtype=np.uint16)
    refl = s2.to_reflectance(dn, scale=0.0001, offset=0.0, nodata=0)
    assert np.isnan(refl[0, 0])
    assert refl[0, 1] == pytest.approx(0.1)
    assert refl[0, 2] == pytest.approx(0.5)


def test_effective_offset_skips_already_applied_boa_offset():
    assert s2.effective_offset({"earthsearch:boa_offset_applied": True}, -0.1) == 0.0
    assert s2.effective_offset({"earthsearch:boa_offset_applied": False}, -0.1) == -0.1
    assert s2.effective_offset({}, -0.1) == -0.1


def test_ndvi_and_friends_known_values():
    red = np.array([0.05, 0.10, 0.20], dtype=np.float32)
    nir = np.array([0.45, 0.30, 0.20], dtype=np.float32)
    green = np.array([0.08, 0.08, 0.08], dtype=np.float32)
    blue = np.array([0.03, 0.03, 0.03], dtype=np.float32)
    idx = s2.compute_indices(red, nir, green, blue)
    assert idx["ndvi"] == pytest.approx([0.8, 0.5, 0.0], abs=1e-6)
    # SAVI with L=0.5: (0.40/1.0)*1.5 = 0.6 for the first pixel
    assert idx["savi"][0] == pytest.approx(0.6, abs=1e-6)
    # NDWI (McFeeters): (0.08-0.45)/(0.53)
    assert idx["ndwi"][0] == pytest.approx(-0.37 / 0.53, abs=1e-6)
    # EVI: 2.5*0.40/(0.45+0.30-0.225+1) = 1.0/1.525
    assert idx["evi"][0] == pytest.approx(1.0 / 1.525, abs=1e-5)


def test_ndvi_division_by_zero_is_nan_not_crash():
    idx = s2.compute_indices(np.array([0.0]), np.array([0.0]))
    assert np.isnan(idx["ndvi"][0])


def test_scl_cloud_shadow_snow_masked_vegetation_kept():
    scl = np.array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], dtype=np.uint8)
    valid = s2.scl_valid_mask(scl)
    assert valid.tolist() == [False, False, True, False, True, True, True, True,
                              False, False, False, False]


def test_zonal_stats_valid_pct_relative_to_field_not_bbox():
    ndvi = np.full((4, 4), 0.6, dtype=np.float32)
    field = np.zeros((4, 4), dtype=bool)
    field[1:3, 1:3] = True                       # 4 field pixels inside a 16-pixel bbox
    valid = np.ones((4, 4), dtype=bool)
    valid[1, 1] = False                          # one cloudy pixel inside the field
    ndvi[0, 0] = -1.0                            # outside field: must not affect stats
    st = s2.zonal_stats(ndvi, field, valid)
    assert st["field_pixel_count"] == 4
    assert st["valid_pixel_count"] == 3
    assert st["valid_pixel_pct"] == 75.0
    assert st["mean"] == pytest.approx(0.6)


def test_zonal_stats_fully_clouded():
    st = s2.zonal_stats(np.ones((2, 2)), np.ones((2, 2), bool), np.zeros((2, 2), bool))
    assert st["mean"] is None and st["valid_pixel_pct"] == 0.0


def _feat(fid, dt, cloud, geom):
    return {"id": fid, "geometry": geom, "properties": {"datetime": dt, "eo:cloud_cover": cloud}}


def test_select_scenes_prefers_containing_tile_then_low_cloud():
    field = box(74.10, 20.07, 74.11, 20.08)
    covering = {"type": "Polygon", "coordinates": [[[74, 20], [75, 20], [75, 21], [74, 21], [74, 20]]]}
    partial = {"type": "Polygon", "coordinates": [[[74.105, 20], [75, 20], [75, 21], [74.105, 21], [74.105, 20]]]}
    feats = [
        _feat("A_partial_clear", "2026-10-01T05:00:00Z", 1.0, partial),
        _feat("A_full_cloudier", "2026-10-01T05:00:00Z", 5.0, covering),
        _feat("B", "2026-10-20T05:00:00Z", 30.0, covering),
    ]
    chosen = s2.select_scenes(feats, field, bin_days=7)
    ids = [c["feature"]["id"] for c in chosen]
    assert ids == ["A_full_cloudier", "B"]


def test_geometry_parse_formats_and_errors():
    ring = [[74.1085, 20.0760], [74.1145, 20.0755], [74.1162, 20.0805], [74.1118, 20.0825], [74.1072, 20.0798]]
    g = parse_field_geometry(ring)
    assert 49 < area_summary(g)["hectares"] < 52        # demo farm is ~50 ha, not 12.4
    assert geometry_key(g) == geometry_key(parse_field_geometry({"type": "Polygon", "coordinates": [ring + [ring[0]]]}))
    with pytest.raises(GeometryError):
        parse_field_geometry({"type": "Point", "coordinates": [74.1, 20.1]})
    with pytest.raises(GeometryError):
        parse_field_geometry([[20.07, 174.1], [20.08, 174.1], [20.08, 174.2]])   # lat/lon swapped -> out of range
