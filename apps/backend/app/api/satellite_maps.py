"""
AgriNexus AI - Smart Satellite Maps & Farm Intelligence API Router.
Handles interactive polygon boundary analysis, geodesic area calculations,
multi-spectral heatmaps (NDVI, Moisture, Crop Health, Barren Land),
and structured AI farm reasoning.
"""

from typing import Any, List, Optional, Dict
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api import deps
from app.db.database import get_db
from app.models.user import User
from app.models.farm import Farm
from app.services.geospatial.geometry import calculate_geodesic_area
from app.services.barren_land import detect_nearby_barren_land
from app.services.satellite_provider import get_default_satellite_provider
from app.services.realdata.geometry import GeometryError

router = APIRouter()


# ─── Pydantic Request / Response Models ──────────────────────────────────────

class BoundaryAnalysisRequest(BaseModel):
    boundary: List[Any] = Field(..., description="List of [lon, lat] coordinate pairs forming a closed polygon.")
    crop: Optional[str] = "Wheat"
    farm_name: Optional[str] = "Custom Farm Field"


class AreaCalculationRequest(BaseModel):
    boundary: List[Any] = Field(..., description="List of [lon, lat] coordinate pairs.")


class AreaCalculationResponse(BaseModel):
    square_meters: float
    hectares: float
    acres: float


# ─── Endpoints ───────────────────────────────────────────────────────────────

def _boundary_ring(boundary_geojson: str) -> List[List[float]]:
    """Outer ring ([lon, lat] pairs) of a stored Polygon / MultiPolygon / Feature boundary."""
    import json
    geom = json.loads(boundary_geojson)
    if geom.get("type") == "FeatureCollection":
        geom = (geom.get("features") or [{}])[0].get("geometry") or {}
    if geom.get("type") == "Feature":
        geom = geom.get("geometry") or {}
    if geom.get("type") == "Polygon":
        return geom["coordinates"][0]
    if geom.get("type") == "MultiPolygon":
        return geom["coordinates"][0][0]
    raise ValueError(f"unsupported boundary type {geom.get('type')!r}")


@router.get("/farms/{farm_id}", status_code=status.HTTP_200_OK)
def get_owned_farm_analysis(
    farm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Multi-spectral analysis of one of the current user's own farms, using its stored boundary.
    Farms owned by other accounts return 404, exactly like farms that do not exist.
    """
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm field not found or unauthorized")
    if not farm.boundary_geojson:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="This farm has no boundary yet. Draw it on the map or import a KML/GeoJSON file.")
    try:
        ring = _boundary_ring(farm.boundary_geojson)
        provider = get_default_satellite_provider()
        try:
            result = provider.get_farm_analysis(boundary_coordinates=ring, crop=farm.current_crop or "Unknown crop",
                                                farm_name=farm.name, farm_id=farm.id)
        except TypeError:  # providers without the farm_id argument
            result = provider.get_farm_analysis(boundary_coordinates=ring, crop=farm.current_crop or "Unknown crop",
                                                farm_name=farm.name)
    except (ValueError, KeyError, GeometryError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Stored boundary is invalid: {e}")
    result["db_farm_id"] = farm.id
    result["location"] = ", ".join(x for x in (farm.village, farm.district, farm.state) if x)
    return result


@router.post("/analyze-boundary", status_code=status.HTTP_200_OK)
def analyze_custom_farm_boundary(
    payload: BoundaryAnalysisRequest,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Ingests a user-drawn boundary polygon, computes exact geodesic area,
    partitions into micro-zones, extracts multi-spectral indices, and yields AI farm reasoning.
    """
    if not payload.boundary or len(payload.boundary) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A polygon boundary requires at least 3 distinct geographic coordinate vertices."
        )

    provider = get_default_satellite_provider()
    try:
        result = provider.get_farm_analysis(
            boundary_coordinates=payload.boundary,
            crop=payload.crop or "Wheat",
            farm_name=payload.farm_name or "Custom Farm Field"
        )
        return result
    except GeometryError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze farm boundary: {str(e)}"
        )


@router.post("/calculate-area", response_model=AreaCalculationResponse, status_code=status.HTTP_200_OK)
def compute_polygon_area(
    payload: AreaCalculationRequest
) -> Any:
    """
    Calculates precise WGS84 geodesic area in square meters, hectares, and acres.
    """
    if not payload.boundary or len(payload.boundary) < 3:
        return {"square_meters": 0.0, "hectares": 0.0, "acres": 0.0}

    return calculate_geodesic_area(payload.boundary)


@router.get("/barren-land", status_code=status.HTTP_200_OK)
def get_nearby_barren_land(
    lat: float = Query(..., description="Center latitude"),
    lon: float = Query(..., description="Center longitude"),
    radius_km: float = Query(2.0, description="Search radius in kilometers"),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Discovers candidate unutilized or barren land parcels surrounding the specified coordinates.
    """
    return detect_nearby_barren_land(center_lat=lat, center_lon=lon, radius_km=radius_km)
