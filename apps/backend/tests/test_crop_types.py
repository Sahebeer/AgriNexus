"""
AgriNexus AI - Crop Type Selection System Unit & Integration Tests
Validates:
1. Static registry contracts (approved vs unapproved crops).
2. Aliasing and name normalization.
3. Fail-closed validation logic (rejecting invalid combinations and unapproved types).
4. API endpoints for farms, calendar, and mandi listings rejecting invalid types (400)
   and persisting valid types.
"""

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.crop_types import (
    APPROVED_CROP_TYPE_CATALOG,
    EXPLICIT_NO_TYPE_CROPS,
    get_crop_types,
    has_crop_types,
    get_crop_type_label,
    normalize_crop_name,
    validate_crop_type,
)
from app.core.security import create_access_token, get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.user import User

client = TestClient(app)


# ---------------------------------------------------------------------------
# 1. Static Registry & Normalization Tests
# ---------------------------------------------------------------------------

def test_approved_crop_catalog_coverage():
    """Verify all 26 approved crops exist with at least two type options."""
    assert len(APPROVED_CROP_TYPE_CATALOG) == 26

    expected_26 = {
        "rice", "wheat", "maize", "cotton", "jute", "chickpea",
        "kidneybeans", "lentil", "apple", "banana", "grapes", "mango",
        "orange", "papaya", "pomegranate", "watermelon", "muskmelon",
        "coconut", "coffee", "potato", "tomato", "bell_pepper",
        "groundnut", "mustard", "onion", "soybean"
    }
    assert set(APPROVED_CROP_TYPE_CATALOG.keys()) == expected_26

    for crop_key, options in APPROVED_CROP_TYPE_CATALOG.items():
        assert len(options) >= 2, f"Crop {crop_key} should have at least 2 options"
        for opt in options:
            assert opt.id, f"Option missing id in {crop_key}"
            assert opt.label, f"Option missing label in {crop_key}"


def test_unapproved_crops_have_no_types():
    """Verify crops outside the 26 approved have empty type catalogs."""
    for crop in EXPLICIT_NO_TYPE_CROPS:
        assert has_crop_types(crop) is False
        assert get_crop_types(crop) == []


def test_crop_aliases_and_normalization():
    """Verify aliases correctly map to approved crop canonical keys."""
    test_cases = [
        ("Rice", "rice"),
        ("paddy", "rice"),
        ("PADDY", "rice"),
        ("Corn", "maize"),
        ("maize", "maize"),
        ("Chickpeas (Gram)", "chickpea"),
        ("chickpea", "chickpea"),
        ("Kidney Beans", "kidneybeans"),
        ("kidneybeans", "kidneybeans"),
        ("Bell Pepper", "bell_pepper"),
        ("pepper,_bell", "bell_pepper"),
        ("capsicum", "bell_pepper"),
        ("Groundnut", "groundnut"),
        ("Peanut", "groundnut"),
        ("Soyabean", "soybean"),
    ]
    for raw, expected_canonical in test_cases:
        norm = normalize_crop_name(raw)
        assert norm == expected_canonical, f"Failed for {raw}: got {norm}, expected {expected_canonical}"
        assert has_crop_types(raw) is True
        assert len(get_crop_types(raw)) >= 2


def test_get_crop_type_label():
    """Verify human readable label lookup."""
    assert get_crop_type_label("rice", "basmati") == "Basmati"
    assert get_crop_type_label("Corn", "sweet_corn") == "Sweet Corn"
    assert get_crop_type_label("wheat", "durum") == "Durum Wheat"
    # Unapproved or unknown falls back to None
    assert get_crop_type_label("rice", None) is None
    assert get_crop_type_label("rice", "custom_type") is None


# ---------------------------------------------------------------------------
# 2. Validation Logic Tests
# ---------------------------------------------------------------------------

def test_validate_crop_type_valid_pairs():
    """Valid crop/crop-type pairs must pass and return normalized crop_type_id."""
    assert validate_crop_type("rice", "basmati") == "basmati"
    assert validate_crop_type("Rice", "sona_masuri") == "sona_masuri"
    assert validate_crop_type("wheat", "durum") == "durum"
    assert validate_crop_type("Corn", "sweet_corn") == "sweet_corn"
    assert validate_crop_type("tomato", "roma") == "roma"
    assert validate_crop_type("cotton", "desi") == "desi"
    assert validate_crop_type("apple", "fuji") == "fuji"


def test_validate_crop_type_optional_null():
    """Null, empty string, or whitespace must pass cleanly as None."""
    assert validate_crop_type("rice", None) is None
    assert validate_crop_type("rice", "") is None
    assert validate_crop_type("rice", "   ") is None
    assert validate_crop_type("pigeonpeas", None) is None
    assert validate_crop_type("unknown_crop", None) is None


def test_validate_crop_type_invalid_cross_crop():
    """Submitting a crop type belonging to another crop must raise HTTP 400."""
    with pytest.raises(HTTPException) as exc_info:
        validate_crop_type("rice", "durum")  # durum belongs to wheat
    assert exc_info.value.status_code == 400
    assert "Invalid crop_type_id" in exc_info.value.detail

    with pytest.raises(HTTPException) as exc_info:
        validate_crop_type("wheat", "basmati")  # basmati belongs to rice
    assert exc_info.value.status_code == 400

    with pytest.raises(HTTPException) as exc_info:
        validate_crop_type("tomato", "sweet_corn")  # sweet_corn belongs to maize
    assert exc_info.value.status_code == 400


def test_validate_crop_type_unapproved_crop():
    """Submitting a crop type for a crop with no catalog must raise HTTP 400."""
    with pytest.raises(HTTPException) as exc_info:
        validate_crop_type("pigeonpeas", "desi")
    assert exc_info.value.status_code == 400
    assert "does not support crop types" in exc_info.value.detail

    with pytest.raises(HTTPException) as exc_info:
        validate_crop_type("mungbean", "summer")
    assert exc_info.value.status_code == 400


def test_validate_crop_type_unknown_type_id():
    """Submitting an unrecognized type id must raise HTTP 400."""
    with pytest.raises(HTTPException) as exc_info:
        validate_crop_type("rice", "synthetic_gmo_rice_99")
    assert exc_info.value.status_code == 400
    assert "Invalid crop_type_id" in exc_info.value.detail


# ---------------------------------------------------------------------------
# 3. API Integration Tests (Farms, Calendar, Mandi)
# ---------------------------------------------------------------------------

@pytest.fixture
def auth_header():
    """Creates a test user and returns an Authorization Bearer header."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "croptype_test@agrinexus.ai").first()
        if not user:
            user = User(
                email="croptype_test@agrinexus.ai",
                hashed_password=get_password_hash("TestPassword123!"),
                full_name="Crop Type Test User",
                role="farmer",
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        token = create_access_token(user.id)
        return {"Authorization": f"Bearer {token}"}
    finally:
        db.close()


def test_api_get_crop_types_endpoint(auth_header):
    """GET /api/v1/farms/crop-types/{crop_name} returns correct catalog."""
    # Approved crop
    res = client.get("/api/v1/farms/crop-types/Rice", headers=auth_header)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    type_ids = [t["id"] for t in data]
    assert "basmati" in type_ids

    # Unapproved crop
    res_unapproved = client.get("/api/v1/farms/crop-types/pigeonpeas", headers=auth_header)
    assert res_unapproved.status_code == 200
    assert res_unapproved.json() == []


def test_api_farm_crop_type_validation(auth_header):
    """POST /api/v1/farms/ enforces crop type validation."""
    # Invalid combo: Rice with durum wheat type
    res_invalid = client.post(
        "/api/v1/farms/",
        headers=auth_header,
        json={
            "name": "Invalid Rice Farm",
            "current_crop": "Rice",
            "crop_type_id": "durum",
            "area": 2.5,
            "state": "Punjab",
            "district": "Ludhiana",
            "village": "Sahnewal",
            "sowing_date": "2026-06-15",
            "irrigation_method": "Tube Well",
        },
    )
    assert res_invalid.status_code == 400
    assert "Invalid crop_type_id" in res_invalid.json()["detail"]

    # Valid combo: Rice with basmati
    res_valid = client.post(
        "/api/v1/farms/",
        headers=auth_header,
        json={
            "name": "Valid Basmati Farm",
            "current_crop": "Rice",
            "crop_type_id": "basmati",
            "area": 3.0,
            "state": "Punjab",
            "district": "Ludhiana",
            "village": "Sahnewal",
            "sowing_date": "2026-06-15",
            "irrigation_method": "Tube Well",
        },
    )
    assert res_valid.status_code == 201
    farm_data = res_valid.json()
    assert farm_data["crop_type_id"] == "basmati"

    # Optional / None
    res_none = client.post(
        "/api/v1/farms/",
        headers=auth_header,
        json={
            "name": "Generic Rice Farm",
            "current_crop": "Rice",
            "crop_type_id": None,
            "area": 1.5,
            "state": "Punjab",
            "district": "Ludhiana",
            "village": "Sahnewal",
            "sowing_date": "2026-06-15",
            "irrigation_method": "Tube Well",
        },
    )
    assert res_none.status_code == 201
    assert res_none.json()["crop_type_id"] is None


def test_api_calendar_crop_type_validation(auth_header):
    """POST /api/v1/calendar/generate validates crop_type_id."""
    # Invalid: Wheat with basmati rice type
    res_invalid = client.post(
        "/api/v1/calendar/generate",
        headers=auth_header,
        json={
            "crop": "Wheat",
            "crop_type_id": "basmati",
            "sow_date": "2026-11-01",
        },
    )
    assert res_invalid.status_code == 400

    # Valid: Wheat with durum
    res_valid = client.post(
        "/api/v1/calendar/generate",
        headers=auth_header,
        json={
            "crop": "Wheat",
            "crop_type_id": "durum",
            "sow_date": "2026-11-01",
        },
    )
    assert res_valid.status_code == 201
    cal_data = res_valid.json()
    assert cal_data["crop_type_id"] == "durum"


def test_api_mandi_crop_type_validation(auth_header):
    """POST /api/v1/mandi/listings validates crop_type_id."""
    # Invalid: Tomato with durum wheat type
    res_invalid = client.post(
        "/api/v1/mandi/listings",
        headers=auth_header,
        json={
            "crop": "Tomato",
            "crop_type_id": "durum",
            "quantity": 100,
            "unit": "kg",
            "price_per_unit": 25,
            "location": "Kolar, Karnataka",
            "contact_number": "9876543210",
            "listing_type": "seller",
        },
    )
    assert res_invalid.status_code == 400

    # Valid: Tomato with roma
    res_valid = client.post(
        "/api/v1/mandi/listings",
        headers=auth_header,
        json={
            "crop": "Tomato",
            "crop_type_id": "roma",
            "quantity": 100,
            "unit": "kg",
            "price_per_unit": 25,
            "location": "Kolar, Karnataka",
            "contact_number": "9876543210",
            "listing_type": "seller",
        },
    )
    assert res_valid.status_code == 201
    listing_data = res_valid.json()
    assert listing_data["crop_type_id"] == "roma"
