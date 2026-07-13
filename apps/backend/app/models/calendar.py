from datetime import date
from sqlalchemy import (
    Boolean, Column, Date, ForeignKey,
    Integer, String, DateTime, Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


class CropCalendar(Base):
    """One calendar per crop sowing cycle."""
    __tablename__ = "crop_calendars"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String, nullable=False)           # e.g. "Kharif Rice 2025 — Punjab"
    crop = Column(String, nullable=False)
    variety = Column(String, nullable=True)
    location = Column(String, nullable=True)        # state / district
    sow_date = Column(Date, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    events = relationship(
        "CalendarEvent",
        back_populates="calendar",
        cascade="all, delete-orphan",
        order_by="CalendarEvent.scheduled_date",
    )


class CalendarEvent(Base):
    """A single farming activity event within a crop calendar."""
    __tablename__ = "calendar_events"

    id = Column(Integer, primary_key=True, index=True)
    calendar_id = Column(Integer, ForeignKey("crop_calendars.id", ondelete="CASCADE"), nullable=False, index=True)

    # Event classification
    event_type = Column(String, nullable=False)     # Land Preparation | Sowing | Irrigation | ...
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    scheduled_date = Column(Date, nullable=False)
    das = Column(Integer, nullable=True)            # Days After Sowing (negative = pre-sowing)

    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    calendar = relationship("CropCalendar", back_populates="events")
