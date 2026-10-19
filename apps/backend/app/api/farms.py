from datetime import date
from typing import Any, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api import deps
from app.db.database import get_db
from app.models.user import User
from app.models.farm import Farm, SoilReport
from app.models.satellite import SatelliteObservation, EarthIntelligenceForecast
from app.services.activity_logger import log_activity
from app.services.earth_intelligence import calculate_explainable_forecasts

from app.core.crop_types import validate_crop_type, get_crop_types, has_crop_types

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
    boundary_geojson: Optional[Any] = None  # GeoJSON Polygon/MultiPolygon (geometry, Feature or text)
    current_crop: str
    crop_type_id: Optional[str] = None
    sowing_date: date
    irrigation_method: str


class UpdateFarmRequest(BaseModel):
    name: Optional[str] = None
    area: Optional[float] = None
    area_unit: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    village: Optional[str] = None
    gps_coordinates: Optional[str] = None
    current_crop: Optional[str] = None
    crop_type_id: Optional[str] = None
    sowing_date: Optional[date] = None
    irrigation_method: Optional[str] = None


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
    boundary_geojson: Optional[str] = None
    current_crop: str
    crop_type_id: Optional[str] = None
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
    farm_state = payload.state
    if payload.gps_coordinates:
        from app.services.satellite import parse_gps_coordinates, check_gps_state_match, resolve_state_from_gps
        lat, lon = parse_gps_coordinates(payload.gps_coordinates)
        if lat is not None and lon is not None:
            resolved_state = resolve_state_from_gps(lat, lon)
            if not farm_state and resolved_state:
                farm_state = resolved_state
            elif farm_state and not check_gps_state_match(lat, lon, farm_state):
                if resolved_state:
                    farm_state = resolved_state  # Auto-align state to authentic GPS coordinates
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="GPS coordinates do not match the selected state region. Please verify coordinates."
                    )
    elif not farm_state and current_user.state:
        farm_state = current_user.state

    boundary_text = None
    if payload.boundary_geojson:
        from app.services.realdata.geometry import GeometryError, parse_field_geometry, to_geojson_text
        try:
            boundary_text = to_geojson_text(parse_field_geometry(payload.boundary_geojson))
        except GeometryError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid field boundary: {e}")

    validated_crop_type = validate_crop_type(payload.current_crop, payload.crop_type_id)

    db_farm = Farm(
        user_id=current_user.id,
        name=payload.name,
        area=payload.area,
        area_unit=payload.area_unit or "hectares",
        state=farm_state or "Maharashtra",
        district=payload.district,
        village=payload.village,
        gps_coordinates=payload.gps_coordinates or "",
        boundary_geojson=boundary_text,
        current_crop=payload.current_crop,
        crop_type_id=validated_crop_type,
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


@router.patch("/{farm_id}", response_model=FarmOut)
@router.put("/{farm_id}", response_model=FarmOut)
def update_farm(
    farm_id: int,
    payload: UpdateFarmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Updates an existing farm field with crop and crop_type_id validation."""
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")

    # If crop is changed:
    if payload.current_crop is not None and payload.current_crop != farm.current_crop:
        # Rule 7: If a crop is changed, reset previously selected crop type if not explicitly supplied
        target_type = payload.crop_type_id  # If None, validates and resets to None
        farm.crop_type_id = validate_crop_type(payload.current_crop, target_type)
        farm.current_crop = payload.current_crop
    elif payload.crop_type_id is not None:
        # Same crop, updating or clearing crop_type_id
        farm.crop_type_id = validate_crop_type(farm.current_crop, payload.crop_type_id)

    if payload.name is not None:
        farm.name = payload.name
    if payload.area is not None:
        farm.area = payload.area
    if payload.area_unit is not None:
        farm.area_unit = payload.area_unit
    if payload.state is not None:
        farm.state = payload.state
    if payload.district is not None:
        farm.district = payload.district
    if payload.village is not None:
        farm.village = payload.village
    if payload.gps_coordinates is not None:
        farm.gps_coordinates = payload.gps_coordinates
        if payload.gps_coordinates:
            from app.services.satellite import parse_gps_coordinates, resolve_state_from_gps, check_gps_state_match
            lat, lon = parse_gps_coordinates(payload.gps_coordinates)
            if lat is not None and lon is not None:
                resolved_state = resolve_state_from_gps(lat, lon)
                if resolved_state and (not farm.state or not check_gps_state_match(lat, lon, farm.state)):
                    farm.state = resolved_state
    if payload.sowing_date is not None:
        farm.sowing_date = payload.sowing_date
    if payload.irrigation_method is not None:
        farm.irrigation_method = payload.irrigation_method

    db.commit()
    db.refresh(farm)
    return farm


@router.get("/crop-types/{crop_name}")
def get_crop_type_options(crop_name: str) -> Any:
    """Returns approved crop type options for the given crop."""
    return [
        {"id": opt.id, "label": opt.label, "aliases": list(opt.aliases)}
        for opt in get_crop_types(crop_name)
    ]



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



def _owned_farm_geometry(db: Session, farm_id: int, user: User):
    """Return (farm, shapely geometry) for a farm the user owns, or raise 404/400."""
    from app.services.realdata.geometry import GeometryError, parse_field_geometry
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == user.id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm field not found or unauthorized")
    if not farm.boundary_geojson:
        raise HTTPException(status_code=400, detail="Farm has no boundary. Draw or import a KML/GeoJSON boundary first.")
    try:
        return farm, parse_field_geometry(farm.boundary_geojson)
    except GeometryError as e:
        raise HTTPException(status_code=400, detail=f"Stored boundary is invalid: {e}")


@router.get("/{farm_id}/vegetation")
def get_farm_vegetation(
    farm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Real Sentinel-2 L2A NDVI/EVI/SAVI/NDWI time series for the farm boundary (cached per scene)."""
    from app.services.realdata.geometry import area_summary, centroid_latlon
    from app.services.realdata.sentinel2 import get_vegetation_series
    farm, geom = _owned_farm_geometry(db, farm_id, current_user)
    series = get_vegetation_series(geom, db=db, farm_id=farm.id)
    series["farm_id"] = farm.id
    series["area"] = area_summary(geom)
    series["centroid"] = list(centroid_latlon(geom))
    return series


@router.get("/{farm_id}/soil-estimate")
def get_farm_soil_estimate(
    farm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """SoilGrids ~250 m ESTIMATE at the field centroid, shown next to (never replacing) farmer soil data."""
    from app.services.realdata.geometry import centroid_latlon
    from app.services.realdata.soilgrids import get_soil_estimate
    farm, geom = _owned_farm_geometry(db, farm_id, current_user)
    lat, lon = centroid_latlon(geom)
    estimate = get_soil_estimate(lat, lon, db=db)
    latest = farm.soil_reports[0] if farm.soil_reports else None
    return {
        "farm_id": farm.id,
        "estimate": estimate,
        "farmer_entered": SoilReportOut.model_validate(latest).model_dump() if latest else None,
        "precedence": "farmer_entered values are authoritative; estimate is context only",
    }


async def _read_boundary_upload(file: UploadFile) -> dict:
    from app.services.realdata.boundary_import import BoundaryImportError, MAX_UPLOAD_BYTES, import_boundary
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    try:
        return import_boundary(file.filename or "", data)
    except BoundaryImportError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/boundary/parse")
async def parse_boundary_file(
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Preview a KML/KMZ/GeoJSON upload: validated polygons, skipped items and the merged boundary."""
    return await _read_boundary_upload(file)


@router.post("/{farm_id}/boundary")
async def upload_farm_boundary(
    farm_id: int,
    file: UploadFile = File(...),
    feature_index: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Save a KML/KMZ/GeoJSON boundary to the farm. Uses all polygons merged unless feature_index is given."""
    from app.services.realdata.geometry import parse_field_geometry, to_geojson_text
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm field not found or unauthorized")
    parsed = await _read_boundary_upload(file)
    if feature_index is not None:
        if not 0 <= feature_index < len(parsed["features"]):
            raise HTTPException(status_code=400, detail=f"feature_index must be 0..{len(parsed['features']) - 1}")
        chosen = parsed["features"][feature_index]["geometry"]
    else:
        chosen = parsed["merged"]["geometry"]
    geom = parse_field_geometry(chosen)
    farm.boundary_geojson = to_geojson_text(geom)
    db.commit()
    from app.services.realdata.geometry import area_summary, centroid_latlon
    return {
        "farm_id": farm.id,
        "saved_geometry_type": geom.geom_type,
        "area": area_summary(geom),
        "entered_area": {"value": farm.area, "unit": farm.area_unit},
        "centroid": list(centroid_latlon(geom)),
        "features": [{k: v for k, v in f.items() if k != "geometry"} for f in parsed["features"]],
        "skipped": parsed["skipped"],
    }


@router.get("/{farm_id}/alerts")
def get_farm_alerts(
    farm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """NDVI-drop, low-NDVI and drought alerts with evidence, computed from real data."""
    from app.services.realdata.agro_weather import get_agro_indices
    from app.services.realdata.alerts import evaluate_alerts
    from app.services.realdata.geometry import centroid_latlon
    from app.services.realdata.sentinel2 import get_vegetation_series
    farm, geom = _owned_farm_geometry(db, farm_id, current_user)
    series = get_vegetation_series(geom, db=db, farm_id=farm.id)
    lat, lon = centroid_latlon(geom)
    agri = get_agro_indices(lat, lon, sowing_date=farm.sowing_date, db=db)
    result = evaluate_alerts(farm.id, series["observations"],
                             agri if agri.get("source") != "unavailable" else None, farm.sowing_date)
    result["inputs"] = {"vegetation_status": series["status"], "weather_source": agri.get("source")}
    return result
