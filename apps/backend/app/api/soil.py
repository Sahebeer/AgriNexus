from typing import List

from fastapi import APIRouter, HTTPException, status

from app.schemas.soil import CropBenchmark, SoilPredictionRequest, SoilPredictionResponse
from app.services.soil_model import SoilModelUnavailable
from app.services.soil_predictor import get_benchmarks, predict_soil


router = APIRouter()


@router.post("/predict", response_model=SoilPredictionResponse, status_code=status.HTTP_200_OK)
def predict_soil_health(payload: SoilPredictionRequest) -> SoilPredictionResponse:
    try:
        return predict_soil(payload)
    except SoilModelUnavailable as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get("/benchmarks", response_model=List[CropBenchmark])
def soil_benchmarks() -> List[CropBenchmark]:
    return get_benchmarks()
