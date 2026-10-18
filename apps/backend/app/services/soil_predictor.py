import csv
import math
import statistics
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

from app.schemas.soil import (
    CropBenchmark,
    CropPrediction,
    FertilizerRecommendation,
    NutrientAnalysis,
    SoilPredictionRequest,
    SoilPredictionResponse,
)
from app.services.soil_model import (
    MAHALANOBIS_THRESHOLD,
    MODEL_VERSION,
    load_soil_model,
    mahalanobis_distance,
)


def _find_dataset_path() -> Path:
    """Locate the optional repository dataset without assuming a fixed depth."""
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "datasets" / "soil recommendation" / "Crop_recommendation.csv"
        if candidate.is_file():
            return candidate
    return Path("__agrinexus_missing_dataset__") / "Crop_recommendation.csv"


DATASET_PATH = _find_dataset_path()
SUPPORTED_TEXTURES = ["Loamy", "Clayey", "Sandy", "Silty", "Peaty"]

# The source dataset contains chemical and climate requirements, but no texture
# column. These agronomic groupings keep the texture signal explicit and deterministic.
TEXTURE_PREFERENCES = {
    "rice": ["Clayey", "Loamy"],
    "jute": ["Loamy", "Silty"],
    "coconut": ["Sandy", "Loamy"],
    "coffee": ["Loamy", "Silty"],
    "cotton": ["Loamy", "Sandy"],
    "groundnut": ["Sandy", "Loamy"],
    "mothbeans": ["Sandy", "Loamy"],
    "mungbean": ["Loamy", "Sandy"],
    "maize": ["Loamy", "Silty"],
    "chickpea": ["Loamy", "Sandy"],
    "lentil": ["Loamy", "Silty"],
}
CROP_ALIASES = {"corn": "maize", "gram": "chickpea", "ground nut": "groundnut"}


def _fallback_rows() -> Dict[str, List[Tuple[float, float, float, float, float]]]:
    return {
        "rice": [(90, 42, 43, 6.5, 82)],
        "maize": [(77, 48, 19, 6.2, 65)],
        "cotton": [(117, 46, 20, 6.9, 79)],
        "chickpea": [(40, 68, 80, 6.5, 17)],
        "pigeonpeas": [(21, 57, 22, 5.7, 48)],
        "banana": [(100, 82, 50, 5.9, 80)],
    }


def _load_requirements() -> Dict[str, Dict[str, float]]:
    grouped: Dict[str, List[Tuple[float, float, float, float, float]]] = {}
    try:
        with DATASET_PATH.open(newline="", encoding="utf-8") as dataset:
            for row in csv.DictReader(dataset):
                crop = row["label"].strip().lower()
                grouped.setdefault(crop, []).append(
                    (
                        float(row["N"]),
                        float(row["P"]),
                        float(row["K"]),
                        float(row["ph"]),
                        float(row["humidity"]),
                    )
                )
    except (OSError, KeyError, ValueError):
        grouped = _fallback_rows()

    requirements = {}
    for crop, rows in grouped.items():
        columns = list(zip(*rows))
        requirements[crop] = {
            "nitrogen": statistics.fmean(columns[0]),
            "phosphorus": statistics.fmean(columns[1]),
            "potassium": statistics.fmean(columns[2]),
            "ph": statistics.fmean(columns[3]),
            # The recommendation dataset exposes humidity rather than soil
            # moisture. A bounded fraction is used as a moisture proxy.
            "moisture": max(18.0, min(55.0, statistics.fmean(columns[4]) * 0.45)),
        }
    return requirements


CROP_REQUIREMENTS = _load_requirements()


def _available_requirements() -> Dict[str, Dict[str, float]]:
    if len(CROP_REQUIREMENTS) >= 22:
        return CROP_REQUIREMENTS
    try:
        artifact_requirements = load_soil_model().get("crop_requirements", {})
        return {**CROP_REQUIREMENTS, **artifact_requirements}
    except Exception:
        return CROP_REQUIREMENTS


def _normalise_crop(crop: str, requirements: Dict[str, Dict[str, float]]) -> str:
    key = " ".join(crop.strip().lower().replace("_", " ").replace("-", " ").split())
    key = CROP_ALIASES.get(key, key)
    if key not in requirements:
        choices = ", ".join(sorted(requirements))
        raise ValueError(f"Unsupported crop '{crop}'. Choose one of: {choices}.")
    return key


def _metric(
    nutrient: str,
    value: float,
    target: float,
    tolerance: float,
    unit: str,
    minimum: float,
    maximum: float,
) -> NutrientAnalysis:
    target_min = max(minimum, target - tolerance)
    target_max = min(maximum, target + tolerance)
    distance_score = max(0.0, 100.0 * (1 - abs(value - target) / tolerance))
    if value < target_min:
        status = "low"
    elif value > target_max:
        status = "high"
    else:
        status = "optimal"
    return NutrientAnalysis(
        nutrient=nutrient,
        value=round(value, 2),
        unit=unit,
        target_min=round(target_min, 2),
        target_max=round(target_max, 2),
        status=status,
        score=round(distance_score, 1),
    )


def get_benchmarks() -> List[CropBenchmark]:
    requirements = _available_requirements()
    benchmarks = []
    for crop, target in sorted(requirements.items()):
        benchmarks.append(
            CropBenchmark(
                crop=crop,
                target_nitrogen=round(target["nitrogen"], 1),
                target_phosphorus=round(target["phosphorus"], 1),
                target_potassium=round(target["potassium"], 1),
                target_ph=round(target["ph"], 2),
                target_moisture=round(target["moisture"], 1),
                preferred_textures=TEXTURE_PREFERENCES.get(crop, ["Loamy"]),
            )
        )
    return benchmarks


SAFE_WEATHER_DEFAULTS = {
    "temperature": 28.0,
    "humidity": 65.0,
    "rainfall": 100.0,
}


def _weather_values(payload: SoilPredictionRequest) -> Tuple[Dict[str, float], str]:
    values = {
        "temperature": payload.temperature if payload.temperature is not None else SAFE_WEATHER_DEFAULTS["temperature"],
        "humidity": payload.humidity if payload.humidity is not None else SAFE_WEATHER_DEFAULTS["humidity"],
        "rainfall": payload.rainfall if payload.rainfall is not None else SAFE_WEATHER_DEFAULTS["rainfall"],
    }
    source = "manual_inputs" if all(value is not None for value in (payload.temperature, payload.humidity, payload.rainfall)) else "safe_defaults"
    return values, source


def _hard_ood_reasons_from_values(
    ph: float,
    nitrogen: float,
    phosphorus: float,
    potassium: float,
    moisture: Optional[float] = None,
) -> List[str]:
    reasons = []
    if ph < 3.5 or ph > 9.5:
        reasons.append("pH outside 3.5–9.5")
    if nitrogen > 300:
        reasons.append("nitrogen above 300 mg/kg")
    if phosphorus > 200:
        reasons.append("phosphorus above 200 mg/kg")
    if potassium > 300:
        reasons.append("potassium above 300 mg/kg")
    if moisture is not None and (moisture < 5 or moisture > 90):
        reasons.append("moisture outside 5–90%")
    return reasons


def _hard_ood_reasons(payload: SoilPredictionRequest) -> List[str]:
    return _hard_ood_reasons_from_values(
        ph=payload.ph,
        nitrogen=payload.nitrogen,
        phosphorus=payload.phosphorus,
        potassium=payload.potassium,
        moisture=payload.moisture,
    )


def predict_soil(payload: SoilPredictionRequest) -> SoilPredictionResponse:
    requirements = _available_requirements()
    crop = _normalise_crop(payload.crop, requirements)
    target = requirements[crop]
    textures = TEXTURE_PREFERENCES.get(crop, ["Loamy"])
    weather, weather_source = _weather_values(payload)
    artifact = load_soil_model()

    model_features = {
        "N": payload.nitrogen,
        "P": payload.phosphorus,
        "K": payload.potassium,
        "temperature": weather["temperature"],
        "humidity": weather["humidity"],
        "ph": payload.ph,
        "rainfall": weather["rainfall"],
    }
    feature_vector = [[model_features[name] for name in artifact["feature_names"]]]
    probabilities = np.asarray(artifact["model"].predict_proba(feature_vector)[0], dtype=float)
    classes = [str(item).lower() for item in artifact["classes"]]
    ranked_indices = np.argsort(probabilities)[::-1]
    predicted_crop = classes[int(ranked_indices[0])]
    classifier_confidence = float(probabilities[int(ranked_indices[0])])
    top_predictions = [
        CropPrediction(crop=classes[int(index)].title(), probability=round(float(probabilities[int(index)]), 4))
        for index in ranked_indices[:3]
    ]
    ood_distance = mahalanobis_distance(model_features, artifact)
    mahalanobis_threshold = float(artifact.get("mahalanobis_threshold", MAHALANOBIS_THRESHOLD))
    hard_ood = _hard_ood_reasons(payload)
    soft_ood = []
    if weather_source == "safe_defaults":
        soft_ood.append("weather features missing; safe defaults used")
    if classifier_confidence < 0.40:
        soft_ood.append(f"classifier confidence {classifier_confidence:.2f} below 0.40")
    if ood_distance > mahalanobis_threshold:
        soft_ood.append(f"Mahalanobis distance {ood_distance:.1f} exceeds {mahalanobis_threshold:.1f}")

    nutrients = [
        _metric("Nitrogen", payload.nitrogen, target["nitrogen"], 18.0, "mg/kg", 0, 1000),
        _metric("Phosphorus", payload.phosphorus, target["phosphorus"], 16.0, "mg/kg", 0, 1000),
        _metric("Potassium", payload.potassium, target["potassium"], 18.0, "mg/kg", 0, 1000),
        _metric("pH", payload.ph, target["ph"], 0.75, "pH", 0, 14),
        _metric("Moisture", payload.moisture, target["moisture"], 12.0, "%", 0, 100),
    ]
    texture_multiplier = 1.0 if payload.texture.lower() in {item.lower() for item in textures} else 0.85
    target_probability = float(probabilities[classes.index(crop)])
    suitability_score = 0.0 if hard_ood else round(target_probability * texture_multiplier * 100, 1)
    health_score = 0 if hard_ood else max(0, min(100, round(suitability_score)))
    if hard_ood:
        suitability = "Unsuitable"
        classifier_status = "hard_ood"
    elif soft_ood:
        suitability = "Ambiguous / Low Confidence Fit"
        classifier_status = "soft_ood"
    else:
        suitability = (
            "Excellent" if health_score >= 80 else
            "Good" if health_score >= 65 else
            "Moderate" if health_score >= 50 else
            "Needs attention"
        )
        classifier_status = "confident"

    limiting_factors = []
    for nutrient in nutrients:
        if nutrient.status != "optimal":
            limiting_factors.append(f"{nutrient.nutrient} is {nutrient.status}")
    if texture_multiplier < 1.0:
        limiting_factors.append(f"Prefer {', '.join(textures).lower()} texture")
    if predicted_crop != crop:
        limiting_factors.append(f"Model predicts {predicted_crop.title()} rather than {crop.title()}")
    limiting_factors.extend(soft_ood)

    recommendations: List[FertilizerRecommendation] = []
    by_name = {item.nutrient: item for item in nutrients}
    if hard_ood:
        recommendations.append(FertilizerRecommendation(
            material="Soil laboratory retest",
            application="Do not apply a major amendment until the sample and field conditions are verified",
            reason="The hard plausibility gate found chemically hostile or non-agronomic input values.",
            priority="high",
        ))
    elif by_name["Nitrogen"].status == "low":
        recommendations.append(FertilizerRecommendation(
            material="Urea or a certified nitrogen source",
            application=f"Apply about {max(15, math.ceil((target['nitrogen'] - payload.nitrogen) * 2.2))} kg/ha in split doses",
            reason="Nitrogen is below the crop benchmark and may limit canopy and yield development.",
            priority="high",
        ))
    if not hard_ood and by_name["Phosphorus"].status == "low":
        recommendations.append(FertilizerRecommendation(
            material="DAP or another phosphate source",
            application=f"Apply about {max(10, math.ceil((target['phosphorus'] - payload.phosphorus) * 2.0))} kg/ha near the root zone",
            reason="Phosphorus is low; prioritize it at sowing for root establishment.",
            priority="high",
        ))
    if not hard_ood and by_name["Potassium"].status == "low":
        recommendations.append(FertilizerRecommendation(
            material="MOP (potassium chloride) or a soil-test-approved potash source",
            application=f"Apply about {max(10, math.ceil((target['potassium'] - payload.potassium) * 1.7))} kg/ha",
            reason="Potassium supports water regulation and crop resilience.",
            priority="medium",
        ))
    if not hard_ood and by_name["pH"].status == "low":
        recommendations.append(FertilizerRecommendation(
            material="Agricultural lime",
            application="Use a laboratory lime requirement before applying; incorporate gradually",
            reason="The soil is acidic for this crop benchmark.",
            priority="medium",
        ))
    elif not hard_ood and by_name["pH"].status == "high":
        recommendations.append(FertilizerRecommendation(
            material="Organic matter and gypsum where locally advised",
            application="Use a laboratory amendment recommendation and avoid over-liming",
            reason="The soil is alkaline for this crop benchmark.",
            priority="medium",
        ))
    if not hard_ood and by_name["Moisture"].status == "low":
        recommendations.append(FertilizerRecommendation(
            material="Irrigation and organic mulch",
            application=f"Irrigate in smaller cycles until moisture approaches {target['moisture']:.0f}%",
            reason="Moisture is below the crop target and nutrient uptake may be constrained.",
            priority="high",
        ))
    elif not hard_ood and by_name["Moisture"].status == "high":
        recommendations.append(FertilizerRecommendation(
            material="Drainage and surface aeration",
            application="Pause irrigation and inspect field drainage before the next watering",
            reason="Excess moisture can reduce root oxygen and increase disease pressure.",
            priority="high",
        ))
    if not recommendations:
        recommendations.append(FertilizerRecommendation(
            material="Well-decomposed compost",
            application="Maintain 2–3 t/ha according to the farm nutrient budget",
            reason="All measured indicators are within the crop benchmark; maintain organic matter.",
            priority="low",
        ))

    if hard_ood:
        summary = "Barren / Chemically Hostile Soil: verify the field sample before using a crop recommendation."
    elif soft_ood:
        summary = f"The model most strongly predicts {predicted_crop.title()} at {classifier_confidence:.0%}, but this profile is outside the validated confidence range."
    else:
        summary = (
            f"{payload.crop.strip().title()} has {suitability.lower()} suitability at {health_score}/100. "
            f"The model most strongly predicts {predicted_crop.title()} at {classifier_confidence:.0%}."
        )
        if limiting_factors:
            summary += " Focus first on " + ", ".join(limiting_factors[:2]) + "."
    benchmark = CropBenchmark(
        crop=crop,
        target_nitrogen=round(target["nitrogen"], 1),
        target_phosphorus=round(target["phosphorus"], 1),
        target_potassium=round(target["potassium"], 1),
        target_ph=round(target["ph"], 2),
        target_moisture=round(target["moisture"], 1),
        preferred_textures=textures,
    )
    return SoilPredictionResponse(
        crop=payload.crop.strip().title(),
        farm_id=payload.farm_id,
        health_score=health_score,
        suitability_score=suitability_score,
        suitability=suitability,
        predicted_crop=predicted_crop.title(),
        classifier_confidence=round(classifier_confidence, 4),
        classifier_status=classifier_status,
        ood_distance=round(ood_distance, 4),
        ood_reason="; ".join(hard_ood or soft_ood) if (hard_ood or soft_ood) else None,
        top_predictions=top_predictions,
        model_version=str(artifact.get("model_version", MODEL_VERSION)),
        weather_source=weather_source,
        texture_multiplier=texture_multiplier,
        summary=summary,
        limiting_factors=limiting_factors,
        nutrients=nutrients,
        recommendations=recommendations,
        benchmark=benchmark,
    )
