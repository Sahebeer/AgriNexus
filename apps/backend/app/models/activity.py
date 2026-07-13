import json
from sqlalchemy import Column, Date, ForeignKey, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.db.database import Base


class ActivityLog(Base):
    """
    Universal farm activity journal entry.
    Records every significant farming event — auto-logged (scans, chats)
    or manually entered (irrigation, fertilizer, harvest, expense, note, etc.)
    """
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Activity classification
    activity_type = Column(String, nullable=False)   # Disease Scan | AI Chat | Fertilizer | Irrigation | ...
    source = Column(String, default="manual")         # "auto" | "manual"

    # Core fields
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    crop = Column(String, nullable=True)
    field_name = Column(String, nullable=True)

    # Date of activity (can differ from created_at for backdated entries)
    activity_date = Column(Date, nullable=False, server_default=func.current_date())

    # Flexible key-value extras (amount, unit, confidence, etc.)
    metadata_json = Column(Text, nullable=True)      # JSON string

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def get_metadata(self) -> dict:
        try:
            return json.loads(self.metadata_json) if self.metadata_json else {}
        except Exception:
            return {}
