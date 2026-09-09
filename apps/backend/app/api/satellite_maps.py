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
from app.services.geospatial.geometry import calculate_geodesic_area
from app.services.barren_land import detect_nearby_barren_land
from app.services.satellite_provider import get_default_satellite_provider

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

@router.get("/demo-farm", status_code=status.HTTP_200_OK)
def get_flagship_demo_farm() -> Any:
    """
    Returns the flagship rural Indian demonstration farm (Niphad, Nashik, Maharashtra)
    with all multi-spectral layers, zones, NDVI historical trajectory, and barren land.
    """
    provider = get_default_satellite_provider()
    return provider.get_demo_farm()


@router.post("/analyze-boundary", status_code=status.HTTP_200_OK)
def analyze_custom_farm_boundary(
    payload: BoundaryAnalysisRequest
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
