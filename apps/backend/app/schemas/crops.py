from typing import List, Optional
from pydantic import BaseModel, Field


class SoilOverrides(BaseModel):
    nitrogen: Optional[float] = Field(default=None, ge=0, le=1000)
    phosphorus: Optional[float] = Field(default=None, ge=0, le=1000)
    potassium: Optional[float] = Field(default=None, ge=0, le=1000)
    ph: Optional[float] = Field(default=None, ge=0, le=14)
    moisture: Optional[float] = Field(default=None, ge=0, le=100)
    temperature: Optional[float] = Field(default=None, ge=-20, le=60)
    humidity: Optional[float] = Field(default=None, ge=0, le=100)
    rainfall: Optional[float] = Field(default=None, ge=0, le=500)


class CropRecommendationRequest(BaseModel):
    farm_id: Optional[int] = Field(default=None, ge=1)
    month: Optional[int] = Field(default=None, ge=1, le=12)
    top_n: int = Field(default=5, ge=1, le=10)
    overrides: Optional[SoilOverrides] = None


class CropRecommendationItem(BaseModel):
    rank: int
    crop: str
    model_probability: float
    season_fit: str  # "in_season" | "perennial" | "off_season"
    season_multiplier: float
    texture_multiplier: float
    score: float
    reasons: List[str]
    cautions: List[str]


class CropRecommendationResponse(BaseModel):
    farm_id: Optional[int] = None
    month: int
    season: str
    soil_source: str  # "latest_soil_report" | "overrides"
    weather_source: str  # "live" | "safe_defaults" | "manual_inputs"
    ood_status: str  # "ok" | "soft_ood" | "hard_ood"
    ood_reason: Optional[str] = None
    recommendations: List[CropRecommendationItem]
    model_version: str
