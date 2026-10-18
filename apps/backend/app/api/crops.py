from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.db.database import get_db
from app.models.user import User
from app.schemas.crops import CropRecommendationRequest, CropRecommendationResponse
from app.services.crop_recommender import recommend_crops
from app.services.soil_model import SoilModelUnavailable

router = APIRouter()


@router.post(
    "/recommend",
    response_model=CropRecommendationResponse,
    status_code=status.HTTP_200_OK,
    summary="Recommend ranked crops based on soil, weather, and season",
)
def get_crop_recommendations(
    payload: CropRecommendationRequest,
    current_user: User = Depends(deps.get_current_active_user),
    db: Session = Depends(get_db),
) -> CropRecommendationResponse:
    """
    Ranks agricultural crops for a specific farm field or soil profile.
    Integrates:
      1. Field soil chemistry (from latest report or overrides)
      2. Farm geographic weather and microclimate conditions
      3. Agro-climatic cropping season (Kharif, Rabi, Zaid, Perennial)
      4. Dual-layer Out-of-Distribution (OOD) plausibility gating
    """
    try:
        return recommend_crops(payload=payload, user_id=current_user.id, db=db)
    except SoilModelUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate crop recommendations: {str(exc)}",
        ) from exc
