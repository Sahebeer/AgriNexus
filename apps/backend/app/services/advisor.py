import os
import logging
import json
import re
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


# Agricultural vocabulary for relevance guardrail
AGRICULTURAL_TERMS = {
    # Crops & Plants
    "crop", "crops", "plant", "plants", "vegetation", "foliage", "seed", "seeds",
    "wheat", "rice", "paddy", "cotton", "tomato", "potato", "mustard", "sugarcane",
    "maize", "corn", "soybean", "barley", "millet", "bajra", "jowar", "pulses",
    "onion", "garlic", "chilli", "chili", "pepper", "brinjal", "eggplant", "mango", "citrus",
    "gram", "chickpea", "lentil", "groundnut", "peanut", "turmeric", "ginger", "sarson",
    "ganna", "gehun", "dhan", "tamatar", "aloo", "kapas", "fasal", "khet", "sabzi", "anaaj", "beej",
    # Soil & Nutrients
    "soil", "mitti", "ph", "nitrogen", "phosphorus", "potassium", "potash", "urea", "dap",
    "npk", "fertilizer", "khad", "manure", "compost", "vermicompost", "humus", "zinc",
    "iron", "sulphur", "sulfur", "boron", "organic", "calcium", "magnesium", "salinity",
    "alkaline", "acidic", "loam", "clay", "sandy", "nutrient", "nutrients", "fertigation",
    # Disease & Pests
    "disease", "pathogen", "pest", "pests", "insect", "insects", "fungus", "fungal",
    "bacteria", "bacterial", "virus", "viral", "blight", "rust", "rot", "wilt",
    "mildew", "leaf curl", "aphid", "aphids", "whitefly", "borer", "caterpillar",
    "jassid", "thrips", "mite", "spore", "chlorosis", "yellowing", "yellow leaf",
    "yellow leaves", "spots", "neem", "pesticide", "fungicide", "insecticide",
    "spray", "dosage", "dose", "bimari", "keeda", "daag", "peeli", "peela",
    # Water & Weather
    "water", "irrigation", "sinchai", "drip", "sprinkler", "flood", "canal", "borewell",
    "drainage", "moisture", "drought", "rain", "rainfall", "monsoon", "frost", "hail",
    "dew", "pala", "barish", "weather", "temperature", "humidity", "microclimate",
    # Farm Operations & Management
    "farm", "farmer", "farming", "kisaan", "kisan", "kheti", "acre", "hectare", "bigha",
    "yield", "harvest", "harvesting", "sow", "sowing", "plantation", "transplanting",
    "germination", "tillage", "mulching", "pruning", "weeding", "weed", "weeds", "herbicide",
    "kharif", "rabi", "zaid", "rotation", "intercropping", "nursery", "livestock", "tractor",
    # Technology / Remote Sensing / Radar
    "sar", "satellite", "radar", "sentinel", "sentinel-1", "sentinel-2", "stac",
    "backscatter", "dielectric", "polarization", "vv", "vh", "rvi", "ndvi", "ndwi",
    "copernicus", "remote sensing", "earth intelligence", "radar vegetation index",
    # Finance & Market
    "mandi", "msp", "subsidy", "subsidies", "scheme", "schemes", "pm-kisan", "kcc",
    "pmfby", "crop insurance", "bhav", "mandi price", "market rate"
}

CONVERSATIONAL_TOKENS = {
    "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
    "namaste", "pranam", "ram ram", "kaise ho", "kaisa hai", "thank you",
    "thanks", "dhanyawad", "shukriya", "bye", "goodbye", "help", "who are you"
}

FOLLOWUP_PHRASES = [
    "what about", "how much", "what dosage", "how often", "when to", "is it safe",
    "can i", "tell me more", "what next", "why", "how to apply", "yes", "no",
    "okay", "ok", "sure", "and for", "which one", "explain"
]


def is_agricultural_or_conversational(cleaned_msg: str, chat_history: list) -> bool:
    """
    Evaluates whether the user's message is relevant to agriculture or is a valid
    turn in an ongoing conversational flow.
    Rejects out-of-scope queries (coding, trivia, entertainment, sports, crypto, politics).
    """
    # 1. Check for direct conversational greetings/closings
    for token in CONVERSATIONAL_TOKENS:
        if re.search(rf"\b{re.escape(token)}\b", cleaned_msg):
            return True

    # 2. Check for agricultural keywords
    for word in AGRICULTURAL_TERMS:
        if re.search(rf"\b{re.escape(word)}\b", cleaned_msg):
            return True

    # 3. Check for multi-turn conversational follow-up if prior turns were agricultural
    if chat_history and len(chat_history) > 0:
        is_followup = any(cleaned_msg.startswith(p) or p in cleaned_msg for p in FOLLOWUP_PHRASES)
        if is_followup or len(cleaned_msg.split()) <= 4:
            # Check if any recent message discussed agriculture
            recent_context = " ".join([m.get("content", "").lower() for m in chat_history[-4:]])
            for word in AGRICULTURAL_TERMS:
                if word in recent_context:
                    return True

    return False


def retrieve_rag_context(user_message: str) -> str:
    """
    Scans the query for agricultural keywords, retrieves matching
    verified facts from our knowledge base dictionary, and formats it as a prompt injection block.
    """
    cleaned_query = user_message.lower()
    retrieved_facts = []

    keyword_map = {
        "tomato": "tomato",
        "cotton": "cotton",
        "wheat": "wheat",
        "rice": "rice",
        "potato": "potato",
        "mustard": "mustard",
        "sarson": "mustard",
        "sugarcane": "sugarcane",
        "ganna": "sugarcane",
        "blight": "blight",
        "rust": "rust",
        "yellow": "yellow_leaves",
        "chlorosis": "yellow_leaves",
        "peeli": "yellow_leaves",
        "pest": "pest_control",
        "aphid": "pest_control",
        "keeda": "pest_control",
        "borer": "pest_control",
        "drip": "drip_irrigation",
        "irrigation": "drip_irrigation",
        "sinchai": "drip_irrigation",
        "organic": "organic_farming",
        "jeevamrit": "organic_farming",
        "jaivik": "organic_farming",
        "frost": "frost_protection",
        "pala": "frost_protection",
        "soil test": "soil_testing",
        "sar": "sar_radar",
        "radar": "sar_radar",
        "satellite": "sar_radar",
        "sentinel": "sar_radar",
        "fertilizer": "fertilizer",
        "urea": "fertilizer",
        "dap": "fertilizer",
        "potash": "fertilizer",
        "khad": "fertilizer",
        "ph": "soil_ph"
    }

    matched_keys = set()
    for term, kb_key in keyword_map.items():
        if term in cleaned_query and kb_key in KNOWLEDGE_BASE:
            matched_keys.add(kb_key)

    for key in matched_keys:
        data = KNOWLEDGE_BASE[key]
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
    Generates precision agronomy recommendations based on user questions.
    Supports 2-way multi-turn conversation, strict relevance guardrails,
    general agricultural doubt solving, and Sentinel-1 SAR intelligence.
    """
    cleaned_msg = user_message.lower().strip()

    # 1. Relevance Guardrail check
    if not is_agricultural_or_conversational(cleaned_msg, chat_history):
        is_hindi = any(w in cleaned_msg for w in ["kya", "kaise", "hai", "mujhe", "batao", "kripya"])
        if is_hindi:
            return (
                "Kripya kheti, fasal, mitti, keet prabandhan, sinchai ya mausam se jude sawal poochein. "
                "Main aapka AgriNexus Kheti Advisor hoon, jo aapki kheti aur fasal ki behtari ke liye tayyar hai!"
            )
        return (
            "Please provide relevant information or questions regarding agriculture, crop health, "
            "soil management, irrigation, livestock, weather advisories, or farm operations. "
            "I am your specialized AgriNexus AI Agronomy Advisor, dedicated to helping you optimize your farm operations and crop yields!"
        )

    # 2. Compile Farmer Profile, Environmental & SAR Context
    context_bulletpoints = []
    if profile_name:
        context_bulletpoints.append(f"- Farmer Name: {profile_name}")
    if profile_state:
        context_bulletpoints.append(f"- State Location: {profile_state}")

    # Check registered farm fields & soil health
    if farmer_context and "farms" in farmer_context:
        farms_data = farmer_context["farms"]
        if isinstance(farms_data, list) and len(farms_data) > 0:
            field_descriptions = []
            for f in farms_data:
                name = f.get("name", "Unnamed Field")
                area = f.get("area") or f.get("size", "Unknown size")
                soil = f.get("soil_type")
                if not soil and f.get("soil_reports") and len(f["soil_reports"]) > 0:
                    soil = f["soil_reports"][0].get("soil_texture")
                soil = soil or "Unknown soil"

                irrigation = f.get("irrigation_method", "Unknown irrigation")
                crop = f.get("current_crop") or f.get("crop", "Unknown")
                desc = f"{name} ({area} Ha, Crop: {crop}, soil texture: {soil}, water: {irrigation})"

                # Soil report
                sh = f.get("soil_health")
                if not sh and f.get("soil_reports") and len(f["soil_reports"]) > 0:
                    sh = f["soil_reports"][0]
                if sh:
                    desc += (
                        f" [Soil: pH {sh.get('ph')}, N {sh.get('nitrogen')}, "
                        f"P {sh.get('phosphorus')}, K {sh.get('potassium')}, "
                        f"Moisture {sh.get('soil_moisture')}%]"
                    )

                # SAR Telemetry per farm if available
                sar = f.get("sar_telemetry")
                if sar:
                    desc += (
                        f" [Sentinel-1 SAR Radar: VV {sar.get('vv')} dB, VH {sar.get('vh')} dB, "
                        f"RVI {sar.get('rvi')}, status: {sar.get('model_prediction')}]"
                    )

                field_descriptions.append(desc)
            context_bulletpoints.append(f"- Registered Farm Fields: {'; '.join(field_descriptions)}")

    # Ingest Sentinel-1 SAR Radar Intelligence
    if farmer_context and "sar_intelligence" in farmer_context:
        sar_list = farmer_context["sar_intelligence"]
        if isinstance(sar_list, list) and len(sar_list) > 0:
            sar_items = []
            for s in sar_list[:3]:
                field_name = s.get("field_name") or f"Field #{s.get('field_id', 'Active')}"
                vv = s.get("vv")
                vh = s.get("vh")
                rvi = s.get("rvi") or s.get("radar_vegetation_index")
                condition = s.get("condition") or s.get("model_prediction", "calibrated")
                item_desc = (
                    f"{field_name} (Date: {s.get('date', 'Recent')}): VV {vv} dB (dielectric/moisture proxy), "
                    f"VH {vh} dB (canopy biomass proxy), RVI {rvi}, Radar Assessment: {condition}"
                )
                if s.get("anomaly_detected"):
                    item_desc += f" [ALERT: Anomaly detected: {s.get('anomaly_reason', 'variance detected')}]"
                sar_items.append(item_desc)
            context_bulletpoints.append(f"- Sentinel-1 SAR Radar Telemetry (Earth Observation): {'; '.join(sar_items)}")

    # Ingest Weather Context
    if farmer_context and "weather" in farmer_context:
        w = farmer_context["weather"]
        if isinstance(w, dict):
            temp = w.get("temperature", "Unknown")
            cond = w.get("condition", "Unknown")
            alerts = w.get("alerts", [])
            alert_str = f" | Alerts: {[a.get('message') for a in alerts]}" if alerts else ""
            context_bulletpoints.append(f"- Current Local Weather: {temp}°C, {cond}{alert_str}")

    # Ingest Disease Scans
    if farmer_context and "scans" in farmer_context:
        sc = farmer_context["scans"]
        if isinstance(sc, list) and len(sc) > 0:
            sc_str = ", ".join([f"{item.get('disease')} ({item.get('confidence'):.0%}, date: {item.get('date')})" for item in sc[:3]])
            context_bulletpoints.append(f"- Recent Leaf Scans: {sc_str}")

    # Ingest Expenses
    if farmer_context and "expenses" in farmer_context:
        ex = farmer_context["expenses"]
        if isinstance(ex, list) and len(ex) > 0:
            ex_str = ", ".join([f"{item.get('category')} (₹{item.get('amount'):.0f}, date: {item.get('date')})" for item in ex[:4]])
            context_bulletpoints.append(f"- Recent Expenses: {ex_str}")

    # Ingest Crop Schedules
    if farmer_context and "calendars" in farmer_context:
        cals = farmer_context["calendars"]
        if isinstance(cals, list) and len(cals) > 0:
            cals_desc = []
            for c in cals[:2]:
                evs = c.get("upcoming_events", [])
                evs_str = ", ".join([f"{e.get('title')} on {e.get('date')}" for e in evs])
                cals_desc.append(f"{c.get('name')} (sow: {c.get('sow_date')}, upcoming: {evs_str})")
            context_bulletpoints.append(f"- Active Schedules: {'; '.join(cals_desc)}")

    context_block = "\n".join(context_bulletpoints) if context_bulletpoints else "None (Query the user politely if you need profile details)."

    # 3. Retrieve verified RAG facts
    rag_block = retrieve_rag_context(user_message)
    rag_injection = f"\n=== VERIFIED AGRICULTURAL FACTS (RAG Context) ===\n{rag_block}\n" if rag_block else ""

    # 4. Execute real Gemini query if available
    if GENAI_AVAILABLE:
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")

            # Format multi-turn history for Gemini chat structure
            formatted_history = []
            for msg in chat_history[-10:]:  # Pass up to 10 recent messages for 2-way conversation continuity
                role = "user" if msg["sender"] == "user" else "model"
                formatted_history.append({
                    "role": role,
                    "parts": [msg["content"]]
                })

            chat = model.start_chat(history=formatted_history)

            system_instruction = (
                "You are AgriNexus AI, a world-class precision agronomy advisor assisting farmers.\n\n"
                "=== CORE SYSTEM DIRECTIVES ===\n"
                "1. STRICT RELEVANCE GUARDRAIL: You ONLY answer questions related to agriculture, crops, "
                "farming techniques, soil science, irrigation, pest/disease management, agricultural economics, "
                "or weather impacts. If the user asks about irrelevant topics (movies, coding, pop culture, sports, "
                "politics, general trivia, cryptocurrency), politely reply: "
                "'Please provide relevant information or questions regarding agriculture, crop care, farming practices, "
                "soil health, or your fields. How can I assist with your farm today?'\n\n"
                "2. TWO-WAY CONVERSATIONAL CONTINUITY: Always maintain conversation context across turns. When the user asks "
                "follow-ups (e.g. 'what dosage should I use?', 'how often to spray?', 'is it safe for wheat?'), "
                "refer back directly to the previously discussed diagnosis or fertilizer and provide specific answers.\n\n"
                "3. GENERAL AGRICULTURAL DOUBTS: Answer general farming doubts (yellow leaves, pest control, drip irrigation, "
                "frost protection, soil pH, crop calendars) comprehensively with clear, step-by-step actionable advice.\n\n"
                "4. SAR RADAR INTELLIGENCE INTEGRATION: When Sentinel-1 SAR telemetry is present in the context below: "
                "- Explain that SAR uses active microwave radar (C-band, 5.405 GHz) which penetrates clouds and night.\n"
                "- High VV backscatter (> -10 dB) indicates soil moisture saturation or waterlogging (recommend holding back irrigation).\n"
                "- Low VV backscatter (< -16 dB) indicates root-zone moisture deficit (recommend timely irrigation).\n"
                "- VH backscatter and RVI indicate vegetative canopy density; sudden VH drops indicate lodging or damage.\n\n"
                "5. PERSONALIZATION & MULTILINGUALISM: Address the farmer by name if available. Match the user's language "
                "(English, Hindi, or Romanized Hinglish like 'urea kab daalein').\n\n"
                "=== FARMER PROFILE & SATELLITE CONTEXT ===\n"
                f"{context_block}\n"
                f"{rag_injection}\n"
            )
            response = chat.send_message(system_instruction + "\n\nUser Message: " + user_message)
            return response.text
        except Exception as ex:
            logger.error(f"Gemini API inference failed: {ex}. Falling back to context-aware rule engine.")

    # 5. Context-Aware Fallback RAG Engine
    name_str = f" {profile_name}" if profile_name else ""
    state_str = f" in {profile_state}" if profile_state else ""

    # 5a. Greetings & pleasantries (only if purely conversational without an agricultural question)
    greetings_en = ["hi", "hello", "good morning", "hey", "good afternoon", "good evening"]
    greetings_hi = ["kaise ho", "kaisa hai", "namaste", "pranam", "ram ram"]
    thanks = ["thank you", "thanks", "dhanyawad", "shukriya"]

    is_pure_greeting = len(cleaned_msg.split()) <= 6 and not any(
        re.search(rf"\b{re.escape(k)}\b", cleaned_msg)
        for k in ["aphid", "pest", "drip", "yellow", "fertilizer", "soil", "crop", "wheat", "rice", "tomato", "cotton", "potato", "mustard", "sar", "radar", "blight", "rust"]
    )

    if is_pure_greeting:
        if any(re.search(rf"\b{re.escape(g)}\b", cleaned_msg) for g in greetings_en):
            return (
                f"Hello{name_str}! I hope you are having a great day on the farm{state_str}. "
                "How can I assist you with your crops, soil health, irrigation, or satellite radar monitoring today?"
            )
        elif any(re.search(rf"\b{re.escape(g)}\b", cleaned_msg) for g in greetings_hi):
            return (
                f"Namaste{name_str}! Main bilkul theek hoon. Aap batayein, khet par sab kaisa chal raha hai? "
                "Aaj kis crop, mitti, ya fertilizer me help chahiye?"
            )
        elif any(re.search(rf"\b{re.escape(t)}\b", cleaned_msg) for t in thanks):
            return (
                f"You're very welcome{name_str}! I am always here to assist you with "
                "crop health, disease treatments, SAR radar analysis, or fertilizers. Let me know whenever you need guidance!"
            )

    # 5b. Multi-turn conversational follow-ups (2-way continuity)
    if chat_history and len(chat_history) > 0:
        prior_msgs = [m for m in chat_history if m.get("content", "").strip().lower() != cleaned_msg]
        prior_text = " ".join([m.get("content", "").lower() for m in prior_msgs])

        if any(w in cleaned_msg for w in ["dosage", "how much", "kitna", "dose", "quantity", "spray", "apply"]):
            if "blight" in prior_text:
                return (
                    "### Recommended Dosage for Blight Control\n\n"
                    "* **Protective Spray:** Mancozeb 75 WP at **2.0 to 2.5 grams per liter** of water (approx. 500-600g per acre in 200L water).\n"
                    "* **Curative Action (Active Infestation):** Metalaxyl + Mancozeb (Ridomil Gold) at **2.0 grams per liter** or Azoxystrobin at **1.0 ml per liter**.\n"
                    "* **Application Tip:** Spray during calm morning or late afternoon hours ensuring uniform coverage of both upper and lower leaf surfaces."
                )
            elif "rust" in prior_text:
                return (
                    "### Recommended Dosage for Rust Treatment\n\n"
                    "* **Propiconazole (Tilt 25 EC):** Apply at **1.0 ml per liter** of water (200 ml in 200L water per acre).\n"
                    "* **Tebuconazole (Folicur 250 EC):** Apply at **1.0 ml per liter** of water.\n"
                    "* **Timing:** Initiate spray immediately at first detection of yellow or brown pustules; repeat after 12-15 days if conditions remain humid."
                )
            elif "urea" in prior_text or "nitrogen" in prior_text or "fertilizer" in prior_text:
                return (
                    "### Fertilizer Dosage Guidelines\n\n"
                    "* **Urea Top-Dressing:** Typically applied at **40-50 kg per acre** per split dose alongside irrigation.\n"
                    "* **Foliar Spray:** 1% to 2% solution (10-20g Urea per liter of water) for rapid nitrogen uptake during vegetative stages.\n"
                    "* **DAP Application:** 50 kg/acre basal application during sowing/planting."
                )
            elif any(c in prior_text for c in ["potato", "tomato", "wheat", "cotton", "rice", "mustard"]):
                matched_crop = next((c for c in ["potato", "tomato", "wheat", "cotton", "rice", "mustard"] if c in prior_text), "crop")
                crop_data = KNOWLEDGE_BASE.get(matched_crop, {})
                return (
                    f"### Precision Dosage & Application for {matched_crop.title()}\n\n"
                    f"* **Nutrient Requirement:** {crop_data.get('fertilizer_recommendation')}\n"
                    f"* **Irrigation Timing:** {crop_data.get('irrigation_habits')}\n"
                    f"* **Common Pathogen Controls:** {crop_data.get('diseases')}"
                )

    # 5c. SAR Radar Intelligence queries
    if any(k in cleaned_msg for k in ["sar", "radar", "satellite", "sentinel", "microwave", "backscatter", "rvi"]):
        sar_facts = KNOWLEDGE_BASE.get("sar_radar", {})
        radar_report = ""
        if farmer_context and "sar_intelligence" in farmer_context and farmer_context["sar_intelligence"]:
            latest_sar = farmer_context["sar_intelligence"][0]
            radar_report = (
                f"\n\n**🛰️ Latest Sentinel-1 Radar Scan for Your Farm:**\n"
                f"- **Observation Date:** {latest_sar.get('date', 'Recent')}\n"
                f"- **VV Backscatter:** {latest_sar.get('vv')} dB (Soil Dielectric / Moisture Status)\n"
                f"- **VH Backscatter:** {latest_sar.get('vh')} dB (Canopy Volume Scattering)\n"
                f"- **Radar Vegetation Index (RVI):** {latest_sar.get('rvi', '0.58')}\n"
                f"- **Current Evaluation:** {latest_sar.get('condition', 'Optimal Moisture')}"
            )

        return (
            "### 🛰️ How AgriNexus Utilizes Sentinel-1 SAR Earth Intelligence\n\n"
            f"**1. All-Weather Cloud Penetration:** {sar_facts.get('all_weather_capability', 'Active microwaves penetrate cloud cover day and night.')}\n\n"
            f"**2. Soil Moisture Proxy (VV Backscatter):** {sar_facts.get('soil_moisture_vv', 'Tracks surface dielectric changes to detect saturation or drought.')}\n\n"
            f"**3. Crop Canopy Structure (VH Backscatter):** {sar_facts.get('canopy_biomass_vh', 'Measures volume scattering to track biomass and detect lodging.')}\n\n"
            f"**4. Radar Vegetation Index (RVI):** {sar_facts.get('radar_vegetation_index', 'Ranges from 0.0 (bare soil) to 1.0 (dense mature canopy).')}\n\n"
            f"**5. Actionable Farm Usage:** {sar_facts.get('field_application', 'Automates cloud-proof irrigation schedules and flood detection.')}"
            f"{radar_report}"
        )

    # 5d. Yellow leaves / Chlorosis
    if any(w in cleaned_msg for w in ["yellow", "chlorosis", "peeli", "peela", "yellowing"]):
        yl = KNOWLEDGE_BASE.get("yellow_leaves", {})
        return (
            "### 🌿 Diagnostic Guide: Why Crop Leaves Turn Yellow\n\n"
            f"**1. Nitrogen Deficiency (Lower/Older Leaves First):**\n{yl.get('nitrogen_deficiency')}\n\n"
            f"**2. Iron Deficiency (Top/New Leaves First):**\n{yl.get('iron_deficiency')}\n\n"
            f"**3. Waterlogging / Root Suffocation:**\n{yl.get('overwatering_root_rot')}\n\n"
            "> **Diagnostic Tip:** If yellowing begins at the bottom tips in a 'V' shape, it is nitrogen deficiency. If veins stay green on top leaves, it is iron/zinc deficiency."
        )

    # 5e. Pest and Insect Control
    if any(w in cleaned_msg for w in ["pest", "aphid", "keeda", "insect", "borer", "whitefly", "caterpillar"]):
        pc = KNOWLEDGE_BASE.get("pest_control", {})
        return (
            "### 🐛 Integrated Pest Management (IPM) Advisory\n\n"
            f"* **Sucking Pests (Aphids, Whiteflies, Jassids):** {pc.get('sucking_pests')}\n"
            f"* **Chewing Insects & Borers:** {pc.get('chewing_borers')}\n"
            f"* **Preventive Cultural Practices:** {pc.get('ipm_practices')}\n\n"
            "> **Safety Note:** Always maintain the specified pre-harvest interval (PHI) after applying chemical insecticides."
        )

    # 5f. Drip Irrigation and Water Management
    if any(w in cleaned_msg for w in ["drip", "sprinkler", "sinchai", "water saving", "irrigation"]):
        di = KNOWLEDGE_BASE.get("drip_irrigation", {})
        return (
            "### 💧 Drip Irrigation & Precision Water Management\n\n"
            f"* **Water Savings & Yield:** {di.get('water_efficiency')}\n"
            f"* **Fertigation Advantage:** {di.get('fertigation_advantage')}\n"
            f"* **Disease Suppression:** {di.get('disease_reduction')}\n\n"
            "> **Recommendation:** Combine drip lines with organic crop residue mulching (paddy straw or sugarcane trash) to cut evaporation losses by another 20%."
        )

    # 5g. Frost Protection
    if any(w in cleaned_msg for w in ["frost", "pala", "cold wave", "sheet lehar"]):
        fp = KNOWLEDGE_BASE.get("frost_protection", {})
        return (
            "### ❄️ Critical Frost Protection Strategies\n\n"
            f"* **Evening Light Irrigation:** {fp.get('immediate_measures')}\n"
            f"* **Border Smudge Blanketing:** {fp.get('smudge_smoke')}\n"
            f"* **Foliar Osmotic Protection:** {fp.get('foliar_protection')}"
        )

    # 5h. Organic Farming
    if any(w in cleaned_msg for w in ["organic", "jaivik", "jeevamrit", "vermicompost", "gobar"]):
        org = KNOWLEDGE_BASE.get("organic_farming", {})
        return (
            "### 🌱 Organic Farming & Bio-Input Formulation\n\n"
            f"* **Jeevamrit Formulation:** {org.get('jeevamrit_formulation')}\n"
            f"* **Soil Organic Carbon Enrichment:** {org.get('soil_enrichment')}\n"
            f"* **Natural Pest Deterrents:** {org.get('pest_repellents')}"
        )

    # 5i. Soil Testing & Sampling
    if any(w in cleaned_msg for w in ["soil test", "soil testing", "soil sample", "mitti test"]):
        st = KNOWLEDGE_BASE.get("soil_testing", {})
        return (
            "### 🧪 Standard Soil Testing Protocol\n\n"
            f"* **Field Sampling Procedure:** {st.get('sampling_protocol')}\n"
            f"* **Critical Parameters Evaluated:** {st.get('key_parameters')}"
        )

    # 5j. Soil pH Buffering
    if "ph" in cleaned_msg:
        ph_data = KNOWLEDGE_BASE.get("soil_ph", {})
        return (
            "### ⚖️ Soil pH Buffering Guidelines\n\n"
            f"* **Acidic Soil Treatment:** {ph_data.get('acidic_fix')}\n"
            f"* **Alkaline Soil Treatment:** {ph_data.get('alkaline_fix')}\n"
            f"* **Nutrient Assimilation Window:** {ph_data.get('nutrient_availability')}"
        )

    # 5k. Fertilizer Application
    if any(w in cleaned_msg for w in ["fertilizer", "npk", "urea", "dap", "khad", "potash"]):
        fert_data = KNOWLEDGE_BASE.get("fertilizer", {})
        return (
            "### 🌾 Precision Fertilizer Application Guidelines\n\n"
            f"* **Urea (46% N):** {fert_data.get('urea')}\n"
            f"* **DAP (18-46-0):** {fert_data.get('dap')}\n"
            f"* **MOP Potash (60% K):** {fert_data.get('potash')}\n"
            f"* **Application Warning:** {fert_data.get('npk_general')}"
        )

    # 5l. Crop Specific Matches
    for crop in ["tomato", "cotton", "wheat", "rice", "potato", "mustard", "sugarcane"]:
        if crop in cleaned_msg:
            crop_data = KNOWLEDGE_BASE.get(crop, {})
            if crop_data:
                return (
                    f"### 🌾 Precision Agronomy Guide for {crop.title()}\n\n"
                    f"* **Sowing Period:** {crop_data.get('sowing_period')}\n"
                    f"* **Ideal Temperature:** {crop_data.get('ideal_temp_c', 'Seasonal range')}\n"
                    f"* **Soil Suitability:** {crop_data.get('soil_suitability')}\n"
                    f"* **Fertilizers:** {crop_data.get('fertilizer_recommendation')}\n"
                    f"* **Pathology Risks:** {crop_data.get('diseases')}\n"
                    f"* **Irrigation Schedule:** {crop_data.get('irrigation_habits')}\n\n"
                    f"> **Location Context:** Local climate factors are active{state_str}."
                )

    # 5m. Disease Symptom Intervention
    if "blight" in cleaned_msg or "daag" in cleaned_msg:
        blight_data = KNOWLEDGE_BASE.get("blight", {})
        return (
            "### 🍂 Blight Symptom Intervention\n\n"
            f"* **Pathogen Classification:** {blight_data.get('pathogen_type')}\n"
            f"* **Environmental Drivers:** {blight_data.get('environmental_triggers')}\n"
            f"* **Curative Chemical Controls:** {blight_data.get('chemical_control')}\n"
            f"* **Cultural & Organic Measures:** {blight_data.get('organic_control')}"
        )
    elif "rust" in cleaned_msg:
        rust_data = KNOWLEDGE_BASE.get("rust", {})
        return (
            "### 🌾 Rust Pathogen Intervention\n\n"
            f"* **Pathogen Classification:** {rust_data.get('pathogen_type')}\n"
            f"* **Triggers:** {rust_data.get('environmental_triggers')}\n"
            f"* **Chemical Controls:** {rust_data.get('chemical_control')}\n"
            f"* **Organic Measures:** {rust_data.get('organic_control')}"
        )

    # 5n. Intelligent Fallback asking for details
    return (
        f"I hear you, {profile_name or 'Farmer'}. To tailor the most effective agronomy advice, "
        "could you let me know:\n"
        "- Which crop you are currently growing or planning?\n"
        "- What symptoms, soil conditions, or irrigation patterns you are observing?\n"
        "Feel free to ask in English, Hindi, or Hinglish!"
    )
