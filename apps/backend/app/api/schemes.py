from typing import Any, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.models.user import User
from app.services.schemes import get_recommended_schemes, SCHEMES_DATABASE

router = APIRouter()

# Schema definitions
class CriterionMatch(BaseModel):
    criterion: str
    value: str
    status: str

class MatchResponse(BaseModel):
    id: str
    name: str
    agency: str
    category: str
    scope: str = "National"
    description: str
    benefits: str
    documents: List[str]
    helpline: str = ""
    portal_url: str = ""
    checklist: List[CriterionMatch]
    match_score: int

@router.get("/recommend", response_model=List[MatchResponse])
def recommend_schemes(
    *,
    farm_size: float = 1.0,
    crops: Optional[str] = "",
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Evaluates eligibility parameters against the central and state scheme registries
    and returns a tailored list of subsidies.
    """
    # 1. Parse crops comma-separated string
    crops_list = []
    if crops:
        crops_list = [c.strip() for c in crops.split(",") if c.strip()]
        
    try:
        # 2. Query the recommendation service
        results = get_recommended_schemes(
            user_state=current_user.state or "",
            farm_size=farm_size,
            active_crops=crops_list
        )
        return results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during schemes matching: {str(e)}"
        )

@router.get("/all")
def get_all_schemes(
    search: Optional[str] = None,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Returns the complete catalog of agricultural subsidies, with optional search strings.
    """
    if not search:
        return SCHEMES_DATABASE
        
    cleaned_search = search.lower()
    filtered = []
    for s in SCHEMES_DATABASE:
        if (
            cleaned_search in s["name"].lower() or 
            cleaned_search in s["description"].lower() or 
            cleaned_search in s["category"].lower()
        ):
            filtered.append(s)
    return filtered
