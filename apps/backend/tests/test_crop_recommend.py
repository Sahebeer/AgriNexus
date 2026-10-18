from datetime import date
import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.farm import Farm, SoilReport
from app.models.user import User
from app.services.crop_seasons import season_fit, season_for_month

client = TestClient(app)


@pytest.fixture
def test_db_users_and_farms():
    db = SessionLocal()
    try:
        # Create user A
        user_a = db.query(User).filter(User.email == "croptest_user_a@agrinexus.demo").first()
        if not user_a:
            user_a = User(
                email="croptest_user_a@agrinexus.demo",
                hashed_password=get_password_hash("SecretPass123!"),
                full_name="Crop Test User A",
                role="farmer",
                is_active=True,
            )
            db.add(user_a)
            db.commit()
            db.refresh(user_a)

        # Create user B
        user_b = db.query(User).filter(User.email == "croptest_user_b@agrinexus.demo").first()
        if not user_b:
            user_b = User(
                email="croptest_user_b@agrinexus.demo",
                hashed_password=get_password_hash("SecretPass123!"),
                full_name="Crop Test User B",
                role="farmer",
                is_active=True,
            )
            db.add(user_b)
            db.commit()
            db.refresh(user_b)

        # Farm for User A with soil report
        farm_a = db.query(Farm).filter(Farm.name == "Crop Farm A", Farm.user_id == user_a.id).first()
        if not farm_a:
            farm_a = Farm(
                user_id=user_a.id,
                name="Crop Farm A",
                area=2.5,
                state="Punjab",
                district="Ludhiana",
                village="Sahnewal",
                gps_coordinates="30.9010 N, 75.8570 E",
                current_crop="Wheat",
                sowing_date=date(2025, 11, 15),
                irrigation_method="Drip",
            )
            db.add(farm_a)
            db.commit()
            db.refresh(farm_a)

        soil_a = db.query(SoilReport).filter(SoilReport.farm_id == farm_a.id).first()
        if not soil_a:
            soil_a = SoilReport(
                farm_id=farm_a.id,
                ph=6.5,
                nitrogen=90.0,
                phosphorus=42.0,
                potassium=43.0,
                organic_carbon=0.6,
                soil_moisture=35.0,
                electrical_conductivity=1.2,
                temperature=24.0,
                humidity=75.0,
                soil_texture="Clayey",
                test_date=date(2026, 1, 10),
            )
            db.add(soil_a)
            db.commit()

        # Farm for User A without soil report
        farm_a_no_soil = db.query(Farm).filter(Farm.name == "Crop Farm A No Soil", Farm.user_id == user_a.id).first()
        if not farm_a_no_soil:
            farm_a_no_soil = Farm(
                user_id=user_a.id,
                name="Crop Farm A No Soil",
                area=1.0,
                state="Punjab",
                district="Amritsar",
                village="Attari",
                current_crop="None",
                sowing_date=date(2026, 1, 1),
                irrigation_method="Flood",
            )
            db.add(farm_a_no_soil)
            db.commit()
            db.refresh(farm_a_no_soil)

        # Farm for User B
        farm_b = db.query(Farm).filter(Farm.name == "Crop Farm B", Farm.user_id == user_b.id).first()
        if not farm_b:
            farm_b = Farm(
                user_id=user_b.id,
                name="Crop Farm B",
                area=3.0,
                state="Haryana",
                district="Karnal",
                village="Taraori",
                current_crop="Paddy",
                sowing_date=date(2025, 6, 20),
                irrigation_method="Canal",
            )
            db.add(farm_b)
            db.commit()
            db.refresh(farm_b)

        yield {
            "user_a": user_a,
            "user_b": user_b,
            "farm_a": farm_a,
            "farm_a_no_soil": farm_a_no_soil,
            "farm_b": farm_b,
        }
    finally:
        db.close()


def test_season_determination_logic():
    # Month 6-10 is Kharif
    for m in (6, 7, 8, 9, 10):
        assert season_for_month(m) == "kharif"

    # Month 11, 12, 1, 2, 3 is Rabi
    for m in (11, 12, 1, 2, 3):
        assert season_for_month(m) == "rabi"

    # Month 4, 5 is Zaid
    for m in (4, 5):
        assert season_for_month(m) == "zaid"

    with pytest.raises(ValueError):
        season_for_month(0)
    with pytest.raises(ValueError):
        season_for_month(13)


def test_season_fit_and_multipliers():
    # In Kharif (July)
    fit_rice, mult_rice = season_fit("rice", "kharif")
    assert fit_rice == "in_season"
    assert mult_rice == 1.0

    # Chickpea in Kharif is off-season
    fit_chickpea, mult_chickpea = season_fit("chickpea", "kharif")
    assert fit_chickpea == "off_season"
    assert mult_chickpea == 0.6

    # Chickpea in Rabi is in-season
    fit_chickpea_rabi, mult_chickpea_rabi = season_fit("chickpea", "rabi")
    assert fit_chickpea_rabi == "in_season"
    assert mult_chickpea_rabi == 1.0

    # Pomegranate is perennial in all seasons
    fit_pom, mult_pom = season_fit("pomegranate", "kharif")
    assert fit_pom == "perennial"
    assert mult_pom == 0.9


def test_month_ranks_kharif_above_rabi_given_equal_raw_prob():
    # In July (month 7 -> kharif), an in-season crop gets multiplier 1.0, off-season gets 0.6
    prob = 0.5
    _, s_rice = season_fit("rice", season_for_month(7))
    _, s_chickpea = season_fit("chickpea", season_for_month(7))
    score_rice = round(prob * s_rice * 1.0 * 100, 1)
    score_chickpea = round(prob * s_chickpea * 1.0 * 100, 1)
    assert score_rice > score_chickpea
    assert score_rice == 50.0
    assert score_chickpea == 30.0


def test_unauthenticated_request_returns_401():
    response = client.post("/api/v1/crops/recommend", json={"farm_id": 1, "top_n": 5})
    assert response.status_code == 401


def test_other_user_farm_returns_404(test_db_users_and_farms):
    user_a = test_db_users_and_farms["user_a"]
    farm_b = test_db_users_and_farms["farm_b"]  # Owned by User B

    token_a = create_access_token(user_a.id)
    response = client.post(
        "/api/v1/crops/recommend",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"farm_id": farm_b.id, "top_n": 5},
    )
    assert response.status_code == 404
    assert f"Farm with ID {farm_b.id} not found" in response.json()["detail"]


def test_farm_without_soil_report_and_no_overrides_returns_422(test_db_users_and_farms):
    user_a = test_db_users_and_farms["user_a"]
    farm_no_soil = test_db_users_and_farms["farm_a_no_soil"]

    token_a = create_access_token(user_a.id)
    response = client.post(
        "/api/v1/crops/recommend",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"farm_id": farm_no_soil.id, "top_n": 5},
    )
    assert response.status_code == 422
    assert "No soil report for this farm" in response.json()["detail"]


def test_valid_farm_recommendation_returns_sorted_top_n(test_db_users_and_farms):
    user_a = test_db_users_and_farms["user_a"]
    farm_a = test_db_users_and_farms["farm_a"]

    token_a = create_access_token(user_a.id)
    response = client.post(
        "/api/v1/crops/recommend",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"farm_id": farm_a.id, "month": 7, "top_n": 5},
    )
    assert response.status_code == 200
    data = response.json()

    assert data["farm_id"] == farm_a.id
    assert data["month"] == 7
    assert data["season"] == "kharif"
    assert data["soil_source"] == "latest_soil_report"
    assert data["ood_status"] in {"ok", "soft_ood"}
    assert len(data["recommendations"]) <= 5
    assert len(data["recommendations"]) > 0

    recs = data["recommendations"]
    # Verify scores are sorted descending
    scores = [r["score"] for r in recs]
    assert scores == sorted(scores, reverse=True)

    # Verify rank values are 1..N
    assert [r["rank"] for r in recs] == list(range(1, len(recs) + 1))


def test_hard_ood_input_returns_empty_list(test_db_users_and_farms):
    user_a = test_db_users_and_farms["user_a"]
    token_a = create_access_token(user_a.id)

    # Nitrogen 450 exceeds 300 mg/kg limit
    response = client.post(
        "/api/v1/crops/recommend",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "month": 8,
            "overrides": {
                "ph": 6.5,
                "nitrogen": 450.0,
                "phosphorus": 40.0,
                "potassium": 40.0,
                "moisture": 30.0,
            },
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["ood_status"] == "hard_ood"
    assert "nitrogen above 300 mg/kg" in data["ood_reason"]
    assert data["recommendations"] == []


def test_overrides_path_works_without_farm_id(test_db_users_and_farms):
    user_a = test_db_users_and_farms["user_a"]
    token_a = create_access_token(user_a.id)

    response = client.post(
        "/api/v1/crops/recommend",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "month": 12,
            "top_n": 3,
            "overrides": {
                "nitrogen": 40.0,
                "phosphorus": 68.0,
                "potassium": 80.0,
                "ph": 6.5,
                "moisture": 25.0,
                "temperature": 18.0,
                "humidity": 60.0,
                "rainfall": 50.0,
            },
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["farm_id"] is None
    assert data["month"] == 12
    assert data["season"] == "rabi"
    assert data["soil_source"] == "overrides"
    assert data["weather_source"] == "manual_inputs"
    assert len(data["recommendations"]) == 3
    assert data["recommendations"][0]["score"] > 0
