"""
AgriNexus AI - Crop Advisor Guardrail, 2-Way Chat & SAR Intelligence Tests
Verifies:
1. Strict relevance guardrail rejects out-of-scope queries (coding, trivia, entertainment).
2. General agricultural doubts (yellow leaves, drip irrigation, pest control, frost, soil) are correctly answered.
3. 2-way conversational continuity preserves context for follow-up turns.
4. Sentinel-1 SAR Earth Intelligence telemetry is integrated and explained.
"""

import pytest
from app.services.advisor import generate_advisor_response, is_agricultural_or_conversational


def test_irrelevant_queries_rejected():
    """Verifies that non-agricultural queries trigger the polite relevance guardrail."""
    irrelevant_prompts = [
        "write a python script for quicksort",
        "who won the cricket world cup final?",
        "what is the capital of France?",
        "tell me about bitcoin and cryptocurrency investments",
        "recommend a good action movie to watch tonight",
        "solve the equation 3x + 12 = 30",
        "who is the CEO of Apple?"
    ]

    for prompt in irrelevant_prompts:
        response = generate_advisor_response(
            user_message=prompt,
            chat_history=[],
            profile_name="Ramesh"
        )
        assert "Please provide relevant information" in response or "kheti" in response.lower()
        assert "AgriNexus" in response


def test_general_agricultural_doubts_resolved():
    """Verifies that general farming and agronomy doubts receive thorough, expert answers."""
    # 1. Yellow leaves / Chlorosis
    resp_yellow = generate_advisor_response("why are my crop leaves turning yellow?", [])
    assert "Nitrogen Deficiency" in resp_yellow or "chlorosis" in resp_yellow.lower()
    assert "Iron Deficiency" in resp_yellow or "interveinal" in resp_yellow.lower()

    # 2. Drip Irrigation
    resp_drip = generate_advisor_response("how does drip irrigation save water?", [])
    assert "40%" in resp_drip or "water" in resp_drip.lower()
    assert "fertigation" in resp_drip.lower() or "drip" in resp_drip.lower()

    # 3. Pest Management
    resp_pests = generate_advisor_response("how to control aphids and chewing pests in my field?", [])
    assert "Integrated Pest Management" in resp_pests or "neem" in resp_pests.lower()
    assert "aphid" in resp_pests.lower() or "spray" in resp_pests.lower()

    # 4. Frost Protection
    resp_frost = generate_advisor_response("how to protect crops from frost and cold wave?", [])
    assert "irrigation" in resp_frost.lower() or "smoke" in resp_frost.lower() or "frost" in resp_frost.lower()

    # 5. Soil Testing
    resp_soil = generate_advisor_response("how to do soil testing for my farm?", [])
    assert "sampling" in resp_soil.lower() or "ph" in resp_soil.lower() or "parameter" in resp_soil.lower()


def test_sar_intelligence_explanation_and_telemetry():
    """Verifies that the advisor explains Sentinel-1 SAR intelligence and consumes radar telemetry."""
    # Query asking about SAR intelligence
    resp_sar = generate_advisor_response("how to make use of the SAR intelligence?", [])
    assert "Sentinel-1" in resp_sar or "radar" in resp_sar.lower() or "sar" in resp_sar.lower()
    assert "VV" in resp_sar or "dielectric" in resp_sar.lower() or "moisture" in resp_sar.lower()
    assert "VH" in resp_sar or "biomass" in resp_sar.lower() or "volume scattering" in resp_sar.lower()

    # Query with active SAR telemetry context
    farmer_ctx = {
        "sar_intelligence": [
            {
                "field_name": "North Field",
                "date": "2026-09-08",
                "vv": -8.5,
                "vh": -15.2,
                "rvi": 0.64,
                "condition": "Excess Moisture / Saturated"
            }
        ]
    }
    resp_with_sar = generate_advisor_response(
        "check my satellite radar and SAR telemetry",
        [],
        farmer_context=farmer_ctx
    )
    assert "North Field" in resp_with_sar or "Radar Scan" in resp_with_sar
    assert "-8.5" in resp_with_sar or "VV" in resp_with_sar


def test_two_way_conversational_continuity():
    """Verifies that follow-up questions in a multi-turn conversation retain previous context."""
    # Turn 1: User asks about early blight in tomato
    history = [
        {"sender": "user", "content": "My tomato plants have dark concentric rings on lower leaves, looks like early blight."},
        {"sender": "assistant", "content": "This indicates early blight caused by Alternaria solani. Treat with Mancozeb or Ridomil Gold."}
    ]

    # Turn 2: User asks a short follow-up "what is the recommended dosage?"
    resp_followup = generate_advisor_response(
        user_message="what is the recommended dosage?",
        chat_history=history
    )
    # The advisor should connect "dosage" with "blight" and provide specific grams/liter
    assert "Dosage for Blight" in resp_followup or "Mancozeb" in resp_followup or "grams" in resp_followup or "per liter" in resp_followup

    # Short follow-ups like "is it safe?" should NOT be rejected by guardrail
    assert is_agricultural_or_conversational("is it safe?", history) is True
    assert is_agricultural_or_conversational("how often should i spray?", history) is True


def test_greetings_and_multilingual():
    """Verifies friendly greetings and multilingual responses."""
    resp_en = generate_advisor_response("Good morning, how are you?", [], profile_name="Sardar Singh")
    assert "Sardar Singh" in resp_en or "Hello" in resp_en
    assert "crop" in resp_en.lower() or "farm" in resp_en.lower()

    resp_hi = generate_advisor_response("Namaste kaisa hai sab?", [], profile_name="Kisan")
    assert "Namaste" in resp_hi or "khet" in resp_hi.lower()
