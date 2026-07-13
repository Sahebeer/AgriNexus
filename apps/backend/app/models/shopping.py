from datetime import datetime
from sqlalchemy import (
    Boolean, Column, Float, ForeignKey,
    Integer, String, DateTime, Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


class ShoppingList(Base):
    """Top-level shopping list — one per generation request."""
    __tablename__ = "shopping_lists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String, nullable=False)           # e.g. "Kharif Rice — 2.5 Ha"
    crop = Column(String, nullable=False)
    farm_size = Column(Float, nullable=False)        # hectares
    soil_type = Column(String, nullable=True)
    season = Column(String, nullable=True)           # Kharif | Rabi | Zaid
    growth_stage = Column(String, nullable=True)     # Pre-Sowing | Sowing | Vegetative | ...

    estimated_total_cost = Column(Float, default=0.0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    items = relationship("ShoppingListItem", back_populates="shopping_list",
                         cascade="all, delete-orphan", order_by="ShoppingListItem.category")


class ShoppingListItem(Base):
    """Individual line item within a shopping list."""
    __tablename__ = "shopping_list_items"

    id = Column(Integer, primary_key=True, index=True)
    list_id = Column(Integer, ForeignKey("shopping_lists.id", ondelete="CASCADE"), nullable=False, index=True)

    category = Column(String, nullable=False)        # Seeds | Fertilizers | Pesticides | Tools | ...
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    quantity = Column(Float, nullable=False, default=1.0)
    unit = Column(String, nullable=False, default="kg")
    unit_cost = Column(Float, nullable=False, default=0.0)   # INR per unit
    total_cost = Column(Float, nullable=False, default=0.0)  # quantity × unit_cost

    is_purchased = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)

    shopping_list = relationship("ShoppingList", back_populates="items")
