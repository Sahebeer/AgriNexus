from typing import Any, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.db.database import get_db
from app.models.user import User
from app.models.shopping import ShoppingList, ShoppingListItem
from app.services.shopping import generate_shopping_list

router = APIRouter()


# ─── Pydantic Schemas ────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    crop: str
    farm_size: float
    soil_type: Optional[str] = ""
    season: Optional[str] = ""
    growth_stage: Optional[str] = ""


class ItemOut(BaseModel):
    id: int
    category: str
    name: str
    description: Optional[str] = ""
    quantity: float
    unit: str
    unit_cost: float
    total_cost: float
    is_purchased: bool
    notes: Optional[str] = ""

    class Config:
        from_attributes = True


class ListOut(BaseModel):
    id: int
    name: str
    crop: str
    farm_size: float
    soil_type: Optional[str] = ""
    season: Optional[str] = ""
    growth_stage: Optional[str] = ""
    estimated_total_cost: float
    items: List[ItemOut] = []

    class Config:
        from_attributes = True


class ListSummary(BaseModel):
    id: int
    name: str
    crop: str
    farm_size: float
    season: Optional[str] = ""
    estimated_total_cost: float

    class Config:
        from_attributes = True


class ItemPatchRequest(BaseModel):
    is_purchased: Optional[bool] = None
    quantity: Optional[float] = None
    unit_cost: Optional[float] = None
    notes: Optional[str] = None


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/generate", response_model=ListOut, status_code=status.HTTP_201_CREATED)
def generate_and_save(
    *,
    payload: GenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Generate a smart shopping list from crop parameters and persist it to the database.
    """
    data = generate_shopping_list(
        crop=payload.crop,
        farm_size=payload.farm_size,
        soil_type=payload.soil_type or "",
        season=payload.season or "",
        growth_stage=payload.growth_stage or "",
    )

    db_list = ShoppingList(
        user_id=current_user.id,
        name=data["name"],
        crop=data["crop"],
        farm_size=data["farm_size"],
        soil_type=data["soil_type"],
        season=data["season"],
        growth_stage=data["growth_stage"],
        estimated_total_cost=data["estimated_total_cost"],
    )
    db.add(db_list)
    db.flush()  # get id before items

    for item in data["items"]:
        db.add(ShoppingListItem(
            list_id=db_list.id,
            category=item["category"],
            name=item["name"],
            description=item["description"],
            quantity=item["quantity"],
            unit=item["unit"],
            unit_cost=item["unit_cost"],
            total_cost=item["total_cost"],
            is_purchased=False,
        ))

    db.commit()
    db.refresh(db_list)
    return db_list


@router.get("/", response_model=List[ListSummary])
def list_all(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Return summary of all shopping lists for the current user."""
    return (
        db.query(ShoppingList)
        .filter(ShoppingList.user_id == current_user.id)
        .order_by(ShoppingList.created_at.desc())
        .all()
    )


@router.get("/{list_id}", response_model=ListOut)
def get_list(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Fetch a single shopping list with all its items."""
    db_list = (
        db.query(ShoppingList)
        .filter(ShoppingList.id == list_id, ShoppingList.user_id == current_user.id)
        .first()
    )
    if not db_list:
        raise HTTPException(status_code=404, detail="Shopping list not found")
    return db_list


@router.patch("/{list_id}/items/{item_id}", response_model=ItemOut)
def update_item(
    list_id: int,
    item_id: int,
    payload: ItemPatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Patch a single item — toggle purchased, adjust quantity, update notes."""
    item = (
        db.query(ShoppingListItem)
        .join(ShoppingList)
        .filter(
            ShoppingListItem.id == item_id,
            ShoppingListItem.list_id == list_id,
            ShoppingList.user_id == current_user.id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if payload.is_purchased is not None:
        item.is_purchased = payload.is_purchased
    if payload.quantity is not None:
        item.quantity = payload.quantity
        item.total_cost = round(payload.quantity * item.unit_cost, 2)
    if payload.unit_cost is not None:
        item.unit_cost = payload.unit_cost
        item.total_cost = round(item.quantity * payload.unit_cost, 2)
    if payload.notes is not None:
        item.notes = payload.notes

    # Recalculate list total
    db.flush()
    parent = db.query(ShoppingList).filter(ShoppingList.id == list_id).first()
    if parent:
        parent.estimated_total_cost = round(
            sum(i.total_cost for i in parent.items), 2
        )

    db.commit()
    db.refresh(item)
    return item


@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_list(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> None:
    """Delete a shopping list (cascades to items)."""
    db_list = (
        db.query(ShoppingList)
        .filter(ShoppingList.id == list_id, ShoppingList.user_id == current_user.id)
        .first()
    )
    if not db_list:
        raise HTTPException(status_code=404, detail="Shopping list not found")
    db.delete(db_list)
    db.commit()
