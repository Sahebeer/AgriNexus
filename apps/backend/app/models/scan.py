from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean
from sqlalchemy.sql import func
from app.db.database import Base

class ScanLog(Base):
    __tablename__ = "scan_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    image_path = Column(String, nullable=True) # Location where scanned image is stored if cached
    predicted_disease_id = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    
    user_feedback_correct = Column(Boolean, nullable=True) # null = no feedback, True = correct, False = incorrect
    expert_correction_id = Column(String, nullable=True) # Overridden classification label by admin/expert
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
