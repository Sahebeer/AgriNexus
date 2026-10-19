"""Field geometry helpers: parse, validate, measure.

Accepts every boundary shape the app already uses (bare ring ``[[lon, lat], ...]``,
GeoJSON Polygon / MultiPolygon geometry, Feature, FeatureCollection) and returns a
validated 2D shapely geometry in WGS84 (EPSG:4326, lon/lat order), matching the
``farms.boundary_geojson`` text column.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, Tuple, Union

from pyproj import Geod
from shapely import set_precision
from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union
from shapely.validation import explain_validity, make_valid

_GEOD = Geod(ellps="WGS84")

# Hard limits keep a single request from pulling a whole Sentinel-2 tile.
MAX_FIELD_AREA_HA = 5000.0
MIN_FIELD_AREA_HA = 0.01


class GeometryError(ValueError):
    """Raised with a human-readable message when a boundary cannot be used."""


def _strip_z(coords: Any) -> Any:
    if isinstance(coords, (list, tuple)) and coords and isinstance(coords[0], (int, float)):
        return [float(coords[0]), float(coords[1])]
    return [_strip_z(c) for c in coords]


def _to_geojson_geometry(obj: Any) -> Dict[str, Any]:
    if isinstance(obj, str):
        try:
            obj = json.loads(obj)
        except json.JSONDecodeError as exc:
            raise GeometryError(f"Boundary is not valid JSON: {exc}") from exc

    if isinstance(obj, list):
        # Bare ring [[lon, lat], ...] (what the satellite page posts) or ring list.
        if obj and isinstance(obj[0], (list, tuple)) and obj[0] and isinstance(obj[0][0], (int, float)):
            return {"type": "Polygon", "coordinates": [obj]}
        return {"type": "Polygon", "coordinates": obj}

    if not isinstance(obj, dict) or "type" not in obj:
        raise GeometryError("Boundary must be a GeoJSON geometry, Feature, or coordinate ring.")

    gtype = obj["type"]
    if gtype == "Feature":
        if not obj.get("geometry"):
            raise GeometryError("GeoJSON Feature has no geometry.")
        return _to_geojson_geometry(obj["geometry"])
    if gtype == "FeatureCollection":
        geoms = [_to_geojson_geometry(f) for f in obj.get("features", []) if f.get("geometry")]
        polys = [g for g in geoms if g["type"] in ("Polygon", "MultiPolygon")]
        if not polys:
            raise GeometryError("FeatureCollection contains no Polygon/MultiPolygon features.")
        merged = unary_union([shape(g) for g in polys])
        return mapping(merged)
    if gtype in ("Polygon", "MultiPolygon"):
        return {"type": gtype, "coordinates": obj.get("coordinates")}
    raise GeometryError(f"Unsupported geometry type '{gtype}'. Fields must be Polygon or MultiPolygon.")


def parse_field_geometry(obj: Any) -> Union[Polygon, MultiPolygon]:
    """Parse and validate a field boundary. Raises GeometryError with a clear reason."""
    gj = _to_geojson_geometry(obj)
    try:
        gj["coordinates"] = _strip_z(gj["coordinates"])
        geom: BaseGeometry = shape(gj)
    except Exception as exc:
        raise GeometryError(f"Could not build polygon from coordinates: {exc}") from exc

    if geom.is_empty:
        raise GeometryError("Boundary is empty.")

    minx, miny, maxx, maxy = geom.bounds
    if not (-180 <= minx <= 180 and -180 <= maxx <= 180 and -90 <= miny <= 90 and -90 <= maxy <= 90):
        raise GeometryError("Coordinates are out of WGS84 range. Expected [longitude, latitude] order.")

    if not geom.is_valid:
        reason = explain_validity(geom)
        fixed = make_valid(geom)
        polys = [g for g in getattr(fixed, "geoms", [fixed]) if isinstance(g, (Polygon, MultiPolygon))]
        if not polys:
            raise GeometryError(f"Invalid polygon ({reason}) and it could not be repaired.")
        geom = unary_union(polys)
        if not geom.is_valid or geom.is_empty:
            raise GeometryError(f"Invalid polygon ({reason}).")

    if not isinstance(geom, (Polygon, MultiPolygon)):
        raise GeometryError(f"Boundary resolved to {geom.geom_type}, expected a polygon.")

    area_ha = geodesic_area_ha(geom)
    if area_ha < MIN_FIELD_AREA_HA:
        raise GeometryError(f"Field is too small ({area_ha:.4f} ha). Minimum is {MIN_FIELD_AREA_HA} ha.")
    if area_ha > MAX_FIELD_AREA_HA:
        raise GeometryError(f"Field is too large ({area_ha:.0f} ha). Maximum is {MAX_FIELD_AREA_HA:.0f} ha.")
    # Hand-drawn rings often repeat a vertex (e.g. clicking the start point to close);
    # simplify(0) drops consecutive duplicates without moving any real vertex.
    return geom.simplify(0, preserve_topology=True)


def geodesic_area_ha(geom: BaseGeometry) -> float:
    area_m2, _ = _GEOD.geometry_area_perimeter(geom)
    return abs(area_m2) / 10_000.0


def area_summary(geom: BaseGeometry) -> Dict[str, float]:
    ha = geodesic_area_ha(geom)
    return {
        "square_meters": round(ha * 10_000.0, 2),
        "hectares": round(ha, 4),
        "acres": round(ha * 2.4710538, 4),
    }


def centroid_latlon(geom: BaseGeometry) -> Tuple[float, float]:
    # representative_point is guaranteed inside the field (centroid of an L-shape may not be).
    pt = geom.representative_point() if not geom.centroid.within(geom) else geom.centroid
    return round(pt.y, 6), round(pt.x, 6)


def geometry_key(geom: BaseGeometry) -> str:
    """Stable cache key for a geometry (coordinates rounded to ~1 cm)."""
    snapped = set_precision(geom, 1e-7).normalize()
    return hashlib.sha1(snapped.wkt.encode()).hexdigest()


def to_geojson_text(geom: BaseGeometry) -> str:
    """Serialize to the same text format stored in ``farms.boundary_geojson``."""
    return json.dumps(mapping(geom), separators=(",", ":"))
