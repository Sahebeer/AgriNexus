import os
import logging

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

def generate_advisor_response(user_message: str, chat_history: list) -> str:
    """
    Generates agronomy recommendations based on user questions.
    If GEMINI_API_KEY is configured, queries Gemini. Otherwise, returns a detailed 
    contextual fallback using natural language keyword matching.
    """
    cleaned_msg = user_message.lower()

    # A. Execute real Gemini query if available
    if GENAI_AVAILABLE:
        try:
            # Build chat parameters matching Gemini SDK
            model = genai.GenerativeModel("gemini-1.5-flash")
            
            # Format history for Gemini chat structure
            # Roles: "user", "model" (Gemini expects 'model' instead of 'assistant')
            formatted_history = []
            for msg in chat_history[-6:]:  # Send last 6 messages as context
                role = "user" if msg["sender"] == "user" else "model"
                formatted_history.append({
                    "role": role,
                    "parts": [msg["content"]]
                })
            
            # Start conversational chat session
            chat = model.start_chat(history=formatted_history)
            
            # Inject agricultural system instruction context in the prompt
            system_instruction = (
                "You are AgriNexus AI, a professional agronomy advisor. "
                "Provide detailed, scientific, and actionable agricultural recommendations. "
                "If asked about disease, fertilizer, irrigation, soil pH, or crop cycles, "
                "respond with structured points. Keep replies concise and professional.\n\n"
            )
            response = chat.send_message(system_instruction + user_message)
            return response.text
        except Exception as ex:
            logger.error(f"Gemini API inference failed: {ex}. Using local expert rules.")

    # B. High-Fidelity Context-Aware Local Expert Rule Engine
    # 1. Soil pH / Soil Health
    if "ph" in cleaned_msg or "soil pH" in cleaned_msg:
        return (
            "### Soil pH Management & Correction Guidelines\n\n"
            "Soil pH significantly influences nutrient availability. Based on standard agronomic parameters:\n\n"
            "* **To Raise pH (Neutralize Acidic Soil):** Apply agricultural lime (calcium carbonate) or dolomite lime. "
            "Dolomite is preferred if the soil has magnesium deficiencies. Apply 3-6 months before planting to allow reaction time.\n"
            "* **To Lower pH (Neutralize Alkaline Soil):** Incorporate elemental sulfur or aluminum sulfate. "
            "Applying organic matter (compost, peat moss) will also naturally buffer alkaline levels over time.\n"
            "* **Optimal Range:** Most field crops (tomatoes, wheat, potatoes) thrive in a slightly acidic to neutral range (**6.0 to 6.8**)."
        )

    # 2. Fertilizers / Nitrogen / Phosphorus / Potassium
    elif "fertilizer" in cleaned_msg or "npk" in cleaned_msg or "nitrogen" in cleaned_msg or "phosphorus" in cleaned_msg or "potassium" in cleaned_msg:
        return (
            "### Fertilizer Optimization Protocol (NPK)\n\n"
            "For optimal crop growth, apply NPK based on the vegetative and flowering stages:\n\n"
            "1. **Vegetative Stage (High Nitrogen - N):** Promotes leaf and stem development. Use urea or ammonium nitrate. "
            "Deficiency symptoms include yellowing of lower leaves (chlorosis).\n"
            "2. **Root/Flowering Stage (High Phosphorus - P):** Enhances root establishment and flower sets. Apply DAP (Diammonium Phosphate) or Single Superphosphate.\n"
            "3. **Fruiting/Hardiness Stage (High Potassium - K):** Improves disease resistance and fruit quality. Apply MOP (Muriate of Potash).\n\n"
            "> **Tip:** Always perform a Soil Health Card test before applying bulk chemical fertilizers to avoid salt build-up."
        )

    # 3. Late Blight / Early Blight / Crop Diseases
    elif "blight" in cleaned_msg or "disease" in cleaned_msg or "fungus" in cleaned_msg:
        return (
            "### Crop Disease Intervention Strategy\n\n"
            "Fungal diseases like Blight (Early and Late) spread rapidly in damp, warm microclimates. Follow this emergency response protocol:\n\n"
            "* **Chemical Controls:** Apply copper hydroxide or Mancozeb-based fungicides. Spray early in the morning when wind is low.\n"
            "* **Cultural Interventions:** Prune bottom leaves up to 18 inches from the soil to avoid splash-back spores. Disinfect shears after every crop line.\n"
            "* **Sanitation:** Immediately bag and burn infected crops. Never compost diseased foliage as spores can survive in compost heat."
        )

    # 4. Irrigation / Watering
    elif "water" in cleaned_msg or "irrigation" in cleaned_msg or "moisture" in cleaned_msg:
        return (
            "### Irrigation Scheduling & Water Management\n\n"
            "Efficient water usage improves turgidity and prevents fungal pathogens. We recommend the following methods:\n\n"
            "* **Drip Irrigation:** Highly efficient; delivers water directly to the root zone, reducing leaf wetness and fungal hazards.\n"
            "* **Timing:** Irrigate during early morning hours (4:00 AM to 8:00 AM). This allows leaf surfaces to dry quickly under the sun.\n"
            "* **Soil Indicators:** Sandy soils require frequent, shallow watering. Clay soils require deep, infrequent watering cycles to avoid root rot."
        )

    # 5. Crop Recommendation / Soil Types
    elif "crop" in cleaned_msg or "soil" in cleaned_msg or "clay" in cleaned_msg or "loam" in cleaned_msg or "sandy" in cleaned_msg:
        return (
            "### Crop Suitability by Soil Structure\n\n"
            "Soil type dictates root drainage and stability. Here are standard crop recommendations:\n\n"
            "* **Loam Soil (Perfect balance):** Highly versatile. Recommended for Tomatoes, Wheat, Sugarcane, and Cotton.\n"
            "* **Clay Soil (High moisture retention):** Recommended for Paddy (Rice), Wheat, and Brassicas. Requires drainage lines.\n"
            "* **Sandy Soil (Fast draining):** Recommended for Root vegetables (Carrots, Potatoes), Groundnuts, and Watermelons."
        )

    # 6. Default assistant response
    else:
        return (
            "Hello! I am your **AgriNexus AI Advisor**. I can assist you with precision farming inputs.\n\n"
            "Try asking me about:\n"
            "* *'How do I correct acid soil pH?'*\n"
            "* *'What fertilizer is best for tomatoes?'*\n"
            "* *'How can I control late blight?'*\n"
            "* *'Suggest crops suitable for heavy clay soil.'*\n\n"
            "Let me know your soil parameters (pH, moisture, structure) for more customized recommendations!"
        )
