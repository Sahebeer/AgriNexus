from sqlalchemy import Column, Date, Float, ForeignKey, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.db.database import Base


class Expense(Base):
    """
    Farming expense logs for spending analysis, visual reports,
    and AI-powered cost optimization recommendations.
    """
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    category = Column(String, nullable=False)        # Seeds | Fertilizers | Labor | Irrigation | Machinery | Transport | Miscellaneous
    description = Column(Text, nullable=True)
    amount = Column(Float, nullable=False)
    expense_date = Column(Date, nullable=False, server_default=func.current_date())
    crop = Column(String, nullable=True)             # e.g. Rice, Wheat (optional crop mapping)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
