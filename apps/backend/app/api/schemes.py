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

class RecommendRequest(BaseModel):
    state: Optional[str] = ""
    land_size_ha: Optional[float] = None
    farm_size: Optional[float] = None
    crops: Optional[Any] = None

def _run_recommend_logic(state: Optional[str], farm_size: float, crops: Any, current_user: User) -> List[dict]:
    crops_list = []
    if isinstance(crops, list):
        crops_list = [str(c).strip() for c in crops if str(c).strip()]
    elif isinstance(crops, str) and crops:
        crops_list = [c.strip() for c in crops.split(",") if c.strip()]

    resolved_state = (state or "").strip() or (current_user.state or "")
    resolved_size = farm_size if farm_size > 0 else 1.0

    try:
        return get_recommended_schemes(
            user_state=resolved_state,
            farm_size=resolved_size,
            active_crops=crops_list
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during schemes matching: {str(e)}"
        )

@router.get("/recommend", response_model=List[MatchResponse])
def recommend_schemes_get(
    *,
    farm_size: float = 1.0,
    crops: Optional[str] = "",
    state: Optional[str] = "",
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Evaluates eligibility parameters against the central and state scheme registries
    and returns a tailored list of subsidies (GET query params).
    """
    return _run_recommend_logic(state, farm_size, crops, current_user)

@router.post("/recommend")
def recommend_schemes_post(
    payload: RecommendRequest,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Evaluates eligibility parameters (POST JSON body from frontend web client).
    """
    size = payload.land_size_ha if payload.land_size_ha is not None else (payload.farm_size or 1.0)
    results = _run_recommend_logic(payload.state, size, payload.crops, current_user)
    return {"recommendations": results, "schemes": results}

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

@router.get("/catalog")
def get_schemes_catalog(
    search: Optional[str] = None,
    state: Optional[str] = None,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Frontend catalog endpoint returning { schemes: [...] }.
    """
    schemes = get_all_schemes(search=search, current_user=current_user)
    if state and state.strip():
        st = state.strip().lower()
        schemes = [s for s in schemes if s.get("scope") == "National" or st in s.get("scope", "").lower()]
    return {"schemes": schemes, "total": len(schemes)}

