import os
import logging
import json
from pathlib import Path
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

# Attempt to configure the official google-generativeai package if key is provided
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
GENAI_AVAILABLE = False

if GEMINI_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_KEY)
        GENAI_AVAILABLE = True
        logger.info("Google Generative AI service initialized successfully for Crop Advisor.")
    except Exception as e:
        logger.error(f"Failed to initialize Google GenAI SDK: {e}")

# Load local agricultural facts RAG database
KNOWLEDGE_BASE: Dict[str, Any] = {}
try:
    kb_path = Path(__file__).parent / "knowledge_base.json"
    if kb_path.exists():
        with open(kb_path, "r", encoding="utf-8") as f:
            KNOWLEDGE_BASE = json.load(f)
        logger.info("Local agriculture knowledge base loaded successfully for RAG.")
    else:
        logger.warning(f"knowledge_base.json not found at {kb_path}. Running with empty facts.")
except Exception as e:
    logger.error(f"Failed to load knowledge_base.json: {e}")


def retrieve_rag_context(user_message: str) -> str:
    """
    Scans the query for crop names or agricultural keywords, retrieves matching
    verified facts from our knowledge base dictionary, and formats it as a prompt injection block.
    """
    cleaned_query = user_message.lower()
    retrieved_facts = []
    
    for key, data in KNOWLEDGE_BASE.items():
        if key in cleaned_query:
            fact_str = f"[Verified Fact for {key.upper()}]: "
            if isinstance(data, dict):
                fact_str += " | ".join([f"{k}: {v}" for k, v in data.items()])
            else:
                fact_str += str(data)
            retrieved_facts.append(fact_str)
            
    if not retrieved_facts:
        return ""
        
    return "\n".join(retrieved_facts)


def generate_advisor_response(
    user_message: str, 
    chat_history: list,
    farmer_context: Optional[dict] = None,
    profile_state: Optional[str] = None,
    profile_name: Optional[str] = None
) -> str:
    """
    Generates agronomy recommendations based on user questions.
    Intelligently integrates farmer context, local weather, state location,
    long-term history, and verified RAG facts.
    """
    cleaned_msg = user_message.lower().strip()
    
    # 1. Compile User Profile & Farm details (context injection)
    context_bulletpoints = []
    if profile_name:
        context_bulletpoints.append(f"- Farmer Name: {profile_name}")
    if profile_state:
        context_bulletpoints.append(f"- State Location: {profile_state}")
        
    # Check if client supplied active farm field context from localStorage
    if farmer_context and "farms" in farmer_context:
        farms_data = farmer_context["farms"]
        if isinstance(farms_data, list) and len(farms_data) > 0:
            field_descriptions = []
            for f in farms_data:
                name = f.get("name", "Unnamed Field")
                size = f.get("size", "Unknown size")
                soil = f.get("soil_type", "Unknown soil")
                irrigation = f.get("irrigation_method", "Unknown irrigation")
                field_descriptions.append(f"{name} ({size} hectares, soil: {soil}, water: {irrigation})")
            context_bulletpoints.append(f"- Registered Farm Fields: {', '.join(field_descriptions)}")
            
    # Check if client supplied current location weather context
    if farmer_context and "weather" in farmer_context:
        w = farmer_context["weather"]
        if isinstance(w, dict):
            temp = w.get("temperature", "Unknown")
            cond = w.get("condition", "Unknown")
            alerts = w.get("alerts", [])
            alert_str = f" | Alerts: {[a.get('message') for a in alerts]}" if alerts else ""
            context_bulletpoints.append(f"- Current Local Weather: {temp}°C, {cond}{alert_str}")
            
    # Check if client supplied market prices context
    if farmer_context and "prices" in farmer_context:
        p = farmer_context["prices"]
        if isinstance(p, list) and len(p) > 0:
            prices_str = ", ".join([f"{item.get('commodity')}: {item.get('price')}/qtl" for item in p[:3]])
            context_bulletpoints.append(f"- Local Market Rates: {prices_str}")

    # Inject Disease Scan History context
    if farmer_context and "scans" in farmer_context:
        sc = farmer_context["scans"]
        if isinstance(sc, list) and len(sc) > 0:
            sc_str = ", ".join([f"{item.get('disease')} (confidence: {item.get('confidence'):.0%}, date: {item.get('date')})" for item in sc[:3]])
            context_bulletpoints.append(f"- Disease Scan History: {sc_str}")

    # Inject Expense logs context
    if farmer_context and "expenses" in farmer_context:
        ex = farmer_context["expenses"]
        if isinstance(ex, list) and len(ex) > 0:
            ex_str = ", ".join([f"{item.get('category')} (₹{item.get('amount'):.0f}, date: {item.get('date')})" for item in ex[:4]])
            context_bulletpoints.append(f"- Recent Expenses: {ex_str}")

    # Inject Crop Calendars and upcoming schedules context
    if farmer_context and "calendars" in farmer_context:
        cals = farmer_context["calendars"]
        if isinstance(cals, list) and len(cals) > 0:
            cals_desc = []
            for c in cals[:2]:
                evs = c.get("upcoming_events", [])
                evs_str = ", ".join([f"{e.get('title')} on {e.get('date')}" for e in evs])
                cals_desc.append(f"{c.get('name')} (sow_date: {c.get('sow_date')}, upcoming: {evs_str})")
            context_bulletpoints.append(f"- Active Crop Schedules: {'; '.join(cals_desc)}")

    # Inject Activity logs context
    if farmer_context and "activities" in farmer_context:
        acts = farmer_context["activities"]
        if isinstance(acts, list) and len(acts) > 0:
            acts_str = ", ".join([f"{item.get('title')} ({item.get('date')})" for item in acts[:3]])
            context_bulletpoints.append(f"- Recent Activity timeline logs: {acts_str}")

    context_block = "\n".join(context_bulletpoints) if context_bulletpoints else "None (Query the user politely if you need profile details)."

    # 2. Retrieve RAG facts
    rag_block = retrieve_rag_context(user_message)
    rag_injection = f"\n=== VERIFIED AGRICULTURAL FACTS (RAG Context) ===\n{rag_block}\n" if rag_block else ""

    # 3. Execute real Gemini query if available
    if GENAI_AVAILABLE:
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            
            # Format history for Gemini chat structure
            formatted_history = []
            for msg in chat_history[-6:]:  # Send last 6 messages as context
                role = "user" if msg["sender"] == "user" else "model"
                formatted_history.append({
                    "role": role,
                    "parts": [msg["content"]]
                })
            
            chat = model.start_chat(history=formatted_history)
            
            system_instruction = (
                "You are AgriNexus AI, a highly experienced precision agronomy advisor helping farmers. "
                "Review the farmer's profile, location weather, and verified facts injected below to personalize your response:\n\n"
                
                "=== FARMER PROFILE & ENVIRONMENTAL CONTEXT ===\n"
                f"{context_block}\n"
                f"{rag_injection}\n"
                
                "=== INSTRUCTIONS ===\n"
                "1. Personalization: Address the farmer by name naturally if known. Integrate their location weather or crops in suggestions without saying 'Based on your profile'.\n"
                "2. Natural Conversation: Avoid standard template responses. Answer greetings (e.g. 'Hi', 'Kaise ho?', 'Good morning', 'Thank you') naturally and warmly like a friendly expert.\n"
                "3. Multilingualism: Match the user's input language. If they ask in English, reply in English. If they query in Hindi or Hinglish (Roman script, e.g. 'cotton me leaves yellow ho rahi hai', 'urea kab daalein'), reply in natural Romanized Hinglish.\n"
                "4. Intelligent Follow-up: If critical info is missing to solve their query (e.g. they say 'spots are on my leaves' but don't state the crop type), do not diagnose blindly. Ask polite, smart follow-up questions one by one.\n"
                "5. Safety & Trustworthiness: Ground all advice in the RAG block or established scientific practices. Suggest checking with local extension officers for severe or ambiguous pathogen outbreaks.\n"
                "6. Proactive Farm Assistant: Be proactive! If the user greets you or asks a general question, inspect their Disease Scan History (e.g. if they had a recent leaf spot scan), Expense logs (e.g. if they spend a lot on fertilizers), or Active Crop Schedules (e.g. upcoming sowing or irrigation events) and offer helpful, smart suggestions/tips before they even ask.\n"
            )
            response = chat.send_message(system_instruction + "\n\nUser Message: " + user_message)
            return response.text
        except Exception as ex:
            logger.error(f"Gemini API inference failed: {ex}. Falling back to context-aware rule engine.")

    # 4. Context-Aware Fallback RAG Engine
    # 4a. Handle Greetings
    greetings_en = ["hi", "hello", "good morning", "hey", "good afternoon"]
    greetings_hi = ["kaise ho", "kaisa hai", "namaste", "pranam", "ram ram"]
    thanks = ["thank you", "thanks", "dhanyawad", "shukriya"]
    
    name_str = f" {profile_name}" if profile_name else ""
    state_str = f" in {profile_state}" if profile_state else ""
    
    if any(g in cleaned_msg for g in greetings_en):
        return (
            f"Hello{name_str}! I hope you're having a productive day{state_str}. "
            "How are your crops doing today? What can I help you with?"
        )
    elif any(g in cleaned_msg for g in greetings_hi):
        return (
            f"Namaste{name_str}! Main bilkul theek hoon. Aap batayein, khet par sab kaisa chal raha hai? "
            "Aaj kis crop ya fertilizer me help chahiye?"
        )
    elif any(t in cleaned_msg for t in thanks):
        return (
            f"You're very welcome{name_str}! I am always here to assist you with "
            "soil health, seed selections, crop diseases, or government schemes. Let me know if you need anything else!"
        )

    # 4b. Crop specific matches from RAG
    for crop in ["tomato", "cotton", "wheat", "rice", "potato"]:
        if crop in cleaned_msg:
            crop_data = KNOWLEDGE_BASE.get(crop, {})
            if crop_data:
                return (
                    f"### Precision Agronomy Guide for {crop.title()}\n\n"
                    f"* **Sowing Period:** {crop_data.get('sowing_period')}\n"
                    f"* **Soil Suitability:** {crop_data.get('soil_suitability')}\n"
                    f"* **Fertilizers:** {crop_data.get('fertilizer_recommendation')}\n"
                    f"* **Common Pathogens:** {crop_data.get('diseases')}\n"
                    f"* **Irrigation Habits:** {crop_data.get('irrigation_habits')}\n\n"
                    f"> **Note:** Local weather state is currently logged{state_str}."
                )

    # 4c. General agronomy matches from RAG
    if "ph" in cleaned_msg:
        ph_data = KNOWLEDGE_BASE.get("soil_ph", {})
        return (
            "### Soil pH Buffering Guidelines\n\n"
            f"* **Acidic Soil Fix:** {ph_data.get('acidic_fix')}\n"
            f"* **Alkaline Soil Fix:** {ph_data.get('alkaline_fix')}\n"
            f"* **Optimal Balance:** {ph_data.get('nutrient_availability')}"
        )
    elif "fertilizer" in cleaned_msg or "npk" in cleaned_msg or "urea" in cleaned_msg or "dap" in cleaned_msg or "khad" in cleaned_msg:
        fert_data = KNOWLEDGE_BASE.get("fertilizer", {})
        return (
            "### Fertilizer Application Guide\n\n"
            f"* **Urea (Nitrogen):** {fert_data.get('urea')}\n"
            f"* **DAP (Phosphorus):** {fert_data.get('dap')}\n"
            f"* **Potash (Potassium):** {fert_data.get('potash')}\n"
            f"* **Foliar Warning:** {fert_data.get('npk_general')}"
        )
    elif "blight" in cleaned_msg or "daag" in cleaned_msg or "disease" in cleaned_msg:
        blight_data = KNOWLEDGE_BASE.get("blight", {})
        return (
            "### Blight Symptom Intervention\n\n"
            f"* **Pathogen Group:** {blight_data.get('pathogen_type')}\n"
            f"* **Triggers:** {blight_data.get('environmental_triggers')}\n"
            f"* **Chemical Actions:** {blight_data.get('chemical_control')}\n"
            f"* **Bio/Cultural Methods:** {blight_data.get('organic_control')}"
        )

    # 4d. Intelligent Fallback asking for details
    return (
        f"I hear you, {profile_name or 'Farmer'}. To provide accurate agricultural advice, "
        "could you let me know:\n"
        "- Which crop you are currently growing?\n"
        "- What symptoms or parameters (pH, soil type, irrigation) you are observing?\n"
        "Feel free to write in English, Hindi, or Hinglish!"
    )
