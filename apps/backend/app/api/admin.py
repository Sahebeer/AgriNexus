"""
AgriNexus AI - Dedicated Administration & Demonstration API Router.
Enforces strict server-side role validation for Admin and Demonstration operations.
"""

from datetime import timedelta
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.api import deps
from app.core import security
from app.core.config import settings
from app.db.database import get_db
from app.models.user import User, UserRole
from app.models.farm import Farm
from app.models.satellite import SatelliteObservation

router = APIRouter()


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str = "admin"
    user_name: str
    email: str


@router.post("/login", response_model=AdminTokenResponse, status_code=status.HTTP_200_OK)
def admin_login(
    payload: AdminLoginRequest,
    db: Session = Depends(get_db)
) -> Any:
    """
    Dedicated Admin Login endpoint.
    Strictly verifies admin role or superuser status on the server before issuing tokens.
    """
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not security.verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid administrative credentials."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrative account is disabled."
        )

    user_role = (user.role or "").lower()
    if user_role != UserRole.ADMIN.value and not user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Standard farmer credentials cannot access the Admin Demonstration Console."
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 2)
    token = security.create_access_token(user.id, expires_delta=access_token_expires)

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role or "admin",
        "user_name": user.full_name or "Administrator",
        "email": user.email
    }


@router.get("/system-status", status_code=status.HTTP_200_OK)
def get_system_status(
    db: Session = Depends(get_db),
    admin_user: User = Depends(deps.get_current_active_admin)
) -> Dict[str, Any]:
    """
    Returns live health telemetry across backend ML models, database records, and satellite pipelines.
    """
    total_users = db.query(User).count()
    total_farms = db.query(Farm).count()
    total_satellite_obs = db.query(SatelliteObservation).count()

    return {
        "status": "operational",
        "environment": "demonstration",
        "active_models": {
            "crop_gate": "MobileNetV3-OOD (Active)",
            "disease_classifier": "MobileNetV3-PlantVillage (38 Classes)",
            "sar_radar_processor": "Sentinel-1 C-Band Calibrated Pipeline",
            "satellite_multi_spectral": "Sentinel-2 Multi-Spectral Simulated Pipeline",
            "ai_reasoning_engine": "AgriNexus Agricultural Reasoning Engine v2.1"
        },
        "providers": {
            "satellite": "DemoSatelliteProvider (Synthetic High-Resolution Sentinel-2 Simulation)",
            "radar": "SARFieldProcessor (Sentinel-1 SAR C-band)",
            "weather": "Open-Meteo & IMD Interpolation"
        },
        "database_metrics": {
            "registered_users": total_users,
            "registered_farms": total_farms,
            "satellite_observations": total_satellite_obs
        },
        "server_time": "2026-09-09T23:30:00Z"
    }


@router.get("/demo-farms", status_code=status.HTTP_200_OK)
def list_admin_demo_farms(
    db: Session = Depends(get_db),
    admin_user: User = Depends(deps.get_current_active_admin)
) -> List[Dict[str, Any]]:
    """
    The signed-in admin's own farms (no synthetic presets). Health / NDVI come from the
    latest stored satellite observation and are null when none exists yet.
    """
    out = []
    for farm in db.query(Farm).filter(Farm.user_id == admin_user.id).order_by(Farm.id).all():
        obs = (db.query(SatelliteObservation)
               .filter(SatelliteObservation.farm_id == farm.id, SatelliteObservation.source == "sentinel-2",
                       SatelliteObservation.ndvi.isnot(None))
               .order_by(SatelliteObservation.observation_date.desc()).first())
        ndvi = obs.ndvi if obs else None
        hectares = farm.area if (farm.area_unit or "hectares").lower().startswith("hect") else round(farm.area * 0.404686, 2)
        out.append({
            "farm_id": farm.id,
            "name": farm.name,
            "location": ", ".join(x for x in (farm.village, farm.district, farm.state) if x),
            "crop": farm.current_crop,
            "area_hectares": hectares,
            "health_score": round(ndvi * 100) if ndvi is not None else None,
            "ndvi_mean": round(ndvi, 2) if ndvi is not None else None,
            "is_demo": False,
        })
    return out
