"""
AgriNexus AI - Demo Farm Data Seeder
Seeds rich, realistic farm fields, soil health reports, Sentinel-1 SAR radar observations,
Earth intelligence forecasts, crop calendars, expenses, and activity logs.
"""

import os
import sys
from datetime import date, timedelta, datetime
from sqlalchemy.sql import func

# Ensure apps/backend is in sys.path
sys.path.insert(0, os.path.abspath("apps/backend"))

from app.db.database import engine, Base, SessionLocal
from app.models.user import User
from app.models.farm import Farm, SoilReport
from app.models.satellite import SatelliteObservation, EarthIntelligenceForecast
from app.models.calendar import CropCalendar, CalendarEvent
from app.models.expense import Expense
from app.models.activity import ActivityLog
from app.models.scan import ScanLog

def seed_data_for_db(session):
    # Ensure tables exist
    Base.metadata.create_all(bind=session.bind)

    users = session.query(User).all()
    if not users:
        print("No users found in database! Creating default farmer user john@gmail.com...")
        from app.core.security import get_password_hash
        default_user = User(
            email="john@gmail.com",
            hashed_password=get_password_hash("Password123!"),
            full_name="John Doe",
            phone="9876543210",
            role="farmer",
            state="Punjab",
            is_active=True
        )
        session.add(default_user)
        session.commit()
        session.refresh(default_user)
        users = [default_user]

    for user in users:
        print(f"\n--- Seeding demo farm data for User: {user.full_name} ({user.email}, ID: {user.id}) ---")

        # Check existing farms
        existing_farms = session.query(Farm).filter(Farm.user_id == user.id).all()
        if existing_farms:
            print(f"User {user.email} already has {len(existing_farms)} farm(s). Skipping creation to prevent duplicates.")
            continue

        today = date.today()

        # 1. Create Farm 1: Green Valley Precision Acres (Wheat)
        farm1 = Farm(
            user_id=user.id,
            name="Green Valley Precision Acres",
            area=4.5,
            area_unit="hectares",
            state="Punjab",
            district="Ludhiana",
            village="Samrala",
            gps_coordinates="30.9010 N, 75.8573 E",
            boundary_geojson='{"type":"Polygon","coordinates":[[[75.855,30.899],[75.860,30.899],[75.860,30.903],[75.855,30.903],[75.855,30.899]]]}',
            current_crop="Wheat (PBW 725)",
            sowing_date=today - timedelta(days=65),
            irrigation_method="Drip Irrigation & Solar Sprinklers"
        )
        session.add(farm1)

        # 2. Create Farm 2: Sunrise Organic Horticulture Block (Tomato)
        farm2 = Farm(
            user_id=user.id,
            name="Sunrise Organic Block",
            area=2.0,
            area_unit="hectares",
            state="Punjab",
            district="Ludhiana",
            village="Khanna",
            gps_coordinates="30.7025 N, 76.2198 E",
            boundary_geojson='{"type":"Polygon","coordinates":[[[76.217,30.701],[76.222,30.701],[76.222,30.705],[76.217,30.705],[76.217,30.701]]]}',
            current_crop="Tomato (Hybrid Avinash-3)",
            sowing_date=today - timedelta(days=40),
            irrigation_method="Drip Fertigation System"
        )
        session.add(farm2)
        session.commit()
        session.refresh(farm1)
        session.refresh(farm2)
        print(f"Created Farm 1: {farm1.name} (ID: {farm1.id})")
        print(f"Created Farm 2: {farm2.name} (ID: {farm2.id})")

        # 3. Create Soil Reports
        soil1 = SoilReport(
            farm_id=farm1.id,
            ph=6.8,
            nitrogen=260.0,
            phosphorus=38.0,
            potassium=295.0,
            organic_carbon=0.78,
            soil_moisture=27.5,
            electrical_conductivity=0.38,
            temperature=21.5,
            humidity=62.0,
            soil_texture="Loamy Sand",
            test_date=today - timedelta(days=5),
            source="sensor"
        )
        soil2 = SoilReport(
            farm_id=farm2.id,
            ph=6.4,
            nitrogen=225.0,
            phosphorus=42.0,
            potassium=280.0,
            organic_carbon=0.85,
            soil_moisture=31.0,
            electrical_conductivity=0.44,
            temperature=23.0,
            humidity=68.0,
            soil_texture="Sandy Loam",
            test_date=today - timedelta(days=8),
            source="lab"
        )
        session.add_all([soil1, soil2])

        # 4. Create Sentinel-1 SAR Radar Observations (Temporal sequence for radar graphs)
        # Farm 1 SAR Observations
        sar_obs_farm1 = [
            SatelliteObservation(
                farm_id=farm1.id,
                observation_date=today - timedelta(days=2),
                satellite="Sentinel-1",
                orbit="ASCENDING",
                polarization="VV+VH",
                vv=-11.2,
                vh=-17.4,
                vv_vh_ratio=6.2,
                model_prediction="normal",
                model_confidence=0.95,
                source="sentinel-1"
            ),
            SatelliteObservation(
                farm_id=farm1.id,
                observation_date=today - timedelta(days=14),
                satellite="Sentinel-1",
                orbit="ASCENDING",
                polarization="VV+VH",
                vv=-11.8,
                vh=-18.1,
                vv_vh_ratio=6.3,
                model_prediction="normal",
                model_confidence=0.93,
                source="sentinel-1"
            ),
            SatelliteObservation(
                farm_id=farm1.id,
                observation_date=today - timedelta(days=26),
                satellite="Sentinel-1",
                orbit="DESCENDING",
                polarization="VV+VH",
                vv=-8.4,
                vh=-19.0,
                vv_vh_ratio=10.6,
                model_prediction="excess_moisture",
                model_confidence=0.91,
                source="sentinel-1"
            ),
            SatelliteObservation(
                farm_id=farm1.id,
                observation_date=today - timedelta(days=38),
                satellite="Sentinel-1",
                orbit="ASCENDING",
                polarization="VV+VH",
                vv=-14.8,
                vh=-20.5,
                vv_vh_ratio=5.7,
                model_prediction="moisture_deficit",
                model_confidence=0.89,
                source="sentinel-1"
            ),
        ]

        # Farm 2 SAR Observations
        sar_obs_farm2 = [
            SatelliteObservation(
                farm_id=farm2.id,
                observation_date=today - timedelta(days=3),
                satellite="Sentinel-1",
                orbit="ASCENDING",
                polarization="VV+VH",
                vv=-10.8,
                vh=-16.9,
                vv_vh_ratio=6.1,
                model_prediction="normal",
                model_confidence=0.94,
                source="sentinel-1"
            ),
            SatelliteObservation(
                farm_id=farm2.id,
                observation_date=today - timedelta(days=15),
                satellite="Sentinel-1",
                orbit="DESCENDING",
                polarization="VV+VH",
                vv=-11.5,
                vh=-17.8,
                vv_vh_ratio=6.3,
                model_prediction="normal",
                model_confidence=0.92,
                source="sentinel-1"
            ),
        ]
        session.add_all(sar_obs_farm1 + sar_obs_farm2)

        # 5. Create Earth Intelligence Engine Forecasts
        eie_forecasts = [
            EarthIntelligenceForecast(
                farm_id=farm1.id,
                forecast_date=today,
                target_date=today + timedelta(days=7),
                window="weekly",
                predicted_ndvi=0.74,
                crop_stress_index=0.12,
                irrigation_demand_index=0.28,
                disease_risk_index=0.15,
                yield_trend=1.07,
                soil_fertility_index=0.82,
                explanation="Canopy biomass expansion is progressing on schedule with stable root-zone dielectric moisture."
            ),
            EarthIntelligenceForecast(
                farm_id=farm1.id,
                forecast_date=today,
                target_date=today + timedelta(days=30),
                window="monthly",
                predicted_ndvi=0.79,
                crop_stress_index=0.18,
                irrigation_demand_index=0.42,
                disease_risk_index=0.20,
                yield_trend=1.10,
                soil_fertility_index=0.80,
                explanation="Favorable thermal accumulation indices projected; monitor flowering stage irrigation."
            ),
            EarthIntelligenceForecast(
                farm_id=farm1.id,
                forecast_date=today,
                target_date=today + timedelta(days=90),
                window="seasonal",
                predicted_ndvi=0.82,
                crop_stress_index=0.14,
                irrigation_demand_index=0.35,
                disease_risk_index=0.14,
                yield_trend=1.12,
                soil_fertility_index=0.84,
                explanation="High yield potential projected across the wheat cultivation zone."
            ),
            EarthIntelligenceForecast(
                farm_id=farm2.id,
                forecast_date=today,
                target_date=today + timedelta(days=7),
                window="weekly",
                predicted_ndvi=0.68,
                crop_stress_index=0.16,
                irrigation_demand_index=0.32,
                disease_risk_index=0.22,
                yield_trend=1.05,
                soil_fertility_index=0.79,
                explanation="Tomato flowering cycle initiated. Drip fertigation maintaining optimal soil moisture."
            )
        ]
        session.add_all(eie_forecasts)

        # 6. Create Crop Calendar & Events
        cal1 = CropCalendar(
            user_id=user.id,
            name="Rabi Wheat Precision Cycle 2025-26",
            crop="Wheat",
            variety="PBW 725",
            location="Ludhiana, Punjab",
            sow_date=today - timedelta(days=65)
        )
        session.add(cal1)
        session.commit()
        session.refresh(cal1)

        events = [
            CalendarEvent(
                calendar_id=cal1.id,
                event_type="Land Preparation",
                title="Deep Tillage & Basal DAP Application",
                description="Apply 50 kg/acre DAP and incorporate well-rotted farmyard manure.",
                scheduled_date=today - timedelta(days=70),
                das=-5,
                is_completed=True,
                completed_at=func.now()
            ),
            CalendarEvent(
                calendar_id=cal1.id,
                event_type="Sowing",
                title="Seed Sowing with Super Seeder",
                description="Treated certified PBW 725 seeds sown at 40 kg/acre.",
                scheduled_date=today - timedelta(days=65),
                das=0,
                is_completed=True,
                completed_at=func.now()
            ),
            CalendarEvent(
                calendar_id=cal1.id,
                event_type="Irrigation",
                title="First Irrigation (Crown Root Initiation / CRI)",
                description="Most critical irrigation stage at 21 days after sowing.",
                scheduled_date=today - timedelta(days=44),
                das=21,
                is_completed=True,
                completed_at=func.now()
            ),
            CalendarEvent(
                calendar_id=cal1.id,
                event_type="Fertilizer",
                title="Second Split Dose: Urea Top Dressing",
                description="Broadcast 45 kg/acre Urea prior to second scheduled watering.",
                scheduled_date=today + timedelta(days=3),
                das=68,
                is_completed=False
            ),
            CalendarEvent(
                calendar_id=cal1.id,
                event_type="Disease Check",
                title="Yellow Rust Foliar Scouting",
                description="Inspect canopy for early yellow stripe rust pustules during humid mornings.",
                scheduled_date=today + timedelta(days=10),
                das=75,
                is_completed=False
            ),
            CalendarEvent(
                calendar_id=cal1.id,
                event_type="Harvest",
                title="Maturity Scouting & Combine Harvesting",
                description="Harvest when grain moisture drops below 12-14%.",
                scheduled_date=today + timedelta(days=60),
                das=125,
                is_completed=False
            )
        ]
        session.add_all(events)

        # 7. Create Farm Expenses
        expenses = [
            Expense(
                user_id=user.id,
                category="Seeds",
                amount=4500.0,
                expense_date=today - timedelta(days=68),
                crop="Wheat",
                description="Certified PBW 725 Wheat seed bags"
            ),
            Expense(
                user_id=user.id,
                category="Fertilizer",
                amount=6800.0,
                expense_date=today - timedelta(days=65),
                crop="Wheat",
                description="Basal DAP (5 bags) and Urea (3 bags)"
            ),
            Expense(
                user_id=user.id,
                category="Irrigation",
                amount=2200.0,
                expense_date=today - timedelta(days=44),
                crop="Wheat",
                description="Solar pump electricity and sprinkler line servicing"
            ),
            Expense(
                user_id=user.id,
                category="Labor",
                amount=5000.0,
                expense_date=today - timedelta(days=20),
                crop="Wheat",
                description="Weeding and field channel maintenance"
            ),
            Expense(
                user_id=user.id,
                category="Equipment",
                amount=1800.0,
                expense_date=today - timedelta(days=12),
                crop="Tomato",
                description="Drip emitter line filter replacement"
            )
        ]
        session.add_all(expenses)

        # 8. Create Activity Logs
        activities = [
            ActivityLog(
                user_id=user.id,
                activity_type="Field Registry",
                title="Registered Farm: Green Valley Precision Acres (4.5 Ha)",
                description="Geotagged field coordinates 30.9010 N, 75.8573 E in Samrala, Ludhiana.",
                activity_date=today - timedelta(days=70),
                source="manual"
            ),
            ActivityLog(
                user_id=user.id,
                activity_type="Satellite Scan",
                title="Sentinel-1 SAR Radar Pass Analyzed",
                description="C-band active microwave telemetry logged VV backscatter at -11.2 dB (Optimal Moisture).",
                activity_date=today - timedelta(days=2),
                source="auto"
            ),
            ActivityLog(
                user_id=user.id,
                activity_type="Soil Telemetry",
                title="IoT Soil Sensor Telemetry Synced",
                description="Soil moisture at 27.5%, pH 6.8, Nitrogen 260 mg/kg.",
                activity_date=today - timedelta(days=5),
                source="sensor"
            ),
            ActivityLog(
                user_id=user.id,
                activity_type="Disease Scan",
                title="Tomato Foliar Scan Verified",
                description="Scanned leaf sample diagnosed with 96% confidence: Normal Health.",
                activity_date=today - timedelta(days=1),
                source="auto"
            )
        ]
        session.add_all(activities)

        # 9. Create Scan Log
        scan1 = ScanLog(
            user_id=user.id,
            image_path="sample_tomato_foliage.jpg",
            predicted_disease_id="healthy_tomato",
            confidence=0.96,
            user_feedback_correct=True
        )
        session.add(scan1)

        session.commit()
        print(f"Successfully seeded complete farm ecosystem for {user.email}!")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_data_for_db(db)
    finally:
        db.close()
