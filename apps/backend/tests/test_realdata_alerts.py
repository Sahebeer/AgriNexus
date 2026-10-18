"""Alert rule tests + advisor context injection (no network, Gemini stubbed)."""

from datetime import date

from app.services.realdata import alerts as al


def _obs(d, mean, valid=100.0, sid=None):
    return {"date": d, "scene_id": sid or f"S2_{d}", "valid_pixel_pct": valid,
            "ndvi": {"mean": mean, "p10": mean - 0.1, "p90": mean + 0.1}}


def test_ndvi_drop_fires_with_evidence():
    res = al.evaluate_alerts(7, [_obs("2026-09-01", 0.70), _obs("2026-09-11", 0.50)], today=date(2026, 9, 12))
    drop = [a for a in res["alerts"] if a["rule"] == "ndvi_drop"]
    assert len(drop) == 1
    a = drop[0]
    assert a["field_id"] == 7 and a["index"] == "ndvi"
    assert a["date_range"] == {"start": "2026-09-01", "end": "2026-09-11"}
    assert a["evidence"]["drop_pct"] == 28.6 and a["evidence"]["current"]["scene_id"] == "S2_2026-09-11"
    assert 0.1 <= a["confidence"] <= 0.95 and a["recommended_action"]


def test_small_drop_and_bare_base_do_not_fire():
    res = al.evaluate_alerts(1, [_obs("2026-09-01", 0.70), _obs("2026-09-11", 0.65)])
    assert not [a for a in res["alerts"] if a["rule"] == "ndvi_drop"]
    res = al.evaluate_alerts(1, [_obs("2026-09-01", 0.15), _obs("2026-09-11", 0.05)])
    assert not [a for a in res["alerts"] if a["rule"] == "ndvi_drop"]


def test_low_valid_pixels_suppress_drop():
    res = al.evaluate_alerts(1, [_obs("2026-09-01", 0.70), _obs("2026-09-11", 0.40, valid=65.0)])
    assert not [a for a in res["alerts"] if a["rule"] == "ndvi_drop"]
    assert any("valid pixels" in s["reason"] for s in res["suppressed"])


def test_far_apart_readings_suppressed():
    res = al.evaluate_alerts(1, [_obs("2026-06-01", 0.70), _obs("2026-08-30", 0.40)])
    assert not [a for a in res["alerts"] if a["rule"] == "ndvi_drop"]
    assert any("days apart" in s["reason"] for s in res["suppressed"])


def test_low_ndvi_confidence_depends_on_season():
    obs = [_obs("2026-09-11", 0.12)]
    in_season = al.evaluate_alerts(1, obs, sowing_date=date(2026, 7, 1))["alerts"][0]
    off_season = al.evaluate_alerts(1, obs)["alerts"][0]
    assert in_season["rule"] == "ndvi_low" and in_season["severity"] == "high"
    assert in_season["confidence"] > off_season["confidence"]


def test_drought_rule():
    agri = {"drought_index": -2.87, "drought_category": "extreme drought", "as_of": "2026-10-19",
            "precip_30d_mm": 13.6, "et0_30d_mm": 147.5, "water_balance_30d_mm": -133.8,
            "climatology_years_used": 10}
    res = al.evaluate_alerts(1, [], agri)
    assert [a["rule"] for a in res["alerts"]] == ["drought"]
    assert res["alerts"][0]["severity"] == "high" and "13.6 mm" in res["alerts"][0]["evidence_text"]
    assert al.evaluate_alerts(1, [], {**agri, "drought_index": -0.4})["alerts"] == []


def test_advisor_prompt_contains_alert_evidence(monkeypatch):
    from app.services import advisor as adv

    captured = {}

    class FakeChat:
        def send_message(self, text):
            captured["prompt"] = text
            return type("R", (), {"text": "ok"})()

    class FakeModel:
        def __init__(self, *_a, **_k):
            pass

        def start_chat(self, history):
            return FakeChat()

    fake_genai = type("G", (), {"GenerativeModel": FakeModel})
    monkeypatch.setattr(adv, "GENAI_AVAILABLE", True)
    monkeypatch.setattr(adv, "genai", fake_genai, raising=False)
    alert = al.evaluate_alerts(3, [_obs("2026-09-01", 0.70), _obs("2026-09-11", 0.50)])["alerts"][0]
    adv.generate_advisor_response("why is my wheat field ndvi dropping?", [],
                                  farmer_context={"field_alerts": [{**alert, "field_name": "North plot"}]})
    assert "Field Alerts from real satellite/weather data" in captured["prompt"]
    assert "S2_2026-09-11" in captured["prompt"] and "North plot" in captured["prompt"]
