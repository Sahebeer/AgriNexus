from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.sql import func
from app.db.database import Base


class VegetationIndexObservation(Base):
    """
    Per-scene Sentinel-2 L2A zonal statistics for one field geometry.
    Acts as the cache for the real NDVI pipeline: one row per (geometry, scene),
    including scenes rejected for low valid-pixel %, so they are not re-downloaded.
    """
    __tablename__ = "vegetation_index_observations"
    __table_args__ = (UniqueConstraint("geom_key", "scene_id", name="uq_vegobs_geom_scene"),)

    id = Column(Integer, primary_key=True, index=True)
    geom_key = Column(String(40), nullable=False, index=True)   # sha1 of the field geometry
    farm_id = Column(Integer, ForeignKey("farms.id", ondelete="CASCADE"), nullable=True, index=True)

    scene_id = Column(String, nullable=False)
    observation_date = Column(Date, nullable=False, index=True)
    status = Column(String, nullable=False)                    # ok | low_valid | error

    scene_cloud_pct = Column(Float, nullable=True)              # scene-level eo:cloud_cover
    valid_pixel_pct = Column(Float, nullable=True)              # unmasked share of field pixels
    field_pixel_count = Column(Integer, nullable=True)

    ndvi_mean = Column(Float, nullable=True)
    ndvi_median = Column(Float, nullable=True)
    ndvi_p10 = Column(Float, nullable=True)
    ndvi_p90 = Column(Float, nullable=True)
    ndvi_std = Column(Float, nullable=True)
    evi_mean = Column(Float, nullable=True)
    savi_mean = Column(Float, nullable=True)
    ndwi_mean = Column(Float, nullable=True)

    source = Column(String, nullable=False, default="element84-earth-search/sentinel-2-l2a")
    error = Column(String, nullable=True)
    fetched_at = Column(DateTime(timezone=True), server_default=func.now())


class WeatherIndexSnapshot(Base):
    """Cached Open-Meteo agro-weather indices (GDD, water balance, drought) per rounded point."""
    __tablename__ = "weather_index_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    lat = Column(Float, nullable=False, index=True)
    lon = Column(Float, nullable=False, index=True)
    sowing_key = Column(String, nullable=False, default="")
    payload = Column(String, nullable=False)          # JSON with values + provenance
    fetched_at = Column(DateTime(timezone=True), server_default=func.now())
