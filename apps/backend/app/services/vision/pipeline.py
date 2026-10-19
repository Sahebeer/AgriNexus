"""
AgriNexus AI - Unified Computer Vision Inference Pipeline
Implements the multi-stage agricultural vision gating contract:
  1. Image Validation (corrupt, exposure, blur, resolution)
  2. Google Gemini Multimodal Vision (if GEMINI_API_KEY is provided)
  3. Local Multi-Stage Computer Vision & Pathological Feature Engine (offline / fallback)
"""

import os
import json
import re
import logging
import time
from typing import Dict, Any, Optional
from PIL import Image
import io

from app.services.vision.image_validation import validate_crop_image
from app.services.vision.crop_gate import run_crop_gate
from app.services.vision.crop_classifier import classify_crop_species
from app.services.vision.disease_classifier import classify_disease

logger = logging.getLogger(__name__)

UPLOAD_CROP_IMAGE_MESSAGE = "Please upload a crop image."
SUPPORTED_CROP_HINTS = {
    "tomato", "potato", "bell_pepper", "corn", "wheat", "rice", "apple",
    "grape", "cotton", "soybean", "citrus", "cucumber", "strawberry", "coffee",
}

from app.core.gemini import GEMINI_API_KEY, resolve_gemini_model
GENAI_VISION_AVAILABLE = False

if GEMINI_API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        GENAI_VISION_AVAILABLE = True
        logger.info("Google Generative AI Vision initialized successfully.")
    except Exception as e:
        logger.warning(f"Failed to initialize GenAI Vision SDK: {e}")


_CONVNEXT_ENGINE = None

def _get_convnext_engine():
    global _CONVNEXT_ENGINE
    if _CONVNEXT_ENGINE is None:
        try:
            import sys
            from pathlib import Path
            repo_root = Path(__file__).resolve().parents[5]
            if str(repo_root) not in sys.path:
                sys.path.insert(0, str(repo_root))
            from ml.disease.inference import DiseaseInferenceEngine

            # Explicitly bind to trained model under colab_trained folder
            checkpoint_path = repo_root / "colab_trained" / "best_model.pth"
            if not checkpoint_path.exists():
                checkpoint_path = repo_root / "ml" / "disease" / "checkpoints" / "best_model.pth"

            class_mapping_path = repo_root / "colab_trained" / "class_mapping.json"
            if not class_mapping_path.exists():
                class_mapping_path = repo_root / "ml" / "disease" / "class_mapping.json"

            config_path = repo_root / "ml" / "disease" / "config.yaml"

            _CONVNEXT_ENGINE = DiseaseInferenceEngine(
                checkpoint_path=str(checkpoint_path),
                class_mapping_path=str(class_mapping_path),
                config_path=str(config_path),
            )
            if getattr(_CONVNEXT_ENGINE, "_ready", False):
                logger.info(f"ConvNeXt DiseaseInferenceEngine loaded successfully from {checkpoint_path}.")
            else:
                logger.warning(f"ConvNeXt DiseaseInferenceEngine initialized from {checkpoint_path} but model is not ready.")
        except Exception as e:
            logger.warning(f"Could not initialize ConvNeXt DiseaseInferenceEngine: {e}")
    return _CONVNEXT_ENGINE


def _analyze_with_gemini_vision(img_pil: Image.Image) -> Optional[Dict[str, Any]]:
    """
    Attempts zero-shot visual diagnosis using Google Gemini Multimodal Vision.
    Returns structured diagnosis dictionary or None if unavailable/failed.
    """
    if not GENAI_VISION_AVAILABLE or not GEMINI_API_KEY:
        return None

    try:
        import google.generativeai as genai
        model = genai.GenerativeModel(resolve_gemini_model())

        prompt = """
You are an expert plant pathologist and agricultural computer vision system for AgriNexus AI.
Analyze this image and return a strictly valid JSON response (no markdown formatting, no code blocks, just raw JSON).

Rules:
1. If the image is NOT an agricultural plant, crop leaf, fruit, or stem (e.g., car, human face, animal, electronic device, furniture, random room), set "is_crop": false.
2. If it IS a plant or crop, identify the crop species (e.g., Tomato, Potato, Corn, Wheat, Rice, Bell Pepper, Apple, Grape, Cotton, Soybean, Sugarcane, Chili, Citrus, Cucumber, Strawberry, Coffee, etc.).
3. Identify if the foliage is healthy or diagnose the exact disease/pest condition (e.g. Early Blight, Late Blight, Bacterial Spot, Septoria Leaf Spot, Yellow Leaf Curl, Leaf Mold, Spider Mites, Powdery Mildew, Rust, Mosaic Virus, Apple Scab, Black Rot, Leaf Blast, Canker, Healthy).
4. Provide structured scientific details, chemical treatment dosages (active ingredient with g/L or ml/L), organic remedies, and biosecurity prevention.
5. Provide top 3 differential candidate diagnoses with realistic confidence scores totaling around 1.0.

JSON format:
{
  "is_crop": true,
  "crop": "Tomato",
  "crop_confidence": 0.96,
  "disease_key": "early_blight",
  "disease_name": "Tomato Early Blight (Alternaria solani)",
  "disease_confidence": 0.94,
  "type": "Fungal Pathogen",
  "severity": "Medium",
  "status": "diagnosed",
  "description": "...",
  "treatment": "Chemical: ... Organic: ...",
  "prevention": "...",
  "top3_predictions": [
    {"name": "Tomato Early Blight (Alternaria solani)", "confidence": 0.94},
    {"name": "Tomato Septoria Leaf Spot", "confidence": 0.04},
    {"name": "Tomato Late Blight", "confidence": 0.02}
  ]
}

If "is_crop" is false:
{
  "is_crop": false,
  "crop_confidence": 0.05,
  "message": "No agricultural crop foliage detected in the image."
}
"""
        # Google occasionally returns 504/429 under load: one retry with a time cap.
        response = None
        for attempt in range(2):
            try:
                response = model.generate_content([prompt, img_pil], request_options={"timeout": 25})
                break
            except Exception as call_exc:
                logger.warning("Gemini Vision attempt %d failed: %s", attempt + 1, str(call_exc)[:200])
                if attempt == 1:
                    raise
                time.sleep(1.5)
        text = response.text.strip()
        # Strip code block wrappers if any
        if text.startswith("```"):
            text = re.sub(r"^```[a-zA-Z]*\n", "", text)
            text = re.sub(r"\n```$", "", text)

        parsed = json.loads(text)

        if not parsed.get("is_crop", True):
            return {
                "status": "crop_not_detected",
                "error_code": "CROP_NOT_DETECTED",
                "crop": None,
                "crop_confidence": parsed.get("crop_confidence", 0.05),
                "disease": None,
                "disease_confidence": None,
                "supported": False,
                "message": UPLOAD_CROP_IMAGE_MESSAGE
            }

        crop_name = (parsed.get("crop") or "Vegetation").lower().replace(" ", "_")
        disease_key = parsed.get("disease_key") or "healthy"
        disease_conf = float(parsed.get("disease_confidence", 0.92))
        crop_conf = float(parsed.get("crop_confidence", 0.94))
        disease_name = parsed.get("disease_name") or f"{crop_name.title()} Foliage"
        status = "healthy" if disease_key == "healthy" else parsed.get("status", "diagnosed")

        # Generate a Grad-CAM symptom heatmap for the image
        from app.services.vision.disease_classifier import generate_symptom_heatmap
        import numpy as np
        mask = np.zeros((64, 64), dtype=np.float32)
        mask[16:48, 16:48] = 0.8
        gradcam = generate_symptom_heatmap(img_pil, mask)

        message = (
            f"Definitive diagnosis: {disease_name} at {int(disease_conf * 100)}% confidence."
            if status == "diagnosed"
            else f"Foliage healthy: {disease_name} at {int(disease_conf * 100)}% confidence."
        )

        return {
            "status": status,
            "crop": crop_name,
            "crop_confidence": crop_conf,
            "disease": disease_key,
            "disease_name": disease_name,
            "disease_confidence": disease_conf,
            "type": parsed.get("type", "Pathological Foliar Condition"),
            "severity": parsed.get("severity", "Medium"),
            "supported": True,
            "message": message,
            "description": parsed.get("description", ""),
            "treatment": parsed.get("treatment", ""),
            "prevention": parsed.get("prevention", ""),
            "gradcam_overlay": gradcam,
            "top3_predictions": parsed.get("top3_predictions", []),
            "source": "gemini_multimodal_vision"
        }
    except Exception as e:
        logger.warning(f"Gemini Multimodal Vision execution failed: {e}. Falling back to local CV pipeline.")
        return None


# ConvNeXt results below this confidence get a Gemini second opinion (when a key is set).
GEMINI_VERIFY_BELOW = 0.95
# Below this, ConvNeXt alone never reports a diagnosis; it says "uncertain" instead.
MIN_DIAGNOSIS_CONFIDENCE = 0.30

_CROP_ALIASES = {"maize": "corn", "cornmaize": "corn", "bellpepper": "pepper", "pepperbell": "pepper"}


def _norm_crop(name: Optional[str]) -> str:
    key = re.sub(r"[^a-z]", "", (name or "").lower())
    return _CROP_ALIASES.get(key, key)


def _same_disease(a: Optional[str], b: Optional[str]) -> bool:
    x = re.sub(r"[^a-z]", "", (a or "healthy").lower())
    y = re.sub(r"[^a-z]", "", (b or "healthy").lower())
    if "healthy" in (x, y):
        return x == y
    return x in y or y in x


def analyze_crop_image(image_bytes: bytes, crop_hint: Optional[str] = None) -> Dict[str, Any]:
    """Public entry point. The current "Grad-CAM" overlay is a fixed placeholder square,
    not real model attention, so it is withheld until real Grad-CAM is implemented.
    The UI only shows the heatmap toggle when an overlay is present."""
    result = _analyze_crop_image(image_bytes, crop_hint)
    if isinstance(result, dict) and "gradcam_overlay" in result:
        result["gradcam_overlay"] = None
    return result


def _analyze_crop_image(image_bytes: bytes, crop_hint: Optional[str] = None) -> Dict[str, Any]:
    """
    Unified entry point for agricultural crop and disease visual diagnosis.
    Guarantees that non-crop images (vehicles, humans, electronics, random scenery)
    and low-quality images are rejected before any disease inference occurs.
    """
    # Stage 1: Image Quality & Integrity Validation
    is_valid, val_details, img_pil = validate_crop_image(image_bytes)
    if not is_valid or img_pil is None:
        return {
            "status": val_details.get("status", "image_quality_error"),
            "error_code": val_details.get("error_code", "IMAGE_QUALITY_TOO_LOW"),
            "crop": None,
            "crop_confidence": None,
            "disease": None,
            "disease_confidence": None,
            "supported": False,
            "message": val_details.get("message", "Uploaded image failed quality validation."),
            "details": val_details
        }

    # Stage 2: Deep Learning Inference via ConvNeXt-Base Engine (Trained on Colab)
    engine = _get_convnext_engine()
    if engine is not None and getattr(engine, "_ready", False):
        try:
            res = engine.predict(img_pil)

            # If the model weights aren't loaded, skip to fallback pipeline
            if isinstance(res, dict) and res.get("status") == "model_unavailable":
                logger.warning("ConvNeXt engine returned model_unavailable. Falling back to secondary pipeline.")
            else:
                reason = res.get("rejection_reason")
                conf = float(res.get("confidence") or 0.0)

                # Hard-reject ONLY when the engine has confirmed background after rescue attempt
                # (inference.py now tries to promote a non-background class before flagging this)
                if reason == "classified_as_background":
                    return {
                        "status": "crop_not_detected",
                        "error_code": "CROP_NOT_DETECTED",
                        "crop": None,
                        "crop_confidence": 0.0,
                        "disease": None,
                        "disease_name": None,
                        "disease_confidence": None,
                        "supported": False,
                        "message": "No agricultural crop foliage detected in this photo. Please upload a clear photo of plant leaves.\nSupported crops include Tomato, Potato, Corn, Apple, Bell Pepper, Grape, Wheat, Rice, Cotton, and more.",
                    }

                # Extremely low confidence: true noise / non-leaf (e.g. blank screenshot, car, human)
                if conf < 0.08:
                    return {
                        "status": "uncertain",
                        "error_code": "LOW_CONFIDENCE",
                        "crop": "Vegetation",
                        "crop_confidence": round(conf or 0.10, 4),
                        "disease": None,
                        "disease_name": "Uncertain Foliar Pattern",
                        "disease_confidence": round(conf or 0.10, 4),
                        "supported": True,
                        "message": "Foliage detected, but symptom clarity is too low for a confident diagnosis. Please upload a closer, well-lit photo.",
                    }

                # ── Monocot Confusion Guard ──────────────────────────────────
                # Uses the monocot_ambiguous flag set by inference.py when corn
                # wins at < 0.90 confidence with notable rice probability mass.
                # Routes to Gemini Vision for species-aware second opinion.
                _monocot_ambiguous = res.get("monocot_ambiguous", False)
                _pred_crop = (res.get("crop") or "").lower().replace("(", "").replace(")", "").replace(" ", "_")
                _pred_conf = float(res.get("confidence") or 0.0)

                # Also trigger on corn < 0.90 regardless of rice mass (belt-and-suspenders)
                _MONOCOT_CROPS = {"corn", "corn_maize", "maize", "wheat"}
                _monocot_triggered = _monocot_ambiguous or (_pred_crop in _MONOCOT_CROPS and _pred_conf < 0.90)

                # ── Gemini second opinion ────────────────────────────────────
                # ConvNeXt can be confidently wrong on photos unlike PlantVillage
                # (e.g. a garden photo -> "Tomato Late Blight 85%"). Below
                # GEMINI_VERIFY_BELOW we ask Gemini; if it disagrees on crop or
                # disease, or says it's not a crop, Gemini's answer wins.
                verified_by_gemini = False
                gemini_alternative = None
                if GENAI_VISION_AVAILABLE and (_monocot_triggered or _pred_conf < GEMINI_VERIFY_BELOW):
                    logger.info("Routing %s (%.2f) to Gemini Vision for a second opinion.", _pred_crop, _pred_conf)
                    gemini_result = _analyze_with_gemini_vision(img_pil)
                    if gemini_result is not None:
                        convnext_opinion = {
                            "crop": res.get("crop"), "disease": res.get("disease"),
                            "confidence": round(_pred_conf, 4), "source": "convnext_deep_learning",
                        }
                        if gemini_result.get("status") == "crop_not_detected":
                            gemini_result["second_opinion"] = convnext_opinion
                            return gemini_result
                        same_crop = _norm_crop(gemini_result.get("crop")) == _norm_crop(res.get("crop"))
                        same_disease = _same_disease(gemini_result.get("disease"), res.get("disease"))
                        weak = _pred_conf < MIN_DIAGNOSIS_CONFIDENCE
                        # Gemini decides WHAT plant it is; ConvNeXt (trained on these exact
                        # diseases) keeps the disease call unless it is too weak to trust.
                        if _monocot_triggered or not same_crop or (weak and not same_disease):
                            gemini_result["source"] = "gemini_multimodal_vision"
                            gemini_result["second_opinion"] = convnext_opinion
                            return gemini_result
                        if same_disease and weak:
                            # Both agree but ConvNeXt's own score is low: report Gemini's confidence.
                            gemini_result["source"] = "gemini_multimodal_vision"
                            gemini_result["verified_by_convnext"] = True
                            gemini_result["second_opinion"] = convnext_opinion
                            return gemini_result
                        verified_by_gemini = same_disease
                        if not same_disease:
                            gemini_alternative = {
                                "disease": gemini_result.get("disease"),
                                "disease_name": gemini_result.get("disease_name"),
                                "confidence": gemini_result.get("disease_confidence"),
                            }

                # Weak predictions must not be presented as a diagnosis.
                if _pred_conf < MIN_DIAGNOSIS_CONFIDENCE and not verified_by_gemini:
                    return {
                        "status": "uncertain",
                        "error_code": "LOW_CONFIDENCE",
                        "crop": (res.get("crop") or "Vegetation").replace("_", " ").title(),
                        "crop_confidence": round(_pred_conf, 4),
                        "disease": None,
                        "disease_name": "Uncertain Foliar Pattern",
                        "disease_confidence": round(_pred_conf, 4),
                        "supported": True,
                        "top3_predictions": res.get("top3_predictions") or [],
                        "message": (f"Not confident enough to diagnose ({int(_pred_conf * 100)}%). "
                                    "Please upload a closer, well-lit photo of a single affected leaf."),
                        "source": "convnext_deep_learning",
                    }


                # ── Successful Agricultural Crop Disease Diagnosis ──
                raw_crop = res.get("crop") or "crop"
                raw_disease = res.get("disease") or "healthy"
                conf = float(res.get("confidence") or 0.50)

                from app.services.vision.disease_classifier import PATHOLOGY_KNOWLEDGE, generate_symptom_heatmap
                import numpy as np

                lookup_key = f"{raw_crop}_{raw_disease}".lower()
                meta = PATHOLOGY_KNOWLEDGE.get(lookup_key, {})

                # Clean readable disease name
                disease_name = meta.get("name")
                if not disease_name:
                    class_clean = res.get("class_name", "").replace("___", " - ").replace("_", " ").title()
                    disease_name = class_clean or f"{raw_crop.title()} {raw_disease.replace('_', ' ').title()}"

                status = "healthy" if raw_disease == "healthy" else "diagnosed"

                # Grad-CAM attention heatmap
                mask = np.zeros((64, 64), dtype=np.float32)
                mask[16:48, 16:48] = 0.85
                gradcam = generate_symptom_heatmap(img_pil, mask)

                if gemini_alternative is not None:
                    alt = gemini_alternative.get("disease_name") or gemini_alternative.get("disease")
                    message_suffix = f" Gemini Vision suggests {alt} as an alternative; confirm in the field."
                elif verified_by_gemini:
                    message_suffix = " Confirmed by Gemini Vision."
                else:
                    message_suffix = ""
                if status == "healthy":
                    message = f"Foliage healthy: {disease_name} ({int(conf * 100)}% confidence)."
                elif conf >= 0.60:
                    message = f"Definitive diagnosis: {disease_name} at {int(conf * 100)}% confidence."
                else:
                    message = f"Probable diagnosis: {disease_name} ({int(conf * 100)}% confidence). Monitor foliage for expanding lesions."

                # Sensible fallback descriptions and treatments for any fine-grained class
                desc = meta.get("description") or f"Detected characteristic foliar symptoms of {disease_name} on {raw_crop.title()} foliage."
                treat = meta.get("treatment")
                if not treat:
                    if status == "healthy":
                        treat = "No pathological intervention needed. Maintain balanced N-P-K fertigation and standard scouting."
                    elif "virus" in raw_disease:
                        treat = "No chemical cure for viral infections once established. Control insect vectors (whiteflies/aphids) with Imidacloprid (0.5 ml/L) or Neem oil (5 ml/L). Rogue infected plants."
                    elif "bacteri" in raw_disease:
                        treat = "Chemical: Spray Copper Hydroxide (2.5 g/L) or Streptocycline (0.5 g/L). Organic: Foliar application of Bacillus subtilis."
                    else:
                        treat = "Chemical: Apply broad-spectrum fungicide Mancozeb (2.5 g/L) or Chlorothalonil (2 g/L) or Azoxystrobin (1 ml/L). Organic: Spray cold-pressed Neem oil (5 ml/L) or Trichoderma viride."

                message += message_suffix
                prevent = meta.get("prevention") or "Ensure adequate crop spacing (>50 cm) for airflow, avoid overhead sprinkler wetting, and destroy crop residues after harvest."

                top3 = res.get("top3_predictions") or [
                    {"name": disease_name, "confidence": round(conf, 4)}
                ]

                return {
                    "status": status,
                    "crop": raw_crop.replace("_", " ").title(),
                    "crop_confidence": round(conf, 4),
                    "disease": raw_disease,
                    "disease_name": disease_name,
                    "disease_confidence": round(conf, 4),
                    "type": meta.get("type", "Pathological Foliar Condition" if status != "healthy" else "Normal Foliage"),
                    "severity": meta.get("severity", "High" if ("blight" in raw_disease or "rot" in raw_disease) else ("Medium" if status == "diagnosed" else "None")),
                    "supported": True,
                    "message": message,
                    "description": desc,
                    "treatment": treat,
                    "prevention": prevent,
                    "gradcam_overlay": gradcam,
                    "top3_predictions": top3,
                    "source": "convnext_deep_learning",
                    "verified_by_gemini": verified_by_gemini,
                    "gemini_alternative": gemini_alternative,
                }
        except Exception as exc:
            logger.warning(f"ConvNeXt inference failed: {exc}. Falling back to secondary pipeline.")

    # Optional Fallback: Gemini Multimodal Vision if ConvNeXt unavailable
    if GENAI_VISION_AVAILABLE:
        gemini_result = _analyze_with_gemini_vision(img_pil)
        if gemini_result is not None:
            return gemini_result

    # Stage 3: Crop / Plant Relevance Gate (Local Heuristic Fallback)
    gate_res = run_crop_gate(img_pil)
    if not gate_res["is_crop"]:
        return {
            "status": "crop_not_detected",
            "error_code": "CROP_NOT_DETECTED",
            "crop": None,
            "crop_confidence": gate_res["crop_confidence"],
            "disease": None,
            "disease_confidence": None,
            "supported": False,
            "message": gate_res["message"]
        }

    # Stage 3: Crop Classification (Local Botanical CV)
    normalized_hint = (crop_hint or "").strip().lower().replace(" ", "_").replace("-", "_")
    if normalized_hint in SUPPORTED_CROP_HINTS:
        crop_res = {"crop": normalized_hint, "crop_confidence": 1.0, "supported": True, "status": "classified"}
    else:
        crop_res = classify_crop_species(img_pil)
    crop = crop_res["crop"]
    crop_conf = crop_res["crop_confidence"]

    if not crop_res["supported"]:
        return {
            "status": "unsupported_crop",
            "error_code": "UNSUPPORTED_CROP",
            "crop": crop,
            "crop_confidence": crop_conf,
            "disease": None,
            "disease_confidence": None,
            "supported": False,
            "message": f"Crop '{crop}' is recognized but not currently in the supported disease diagnostic registry."
        }

    if crop_res["status"] == "uncertain":
        return {
            "status": "uncertain",
            "error_code": "LOW_CONFIDENCE",
            "crop": crop,
            "crop_confidence": crop_conf,
            "disease": None,
            "disease_confidence": None,
            "supported": True,
            "message": "Crop detected, but crop species confidence is below the required threshold."
        }

    # Stage 4 & 5: Disease Classification & Calibrated Thresholding (Local Pathology CV)
    disease_res = classify_disease(
        img_pil,
        crop=crop,
        crop_is_user_hint=normalized_hint in SUPPORTED_CROP_HINTS,
    )

    # Contract formatting
    status = disease_res["status"]  # "diagnosed", "healthy", or "uncertain"
    disease_key = disease_res.get("disease")
    disease_conf = disease_res.get("disease_confidence")
    actual_crop = disease_res.get("crop") or crop
    actual_crop_conf = disease_res.get("crop_confidence") or crop_conf

    if status == "diagnosed":
        message = f"Definitive diagnosis: {disease_res['disease_name']} at {int(disease_conf * 100)}% confidence."
    elif status == "healthy":
        message = f"Foliage healthy: {disease_res['disease_name']} at {int(disease_conf * 100)}% confidence."
    else:  # uncertain or unknown
        message = "Crop detected, but disease confidence is below the required threshold."

    return {
        "status": status,
        "crop": actual_crop,
        "crop_confidence": actual_crop_conf,
        "disease": disease_key,
        "disease_name": disease_res.get("disease_name"),
        "disease_confidence": disease_conf,
        "type": disease_res.get("type", "Pathological Foliar Condition"),
        "severity": disease_res.get("severity", "Moderate"),
        "supported": True,
        "message": message,
        "description": disease_res.get("description"),
        "treatment": disease_res.get("treatment"),
        "prevention": disease_res.get("prevention"),
        "gradcam_overlay": disease_res.get("gradcam_overlay"),
        "top3_predictions": disease_res.get("top3_predictions", []),
        "metrics": disease_res.get("metrics")
    }
