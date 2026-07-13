from datetime import date
from sqlalchemy import (
    Column, Date, Float, ForeignKey,
    Integer, String, DateTime, Text, Enum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


class Farm(Base):
    """
    Farm / Field management table.
    Tracks geographic details, crop types, and farming habits.
    """
    __tablename__ = "farms"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String, nullable=False)
    area = Column(Float, nullable=False)            # e.g., 2.5
    area_unit = Column(String, default="hectares")  # hectares | acres

    state = Column(String, nullable=False)
    district = Column(String, nullable=False)
    village = Column(String, nullable=False)
    gps_coordinates = Column(String, nullable=True) # e.g. "30.9012 N, 75.8568 E"

    current_crop = Column(String, nullable=False)
    sowing_date = Column(Date, nullable=False)
    irrigation_method = Column(String, nullable=False) # Drip, Sprinkler, Flood, etc.

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # Relationships
    soil_reports = relationship(
        "SoilReport",
        back_populates="farm",
        cascade="all, delete-orphan",
        order_by="SoilReport.test_date.desc()",
    )


class SoilReport(Base):
    """
    Soil Health reports for a specific farm field.
    Maintains full historical records for trend monitoring and iot feeds.
    """
    __tablename__ = "soil_reports"

    id = Column(Integer, primary_key=True, index=True)
    farm_id = Column(Integer, ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)

    # Core chemical and physical attributes
    ph = Column(Float, nullable=False)                         # 0 to 14
    nitrogen = Column(Float, nullable=False)                   # N mg/kg (or ppm)
    phosphorus = Column(Float, nullable=False)                 # P mg/kg
    potassium = Column(Float, nullable=False)                  # K mg/kg
    organic_carbon = Column(Float, nullable=False)             # percentage %
    soil_moisture = Column(Float, nullable=False)              # percentage %
    electrical_conductivity = Column(Float, nullable=False)    # EC dS/m
    temperature = Column(Float, nullable=False)                # Celsius °C
    humidity = Column(Float, nullable=False)                   # relative humidity %
    soil_texture = Column(String, nullable=False)              # Sandy, Clayey, Loamy, Silt, etc.

    test_date = Column(Date, nullable=False, server_default=func.current_date())
    
    # Data source metadata (supports IoT sensors, manual input, lab audits)
    source = Column(String, default="manual")                  # "manual" | "sensor" | "lab" | "api"

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    farm = relationship("Farm", back_populates="soil_reports")
