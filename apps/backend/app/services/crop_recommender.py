from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
import numpy as np
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.farm import Farm, SoilReport
from app.schemas.crops import (
    CropRecommendationItem,
    CropRecommendationRequest,
    CropRecommendationResponse,
)
from app.services.crop_seasons import CROP_SEASONS, season_fit, season_for_month
from app.services.satellite import parse_gps_coordinates
from app.services.soil_model import (
    FEATURE_NAMES,
    MAHALANOBIS_THRESHOLD,
    MODEL_VERSION,
    load_soil_model,
    mahalanobis_distance,
)
from app.services.soil_predictor import (
    SAFE_WEATHER_DEFAULTS,
    TEXTURE_PREFERENCES,
    _hard_ood_reasons_from_values,
)
from app.services.weather import get_state_weather


def recommend_crops(
    payload: CropRecommendationRequest,
    user_id: int,
    db: Session,
) -> CropRecommendationResponse:
    farm: Optional[Farm] = None
    if payload.farm_id is not None:
        farm = db.query(Farm).filter(Farm.id == payload.farm_id, Farm.user_id == user_id).first()
        if not farm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Farm with ID {payload.farm_id} not found.",
            )

    # 1. Resolve month and seasonal context (Asia/Kolkata timezone UTC+5:30)
    if payload.month is not None:
        month = payload.month
    else:
        kolkata_now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
        month = kolkata_now.month

    season = season_for_month(month)

    # 2. Resolve Soil Parameters
    overrides = payload.overrides
    has_full_soil_overrides = (
        overrides is not None
        and overrides.nitrogen is not None
        and overrides.phosphorus is not None
        and overrides.potassium is not None
        and overrides.ph is not None
    )

    soil_texture: Optional[str] = None
    if has_full_soil_overrides:
        soil_source = "overrides"
        nitrogen = float(overrides.nitrogen)
        phosphorus = float(overrides.phosphorus)
        potassium = float(overrides.potassium)
        ph = float(overrides.ph)
        moisture = float(overrides.moisture) if overrides.moisture is not None else None
        if farm:
            latest_sr = (
                db.query(SoilReport)
                .filter(SoilReport.farm_id == farm.id)
                .order_by(SoilReport.test_date.desc(), SoilReport.created_at.desc())
                .first()
            )
            if latest_sr:
                soil_texture = latest_sr.soil_texture
    else:
        if not farm:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Farm ID is required unless full soil overrides (N, P, K, pH) are provided.",
            )
        latest_report = (
            db.query(SoilReport)
            .filter(SoilReport.farm_id == farm.id)
            .order_by(SoilReport.test_date.desc(), SoilReport.created_at.desc())
            .first()
        )
        if not latest_report:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No soil report for this farm; add one or provide overrides.",
            )
        soil_source = "latest_soil_report"
        nitrogen = float(latest_report.nitrogen)
        phosphorus = float(latest_report.phosphorus)
        potassium = float(latest_report.potassium)
        ph = float(latest_report.ph)
        moisture = (
            float(overrides.moisture)
            if (overrides and overrides.moisture is not None)
            else float(latest_report.soil_moisture)
        )
        soil_texture = latest_report.soil_texture

    # 3. Resolve Weather Parameters
    has_full_manual_weather = (
        overrides is not None
        and overrides.temperature is not None
        and overrides.humidity is not None
        and overrides.rainfall is not None
    )

    if has_full_manual_weather:
        temperature = float(overrides.temperature)
        humidity = float(overrides.humidity)
        rainfall = float(overrides.rainfall)
        weather_source = "manual_inputs"
    else:
        temperature = None
        humidity = None
        rainfall = None

        if overrides:
            if overrides.temperature is not None:
                temperature = float(overrides.temperature)
            if overrides.humidity is not None:
                humidity = float(overrides.humidity)
            if overrides.rainfall is not None:
                rainfall = float(overrides.rainfall)

        if farm and (temperature is None or humidity is None):
            lat, lon = None, None
            if farm.gps_coordinates:
                lat, lon = parse_gps_coordinates(farm.gps_coordinates)
            user_state = farm.state or "Punjab"
            live_w = get_state_weather(user_state, lat, lon)
            if temperature is None:
                temperature = float(live_w.get("temperature", SAFE_WEATHER_DEFAULTS["temperature"]))
            if humidity is None:
                humidity = float(live_w.get("humidity", SAFE_WEATHER_DEFAULTS["humidity"]))

        if temperature is None:
            temperature = float(SAFE_WEATHER_DEFAULTS["temperature"])
        if humidity is None:
            humidity = float(SAFE_WEATHER_DEFAULTS["humidity"])
        if rainfall is None:
            rainfall = float(SAFE_WEATHER_DEFAULTS["rainfall"])

        weather_source = (
            "manual_inputs"
            if (
                overrides is not None
                and overrides.temperature is not None
                and overrides.humidity is not None
                and overrides.rainfall is not None
            )
            else "safe_defaults"
        )

    # 4. Hard OOD Plausibility Check
    hard_reasons = _hard_ood_reasons_from_values(
        ph=ph,
        nitrogen=nitrogen,
        phosphorus=phosphorus,
        potassium=potassium,
        moisture=moisture,
    )
    if hard_reasons:
        return CropRecommendationResponse(
            farm_id=payload.farm_id,
            month=month,
            season=season,
            soil_source=soil_source,
            weather_source=weather_source,
            ood_status="hard_ood",
            ood_reason="; ".join(hard_reasons),
            recommendations=[],
            model_version=MODEL_VERSION,
        )

    # 5. ML Model Inference & Soft OOD Detection
    artifact = load_soil_model()
    model_features = {
        "N": nitrogen,
        "P": phosphorus,
        "K": potassium,
        "temperature": temperature,
        "humidity": humidity,
        "ph": ph,
        "rainfall": rainfall,
    }

    feature_vector = [[model_features[name] for name in artifact["feature_names"]]]
    probabilities = np.asarray(artifact["model"].predict_proba(feature_vector)[0], dtype=float)
    classes = [str(item).lower() for item in artifact["classes"]]

    ood_distance = mahalanobis_distance(model_features, artifact)
    mahalanobis_threshold = float(artifact.get("mahalanobis_threshold", MAHALANOBIS_THRESHOLD))
    max_prob = float(np.max(probabilities))

    soft_reasons: List[str] = []
    if max_prob < 0.40:
        soft_reasons.append(f"Classifier confidence ({max_prob:.2f}) is below 0.40")
    if ood_distance > mahalanobis_threshold:
        soft_reasons.append(f"Mahalanobis distance ({ood_distance:.1f}) exceeds {mahalanobis_threshold:.1f}")
    if weather_source == "safe_defaults":
        soft_reasons.append("Default safe weather assumptions used (rainfall)")

    is_soft_ood = len(soft_reasons) > 0
    ood_status = "soft_ood" if is_soft_ood else "ok"
    ood_reason = "; ".join(soft_reasons) if is_soft_ood else None

    # 6. Score and Rank All 22 Crops
    scored_items: List[CropRecommendationItem] = []
    for idx, crop_name in enumerate(classes):
        prob = float(probabilities[idx])
        fit_status, s_mult = season_fit(crop_name, season)

        preferred_textures = TEXTURE_PREFERENCES.get(crop_name, ["Loamy"])
        texture_mismatch = False
        if soil_texture and soil_texture.strip():
            if soil_texture.strip().lower() in [t.lower() for t in preferred_textures]:
                t_mult = 1.0
            else:
                t_mult = 0.85
                texture_mismatch = True
        else:
            t_mult = 1.0

        score = round(prob * s_mult * t_mult * 100.0, 1)

        # Factual reasons
        reasons: List[str] = []
        if prob >= 0.20:
            reasons.append(f"High ML biochemical suitability ({prob * 100:.1f}%)")
        elif prob >= 0.05:
            reasons.append(f"Viable agronomic compatibility ({prob * 100:.1f}%)")

        if fit_status == "in_season":
            reasons.append(f"Optimal alignment with {season.title()} cropping season")
        elif fit_status == "perennial":
            reasons.append("Perennial crop suitable for long-term field management")

        if soil_texture and not texture_mismatch:
            reasons.append(f"Matches preferred {soil_texture.title()} soil texture")

        if not reasons:
            reasons.append("Secondary agronomic alternative")

        # Specific cautions
        cautions: List[str] = []
        if fit_status == "off_season":
            typical = ", ".join(CROP_SEASONS.get(crop_name, [])).title()
            cautions.append(f"Off-season for {season.title()} (typically sown in {typical})")
        if texture_mismatch and soil_texture:
            cautions.append(f"Prefers {', '.join(preferred_textures)} texture rather than {soil_texture}")
        if is_soft_ood:
            cautions.append(f"Uncertainty flag: {ood_reason}")

        scored_items.append(
            CropRecommendationItem(
                rank=0,
                crop=crop_name.title(),
                model_probability=round(prob, 4),
                season_fit=fit_status,
                season_multiplier=s_mult,
                texture_multiplier=t_mult,
                score=score,
                reasons=reasons,
                cautions=cautions,
            )
        )

    # Sort descending by score, tiebreak by model_probability desc, then crop name asc
    scored_items.sort(key=lambda item: (-item.score, -item.model_probability, item.crop))

    # Take top_n and assign ranks 1..top_n
    top_items = scored_items[: payload.top_n]
    for r_idx, item in enumerate(top_items, start=1):
        item.rank = r_idx

    return CropRecommendationResponse(
        farm_id=payload.farm_id,
        month=month,
        season=season,
        soil_source=soil_source,
        weather_source=weather_source,
        ood_status=ood_status,
        ood_reason=ood_reason,
        recommendations=top_items,
        model_version=MODEL_VERSION,
    )
