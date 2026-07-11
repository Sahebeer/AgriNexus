from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status

from app.api import deps
from app.models.user import User
from app.services.prices import get_market_prices

router = APIRouter()

@router.get("/market", status_code=status.HTTP_200_OK)
def get_crop_prices(
    crop: Optional[str] = None,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Returns Mandi commodity indices and regional comparisons.
    Can be filtered by crop query matches.
    """
    try:
        prices_data = get_market_prices(crop)
        return prices_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch market indices: {str(e)}"
        )
