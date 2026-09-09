"""
AgriNexus AI - Image Validation Tests
Tests pre-flight quality checks:
- Empty bytes & oversize rejection
- Corrupted file data
- Minimum resolution boundary
- Solid black & solid white frame detection
- Laplacian blur detection
"""

import io
import pytest
from PIL import Image, ImageFilter
import numpy as np

from app.services.vision.image_validation import validate_crop_image


def test_empty_image_bytes():
    valid, details, _ = validate_crop_image(b"")
    assert not valid
    assert details["status"] == "image_quality_error"
    assert details["error_code"] == "INVALID_IMAGE"


def test_corrupt_image_bytes():
    corrupt_bytes = b"NOT_A_REAL_IMAGE_FILE_BUFFER_12345"
    valid, details, _ = validate_crop_image(corrupt_bytes)
    assert not valid
    assert details["status"] == "image_quality_error"
    assert details["error_code"] == "INVALID_IMAGE"


def test_too_small_resolution():
    # 32x32 image is below minimum 64x64 requirement
    img = Image.new("RGB", (32, 32), color=(50, 150, 50))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    valid, details, _ = validate_crop_image(buf.getvalue())
    assert not valid
    assert details["status"] == "image_quality_error"
    assert details["error_code"] == "IMAGE_QUALITY_TOO_LOW"


def test_solid_black_image():
    # Completely dark image
    img = Image.new("RGB", (128, 128), color=(2, 2, 2))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    valid, details, _ = validate_crop_image(buf.getvalue())
    assert not valid
    assert details["status"] == "image_quality_error"
    assert details["error_code"] == "IMAGE_QUALITY_TOO_LOW"


def test_solid_white_image():
    # Completely white over-exposed image
    img = Image.new("RGB", (128, 128), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    valid, details, _ = validate_crop_image(buf.getvalue())
    assert not valid
    assert details["status"] == "image_quality_error"
    assert details["error_code"] == "IMAGE_QUALITY_TOO_LOW"


def test_heavily_blurred_image():
    # Generate image with extreme Gaussian blur
    img = Image.new("RGB", (200, 200), color=(100, 150, 100))
    img = img.filter(ImageFilter.GaussianBlur(radius=25))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    valid, details, _ = validate_crop_image(buf.getvalue())
    assert not valid
    assert details["status"] == "image_quality_error"
    assert details["error_code"] == "IMAGE_QUALITY_TOO_LOW"


def test_valid_leaf_image_passes():
    # Create valid textured green leaf pattern
    arr = np.zeros((150, 150, 3), dtype=np.uint8)
    arr[:, :, 1] = 160  # Green
    arr[20:80, 20:80, 0] = 120  # Contrast variation
    arr[40:100, 40:100, 2] = 40
    img = Image.fromarray(arr)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    valid, details, pil_img = validate_crop_image(buf.getvalue())
    assert valid
    assert details["status"] == "passed"
    assert pil_img is not None
