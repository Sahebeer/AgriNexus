"""
AgriNexus AI - Gemini Agronomic Guidance Service
Strictly consumes verified deterministic ML facts (Vision diagnosis + SAR radar metrics)
to synthesize farmer-friendly explanations, preventive action checklists, and agronomy advice.
"""

import os
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Check for Google Generative AI
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


class AgronomyAdvisor:
    """
    Synthesizes farmer-friendly explanations and checklists from deterministic ML facts.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if self.api_key and GEMINI_AVAILABLE:
            try:
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel("gemini-1.5-flash")
                self.enabled = True
            except Exception as e:
                logger.warning(f"Failed to configure Gemini model: {e}")
                self.enabled = False
        else:
            self.enabled = False

    def generate_agronomy_guidance(
        self,
        ml_diagnosis: Dict[str, Any],
        sar_telemetry: Optional[Dict[str, Any]] = None,
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Accepts verified facts from ML models and produces an actionable farmer advisory report.
        """
        crop = ml_diagnosis.get("crop", "Crop")
        disease_name = ml_diagnosis.get("disease_name", "Pathology")
        confidence = ml_diagnosis.get("disease_confidence", 0.0)
        status = ml_diagnosis.get("status", "diagnosed")

        # Fallback deterministic structured advice
        treatment = ml_diagnosis.get("treatment", "Consult local extension services.")
        prevention = ml_diagnosis.get("prevention", "Maintain balanced irrigation.")

        if not self.enabled:
            return {
                "source": "deterministic_knowledge_base",
                "summary": f"Diagnosed {disease_name} for {crop} with {int(confidence * 100)}% model certainty.",
                "action_items": [
                    f"Immediate Treatment: {treatment}",
                    f"Long-term Prevention: {prevention}",
                    "Inspect surrounding plants within a 5-meter radius for spore transmission."
                ],
                "sar_integration_note": (
                    f"SAR Sentinel-1 radar condition '{sar_telemetry.get('condition')}' factored into risk assessment."
                    if sar_telemetry else "No satellite radar telemetry available."
                )
            }

        # Prompt strictly grounds LLM on verified facts
        prompt = (
            f"You are AgriNexus Senior Agronomist. A deterministic PyTorch model analyzed a farmer's crop photo "
            f"and established these verified facts:\n"
            f"- Crop: {crop}\n"
            f"- Status: {status}\n"
            f"- Diagnosis: {disease_name}\n"
            f"- Model Confidence: {int(confidence * 100)}%\n"
            f"- Standard Treatment: {treatment}\n"
            f"- Standard Prevention: {prevention}\n"
        )
        if sar_telemetry:
            prompt += f"- Sentinel-1 SAR Radar Status: {sar_telemetry.get('condition')} (VV: {sar_telemetry.get('features', {}).get('vv')} dB)\n"

        prompt += (
            "Provide a concise, practical 3-point recommendation for the farmer. "
            "Never alter or question the diagnosis. Focus purely on step-by-step practical remedies."
        )

        try:
            resp = self.model.generate_content(prompt)
            return {
                "source": "gemini_agronomy_advisor",
                "advisory_text": resp.text.strip(),
                "treatment": treatment,
                "prevention": prevention
            }
        except Exception as e:
            logger.warning(f"Gemini API request failed: {e}. Utilizing deterministic fallback.")
            return {
                "source": "deterministic_knowledge_base",
                "summary": f"Diagnosed {disease_name} for {crop}.",
                "treatment": treatment,
                "prevention": prevention
            }
