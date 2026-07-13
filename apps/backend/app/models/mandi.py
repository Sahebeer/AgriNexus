from sqlalchemy import Column, Float, ForeignKey, Integer, String, DateTime, Text, Boolean
from sqlalchemy.sql import func
from app.db.database import Base


class MandiListing(Base):
    """
    Marketplace listings where farmers can sell crops and browse buyers.
    """
    __tablename__ = "mandi_listings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    crop = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String, nullable=False, default="qtl") # qtl (quintal) | kg | tonnes
    price_per_unit = Column(Float, nullable=False)        # price in INR per unit

    location = Column(String, nullable=False)
    contact_number = Column(String, nullable=False)
    listing_type = Column(String, nullable=False)         # "seller" (farmer selling) | "buyer" (trader buying)
    status = Column(String, default="active")             # "active" | "completed" | "cancelled"

    description = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
