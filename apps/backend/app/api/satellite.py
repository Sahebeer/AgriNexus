"""
AgriNexus AI - Satellite SAR Intelligence API Router
Handles Sentinel-1 Synthetic Aperture Radar (SAR) acquisition, backscatter analysis,
and temporal condition tracking for agricultural fields.
Enforces strict JWT authorization and field ownership verification.
"""

from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api import deps
from app.db.database import get_db
from app.models.user import User
from app.models.farm import Farm
from app.models.satellite import SatelliteObservation
from app.services.sar.processor import SARFieldProcessor

router = APIRouter()


class SARFeaturesOut(BaseModel):
    vv: float
    vh: float
    vv_vh_ratio: float
    radar_vegetation_index: Optional[float] = None
    normalized_polarization_ratio: Optional[float] = None


class SARTemporalOut(BaseModel):
    has_temporal_history: bool
    observations_count: int
    delta_vv: float
    delta_vh: float
    delta_ratio: float
    trend: str
    anomaly_detected: bool
    anomaly_reason: Optional[str] = None


class SARDiagnosticOut(BaseModel):
    status: str
    field_id: int
    field_name: str
    crop: str
    satellite: str
    observation_date: str
    orbit: Optional[str] = "ASCENDING"
    polarization: Optional[str] = "VV+VH"
    features: SARFeaturesOut
    temporal: Optional[SARTemporalOut] = None
    condition: str
    confidence: float
    interpretation: str


@router.get("/field/{field_id}", response_model=SARDiagnosticOut, status_code=status.HTTP_200_OK)
def get_field_sar_intelligence(
    field_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Returns latest Sentinel-1 SAR intelligence for a specific field.
    Verifies that the authenticated user owns the field.
    """
    # 1. Field existence and ownership check
    farm = db.query(Farm).filter(Farm.id == field_id).first()
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "FIELD_NOT_FOUND", "message": f"Field with ID {field_id} does not exist."}
        )

    if farm.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "UNAUTHORIZED_FIELD_ACCESS", "message": "You do not have authorization to access this field's satellite telemetry."}
        )

    # 2. Query or process latest SAR observation
    processor = SARFieldProcessor(db)
    try:
        result = processor.process_field_sar(field_id)
        if result.get("status") == "insufficient_data":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "SATELLITE_DATA_UNAVAILABLE", "message": result.get("message", "No suitable SAR observation available.")}
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "SATELLITE_DATA_UNAVAILABLE", "message": f"Failed to retrieve SAR telemetry: {str(e)}"}
        )


@router.get("/field/{field_id}/history", status_code=status.HTTP_200_OK)
def get_field_sar_history(
    field_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Returns historical Sentinel-1 SAR observations for the specified field.
    """
    farm = db.query(Farm).filter(Farm.id == field_id).first()
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "FIELD_NOT_FOUND", "message": f"Field with ID {field_id} does not exist."}
        )

    if farm.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "UNAUTHORIZED_FIELD_ACCESS", "message": "Not authorized to access this field's data."}
        )

    observations = (
        db.query(SatelliteObservation)
        .filter(SatelliteObservation.farm_id == field_id)
        .order_by(SatelliteObservation.observation_date.desc())
        .limit(20)
        .all()
    )

    return [
        {
            "id": obs.id,
            "observation_date": obs.observation_date.isoformat() if obs.observation_date else None,
            "satellite": getattr(obs, "satellite", "Sentinel-1"),
            "orbit": getattr(obs, "orbit", "ASCENDING"),
            "vv": obs.vv if getattr(obs, "vv", None) is not None else -12.0,
            "vh": obs.vh if getattr(obs, "vh", None) is not None else -18.0,
            "vv_vh_ratio": obs.vv_vh_ratio if getattr(obs, "vv_vh_ratio", None) is not None else 6.0,
            "condition": getattr(obs, "model_prediction", "normal"),
            "confidence": getattr(obs, "model_confidence", 0.85)
        }
        for obs in observations
    ]
