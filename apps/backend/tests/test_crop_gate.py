"""
AgriNexus AI - Crop Gate Relevance Unit Tests
Tests crop vs non-crop rejection:
- Agricultural crop leaves accepted
- Unrelated non-crop objects (vehicles, electronics, blue screens) rejected
"""

import pytest
from PIL import Image
import numpy as np

from app.services.vision.crop_gate import run_crop_gate


def test_positive_crop_foliage_accepted():
    # Green agricultural leaf
    arr = np.zeros((100, 100, 3), dtype=np.uint8)
    arr[:, :, 1] = 165  # Green chlorophyll
    arr[:, :, 0] = 55   # Red
    arr[:, :, 2] = 40   # Blue
    # Add textural variation
    arr[20:70, 20:70, 1] = 145
    img = Image.fromarray(arr)

    res = run_crop_gate(img)
    assert res["is_crop"] is True
    assert res["crop_confidence"] >= 0.85


def test_non_crop_car_metallic_blue_rejected():
    # Car / screen / electronic representation (predominantly synthetic blue/gray)
    arr = np.zeros((100, 100, 3), dtype=np.uint8)
    arr[:, :, 2] = 210  # High synthetic blue
    arr[:, :, 0] = 60
    arr[:, :, 1] = 75
    img = Image.fromarray(arr)

    res = run_crop_gate(img)
    assert res["is_crop"] is False
    assert res["crop_confidence"] < 0.50
    assert "detected" in res["reason"] or "non_agricultural" in res["reason"]


def test_non_crop_indoor_furniture_rejected():
    # Brown wood furniture / indoors without chlorophyll foliage
    arr = np.zeros((100, 100, 3), dtype=np.uint8)
    arr[:, :, 0] = 130
    arr[:, :, 1] = 75
    arr[:, :, 2] = 40
    img = Image.fromarray(arr)

    res = run_crop_gate(img)
    assert res["is_crop"] is False
    assert res["crop_confidence"] < 0.85
