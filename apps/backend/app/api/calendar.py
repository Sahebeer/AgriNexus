from datetime import date, datetime
from typing import Any, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.db.database import get_db
from app.models.user import User
from app.models.calendar import CropCalendar, CalendarEvent
from app.services.calendar_gen import generate_calendar_events

router = APIRouter()


# ─── Pydantic Schemas ────────────────────────────────────────────────────────

class CreateCalendarRequest(BaseModel):
    crop: str
    sow_date: date
    variety: Optional[str] = ""
    location: Optional[str] = ""
    name: Optional[str] = ""


class EventOut(BaseModel):
    id: int
    event_type: str
    title: str
    description: Optional[str] = ""
    scheduled_date: date
    das: Optional[int] = None
    is_completed: bool
    notes: Optional[str] = ""

    class Config:
        from_attributes = True


class CalendarOut(BaseModel):
    id: int
    name: str
    crop: str
    variety: Optional[str] = ""
    location: Optional[str] = ""
    sow_date: date
    events: List[EventOut] = []

    class Config:
        from_attributes = True


class CalendarSummary(BaseModel):
    id: int
    name: str
    crop: str
    sow_date: date
    location: Optional[str] = ""

    class Config:
        from_attributes = True


class EventPatchRequest(BaseModel):
    is_completed: Optional[bool] = None
    notes: Optional[str] = None


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/create", response_model=CalendarOut, status_code=status.HTTP_201_CREATED)
def create_calendar(
    *,
    payload: CreateCalendarRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Generate and save a full crop calendar from sow date."""
    name = payload.name or f"{payload.crop} Calendar — {payload.sow_date.strftime('%b %Y')}"
    if payload.location:
        name += f" · {payload.location}"

    db_cal = CropCalendar(
        user_id=current_user.id,
        name=name,
        crop=payload.crop,
        variety=payload.variety or "",
        location=payload.location or "",
        sow_date=payload.sow_date,
    )
    db.add(db_cal)
    db.flush()

    events = generate_calendar_events(
        crop=payload.crop,
        sow_date=payload.sow_date,
    )
    for ev in events:
        db.add(CalendarEvent(
            calendar_id=db_cal.id,
            event_type=ev["event_type"],
            title=ev["title"],
            description=ev["description"],
            scheduled_date=ev["scheduled_date"],
            das=ev["das"],
            is_completed=False,
        ))

    db.commit()
    db.refresh(db_cal)
    return db_cal


@router.get("/", response_model=List[CalendarSummary])
def list_calendars(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    return (
        db.query(CropCalendar)
        .filter(CropCalendar.user_id == current_user.id)
        .order_by(CropCalendar.created_at.desc())
        .all()
    )


@router.get("/{cal_id}", response_model=CalendarOut)
def get_calendar(
    cal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    cal = (
        db.query(CropCalendar)
        .filter(CropCalendar.id == cal_id, CropCalendar.user_id == current_user.id)
        .first()
    )
    if not cal:
        raise HTTPException(status_code=404, detail="Calendar not found")
    return cal


@router.patch("/{cal_id}/events/{event_id}", response_model=EventOut)
def update_event(
    cal_id: int,
    event_id: int,
    payload: EventPatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    ev = (
        db.query(CalendarEvent)
        .join(CropCalendar)
        .filter(
            CalendarEvent.id == event_id,
            CalendarEvent.calendar_id == cal_id,
            CropCalendar.user_id == current_user.id,
        )
        .first()
    )
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")

    if payload.is_completed is not None:
        ev.is_completed = payload.is_completed
        ev.completed_at = datetime.utcnow() if payload.is_completed else None
    if payload.notes is not None:
        ev.notes = payload.notes

    db.commit()
    db.refresh(ev)
    return ev


@router.delete("/{cal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_calendar(
    cal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> None:
    cal = (
        db.query(CropCalendar)
        .filter(CropCalendar.id == cal_id, CropCalendar.user_id == current_user.id)
        .first()
    )
    if not cal:
        raise HTTPException(status_code=404, detail="Calendar not found")
    db.delete(cal)
    db.commit()
