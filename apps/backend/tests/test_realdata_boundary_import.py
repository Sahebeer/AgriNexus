"""KML / KMZ / GeoJSON boundary import tests (no network)."""

import io
import zipfile
from pathlib import Path

import pytest

from app.services.realdata.boundary_import import (
    BoundaryImportError, import_boundary, parse_kml_coordinates,
)

FIX = Path(__file__).parent / "fixtures"


def test_coordinates_strip_altitude():
    assert parse_kml_coordinates(" 74.1,20.0,512\n74.2,20.1 ") == [[74.1, 20.0], [74.2, 20.1]]
    with pytest.raises(BoundaryImportError):
        parse_kml_coordinates("74.1")


def test_kml_polygons_multigeometry_holes_and_skipped_point():
    res = import_boundary("niphad_fields.kml", (FIX / "niphad_fields.kml").read_bytes())
    names = [f["name"] for f in res["features"]]
    assert names == ["Main block", "Split plot with well"]
    main, split = res["features"]
    assert main["geometry_type"] == "Polygon"
    assert all(len(pt) == 2 for pt in main["geometry"]["coordinates"][0])       # altitude stripped
    assert split["geometry_type"] == "MultiPolygon"
    assert len(split["geometry"]["coordinates"][0]) == 2                         # outer + hole kept
    assert res["skipped"] == [{"name": "Pump house", "reason": "no polygon (Point)"}]
    assert res["merged"]["geometry_type"] == "MultiPolygon"
    assert 50 < res["merged"]["area"]["hectares"] < 60


def test_kmz_reads_every_kml_inside():
    kml = (FIX / "niphad_fields.kml").read_bytes()
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("doc.kml", kml)
        zf.writestr("layers/second.kml", kml.replace(b"Main block", b"Second file block"))
        zf.writestr("images/icon.png", b"\x89PNG")
    res = import_boundary("fields.kmz", buf.getvalue())
    assert {f["source"] for f in res["features"]} == {"doc.kml", "layers/second.kml"}
    assert "Second file block" in [f["name"] for f in res["features"]]


def test_geojson_feature_collection():
    res = import_boundary("field.geojson", (FIX / "niphad_field.geojson").read_bytes())
    assert len(res["features"]) == 1 and res["merged"]["geometry_type"] == "Polygon"


def test_self_intersecting_polygon_is_repaired_not_crash():
    bowtie = b'{"type":"Polygon","coordinates":[[[74.10,20.07],[74.11,20.08],[74.11,20.07],[74.10,20.08],[74.10,20.07]]]}'
    res = import_boundary("bowtie.geojson", bowtie)
    assert res["merged"]["area"]["hectares"] > 0


@pytest.mark.parametrize("name,data,msg", [
    ("x.kml", b"<kml><Document><Placemark><Point><coordinates>1,2</coordinates></Point></Placemark></Document></kml>", "No usable field polygons"),
    ("x.kml", b"<kml><unclosed>", "not valid XML"),
    ("x.kml", b'<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa">]><kml/>', "DTD/entity"),
    ("x.kmz", b"PK\x03\x04garbage", "not a valid zip"),
    ("x.txt", b"hello", "Unsupported file type"),
    ("x.geojson", b'{"type":"Point","coordinates":[74,20]}', "No usable field polygons"),
])
def test_clear_errors(name, data, msg):
    with pytest.raises(BoundaryImportError, match=msg):
        import_boundary(name, data)
