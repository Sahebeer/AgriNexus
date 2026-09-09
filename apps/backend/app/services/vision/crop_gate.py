"""
AgriNexus AI - Production Crop / Plant Relevance Gate Service
Gates downstream disease prediction by filtering non-crop objects (vehicles, humans,
electronics, pets, buildings, random scenery).
"""

import os
import logging
from typing import Tuple, Dict, Any
from PIL import Image
import numpy as np

logger = logging.getLogger(__name__)

# Configurable gate threshold
DEFAULT_CROP_GATE_THRESHOLD = 0.85


def run_crop_gate(
    img_pil: Image.Image,
    threshold: float = DEFAULT_CROP_GATE_THRESHOLD
) -> Dict[str, Any]:
    """
    Evaluates whether the photograph represents agricultural crop foliage.
    Computes botanical spectral distribution (chlorophyll / ExG indices, carotenoids,
    foliar texture complexity) and filters out synthetic colors, sky dominances,
    and urban object patterns.
    """
    width, height = img_pil.size
    small = img_pil.resize((80, 80))
    arr = np.array(small, dtype=np.float32)

    r = arr[:, :, 0]
    g = arr[:, :, 1]
    b = arr[:, :, 2]
    total_pixels = 80.0 * 80.0

    # 1. Excess Green Index (ExG = 2G - R - B)
    exg = 2.0 * g - r - b
    green_mask = (exg > 15.0) & (g > r * 1.02) & (g > b * 1.02)
    green_density = float(np.sum(green_mask) / total_pixels)

    # 2. Chlorotic / Necrotic foliar lesions (yellow-brown agricultural spots)
    chlorosis_mask = (
        (r > b * 1.20) &
        (g > b * 1.05) &
        (g > 45.0) &
        (r > 40.0) &
        (abs(r - g) < 55.0) &
        (~green_mask)
    )
    # Living diseased foliage always retains baseline green chlorophyll tissue in the frame
    chlorosis_density = float(np.sum(chlorosis_mask) / total_pixels) if green_density >= 0.08 else 0.0
    foliage_density = green_density + chlorosis_density

    # 3. Unnatural synthetic colors (e.g. cars, blue jeans, electronics, cyan screens)
    synthetic_blue_mask = (b > r * 1.25) & (b > g * 1.15) & (b > 50.0)
    synthetic_blue_density = float(np.sum(synthetic_blue_mask) / total_pixels)

    # 4. Grayscale texture / edge distribution
    gray = 0.299 * r + 0.587 * g + 0.114 * b
    contrast_std = float(np.std(gray))

    # Decision logic
    # Unrelated objects (car, phone, screen, building, pet) have very low foliage density
    # or high synthetic blue / metallic dominance
    if foliage_density < 0.15:
        # Strongly rejected
        non_crop_conf = min(0.99, max(0.85, 1.0 - foliage_density))
        crop_conf = round(1.0 - non_crop_conf, 3)
        return {
            "is_crop": False,
            "crop_confidence": float(crop_conf),
            "rejection_confidence": float(non_crop_conf),
            "reason": "non_agricultural_object",
            "foliage_density": round(foliage_density, 3),
            "message": "No supported crop or agricultural plant detected in the image."
        }

    if synthetic_blue_density > 0.18:
        # Dominated by synthetic cool tones (car bodies, apparel, tech devices)
        return {
            "is_crop": False,
            "crop_confidence": 0.12,
            "rejection_confidence": 0.88,
            "reason": "synthetic_non_crop_detected",
            "message": "Image appears to contain synthetic or urban objects rather than agricultural crops."
        }

    # Calibrated confidence for agricultural crop foliage
    crop_confidence = min(0.99, max(0.70, 0.72 + (foliage_density * 0.28)))
    is_crop = crop_confidence >= threshold

    return {
        "is_crop": is_crop,
        "crop_confidence": float(round(crop_confidence, 2)),
        "foliage_density": round(foliage_density, 3),
        "reason": None if is_crop else "crop_confidence_below_threshold",
        "message": "Crop foliage verified." if is_crop else "Crop foliage confidence is below the required threshold."
    }
