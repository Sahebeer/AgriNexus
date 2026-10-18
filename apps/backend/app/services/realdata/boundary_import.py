"""Parse field boundaries from KML, KMZ (all .kml files inside) and GeoJSON uploads.

- Keeps MultiPolygons (MultiGeometry with several Polygons) and inner rings (holes).
- Strips altitude; validates/repairs via ``geometry.parse_field_geometry``.
- Ignores Points/LineStrings but reports them, so users know why nothing imported.
Written for AgriNexus (idea from GeoKML's KML/KMZ import; no code copied).
"""

from __future__ import annotations

import io
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional

from shapely.geometry import MultiPolygon, Polygon, mapping
from shapely.ops import unary_union

from app.services.realdata.geometry import (
    GeometryError, area_summary, centroid_latlon, parse_field_geometry,
)

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_KMZ_UNCOMPRESSED_BYTES = 20 * 1024 * 1024
MAX_KMZ_ENTRIES = 200


class BoundaryImportError(ValueError):
    pass


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _children(el, name):
    return [c for c in el if _local(c.tag) == name]


def _find_all(el, name):
    return [c for c in el.iter() if _local(c.tag) == name]


def parse_kml_coordinates(text: str) -> List[List[float]]:
    """'lon,lat[,alt] lon,lat[,alt] ...' -> [[lon, lat], ...] (altitude dropped)."""
    pts = []
    for tok in (text or "").replace("\n", " ").replace("\t", " ").split():
        parts = tok.split(",")
        if len(parts) < 2:
            raise BoundaryImportError(f"Malformed KML coordinate '{tok}'.")
        try:
            pts.append([float(parts[0]), float(parts[1])])
        except ValueError as exc:
            raise BoundaryImportError(f"Non-numeric KML coordinate '{tok}'.") from exc
    return pts


def _ring(boundary_el) -> Optional[List[List[float]]]:
    rings = _find_all(boundary_el, "coordinates")
    return parse_kml_coordinates(rings[0].text) if rings else None


def _kml_polygon(poly_el) -> Polygon:
    outer_el = next(iter(_children(poly_el, "outerBoundaryIs")), None)
    outer = _ring(outer_el) if outer_el is not None else None
    if not outer or len(outer) < 3:
        raise BoundaryImportError("KML Polygon has no outer boundary with at least 3 points.")
    holes = [h for h in (_ring(i) for i in _children(poly_el, "innerBoundaryIs")) if h and len(h) >= 3]
    return Polygon(outer, holes)


def parse_kml(data: bytes, source_name: str = "doc.kml") -> List[Dict[str, Any]]:
    head = data[:4096].decode("utf-8", "ignore")
    if re.search(r"<!(DOCTYPE|ENTITY)", head, re.IGNORECASE) or b"<!ENTITY" in data:
        raise BoundaryImportError("KML with DTD/entity declarations is not accepted.")
    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        raise BoundaryImportError(f"{source_name}: not valid XML ({exc}).") from exc

    out = []
    for i, pm in enumerate(_find_all(root, "Placemark")):
        name_el = next(iter(_children(pm, "name")), None)
        name = (name_el.text or "").strip() if name_el is not None else f"Placemark {i + 1}"
        polys = [_kml_polygon(p) for p in _find_all(pm, "Polygon")]
        other = [_local(e.tag) for e in pm.iter() if _local(e.tag) in ("Point", "LineString")]
        if not polys:
            out.append({"name": name, "source": source_name, "skipped": f"no polygon ({', '.join(other) or 'empty'})"})
            continue
        geom = polys[0] if len(polys) == 1 else MultiPolygon(polys)
        out.append({"name": name, "source": source_name, "raw": geom})
    return out


def parse_kmz(data: bytes) -> List[Dict[str, Any]]:
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise BoundaryImportError("KMZ is not a valid zip archive.") from exc
    infos = zf.infolist()
    if len(infos) > MAX_KMZ_ENTRIES or sum(i.file_size for i in infos) > MAX_KMZ_UNCOMPRESSED_BYTES:
        raise BoundaryImportError("KMZ is too large when uncompressed.")
    kmls = [i for i in infos if i.filename.lower().endswith(".kml") and not i.filename.startswith("__MACOSX")]
    if not kmls:
        raise BoundaryImportError("KMZ contains no .kml file.")
    out = []
    for info in kmls:
        out.extend(parse_kml(zf.read(info), info.filename))
    return out


def parse_geojson(data: bytes) -> List[Dict[str, Any]]:
    try:
        obj = json.loads(data.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise BoundaryImportError(f"Not valid GeoJSON: {exc}") from exc
    feats = obj.get("features") if isinstance(obj, dict) and obj.get("type") == "FeatureCollection" else [obj]
    out = []
    for i, f in enumerate(feats):
        props = (f.get("properties") or {}) if isinstance(f, dict) else {}
        name = props.get("name") or f"Feature {i + 1}"
        gtype = (f.get("geometry") or {}).get("type") if f.get("type") == "Feature" else f.get("type")
        if gtype not in ("Polygon", "MultiPolygon"):
            out.append({"name": name, "source": "geojson", "skipped": f"geometry type {gtype}"})
            continue
        out.append({"name": name, "source": "geojson", "raw_geojson": f})
    return out


def import_boundary(filename: str, data: bytes) -> Dict[str, Any]:
    """Parse an upload into validated polygon features plus their union."""
    if len(data) > MAX_UPLOAD_BYTES:
        raise BoundaryImportError(f"File too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB).")
    lower = (filename or "").lower()
    if lower.endswith(".kmz") or data[:2] == b"PK":
        items = parse_kmz(data)
    elif lower.endswith(".kml") or data.lstrip()[:1] == b"<":
        items = parse_kml(data, filename or "upload.kml")
    elif lower.endswith((".geojson", ".json")) or data.lstrip()[:1] == b"{":
        items = parse_geojson(data)
    else:
        raise BoundaryImportError("Unsupported file type. Upload .kml, .kmz, .geojson or .json.")

    features, skipped = [], []
    for it in items:
        if "skipped" in it:
            skipped.append({"name": it["name"], "reason": it["skipped"]})
            continue
        try:
            geom = parse_field_geometry(it.get("raw_geojson") or mapping(it["raw"]))
        except GeometryError as exc:
            skipped.append({"name": it["name"], "reason": str(exc)})
            continue
        features.append({"name": it["name"], "source": it["source"], "geometry": mapping(geom),
                         "geometry_type": geom.geom_type, "area": area_summary(geom), "_geom": geom})

    if not features:
        reasons = "; ".join(f"{s['name']}: {s['reason']}" for s in skipped[:5]) or "file has no placemarks/features"
        raise BoundaryImportError(f"No usable field polygons found ({reasons}).")

    merged = unary_union([f.pop("_geom") for f in features])
    merged = parse_field_geometry(mapping(merged))
    return {
        "features": features,
        "skipped": skipped,
        "merged": {"geometry": mapping(merged), "geometry_type": merged.geom_type,
                   "area": area_summary(merged), "centroid": list(centroid_latlon(merged))},
    }
