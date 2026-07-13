import os
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

GEMINI_KEY = os.getenv("GEMINI_API_KEY")
GENAI_AVAILABLE = False

if GEMINI_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_KEY)
        GENAI_AVAILABLE = True
    except Exception as e:
        logger.error(f"Failed to initialize google-generativeai for Expense Optimizer: {e}")


def analyze_expenses_with_ai(
    expenses: List[Dict[str, Any]],
    farm_context: List[Dict[str, Any]] = None,
    user_state: str = ""
) -> Dict[str, Any]:
    """
    Analyzes farm spending patterns and yields custom optimization recommendations.
    Accepts raw expense dictionaries and farm context.
    Returns:
      - overall_health: "Optimal" | "Action Required" | "Critical"
      - savings_opportunity: float (total estimate)
      - suggestions: List[Dict[str, str]] (keys: category, issue, solution, saving_estimate)
      - profitability_forecast: Dict[str, Any] (estimated yield, estimated market price, net margin)
    """
    total_spend = sum(exp["amount"] for exp in expenses)
    category_totals: Dict[str, float] = {}
    for exp in expenses:
        cat = exp["category"]
        category_totals[cat] = category_totals.get(cat, 0.0) + exp["amount"]

    # Calculate proportions
    proportions = {cat: (amt / total_spend) if total_spend > 0 else 0.0 for cat, amt in category_totals.items()}

    # Resolve farm size
    total_hectares = sum(f.get("size", 1.0) for f in farm_context) if farm_context else 1.0
    primary_crops = list(set(f.get("crop", "Unknown") for f in farm_context if f.get("crop"))) if farm_context else []
    primary_crop = primary_crops[0] if primary_crops else "General Crop"

    # 1. Standard rules for fallback or RAG guidance
    warnings = []
    savings = 0.0

    # Rule checks based on typical Indian farming budgets per hectare
    # Fertilizers shouldn't exceed ₹15,000 per hectare for general cereal crops
    fert_spend = category_totals.get("Fertilizers", 0.0)
    fert_per_ha = fert_spend / total_hectares
    if fert_per_ha > 15000:
        savings_est = (fert_per_ha - 10000) * total_hectares
        savings += savings_est
        warnings.append({
            "category": "Fertilizers",
            "issue": f"High fertilizer spending (₹{fert_per_ha:.0f}/Ha compared to national avg ₹8,000–₹12,000/Ha).",
            "solution": "Get a Soil Health Card (SHC) to apply targeted nitrogen/potassium doses. Shift to Neem-Coated Urea and nano-urea sprays which are 40% cheaper and highly effective.",
            "saving_estimate": f"₹{savings_est:,.0f}"
        })

    # Seeds - Hybrid seeds shouldn't exceed 25% of total budget unless high-density orchards
    seeds_spend = category_totals.get("Seeds", 0.0)
    seeds_prop = proportions.get("Seeds", 0.0)
    if seeds_prop > 0.35 and seeds_spend > 5000:
        savings_est = seeds_spend * 0.20
        savings += savings_est
        warnings.append({
            "category": "Seeds",
            "issue": "Seeds budget comprises a high percentage of total farm investment.",
            "solution": "Procure certified seeds from state cooperative societies or National Seeds Corporation (NSC) depots which offer up to 40% subsidy.",
            "saving_estimate": f"₹{savings_est:,.0f}"
        })

    # Labor - manual weeding/ploughing cost optimization
    labor_spend = category_totals.get("Labor", 0.0)
    labor_per_ha = labor_spend / total_hectares
    if labor_per_ha > 20000:
        savings_est = labor_spend * 0.15
        savings += savings_est
        warnings.append({
            "category": "Labor",
            "issue": "High manual labor costs for weeding and harvesting.",
            "solution": "Establish or join a local Farmer Producer Organization (FPO) to rent modern mechanical weeders and seeders at subsidized rates under SMAM schemes.",
            "saving_estimate": f"₹{savings_est:,.0f}"
        })

    # Default fallback analysis if no warnings triggered but spending exists
    if not warnings and total_spend > 0:
        savings += total_spend * 0.08
        warnings.append({
            "category": "General",
            "issue": "General input spending could be optimized.",
            "solution": "Leverage central and state schemes like the KCC (4% subsidized interest rate) or PMKSY micro-irrigation subvention to lower capital machinery/irrigation costs.",
            "saving_estimate": f"₹{total_spend * 0.08:,.0f}"
        })

    # Profitability Forecast
    # Typical yield (Tonnes per hectare) and price (₹ per tonne / qtl) estimates
    avg_yields = {"Rice": 4.5, "Wheat": 3.8, "Cotton": 2.2, "Sugarcane": 75.0, "Tomato": 25.0, "Potato": 22.0}
    avg_prices = {"Rice": 2200, "Wheat": 2275, "Cotton": 7121, "Sugarcane": 340, "Tomato": 1200, "Potato": 1400} # Price per Quintal (100kg = 0.1 Tonne)

    crop_yield_per_ha = avg_yields.get(primary_crop, 3.5)
    crop_price_per_qtl = avg_prices.get(primary_crop, 1800)

    est_yield_tonnes = crop_yield_per_ha * total_hectares
    est_yield_qtl = est_yield_tonnes * 10
    est_revenue = est_yield_qtl * crop_price_per_qtl
    net_profit = est_revenue - total_spend

    profitability = {
        "crop": primary_crop,
        "estimated_yield_tonnes": round(est_yield_tonnes, 2),
        "market_price_per_qtl": crop_price_per_qtl,
        "estimated_revenue": round(est_revenue, 2),
        "net_margin": round(net_profit, 2),
    }

    # 2. AI Execution using Gemini if enabled
    if GENAI_AVAILABLE:
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")

            prompt = (
                f"You are AgriNexus AI, a farm economics expert. Analyze the following farm expenses and context. "
                f"Provide professional, actionable cost-saving advice in standard formatting.\n\n"
                f"=== FARM PROFILE ===\n"
                f"- State: {user_state}\n"
                f"- Farm Size: {total_hectares} Hectares\n"
                f"- Primary Crop: {primary_crop}\n\n"
                f"=== DETAILED EXPENSES ===\n"
            )
            for exp in expenses:
                prompt += f"- {exp['category']}: ₹{exp['amount']} ({exp.get('description', '')})\n"

            prompt += (
                f"\n=== INSTRUCTIONS ===\n"
                f"Reply in a clean, valid JSON format matching this exact schema:\n"
                f"{{\n"
                f"  \"overall_health\": \"Optimal\" | \"Action Required\" | \"Critical\",\n"
                f"  \"savings_opportunity\": number,\n"
                f"  \"suggestions\": [\n"
                f"    {{\n"
                f"      \"category\": \"Seeds\" | \"Fertilizers\" | \"Labor\" | \"Irrigation\" | \"Machinery\" | \"Transport\" | \"Miscellaneous\",\n"
                f"      \"issue\": \"Short issue description\",\n"
                f"      \"solution\": \"Detailed action steps with cost saving alternatives or government schemes (KCC, SMAM, Nano Urea, NSC, etc.)\",\n"
                f"      \"saving_estimate\": \"Estimated saving text, e.g. ₹2,500\"\n"
                f"    }}\n"
                f"  ],\n"
                f"  \"profitability_forecast\": {{\n"
                f"    \"crop\": \"{primary_crop}\",\n"
                f"    \"estimated_yield_tonnes\": {est_yield_tonnes},\n"
                f"    \"market_price_per_qtl\": {crop_price_per_qtl},\n"
                f"    \"estimated_revenue\": {est_revenue},\n"
                f"    \"net_margin\": {net_profit}\n"
                f"  }}\n"
                f"}}\n"
                f"Ensure the response is ONLY valid JSON. No markdown ticks or other conversational text outside the JSON."
            )

            response = model.generate_content(prompt)
            clean_text = response.text.replace("```json", "").replace("```", "").strip()
            import json
            ai_data = json.loads(clean_text)
            return ai_data
        except Exception as e:
            logger.error(f"Gemini expense optimizer failed: {e}. Falling back to rule-based engine.")

    # Rule-engine fallback return
    return {
        "overall_health": "Action Required" if savings > 0 else "Optimal",
        "savings_opportunity": round(savings, 2),
        "suggestions": warnings,
        "profitability_forecast": profitability,
    }
