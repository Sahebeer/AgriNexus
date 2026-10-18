from functools import lru_cache
from pathlib import Path
from typing import Any, Dict

import joblib
import numpy as np


FEATURE_NAMES = ("N", "P", "K", "temperature", "humidity", "ph", "rainfall")
GATE_FEATURE_NAMES = ("N", "P", "K", "ph", "humidity")
MODEL_VERSION = "soil-crop-rf-v1"
MAHALANOBIS_THRESHOLD = 15.0863  # chi-square(df=5, p=0.01)
MODEL_PATH = Path(__file__).resolve().parent / "artifacts" / "soil_crop_classifier.joblib"


class SoilModelUnavailable(RuntimeError):
    """Raised when the trusted, image-bundled soil model cannot be loaded."""


@lru_cache(maxsize=1)
def load_soil_model() -> Dict[str, Any]:
    """Load and validate the committed model artifact once per process."""
    if not MODEL_PATH.is_file():
        raise SoilModelUnavailable(f"Soil model artifact is missing: {MODEL_PATH}")
    try:
        # This path is fixed inside the application image; never accept a user path.
        artifact = joblib.load(MODEL_PATH)
    except Exception as exc:
        raise SoilModelUnavailable("Soil model artifact could not be loaded") from exc

    if not isinstance(artifact, dict) or artifact.get("artifact_type") != "soil_crop_classifier":
        raise SoilModelUnavailable("Soil model artifact has an invalid format")
    if tuple(artifact.get("feature_names", ())) != FEATURE_NAMES:
        raise SoilModelUnavailable("Soil model feature contract does not match the API")
    required = {"model", "classes", "mahalanobis_mean", "mahalanobis_precision"}
    if not required.issubset(artifact):
        raise SoilModelUnavailable("Soil model artifact is incomplete")
    return artifact


def mahalanobis_distance(values: Dict[str, float], artifact: Dict[str, Any]) -> float:
    vector = np.array([values[name] for name in GATE_FEATURE_NAMES], dtype=float)
    mean = np.asarray(artifact["mahalanobis_mean"], dtype=float)
    precision = np.asarray(artifact["mahalanobis_precision"], dtype=float)
    delta = vector - mean
    return float(delta @ precision @ delta.T)
