from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class SoilPredictionRequest(BaseModel):
    crop: str = Field(min_length=2, max_length=50)
    ph: float = Field(ge=0, le=14)
    nitrogen: float = Field(ge=0, le=1000)
    phosphorus: float = Field(ge=0, le=1000)
    potassium: float = Field(ge=0, le=1000)
    moisture: float = Field(ge=0, le=100)
    texture: str = Field(min_length=2, max_length=30)
    temperature: Optional[float] = Field(default=None, ge=-20, le=60)
    humidity: Optional[float] = Field(default=None, ge=0, le=100)
    rainfall: Optional[float] = Field(default=None, ge=0, le=500)
    farm_id: Optional[int] = Field(default=None, ge=1)

    @field_validator("crop", "texture")
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value


class NutrientAnalysis(BaseModel):
    nutrient: str
    value: float
    unit: str
    target_min: float
    target_max: float
    status: str
    score: float


class FertilizerRecommendation(BaseModel):
    material: str
    application: str
    reason: str
    priority: str = "medium"


class CropPrediction(BaseModel):
    crop: str
    probability: float


class CropBenchmark(BaseModel):
    crop: str
    target_nitrogen: float
    target_phosphorus: float
    target_potassium: float
    target_ph: float
    target_moisture: float
    preferred_textures: List[str]


class SoilPredictionResponse(BaseModel):
    crop: str
    farm_id: Optional[int] = None
    health_score: int
    suitability_score: float
    suitability: str
    predicted_crop: str
    classifier_confidence: float
    classifier_status: str
    ood_distance: float
    ood_reason: Optional[str] = None
    top_predictions: List[CropPrediction]
    model_version: str
    weather_source: str
    texture_multiplier: float
    summary: str
    limiting_factors: List[str]
    nutrients: List[NutrientAnalysis]
    recommendations: List[FertilizerRecommendation]
    benchmark: CropBenchmark
