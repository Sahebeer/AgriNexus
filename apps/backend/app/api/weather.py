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
            if farm.gps_coordinates:
                lat, lon = parse_gps_coordinates(farm.gps_coordinates)
        else:
            # 2. Otherwise find the user's first farm with valid coordinates
            farms = db.query(Farm).filter(Farm.user_id == current_user.id).all()
            for farm in farms:
                if farm.gps_coordinates:
                    flat, flon = parse_gps_coordinates(farm.gps_coordinates)
                    if flat is not None and flon is not None:
                        lat, lon = flat, flon
                        user_state = farm.state or user_state
                        break
        
        # 3. Call weather service with resolved coordinates/state
        weather_data = get_state_weather(user_state, lat, lon)
        return weather_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compile weather forecast: {str(e)}"
        )

