"""
AgriNexus AI - Image Quality & Integrity Validation Service
Performs objective pre-flight quality checks before ML inference:
- File byte integrity & format decoding
- Maximum & minimum resolution constraints
- Solid black / solid white / severe exposure detection
- Blur analysis via Laplacian variance
"""

import io
import logging
from typing import Dict, Any, Tuple
from PIL import Image, ImageFilter
import numpy as np

logger = logging.getLogger(__name__)


def validate_crop_image(image_bytes: bytes, max_size_bytes: int = 10 * 1024 * 1024) -> Tuple[bool, Dict[str, Any], Image.Image | None]:
    """
    Validates uploaded image against quality and integrity standards.
    Returns:
      (is_valid: bool, details: dict, pil_image: Image.Image | None)
    """
    # 1. Byte length checks
    if not image_bytes or len(image_bytes) == 0:
        return False, {
            "status": "image_quality_error",
            "error_code": "INVALID_IMAGE",
            "message": "Empty file uploaded. Please upload a valid image file."
        }, None

    if len(image_bytes) > max_size_bytes:
        return False, {
            "status": "image_quality_error",
            "error_code": "IMAGE_TOO_LARGE",
            "message": "Image file size exceeds the 10MB maximum limit."
        }, None

    # 2. PIL Decoding & Corrupted Byte Check
    try:
        img_pil = Image.open(io.BytesIO(image_bytes))
        img_pil.load()  # Force decode entire image buffer
        img_pil = img_pil.convert("RGB")
    except Exception as e:
        logger.warning(f"Failed to decode image bytes: {e}")
        return False, {
            "status": "image_quality_error",
            "error_code": "INVALID_IMAGE",
            "message": "Uploaded file is corrupted or not a recognized image format."
        }, None

    # 3. Minimum Resolution Check
    width, height = img_pil.size
    if width < 48 or height < 48:
        return False, {
            "status": "image_quality_error",
            "error_code": "IMAGE_QUALITY_TOO_LOW",
            "message": f"Image resolution ({width}x{height}) is too small for foliar disease analysis (minimum 48x48 required)."
        }, None

    # 4. Exposure & Solid Frame Checks (Black / White / Zero Contrast)
    gray = img_pil.convert("L")
    gray_np = np.array(gray, dtype=np.float32)

    mean_brightness = float(np.mean(gray_np))
    std_contrast = float(np.std(gray_np))

    # Completely or almost completely pitch black
    if mean_brightness < 8.0 and std_contrast < 5.0:
        return False, {
            "status": "image_quality_error",
            "error_code": "IMAGE_QUALITY_TOO_LOW",
            "message": "Image is completely dark or under-exposed. Please upload a photo in natural lighting."
        }, None

    # Completely pure solid white frame with zero variation
    if mean_brightness > 252.0 and std_contrast < 3.0:
        return False, {
            "status": "image_quality_error",
            "error_code": "IMAGE_QUALITY_TOO_LOW",
            "message": "Image is completely blank white. Please upload a photo showing leaf details."
        }, None

    # Extreme flat solid color
    if std_contrast < 3.0:
        return False, {
            "status": "image_quality_error",
            "error_code": "IMAGE_QUALITY_TOO_LOW",
            "message": "Image lacks visual contrast or structural detail."
        }, None

    # 5. Blur Detection via Laplacian Variance
    laplacian_kernel = ImageFilter.Kernel((3, 3), [-1, -1, -1, -1, 8, -1, -1, -1, -1], 1, 0)
    lap_img = gray.filter(laplacian_kernel)
    lap_var = float(np.var(np.array(lap_img, dtype=np.float32)))

    # Laplacian variance threshold: < 10.0 indicates severe, unusable blur
    if lap_var < 10.0:
        return False, {
            "status": "image_quality_error",
            "error_code": "IMAGE_QUALITY_TOO_LOW",
            "message": f"Image is too blurry for reliable disease diagnosis (sharpness score {round(lap_var, 1)} < 10.0). Please retake with clean focus."
        }, None

    # Passed all pre-flight checks
    return True, {
        "status": "passed",
        "metrics": {
            "width": width,
            "height": height,
            "brightness": round(mean_brightness, 2),
            "contrast": round(std_contrast, 2),
            "sharpness": round(lap_var, 2)
        }
    }, img_pil
