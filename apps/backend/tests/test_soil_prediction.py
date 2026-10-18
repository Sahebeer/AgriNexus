import json
from pathlib import Path

import joblib
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.soil import SoilPredictionRequest
from app.services.soil_predictor import get_benchmarks, predict_soil


client = TestClient(app)
ARTIFACT_PATH = Path(__file__).resolve().parents[1] / "app" / "services" / "artifacts" / "soil_crop_classifier.joblib"
REPORT_PATH = ARTIFACT_PATH.with_suffix(".report.json")


def test_balanced_soil_profile_is_suitable_for_rice():
    result = predict_soil(SoilPredictionRequest(
        crop="rice",
        ph=6.5,
        nitrogen=90,
        phosphorus=42,
        potassium=43,
        moisture=37,
        texture="Clayey",
        temperature=20.88,
        humidity=82.0,
        rainfall=202.9,
    ))

    assert result.health_score >= 80
    assert result.suitability in {"Excellent", "Good"}
    assert result.predicted_crop == "Rice"
    assert result.classifier_status == "confident"
    assert all(item.status == "optimal" for item in result.nutrients)
    assert result.recommendations


def test_extreme_ph_is_flagged_and_recommends_amendment():
    result = predict_soil(SoilPredictionRequest(
        crop="maize",
        ph=14,
        nitrogen=10,
        phosphorus=10,
        potassium=10,
        moisture=5,
        texture="Sandy",
    ))

    assert result.health_score < 50
    assert any(item.nutrient == "pH" and item.status == "high" for item in result.nutrients)
    assert any("laboratory retest" in item.material.lower() for item in result.recommendations)


def test_hard_ood_profile_is_unsuitable():
    result = predict_soil(SoilPredictionRequest(
        crop="rice",
        ph=14,
        nitrogen=90,
        phosphorus=42,
        potassium=43,
        moisture=35,
        texture="Clayey",
        temperature=25,
        humidity=65,
        rainfall=100,
    ))

    assert result.health_score == 0
    assert result.suitability == "Unsuitable"
    assert result.classifier_status == "hard_ood"
    assert result.ood_reason


def test_soft_ood_profile_is_not_presented_as_reliable():
    result = predict_soil(SoilPredictionRequest(
        crop="rice",
        ph=7.0,
        nitrogen=80,
        phosphorus=50,
        potassium=50,
        moisture=40,
        texture="Loamy",
        temperature=-20,
        humidity=0,
        rainfall=500,
    ))

    assert result.classifier_status == "soft_ood"
    assert result.suitability == "Ambiguous / Low Confidence Fit"
    assert result.ood_reason


def test_benchmarks_are_loaded_from_crop_dataset():
    benchmarks = get_benchmarks()
    assert len(benchmarks) >= 20
    assert {item.crop for item in benchmarks}.issuperset({"rice", "maize", "cotton"})


def test_artifact_contract_and_report_metrics():
    artifact = joblib.load(ARTIFACT_PATH)
    report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))

    assert artifact["artifact_type"] == "soil_crop_classifier"
    assert artifact["feature_names"] == ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
    assert len(artifact["classes"]) == 22
    assert report["feature_names"] == artifact["feature_names"]
    assert report["metrics"]["test"]["accuracy"] >= 0.95
    assert len(report["metrics"]["test"]["confusion_matrix"]) == 22


def test_missing_weather_inputs_use_explicit_safe_defaults():
    result = predict_soil(SoilPredictionRequest(
        crop="rice",
        ph=6.5,
        nitrogen=90,
        phosphorus=42,
        potassium=43,
        moisture=37,
        texture="Clayey",
    ))

    assert result.weather_source == "safe_defaults"


def test_soil_api_validates_and_returns_prediction():
    response = client.post("/api/v1/soil/predict", json={
        "crop": "chickpea",
        "ph": 6.5,
        "nitrogen": 40,
        "phosphorus": 68,
        "potassium": 80,
        "moisture": 25,
        "texture": "Loamy",
        "temperature": 25,
        "humidity": 65,
        "rainfall": 100,
    })
    assert response.status_code == 200
    body = response.json()
    assert body["crop"] == "Chickpea"
    assert "nutrients" in body
    assert "recommendations" in body
    assert "predicted_crop" in body
    assert "classifier_confidence" in body
    assert len(body["top_predictions"]) == 3
    assert body["classifier_status"] in {"confident", "soft_ood", "hard_ood"}
    assert body["weather_source"] == "manual_inputs"


def test_soil_api_rejects_invalid_ph():
    response = client.post("/api/v1/soil/predict", json={
        "crop": "rice",
        "ph": 15,
        "nitrogen": 90,
        "phosphorus": 42,
        "potassium": 43,
        "moisture": 30,
        "texture": "Loamy",
    })
    assert response.status_code == 422
