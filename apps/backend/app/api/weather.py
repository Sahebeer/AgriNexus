from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.db.database import get_db
from app.models.user import User
from app.models.farm import Farm
from app.services.weather import get_state_weather
from app.services.satellite import parse_gps_coordinates

router = APIRouter()


def _farm_point(farm: Farm):
    """Best point for a farm: boundary centroid, then GPS string. Returns (lat, lon, basis)."""
    if farm.boundary_geojson:
        try:
            from app.services.realdata.geometry import centroid_latlon, parse_field_geometry
            lat, lon = centroid_latlon(parse_field_geometry(farm.boundary_geojson))
            return lat, lon, "field boundary centroid"
        except Exception:
            pass
    if farm.gps_coordinates:
        lat, lon = parse_gps_coordinates(farm.gps_coordinates)
        if lat is not None and lon is not None:
            return lat, lon, "farm GPS point"
    return None, None, None

@router.get("/forecast", status_code=status.HTTP_200_OK)
def get_weather_forecast(
    farm_id: Optional[int] = None,
    current_user: User = Depends(deps.get_current_active_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Returns localized weather metrics, alerts, and microclimate advisories
    determined by the authenticated user's state profile or specific farm's GPS location.
    """
    try:
        lat, lon = None, None
        location_basis = None
        resolved_farm = None
        user_state = current_user.state or "Punjab"
        
        # 1. If farm_id is provided, look up that specific farm
        if farm_id is not None:
            farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == current_user.id).first()
            if not farm:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Farm with ID {farm_id} not found."
                )
            user_state = farm.state or user_state
            resolved_farm = farm
            lat, lon, location_basis = _farm_point(farm)
        else:
            # 2. Otherwise find the user's first farm with valid coordinates
            farms = db.query(Farm).filter(Farm.user_id == current_user.id).all()
            for farm in farms:
                flat, flon, basis = _farm_point(farm)
                if flat is not None and flon is not None:
                    lat, lon, location_basis = flat, flon, basis
                    user_state = farm.state or user_state
                    resolved_farm = farm
                    break

        # 3. Call weather service with resolved coordinates/state
        weather_data = get_state_weather(user_state, lat, lon)
        if location_basis and weather_data.get("source") == "open-meteo":
            weather_data["location_basis"] = location_basis
            weather_data["farm_id"] = resolved_farm.id if resolved_farm else None

        # 4. Agricultural indices (GDD, 30-day water balance, drought) at the same point
        if weather_data.get("source") == "open-meteo" and weather_data.get("lat") is not None:
            from app.services.realdata.agro_weather import get_agro_indices
            weather_data["agri_indices"] = get_agro_indices(
                weather_data["lat"], weather_data["lon"],
                sowing_date=resolved_farm.sowing_date if resolved_farm else None, db=db)
            agri = weather_data["agri_indices"]
            z = agri.get("drought_index")
            if z is not None and z <= -1.0:
                weather_data.setdefault("alerts", []).append({
                    "type": "Drought Alert",
                    "severity": "Red" if z <= -1.5 else "Amber",
                    "message": (f"{agri.get('drought_category', 'Dry spell').capitalize()}: "
                                f"{agri.get('precip_30d_mm')} mm rain vs {agri.get('et0_30d_mm')} mm "
                                f"evapotranspiration in the last 30 days (index {z} vs 10-year normal)."),
                })
                weather_data.setdefault("advisories", []).append(
                    "Prioritise irrigation for moisture-sensitive crop stages and mulch to reduce evaporation.")
        return weather_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compile weather forecast: {str(e)}"
        )

