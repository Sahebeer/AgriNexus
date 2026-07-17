from datetime import date
from typing import Any, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.db.database import get_db
from app.models.user import User
from app.models.farm import Farm, SoilReport
from app.models.satellite import SatelliteObservation, EarthIntelligenceForecast
from app.services.activity_logger import log_activity
from app.services.earth_intelligence import calculate_explainable_forecasts

router = APIRouter()


# ─── Pydantic Schemas ────────────────────────────────────────────────────────

class CreateFarmRequest(BaseModel):
    name: str
    area: float
    area_unit: Optional[str] = "hectares"
    state: str
    district: str
    village: str
    gps_coordinates: Optional[str] = ""
    current_crop: str
    sowing_date: date
    irrigation_method: str


class SoilReportCreate(BaseModel):
    ph: float
    nitrogen: float
    phosphorus: float
    potassium: float
    organic_carbon: float
    soil_moisture: float
    electrical_conductivity: float
    temperature: float
    humidity: float
    soil_texture: str
    test_date: Optional[date] = None
    source: Optional[str] = "manual"


class SoilReportOut(BaseModel):
    id: int
    farm_id: int
    ph: float
    nitrogen: float
    phosphorus: float
    potassium: float
    organic_carbon: float
    soil_moisture: float
    electrical_conductivity: float
    temperature: float
    humidity: float
    soil_texture: str
    test_date: date
    source: str
    created_at: Any

    class Config:
        from_attributes = True


class SatelliteObservationOut(BaseModel):
    id: int
    farm_id: int
    observation_date: date
    ndvi: float
    ndwi: float
    cloud_cover: float
    source: str
    created_at: Any

    class Config:
        from_attributes = True


class EarthIntelligenceForecastOut(BaseModel):
    id: int
    farm_id: int
    forecast_date: date
    target_date: date
    window: str
    predicted_ndvi: float
    crop_stress_index: float
    irrigation_demand_index: float
    disease_risk_index: float
    yield_trend: float
    soil_fertility_index: float
    explanation: str
    created_at: Any

    class Config:
        from_attributes = True


class FarmOut(BaseModel):
    id: int
    name: str
    area: float
    area_unit: str
    state: str
    district: str
    village: str
    gps_coordinates: Optional[str] = ""
    current_crop: str
    sowing_date: date
    irrigation_method: str
    soil_reports: List[SoilReportOut] = []
    satellite_observations: List[SatelliteObservationOut] = []
    earth_forecasts: List[EarthIntelligenceForecastOut] = []

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/", response_model=List[FarmOut])
def list_farms(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Fetch all fields owned by the current operator."""
    return (
        db.query(Farm)
        .filter(Farm.user_id == current_user.id)
        .order_by(Farm.created_at.desc())
        .all()
    )


@router.post("/", response_model=FarmOut, status_code=status.HTTP_201_CREATED)
def create_farm(
    *,
    payload: CreateFarmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Registers a new farm field in the database and seeds an initial
    healthy benchmark soil report.
    """
    if payload.gps_coordinates:
        from app.services.satellite import parse_gps_coordinates, check_gps_state_match
        lat, lon = parse_gps_coordinates(payload.gps_coordinates)
        if lat is not None and lon is not None:
            if not check_gps_state_match(lat, lon, payload.state):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="GPS coordinates do not match the selected state region. Please verify coordinates."
                )

    db_farm = Farm(
        user_id=current_user.id,
        name=payload.name,
        area=payload.area,
        area_unit=payload.area_unit or "hectares",
        state=payload.state,
        district=payload.district,
        village=payload.village,
        gps_coordinates=payload.gps_coordinates or "",
        current_crop=payload.current_crop,
        sowing_date=payload.sowing_date,
        irrigation_method=payload.irrigation_method,
    )
    db.add(db_farm)
    db.flush()  # get farm ID

    # Seed an initial default soil report to prevent blank states (DEMO users only)
    from app.services.satellite import is_demo_user
    if is_demo_user(current_user):
        from app.services.weather import STATE_COORDINATES
        normalized_state = db_farm.state.strip().title() if db_farm.state else "Punjab"
        lat, lon = STATE_COORDINATES.get(normalized_state, (30.9012, 75.8568))
        
        # Calculate deterministic values based on state coordinates
        seed_factor = abs(int(lat * 10000 + lon * 10000))
        ph = round(6.0 + (seed_factor % 15) / 10.0, 1)
        nitrogen = round(110.0 + (seed_factor % 50), 1)
        phosphorus = round(20.0 + (seed_factor % 20), 1)
        potassium = round(120.0 + (seed_factor % 100), 1)
        organic_carbon = round(0.4 + (seed_factor % 4) / 10.0, 2)
        soil_moisture = round(15.0 + (seed_factor % 15), 1)
        temperature = round(20.0 + (seed_factor % 10), 1)
        humidity = round(50.0 + (seed_factor % 30), 1)
        texture = "Clayey" if (seed_factor % 3 == 0) else ("Sandy" if (seed_factor % 3 == 1) else "Loamy")

        default_report = SoilReport(
            farm_id=db_farm.id,
            ph=ph,
            nitrogen=nitrogen,
            phosphorus=phosphorus,
            potassium=potassium,
            organic_carbon=organic_carbon,
            soil_moisture=soil_moisture,
            electrical_conductivity=round(0.8 + (seed_factor % 10) / 10.0, 1),
            temperature=temperature,
            humidity=humidity,
            soil_texture=texture,
            test_date=date.today(),
            source="manual",
        )
        db.add(default_report)
        db.commit()
    else:
        db.commit()

    # Log to timeline
    try:
        log_activity(
            db,
            user_id=current_user.id,
            activity_type="Field Observation",
            title=f"Registered Farm Field: {payload.name}",
            description=f"Field registered: {payload.area} {payload.area_unit or 'hectares'} of {payload.current_crop} in {payload.village}, {payload.state}.",
            crop=payload.current_crop,
            source="auto",
            metadata={"farm_id": db_farm.id, "area": payload.area},
        )
    except Exception:
        pass

    db.refresh(db_farm)
    return db_farm


@router.delete("/{farm_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_farm(
    farm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> None:
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm field not found")
    db.delete(farm)
    db.commit()


@router.post("/{farm_id}/soil", response_model=SoilReportOut, status_code=status.HTTP_201_CREATED)
def log_soil_report(
    farm_id: int,
    payload: SoilReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Publish a new soil report for a specific farm field.
    This endpoint supports manual inputs, IoT uploads, or lab APIs.
    """
    # Verify owner
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm field not found or unauthorized")

    report = SoilReport(
        farm_id=farm_id,
        ph=payload.ph,
        nitrogen=payload.nitrogen,
        phosphorus=payload.phosphorus,
        potassium=payload.potassium,
        organic_carbon=payload.organic_carbon,
        soil_moisture=payload.soil_moisture,
        electrical_conductivity=payload.electrical_conductivity,
        temperature=payload.temperature,
        humidity=payload.humidity,
        soil_texture=payload.soil_texture,
        test_date=payload.test_date or date.today(),
        source=payload.source or "manual",
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # Log to Timeline
    try:
        log_activity(
            db,
            user_id=current_user.id,
            activity_type="Field Observation",
            title=f"Soil Health Updated: {farm.name}",
            description=f"New report logged via {report.source.upper()}. pH: {report.ph}, N: {report.nitrogen}, P: {report.phosphorus}, K: {report.potassium}, Moisture: {report.soil_moisture}%.",
            crop=farm.current_crop,
            source="auto",
            metadata={"farm_id": farm.id, "report_id": report.id, "source": report.source},
        )
    except Exception:
        pass

    return report


@router.get("/{farm_id}/soil-history", response_model=List[SoilReportOut])
def get_soil_history(
    farm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Fetch complete historical soil reports for trends comparisons."""
    # Verify owner
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm field not found or unauthorized")

    return (
        db.query(SoilReport)
        .filter(SoilReport.farm_id == farm_id)
        .order_by(SoilReport.test_date.desc())
        .all()
    )


@router.get("/{farm_id}/satellite-history", response_model=List[SatelliteObservationOut])
def get_satellite_history(
    farm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Fetch all Sentinel satellite index observation readings for the farm field."""
    # Verify owner
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm field not found or unauthorized")

    return (
        db.query(SatelliteObservation)
        .filter(SatelliteObservation.farm_id == farm_id)
        .order_by(SatelliteObservation.observation_date.desc())
        .all()
    )


@router.get("/{farm_id}/earth-forecasts", response_model=List[EarthIntelligenceForecastOut])
def get_earth_forecasts(
    farm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Triggers downscaled telemetry ingestion, runs LightGBM forecasting, and yields explainable forecasts."""
    # Verify owner
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm field not found or unauthorized")

    # This triggers the automatic downscale weather ingestion + seeds initial metrics + returns weekly/monthly/seasonal forecasts
    return calculate_explainable_forecasts(db, farm_id)

