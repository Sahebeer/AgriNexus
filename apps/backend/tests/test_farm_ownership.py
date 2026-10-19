"""Farm / boundary ownership: an account only ever sees its own farms, and no
hard-coded demo farm is served to anyone (regression for "Shree Krishna Precision Farm")."""

import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.api import satellite_maps
from app.core.security import create_access_token, get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.farm import Farm
from app.models.user import User
from app.services.satellite_provider import DemoSatelliteProvider

client = TestClient(app)

BOUNDARY_A = '{"type":"Polygon","coordinates":[[[75.855,30.899],[75.860,30.899],[75.860,30.903],[75.855,30.903],[75.855,30.899]]]}'
BOUNDARY_B = '{"type":"Polygon","coordinates":[[[76.217,30.701],[76.222,30.701],[76.222,30.705],[76.217,30.705],[76.217,30.701]]]}'


def _user(db, role="farmer"):
    u = User(email=f"own_{uuid.uuid4().hex[:10]}@agrinexus.test", hashed_password=get_password_hash("Pass12345!"),
             full_name="Ownership Test", role=role, is_active=True)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _farm(db, user, name, boundary):
    f = Farm(user_id=user.id, name=name, area=2.0, area_unit="hectares", state="Punjab", district="Ludhiana",
             village="Test", current_crop="Wheat", sowing_date=date(2026, 7, 1), irrigation_method="Drip",
             boundary_geojson=boundary)
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


@pytest.fixture
def accounts(monkeypatch):
    # Offline: synthetic provider instead of live Sentinel-2.
    monkeypatch.setattr(satellite_maps, "get_default_satellite_provider", lambda: DemoSatelliteProvider())
    db = SessionLocal()
    a, b, empty = _user(db), _user(db), _user(db)
    admin = _user(db, role="admin")
    fa = _farm(db, a, "Green Valley Precision Acres", BOUNDARY_A)
    fb = _farm(db, b, "Sunrise Organic Block", BOUNDARY_B)
    fadmin = _farm(db, admin, "Admin Own Farm", BOUNDARY_A)
    hdr = lambda u: {"Authorization": f"Bearer {create_access_token(u.id)}"}
    try:
        yield {"a": hdr(a), "b": hdr(b), "empty": hdr(empty), "admin": hdr(admin),
               "fa": fa.id, "fb": fb.id, "fadmin": fadmin.id}
    finally:
        for f in (fa, fb, fadmin):
            db.delete(db.merge(f))
        for u in (a, b, empty, admin):
            db.delete(db.merge(u))
        db.commit()
        db.close()


def test_farm_list_is_scoped_to_owner(accounts):
    names_a = [f["name"] for f in client.get("/api/v1/farms/", headers=accounts["a"]).json()]
    names_b = [f["name"] for f in client.get("/api/v1/farms/", headers=accounts["b"]).json()]
    assert names_a == ["Green Valley Precision Acres"]
    assert names_b == ["Sunrise Organic Block"]


def test_owner_gets_own_boundary_analysis(accounts):
    r = client.get(f"/api/v1/satellite-maps/farms/{accounts['fa']}", headers=accounts["a"])
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "Green Valley Precision Acres" and body["db_farm_id"] == accounts["fa"]
    assert body["boundary"][0] == [75.855, 30.899]
    assert "Shree Krishna" not in r.text


def test_cannot_read_another_accounts_farm_or_boundary(accounts):
    for path in (f"/api/v1/satellite-maps/farms/{accounts['fb']}", f"/api/v1/farms/{accounts['fb']}/vegetation"):
        r = client.get(path, headers=accounts["a"])
        assert r.status_code == 404, path
        assert "Sunrise" not in r.text and "76.217" not in r.text


def test_satellite_farm_requires_login(accounts):
    assert client.get(f"/api/v1/satellite-maps/farms/{accounts['fa']}").status_code == 401


def test_account_without_farms_gets_empty_list_not_demo(accounts):
    assert client.get("/api/v1/farms/", headers=accounts["empty"]).json() == []


def test_hardcoded_demo_farm_endpoint_removed(accounts):
    assert client.get("/api/v1/satellite-maps/demo-farm", headers=accounts["a"]).status_code == 404
    assert not hasattr(DemoSatelliteProvider(), "get_demo_farm")


def test_admin_farm_cards_only_show_admins_own_farms(accounts):
    farms = client.get("/api/v1/admin/demo-farms", headers=accounts["admin"]).json()
    assert [f["name"] for f in farms] == ["Admin Own Farm"]
    assert all(not f["is_demo"] for f in farms)
