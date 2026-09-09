"""
AgriNexus AI - Production SAR Inference Runner
Runs feature transformation and calls AgriculturalSARModel to produce structured facts.
"""

from typing import Dict, Any, List, Optional
from ml.satellite.preprocessing.calibration import calculate_sar_indices
from ml.satellite.features import extract_temporal_features
from ml.satellite.model import AgriculturalSARModel


class SARInferenceService:
    def __init__(self, checkpoint_path: Optional[str] = None):
        self.model = AgriculturalSARModel(weights_path=checkpoint_path)

    def analyze_field_sar(
        self,
        latest_vv: float,
        latest_vh: float,
        historical_observations: Optional[List[Dict[str, Any]]] = None,
        soil_moisture: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Executes complete SAR inference pipeline:
        1. Radar index derivation (VV/VH ratio, RVI, NPR)
        2. Multi-pass temporal feature engineering (ΔVV, ΔVH, rolling stats)
        3. Condition prediction
        """
        indices = calculate_sar_indices(latest_vv, latest_vh)
        temporal = extract_temporal_features(historical_observations or [])

        delta_vv = temporal.get("delta_vv", 0.0)
        delta_vh = temporal.get("delta_vh", 0.0)

        model_res = self.model.predict(
            vv_db=indices["vv_db"],
            vh_db=indices["vh_db"],
            vv_vh_ratio=indices["vv_vh_ratio"],
            rvi=indices["radar_vegetation_index"],
            delta_vv=delta_vv,
            delta_vh=delta_vh,
            soil_moisture_pct=soil_moisture
        )

        return {
            "indices": indices,
            "temporal": temporal,
            "condition": model_res["condition"],
            "confidence": model_res["confidence"],
            "interpretation": model_res["interpretation"]
        }
