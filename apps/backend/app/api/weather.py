from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status

from app.api import deps
from app.models.user import User
from app.services.weather import get_state_weather

router = APIRouter()

@router.get("/forecast", status_code=status.HTTP_200_OK)
def get_weather_forecast(
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Returns localized weather metrics, alerts, and microclimate advisories
    determined by the authenticated user's state profile.
    """
    try:
        user_state = current_user.state or "Punjab"  # Default fallback
        weather_data = get_state_weather(user_state)
        return weather_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compile weather forecast: {str(e)}"
        )
