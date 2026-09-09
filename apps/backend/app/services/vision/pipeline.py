"""
AgriNexus AI - Unified Computer Vision Inference Pipeline
Implements the multi-stage agricultural vision gating contract:
  1. Image Validation (corrupt, exposure, blur, resolution)
  2. Crop/Plant Relevance Gate (positive crop vs negative/OOD)
  3. Crop Classification (species identification)
  4. Disease Classification
  5. Calibrated Confidence & OOD Evaluation
  6. Return Structured Diagnostic Result
"""

import logging
from typing import Dict, Any, Optional
from PIL import Image

from app.services.vision.image_validation import validate_crop_image
from app.services.vision.crop_gate import run_crop_gate
from app.services.vision.crop_classifier import classify_crop_species
from app.services.vision.disease_classifier import classify_disease

logger = logging.getLogger(__name__)


def analyze_crop_image(image_bytes: bytes) -> Dict[str, Any]:
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

    # Stage 2: Crop / Plant Relevance Gate
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

    # Stage 3: Crop Classification
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

    # Stage 4 & 5: Disease Classification & Calibrated Thresholding
    disease_res = classify_disease(img_pil, crop=crop)

    # Contract formatting
    status = disease_res["status"]  # "diagnosed", "healthy", or "uncertain"
    disease_key = disease_res.get("disease")
    disease_conf = disease_res.get("disease_confidence")

    if status == "diagnosed":
        message = f"Definitive diagnosis: {disease_res['disease_name']} at {int(disease_conf * 100)}% confidence."
    elif status == "healthy":
        message = f"Foliage healthy: {disease_res['disease_name']} at {int(disease_conf * 100)}% confidence."
    else:  # uncertain or unknown
        message = "Crop detected, but disease confidence is below the required threshold."

    return {
        "status": status,
        "crop": crop,
        "crop_confidence": crop_conf,
        "disease": disease_key,
        "disease_name": disease_res.get("disease_name"),
        "disease_confidence": disease_conf,
        "supported": True,
        "message": message,
        "description": disease_res.get("description"),
        "treatment": disease_res.get("treatment"),
        "prevention": disease_res.get("prevention"),
        "gradcam_overlay": disease_res.get("gradcam_overlay"),
        "metrics": disease_res.get("metrics")
    }
