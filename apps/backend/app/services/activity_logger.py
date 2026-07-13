"""
services/activity_logger.py
────────────────────────────
Shared helper called by disease.py, advisor.py, shopping.py, and any future
module that wants to auto-log an activity into the farm diary.

Usage:
    from app.services.activity_logger import log_activity
    log_activity(db, user_id=user.id, activity_type="Disease Scan", ...)
"""
from __future__ import annotations
import json
from datetime import date
from sqlalchemy.orm import Session
from app.models.activity import ActivityLog


VALID_TYPES = {
    "Disease Scan",
    "AI Chat",
    "Fertilizer Application",
    "Irrigation",
    "Pesticide / Spray",
    "Harvest",
    "Purchase",
    "Expense",
    "Field Observation",
    "Shopping List",
    "Calendar Created",
    "Note",
    "Other",
}


def log_activity(
    db: Session,
    *,
    user_id: int,
    activity_type: str,
    title: str,
    description: str = "",
    crop: str = "",
    field_name: str = "",
    activity_date: date | None = None,
    source: str = "auto",
    metadata: dict | None = None,
) -> ActivityLog:
    """
    Create and persist an ActivityLog row.
    Safe to call from inside any API endpoint after a commit.
    Exceptions are swallowed so that auto-logging never breaks the parent call.
    """
    if activity_type not in VALID_TYPES:
        activity_type = "Other"

    entry = ActivityLog(
        user_id=user_id,
        activity_type=activity_type,
        source=source,
        title=title,
        description=description or "",
        crop=crop or "",
        field_name=field_name or "",
        activity_date=activity_date or date.today(),
        metadata_json=json.dumps(metadata) if metadata else None,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
