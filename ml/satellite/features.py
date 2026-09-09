"""
AgriNexus AI - Sentinel-1 Temporal Feature Engineering
Extracts multi-pass temporal dynamics from sequential SAR observations:
- Backscatter deltas (ΔVV, ΔVH, ΔRatio)
- Rolling temporal statistics (mean, variance)
- Anomaly z-scores to detect sudden structural or moisture deviations.
"""

from typing import List, Dict, Any, Optional
import numpy as np


def extract_temporal_features(historical_observations: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes temporal changes across sequential SAR observations.
    Each item must contain: acquisition_date, vv, vh, vv_vh_ratio.
    Sorted in chronological order.
    """
    if not historical_observations:
        return {
            "has_temporal_history": False,
            "observations_count": 0,
            "delta_vv": 0.0,
            "delta_vh": 0.0,
            "delta_ratio": 0.0,
            "trend": "insufficient_data",
            "anomaly_detected": False
        }

    count = len(historical_observations)
    latest = historical_observations[-1]
    latest_vv = float(latest.get("vv", -12.0))
    latest_vh = float(latest.get("vh", -18.0))
    latest_ratio = float(latest.get("vv_vh_ratio", 6.0))

    if count == 1:
        return {
            "has_temporal_history": True,
            "observations_count": 1,
            "delta_vv": 0.0,
            "delta_vh": 0.0,
            "delta_ratio": 0.0,
            "rolling_mean_vv": latest_vv,
            "rolling_mean_vh": latest_vh,
            "trend": "baseline_established",
            "anomaly_detected": False
        }

    previous = historical_observations[-2]
    prev_vv = float(previous.get("vv", latest_vv))
    prev_vh = float(previous.get("vh", latest_vh))
    prev_ratio = float(previous.get("vv_vh_ratio", latest_ratio))

    delta_vv = float(round(latest_vv - prev_vv, 2))
    delta_vh = float(round(latest_vh - prev_vh, 2))
    delta_ratio = float(round(latest_ratio - prev_ratio, 2))

    # Compute rolling statistics
    all_vv = [float(o.get("vv", -12.0)) for o in historical_observations]
    all_vh = [float(o.get("vh", -18.0)) for o in historical_observations]

    mean_vv = float(np.mean(all_vv))
    std_vv = float(np.std(all_vv)) if len(all_vv) > 2 else 1.0
    if std_vv < 1e-4:
        std_vv = 1.0

    z_score_vv = (latest_vv - mean_vv) / std_vv

    # Agricultural SAR Interpretation:
    # 1. Significant VV surge (+2.5 dB) often indicates sudden wet soil / rainfall event.
    # 2. Significant VH surge (+2.0 dB) indicates rapid crop biomass/canopy growth.
    # 3. Sudden drop in both VV and VH (> -3.0 dB) indicates potential harvesting or lodging damage.
    trend = "stable"
    anomaly_detected = False
    anomaly_reason = None

    if delta_vv > 2.5 and delta_vh < 1.0:
        trend = "moisture_increase"
        if delta_vv > 4.0:
            anomaly_detected = True
            anomaly_reason = "Sudden soil saturation or surface flooding"
    elif delta_vh > 1.8:
        trend = "vegetation_expansion"
    elif delta_vh < -2.5 and delta_vv < -2.0:
        trend = "biomass_reduction"
        anomaly_detected = True
        anomaly_reason = "Sharp biomass decline (harvesting or crop damage)"
    elif delta_vv < -3.0:
        trend = "soil_drying"

    return {
        "has_temporal_history": True,
        "observations_count": count,
        "delta_vv": delta_vv,
        "delta_vh": delta_vh,
        "delta_ratio": delta_ratio,
        "rolling_mean_vv": float(round(mean_vv, 2)),
        "rolling_mean_vh": float(round(float(np.mean(all_vh)), 2)),
        "z_score_vv": float(round(z_score_vv, 2)),
        "trend": trend,
        "anomaly_detected": anomaly_detected,
        "anomaly_reason": anomaly_reason
    }
