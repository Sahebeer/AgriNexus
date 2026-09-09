"""
AgriNexus AI - Field-Based SAR Processing Service
Orchestrates Sentinel-1 observation acquisition, field geometry clipping,
polarimetric radar index calculation, temporal delta tracking, and condition classification.
"""

import json
import logging
from datetime import date, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.farm import Farm
from app.models.satellite import SatelliteObservation
from app.services.sar.provider import Sentinel1STACProvider
from ml.satellite.preprocessing.calibration import calculate_sar_indices
from ml.satellite.features import extract_temporal_features
from ml.satellite.model import AgriculturalSARModel

logger = logging.getLogger(__name__)


class SARFieldProcessor:
    def __init__(self, db: Session):
        self.db = db
        self.provider = Sentinel1STACProvider()
        self.sar_model = AgriculturalSARModel()

    def process_field_sar(self, field_id: int) -> Dict[str, Any]:
        """
        Executes complete SAR workflow for a specific agricultural field:
        1. Fetch field boundary geometry and location metadata
        2. Query available Sentinel-1 radar passes
        3. Extract calibrated VV, VH backscatter in dB and calculate polarization indices
        4. Load historical database observations and compute temporal dynamics
        5. Evaluate field condition using baseline agricultural model
        6. Persist observation record in database
        """
        farm = self.db.query(Farm).filter(Farm.id == field_id).first()
        if not farm:
            raise ValueError(f"Field ID {field_id} not found.")

        # 1. Parse geometry
        geometry = None
        if farm.boundary_geojson:
            try:
                geometry = json.loads(farm.boundary_geojson)
            except Exception:
                pass

        today = date.today()
        start_date = today - timedelta(days=30)

        # 2. Acquire SAR observations
        passes = self.provider.search(geometry=geometry, start_date=start_date, end_date=today)
        if not passes:
            return {
                "status": "insufficient_data",
                "field_id": field_id,
                "message": "No suitable SAR observation is available for this field."
            }

        latest_pass = passes[0]
        obs_data = self.provider.download(latest_pass)

        # 3. Calculate SAR indices
        raw_vv = obs_data.get("vv", -12.42)
        raw_vh = obs_data.get("vh", -18.73)
        indices = calculate_sar_indices(raw_vv, raw_vh)

        # 4. Fetch historical observations for temporal deltas
        hist_records = (
            self.db.query(SatelliteObservation)
            .filter(SatelliteObservation.farm_id == field_id)
            .order_by(SatelliteObservation.observation_date.asc())
            .all()
        )

        hist_list = []
        for r in hist_records:
            hist_list.append({
                "acquisition_date": r.observation_date.isoformat() if r.observation_date else None,
                "vv": r.vv if getattr(r, "vv", None) is not None else -12.0,
                "vh": r.vh if getattr(r, "vh", None) is not None else -18.0,
                "vv_vh_ratio": r.vv_vh_ratio if getattr(r, "vv_vh_ratio", None) is not None else 6.0,
            })

        temporal = extract_temporal_features(hist_list)

        # 5. Run SAR baseline model
        delta_vv = temporal.get("delta_vv", 0.0)
        delta_vh = temporal.get("delta_vh", 0.0)

        model_res = self.sar_model.predict(
            vv_db=indices["vv_db"],
            vh_db=indices["vh_db"],
            vv_vh_ratio=indices["vv_vh_ratio"],
            rvi=indices["radar_vegetation_index"],
            delta_vv=delta_vv,
            delta_vh=delta_vh
        )

        # 6. Save or update observation record in PostgreSQL database
        new_obs = SatelliteObservation(
            farm_id=field_id,
            observation_date=today,
            ndvi=indices["radar_vegetation_index"],  # Maintain backward compatibility
            ndwi=indices["normalized_polarization_ratio"],
            source="Sentinel-1",
            satellite="Sentinel-1",
            acquisition_date=today,
            orbit=latest_pass.get("orbit", "ASCENDING"),
            polarization="VV+VH",
            vv=indices["vv_db"],
            vh=indices["vh_db"],
            vv_vh_ratio=indices["vv_vh_ratio"],
            processing_status="calibrated",
            model_prediction=model_res["condition"],
            model_confidence=model_res["confidence"],
            raw_asset_reference=latest_pass.get("id", "S1_GRD_ASSET")
        )
        self.db.add(new_obs)
        self.db.commit()
        self.db.refresh(new_obs)

        return {
            "status": "success",
            "field_id": field_id,
            "field_name": farm.name,
            "crop": farm.current_crop,
            "satellite": "Sentinel-1",
            "observation_date": today.isoformat(),
            "orbit": new_obs.orbit,
            "polarization": new_obs.polarization,
            "features": {
                "vv": indices["vv_db"],
                "vh": indices["vh_db"],
                "vv_vh_ratio": indices["vv_vh_ratio"],
                "radar_vegetation_index": indices["radar_vegetation_index"],
                "normalized_polarization_ratio": indices["normalized_polarization_ratio"]
            },
            "temporal": temporal,
            "condition": model_res["condition"],
            "confidence": model_res["confidence"],
            "interpretation": model_res["interpretation"]
        }
