from sqlalchemy import Column, Date, Float, ForeignKey, Integer, String, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


class SatelliteObservation(Base):
    """
    Caches historical calculated vegetation and crop indices 
    derived from Sentinel-2 L2A collections or telemetry.
    """
    __tablename__ = "satellite_observations"

    id = Column(Integer, primary_key=True, index=True)
    farm_id = Column(Integer, ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    
    observation_date = Column(Date, nullable=False, index=True)
    ndvi = Column(Float, nullable=True)            # Normalized Difference Vegetation Index (-1 to 1)
    ndwi = Column(Float, nullable=True)            # Normalized Difference Water Index (-1 to 1)
    cloud_cover = Column(Float, default=0.0)       # Cloud cover percentage
    source = Column(String, default="sentinel-1")  # "sentinel-1" | "sentinel-2" | "simulated"

    # Sentinel-1 SAR Radar Fields
    satellite = Column(String, default="Sentinel-1", nullable=True)
    acquisition_date = Column(Date, nullable=True)
    orbit = Column(String, default="ASCENDING", nullable=True)  # ASCENDING | DESCENDING
    polarization = Column(String, default="VV+VH", nullable=True)
    vv = Column(Float, nullable=True)              # Backscatter VV in dB
    vh = Column(Float, nullable=True)              # Backscatter VH in dB
    vv_vh_ratio = Column(Float, nullable=True)     # VV/VH ratio in dB
    processing_status = Column(String, default="calibrated", nullable=True)
    model_prediction = Column(String, nullable=True) # normal | vegetation_stress | excess_moisture | etc.
    model_confidence = Column(Float, nullable=True)
    raw_asset_reference = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Property alias for field_id <-> farm_id
    @property
    def field_id(self) -> int:
        return self.farm_id

    @field_id.setter
    def field_id(self, val: int):
        self.farm_id = val

    # Relationship
    farm = relationship("Farm")


class EarthIntelligenceForecast(Base):
    """
    AI-generated multi-window forecasts for a farm field.
    Predicts stress, disease risks, irrigation index, and soil trends.
    """
    __tablename__ = "earth_intelligence_forecasts"

    id = Column(Integer, primary_key=True, index=True)
    farm_id = Column(Integer, ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    
    forecast_date = Column(Date, nullable=False, server_default=func.current_date())
    target_date = Column(Date, nullable=False)
    window = Column(String, nullable=False)        # "weekly" | "monthly" | "seasonal"
    
    predicted_ndvi = Column(Float, nullable=False)
    crop_stress_index = Column(Float, nullable=False)      # 0 to 1 (low to high)
    irrigation_demand_index = Column(Float, nullable=False) # 0 to 1
    disease_risk_index = Column(Float, nullable=False)      # 0 to 1
    yield_trend = Column(Float, nullable=False)             # multiplier (e.g. 1.05 = +5% yield)
    soil_fertility_index = Column(Float, nullable=False)    # 0 to 1
    
    explanation = Column(Text, nullable=False)              # Explanatory narrative generated via feature importance
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    farm = relationship("Farm")
