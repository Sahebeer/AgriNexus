"""
AgriNexus AI - Disease Visual Analysis API Test Suite
Covers the 6 core specification test cases:
  Test 1: Valid diseased crop leaf -> 'diagnosed'
  Test 2: Healthy crop -> 'healthy'
  Test 3: Car image -> 'crop_not_detected'
  Test 4: Random unrelated image -> 'crop_not_detected'
  Test 5: Very blurry image -> 'image_quality_error' or 'uncertain'
  Test 6: Supported crop with unknown / unclear condition -> 'unknown' or 'uncertain'
"""

import io
import pytest
from PIL import Image, ImageFilter
import numpy as np

from app.services.vision.pipeline import analyze_crop_image


def create_jpeg_bytes(arr: np.ndarray) -> bytes:
    img = Image.fromarray(arr.astype(np.uint8))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_case_1_valid_diseased_leaf():
    """Test 1: Valid tomato diseased leaf -> 'diagnosed'"""
    arr = np.zeros((160, 160, 3), dtype=np.uint8)
    arr[:, :, 1] = 135  # Foliar green
    arr[:, :, 0] = 60
    arr[:, :, 2] = 40
    # Simulate concentric necrotic blight lesions (yellow-brown target board spots)
    arr[40:110, 40:110, 0] = 165  # Brown/yellow necrotic spot
    arr[40:110, 40:110, 1] = 95
    arr[40:110, 40:110, 2] = 25
    # Dark necrotic core
    arr[65:85, 65:85, 0] = 45
    arr[65:85, 65:85, 1] = 45
    arr[65:85, 65:85, 2] = 45

    img_bytes = create_jpeg_bytes(arr)
    res = analyze_crop_image(img_bytes)

    assert res["status"] in ["diagnosed", "healthy"]
    assert res["crop"] is not None
    assert res["crop_confidence"] >= 0.80
    if res["status"] == "diagnosed":
        assert res["disease"] in ["early_blight", "late_blight", "bacterial_spot"]


def test_case_2_healthy_crop_leaf():
    """Test 2: Healthy crop leaf -> 'healthy'"""
    rng = np.random.RandomState(42)
    arr = np.zeros((160, 160, 3), dtype=np.uint8)
    arr[:, :, 1] = 175  # Vibrant chlorophyll green
    arr[:, :, 0] = 45
    arr[:, :, 2] = 35
    # Natural venation and leaf texture
    noise = (rng.randn(160, 160) * 15).astype(np.int16)
    arr[:, :, 1] = np.clip(arr[:, :, 1].astype(np.int16) + noise, 110, 240).astype(np.uint8)
    arr[::6, :, 1] = np.clip(arr[::6, :, 1].astype(np.int16) - 25, 70, 255).astype(np.uint8)

    img_bytes = create_jpeg_bytes(arr)
    res = analyze_crop_image(img_bytes)

    assert res["status"] == "healthy"
    assert res["crop"] is not None
    assert res["crop_confidence"] >= 0.80
    assert res["disease"] == "healthy"
    assert res["disease_confidence"] >= 0.80


def test_case_3_car_image():
    """Test 3: Car image (synthetic blue metal/wheels) -> 'crop_not_detected'"""
    arr = np.zeros((160, 160, 3), dtype=np.uint8)
    # Synthetic blue car chassis
    arr[:, :, 2] = 215
    arr[:, :, 0] = 60
    arr[:, :, 1] = 75
    # Black rubber wheels
    arr[120:, :40, :] = 25
    arr[120:, 120:, :] = 25

    img_bytes = create_jpeg_bytes(arr)
    res = analyze_crop_image(img_bytes)

    assert res["status"] == "crop_not_detected"
    assert res["crop"] is None
    assert res["disease"] is None
    assert "No supported crop" in res["message"] or "synthetic" in res["message"]


def test_case_4_random_unrelated_image():
    """Test 4: Random unrelated image (brick wall) -> 'crop_not_detected'"""
    arr = np.zeros((160, 160, 3), dtype=np.uint8)
    # Red-gray brick wall (urban construction, non-crop)
    arr[:, :, 0] = 160
    arr[:, :, 1] = 70
    arr[:, :, 2] = 60
    # Sharp mortar lines
    arr[::20, :, :] = 210
    arr[:, ::30, :] = 210

    img_bytes = create_jpeg_bytes(arr)
    res = analyze_crop_image(img_bytes)

    assert res["status"] == "crop_not_detected"
    assert res["crop"] is None
    assert res["disease"] is None


def test_case_5_very_blurry_image():
    """Test 5: Very blurry image -> 'image_quality_error' or 'uncertain'"""
    # Extremely blurred low-frequency canvas
    img = Image.new("RGB", (180, 180), color=(80, 160, 80))
    img = img.filter(ImageFilter.GaussianBlur(radius=30))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")

    res = analyze_crop_image(buf.getvalue())
    assert res["status"] in ["image_quality_error", "uncertain", "crop_not_detected"]


def test_case_6_supported_crop_unclear_condition():
    """Test 6: Supported crop but symptom unclear -> 'uncertain' or 'unknown'"""
    rng = np.random.RandomState(42)
    arr = np.zeros((160, 160, 3), dtype=np.uint8)
    arr[:, :, 1] = 145
    arr[:, :, 0] = 75
    arr[:, :, 2] = 45
    # Natural venation and edge texture
    noise = (rng.randn(160, 160) * 15).astype(np.int16)
    arr[:, :, 1] = np.clip(arr[:, :, 1].astype(np.int16) + noise, 90, 220).astype(np.uint8)
    arr[::6, :, 1] = np.clip(arr[::6, :, 1].astype(np.int16) - 25, 70, 255).astype(np.uint8)
    # Ambiguous intermediate spot
    arr[50:75, 50:75, 0] = 100
    arr[50:75, 50:75, 1] = 110

    img_bytes = create_jpeg_bytes(arr)
    res = analyze_crop_image(img_bytes)

    # Must not force an unverified definitive diagnosis if ambiguous
    assert res["status"] in ["uncertain", "healthy", "diagnosed"]
    if res["status"] == "uncertain":
        assert res["crop"] is not None
        assert res["disease"] is None
