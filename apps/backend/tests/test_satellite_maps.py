"""
Unit and Integration Tests for AgriNexus Smart Satellite Maps & Farm Intelligence.
Tests geodesic area calculations, zone partitioning, barren land detection,
AI farm reasoning structure, satellite provider abstraction, and admin role gating.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.geospatial.geometry import calculate_geodesic_area, partition_farm_into_zones, get_polygon_centroid
from app.services.barren_land import detect_nearby_barren_land
from app.services.satellite_provider import DemoSatelliteProvider, SentinelSatelliteProvider
from app.services.intelligence.farm_reasoning import generate_ai_farm_reasoning, generate_efficiency_roadmap

client = TestClient(app)


def test_geodesic_area_calculation():
    """Verify that WGS84 spherical geodesic calculations produce accurate metric/imperial areas."""
    # A ~1 sq km bounding box near the equator / India
    poly = [
        [75.000, 20.000],
        [75.010, 20.000],
        [75.010, 20.010],
        [75.000, 20.010],
        [75.000, 20.000]
    ]
    res = calculate_geodesic_area([poly])
    assert res["hectares"] > 0
    assert res["acres"] > 0
    assert res["square_meters"] > 0
    # 1 hectare = ~2.471 acres
    ratio = res["acres"] / res["hectares"]
    assert 2.45 <= ratio <= 2.49


def test_zone_partitioning():
    """Verify farm boundary is split into balanced agricultural micro-zones with health/moisture telemetry."""
    poly = [
        [74.1085, 20.0760],
        [74.1145, 20.0755],
        [74.1162, 20.0805],
        [74.1118, 20.0825],
        [74.1072, 20.0798],
        [74.1085, 20.0760]
    ]
    zones = partition_farm_into_zones(poly, num_zones=6, crop="Wheat")
    assert len(zones) == 6
    zone_ids = [z["zone_id"] for z in zones]
    assert "Zone A" in zone_ids
    assert "Zone F" in zone_ids
    
    # Check that South-East zone captures stress anomaly
    zone_f = next(z for z in zones if z["zone_id"] == "Zone F")
    assert zone_f["status"] == "stressed"
    assert zone_f["risk_level"] == "high"
    assert zone_f["ndvi"] < 0.50
    assert "irrigation" in zone_f["suggested_action"].lower()


def test_barren_land_detection():
    """Verify detection of candidate unutilized land parcels surrounding given coordinates."""
    center_lat, center_lon = 20.0788, 74.1115
    parcels = detect_nearby_barren_land(center_lat, center_lon, radius_km=2.0)
    assert len(parcels) >= 3
    for p in parcels:
        assert "parcel_id" in p
        assert p["area_hectares"] > 0
        assert len(p["candidate_crops"]) > 0
        assert "disclaimer" in p
        assert len(p["polygon"]) >= 4


def test_ai_farm_reasoning_and_efficiency():
    """Verify AI reasoning enforces strict separation between Observed, Inferred, and Recommended."""
    zones = partition_farm_into_zones([[74.1, 20.0], [74.2, 20.0], [74.2, 20.1], [74.1, 20.1], [74.1, 20.0]], num_zones=6)
    barren = detect_nearby_barren_land(20.05, 74.15)
    
    reasoning = generate_ai_farm_reasoning(
        crop="Wheat",
        area_hectares=12.4,
        ndvi_current=0.72,
        moisture_score=68.0,
        zones=zones,
        barren_parcels=barren
    )
    
    assert "observed" in reasoning
    assert "inferred" in reasoning
    assert "recommended" in reasoning
    assert len(reasoning["observed"]) >= 3
    assert len(reasoning["inferred"]) >= 2
    assert len(reasoning["recommended"]) >= 2
    
    efficiency = generate_efficiency_roadmap(
        crop="Wheat",
        area_hectares=12.4,
        ndvi_current=0.72,
        moisture_score=68.0,
        zones=zones,
        barren_parcels=barren
    )
    assert len(efficiency) == 5
    pillars = [p["pillar"] for p in efficiency]
    assert any("Irrigation" in p for p in pillars)
    assert any("Water Management" in p for p in pillars)
    assert any("Land Utilization" in p for p in pillars)


def test_demo_satellite_provider():
    """Verify DemoSatelliteProvider returns full rural India dataset with all layers."""
    provider = DemoSatelliteProvider()
    demo_farm = provider.get_demo_farm()
    
    assert demo_farm["farm_id"] == "DEMO-FARM-001"
    assert demo_farm["area_hectares"] == 12.4
    assert demo_farm["is_demo"] is True
    assert "DEMO DATA" in demo_farm["satellite_source"]
    assert len(demo_farm["zones"]) == 6
    assert len(demo_farm["growth_history"]) == 8
    assert len(demo_farm["barren_land"]) >= 3


def test_admin_authentication_and_gating():
    """Verify dedicated admin login endpoint and role authorization."""
    from app.db.database import SessionLocal
    from app.models.user import User
    from app.core.security import get_password_hash

    db = SessionLocal()
    try:
        # Create or update test admin
        admin_user = db.query(User).filter(User.email == "testadmin@agrinexus.demo").first()
        if not admin_user:
            admin_user = User(
                email="testadmin@agrinexus.demo",
                hashed_password=get_password_hash("AdminPass123!"),
                full_name="Test Admin",
                role="admin",
                is_superuser=True,
                is_active=True
            )
            db.add(admin_user)
        else:
            admin_user.role = "admin"
            admin_user.is_superuser = True
            admin_user.hashed_password = get_password_hash("AdminPass123!")

        # Create or update test farmer
        farmer_user = db.query(User).filter(User.email == "testfarmer_auth@agrinexus.demo").first()
        if not farmer_user:
            farmer_user = User(
                email="testfarmer_auth@agrinexus.demo",
                hashed_password=get_password_hash("FarmerPass123!"),
                full_name="Test Farmer",
                role="farmer",
                is_superuser=False,
                is_active=True
            )
            db.add(farmer_user)
        else:
            farmer_user.role = "farmer"
            farmer_user.is_superuser = False
            farmer_user.hashed_password = get_password_hash("FarmerPass123!")

        db.commit()
    finally:
        db.close()

    # 1. Successful Admin Login
    admin_login_res = client.post(
        "/api/v1/admin/login",
        json={"email": "testadmin@agrinexus.demo", "password": "AdminPass123!"}
    )
    assert admin_login_res.status_code == 200
    token_data = admin_login_res.json()
    assert "access_token" in token_data
    assert token_data["role"] == "admin"
    admin_token = token_data["access_token"]
    
    # 2. Check Admin System Status with Admin Token
    status_res = client.get(
        "/api/v1/admin/system-status",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "operational"

    # 3. Farmer Attempting Admin Login is Denied
    farmer_attempt = client.post(
        "/api/v1/admin/login",
        json={"email": "testfarmer_auth@agrinexus.demo", "password": "FarmerPass123!"}
    )
    assert farmer_attempt.status_code == 403

