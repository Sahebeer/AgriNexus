import json
from datetime import date
from typing import Any, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.api import deps
from app.db.database import get_db
from app.models.user import User
from app.models.activity import ActivityLog
from app.services.activity_logger import log_activity, VALID_TYPES

router = APIRouter()


# ─── Pydantic Schemas ────────────────────────────────────────────────────────

class CreateActivityRequest(BaseModel):
    activity_type: str
    title: str
    description: Optional[str] = ""
    crop: Optional[str] = ""
    field_name: Optional[str] = ""
    activity_date: Optional[date] = None
    metadata: Optional[dict] = None


class ActivityOut(BaseModel):
    id: int
    activity_type: str
    source: str
    title: str
    description: Optional[str] = ""
    crop: Optional[str] = ""
    field_name: Optional[str] = ""
    activity_date: date
    metadata_json: Optional[str] = None
    created_at: Any  # datetime

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/types")
def get_activity_types() -> list:
    """Return all valid activity types for frontend dropdowns."""
    return sorted(VALID_TYPES)


@router.get("/", response_model=List[ActivityOut])
def get_activities(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
    activity_type: Optional[str] = Query(None),
    crop: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    source: Optional[str] = Query(None),   # "auto" | "manual"
    limit: int = Query(100, le=500),
    offset: int = Query(0),
) -> Any:
    """
    Fetch activity logs with optional filters.
    Ordered by activity_date DESC (most recent first).
    """
    q = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == current_user.id)
    )

    if activity_type:
        q = q.filter(ActivityLog.activity_type == activity_type)
    if crop:
        q = q.filter(ActivityLog.crop.ilike(f"%{crop}%"))
    if date_from:
        q = q.filter(ActivityLog.activity_date >= date_from)
    if date_to:
        q = q.filter(ActivityLog.activity_date <= date_to)
    if source:
        q = q.filter(ActivityLog.source == source)

    return q.order_by(desc(ActivityLog.activity_date), desc(ActivityLog.created_at)).offset(offset).limit(limit).all()


@router.post("/", response_model=ActivityOut, status_code=status.HTTP_201_CREATED)
def create_activity(
    *,
    payload: CreateActivityRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Manually log a farm activity."""
    entry = log_activity(
        db,
        user_id=current_user.id,
        activity_type=payload.activity_type,
        title=payload.title,
        description=payload.description or "",
        crop=payload.crop or "",
        field_name=payload.field_name or "",
        activity_date=payload.activity_date or date.today(),
        source="manual",
        metadata=payload.metadata,
    )
    return entry


@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(
    activity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> None:
    entry = (
        db.query(ActivityLog)
        .filter(ActivityLog.id == activity_id, ActivityLog.user_id == current_user.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Activity not found")
    db.delete(entry)
    db.commit()


@router.get("/stats/summary")
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Aggregate stats — total per type."""
    rows = (
        db.query(ActivityLog.activity_type, db.func.count(ActivityLog.id))
        .filter(ActivityLog.user_id == current_user.id)
        .group_by(ActivityLog.activity_type)
        .all()
    )
    return {r[0]: r[1] for r in rows}
