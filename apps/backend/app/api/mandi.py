from typing import Any, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.api import deps
from app.db.database import get_db
from app.models.user import User
from app.models.mandi import MandiListing
from app.services.activity_logger import log_activity

router = APIRouter()


# ─── Pydantic Schemas ────────────────────────────────────────────────────────

class CreateListingRequest(BaseModel):
    crop: str
    quantity: float
    unit: Optional[str] = "qtl"
    price_per_unit: float
    location: str
    contact_number: str
    listing_type: str  # seller | buyer
    description: Optional[str] = ""


class ListingOut(BaseModel):
    id: int
    user_id: int
    crop: str
    quantity: float
    unit: str
    price_per_unit: float
    location: str
    contact_number: str
    listing_type: str
    status: str
    description: Optional[str] = ""
    created_at: Any

    class Config:
        from_attributes = True


class ListingStatusPatch(BaseModel):
    status: str  # active | completed | cancelled


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/listings", response_model=List[ListingOut])
def get_listings(
    *,
    db: Session = Depends(get_db),
    crop: Optional[str] = Query(None),
    listing_type: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Fetch marketplace ads with filters."""
    q = db.query(MandiListing).filter(MandiListing.status == "active")
    if crop:
        q = q.filter(MandiListing.crop.ilike(f"%{crop}%"))
    if listing_type:
        q = q.filter(MandiListing.listing_type == listing_type)
    if location:
        q = q.filter(MandiListing.location.ilike(f"%{location}%"))

    return q.order_by(desc(MandiListing.created_at)).offset(offset).limit(limit).all()


@router.get("/listings/my", response_model=List[ListingOut])
def get_my_listings(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Fetch listings created by the logged-in user."""
    return (
        db.query(MandiListing)
        .filter(MandiListing.user_id == current_user.id)
        .order_by(desc(MandiListing.created_at))
        .all()
    )


@router.post("/listings", response_model=ListingOut, status_code=status.HTTP_201_CREATED)
def create_listing(
    *,
    payload: CreateListingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Publish a buyer/seller listing, auto-log to activity log."""
    db_listing = MandiListing(
        user_id=current_user.id,
        crop=payload.crop,
        quantity=payload.quantity,
        unit=payload.unit or "qtl",
        price_per_unit=payload.price_per_unit,
        location=payload.location,
        contact_number=payload.contact_number,
        listing_type=payload.listing_type,
        description=payload.description or "",
    )
    db.add(db_listing)
    db.commit()
    db.refresh(db_listing)

    # Auto-log to activity timeline
    try:
        action = "List Crop for Sale" if payload.listing_type == "seller" else "Post Crop Procurement Request"
        log_activity(
            db,
            user_id=current_user.id,
            activity_type="Purchase" if payload.listing_type == "buyer" else "Other",
            title=f"Mandi Listing: {payload.crop} ({payload.quantity} {payload.unit})",
            description=f"{action}. Price: ₹{payload.price_per_unit}/{payload.unit}. Location: {payload.location}.",
            crop=payload.crop,
            source="auto",
            metadata={"listing_id": db_listing.id, "price": payload.price_per_unit, "quantity": payload.quantity},
        )
    except Exception:
        pass

    return db_listing


@router.patch("/listings/{listing_id}", response_model=ListingOut)
def patch_listing(
    listing_id: int,
    payload: ListingStatusPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    listing = db.query(MandiListing).filter(MandiListing.id == listing_id, MandiListing.user_id == current_user.id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    listing.status = payload.status
    db.commit()
    db.refresh(listing)
    return listing


@router.delete("/listings/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> None:
    listing = db.query(MandiListing).filter(MandiListing.id == listing_id, MandiListing.user_id == current_user.id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    db.delete(listing)
    db.commit()


@router.get("/analytics")
def get_mandi_analytics(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Return demand insights and selling time recommendations."""
    return {
        "demand_index": [
            {"crop": "Wheat", "demand_ratio": 1.45, "status": "High Demand"},
            {"crop": "Mustard", "demand_ratio": 1.25, "status": "High Demand"},
            {"crop": "Rice", "demand_ratio": 0.95, "status": "Stable"},
            {"crop": "Cotton", "demand_ratio": 1.10, "status": "Stable"},
            {"crop": "Tomato", "demand_ratio": 0.65, "status": "Oversupply (Prices Dropping)"},
            {"crop": "Potato", "demand_ratio": 1.05, "status": "Stable"},
        ],
        "selling_recommendations": [
            {
                "crop": "Rice",
                "best_mandi": "Khanna Mandi (Punjab)",
                "premium_percent": 5.2,
                "best_time_to_sell": "Sell immediately — volume influx expected next week.",
            },
            {
                "crop": "Wheat",
                "best_mandi": "Azadpur Mandi (Delhi)",
                "premium_percent": 3.8,
                "best_time_to_sell": "Hold for 10 days — central warehouse procurements starting.",
            },
            {
                "crop": "Tomato",
                "best_mandi": "Kolar Mandi (Karnataka)",
                "premium_percent": 12.0,
                "best_time_to_sell": "Sell at nearest regional market to avoid transportation loss.",
            }
        ]
    }
