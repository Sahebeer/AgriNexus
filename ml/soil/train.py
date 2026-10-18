"""Train and validate the soil crop recommendation classifier.

The resulting joblib artifact is copied into the backend image boundary and
contains the fitted model, feature contract, validation metrics, and the
training-distribution statistics used by the inference OOD gate.
"""

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, top_k_accuracy_score
from sklearn.model_selection import train_test_split


ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "apps" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.soil_model import (  # noqa: E402
    FEATURE_NAMES,
    GATE_FEATURE_NAMES,
    MAHALANOBIS_THRESHOLD,
    MODEL_VERSION,
)


DEFAULT_DATASET = ROOT_DIR / "datasets" / "soil recommendation" / "Crop_recommendation.csv"
DEFAULT_OUTPUT = BACKEND_DIR / "app" / "services" / "artifacts" / "soil_crop_classifier.joblib"
DEFAULT_REPORT = BACKEND_DIR / "app" / "services" / "artifacts" / "soil_crop_classifier.report.json"


def _load_dataset(path: Path) -> Tuple[np.ndarray, np.ndarray]:
    rows: List[List[float]] = []
    labels: List[str] = []
    with path.open(newline="", encoding="utf-8") as source:
        for row in csv.DictReader(source):
            rows.append([float(row[name]) for name in FEATURE_NAMES])
            labels.append(row["label"].strip().lower())
    if not rows or len(set(labels)) != 22:
        raise ValueError("Expected the balanced 22-class Crop_recommendation.csv dataset")
    return np.asarray(rows, dtype=float), np.asarray(labels)


def _ece(probabilities: np.ndarray, labels: np.ndarray, classes: np.ndarray, bins: int = 10) -> float:
    predictions = classes[np.argmax(probabilities, axis=1)]
    confidence = np.max(probabilities, axis=1)
    correct = (predictions == labels).astype(float)
    total = 0.0
    for lower in np.linspace(0.0, 1.0, bins + 1)[:-1]:
        upper = lower + 1.0 / bins
        mask = (confidence >= lower) & ((confidence < upper) if upper < 1 else (confidence <= upper))
        if np.any(mask):
            total += float(np.mean(mask)) * abs(float(np.mean(correct[mask])) - float(np.mean(confidence[mask])))
    return total


def _metrics(model: RandomForestClassifier, x: np.ndarray, y: np.ndarray) -> Dict[str, object]:
    probabilities = model.predict_proba(x)
    predictions = model.classes_[np.argmax(probabilities, axis=1)]
    return {
        "accuracy": float(accuracy_score(y, predictions)),
        "macro_f1": float(f1_score(y, predictions, average="macro")),
        "top_3_accuracy": float(top_k_accuracy_score(y, probabilities, k=3, labels=model.classes_)),
        "ece": float(_ece(probabilities, y, model.classes_)),
        "confusion_matrix": confusion_matrix(y, predictions, labels=model.classes_).tolist(),
    }


def train(
    dataset_path: Path = DEFAULT_DATASET,
    output_path: Path = DEFAULT_OUTPUT,
    report_path: Path = DEFAULT_REPORT,
    trees: int = 300,
) -> Dict[str, object]:
    x, y = _load_dataset(dataset_path)
    x_train, x_remaining, y_train, y_remaining = train_test_split(
        x, y, test_size=0.30, random_state=42, stratify=y
    )
    x_val, x_test, y_val, y_test = train_test_split(
        x_remaining, y_remaining, test_size=0.50, random_state=42, stratify=y_remaining
    )

    model = RandomForestClassifier(
        n_estimators=trees,
        random_state=42,
        n_jobs=-1,
        class_weight="balanced",
    )
    model.fit(x_train, y_train)

    gate_indices = [FEATURE_NAMES.index(name) for name in GATE_FEATURE_NAMES]
    gate_train = x_train[:, gate_indices]
    covariance = np.cov(gate_train, rowvar=False) + np.eye(len(GATE_FEATURE_NAMES)) * 1e-6
    crop_requirements = {}
    for label in sorted(set(y.tolist())):
        crop_rows = x[y == label]
        crop_requirements[label] = {
            "nitrogen": float(np.mean(crop_rows[:, FEATURE_NAMES.index("N")])),
            "phosphorus": float(np.mean(crop_rows[:, FEATURE_NAMES.index("P")])),
            "potassium": float(np.mean(crop_rows[:, FEATURE_NAMES.index("K")])),
            "ph": float(np.mean(crop_rows[:, FEATURE_NAMES.index("ph")])),
            "moisture": max(18.0, min(55.0, float(np.mean(crop_rows[:, FEATURE_NAMES.index("humidity")])) * 0.45)),
        }
    artifact: Dict[str, object] = {
        "artifact_type": "soil_crop_classifier",
        "model_version": MODEL_VERSION,
        "feature_names": list(FEATURE_NAMES),
        "gate_feature_names": list(GATE_FEATURE_NAMES),
        "classes": model.classes_.tolist(),
        "model": model,
        "mahalanobis_mean": np.mean(gate_train, axis=0).tolist(),
        "mahalanobis_precision": np.linalg.pinv(covariance).tolist(),
        "mahalanobis_threshold": MAHALANOBIS_THRESHOLD,
        "crop_requirements": crop_requirements,
        "metrics": {
            "train_rows": len(x_train),
            "validation_rows": len(x_val),
            "test_rows": len(x_test),
            "validation": _metrics(model, x_val, y_val),
            "test": _metrics(model, x_test, y_test),
        },
    }
    test_metrics = artifact["metrics"]["test"]  # type: ignore[index]
    if (
        test_metrics["macro_f1"] < 0.95
        or test_metrics["top_3_accuracy"] < 0.98
        or test_metrics["ece"] >= 0.05
    ):
        raise RuntimeError(f"Model failed acceptance metrics: {json.dumps(artifact['metrics'])}")

    report = {
        "artifact_type": "soil_crop_classifier",
        "model_version": MODEL_VERSION,
        "dataset": str(dataset_path),
        "feature_names": list(FEATURE_NAMES),
        "classes": model.classes_.tolist(),
        "split": {"train": len(x_train), "validation": len(x_val), "test": len(x_test), "random_state": 42},
        "metrics": artifact["metrics"],
        "acceptance": {"macro_f1_min": 0.95, "top_3_accuracy_min": 0.98, "ece_max_exclusive": 0.05},
        "ood_policy": {
            "hard_ranges": {"ph": [3.5, 9.5], "nitrogen_max": 300, "phosphorus_max": 200, "potassium_max": 300, "moisture": [5, 90]},
            "soft_confidence_min": 0.40,
            "mahalanobis_threshold": MAHALANOBIS_THRESHOLD,
        },
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, output_path, compress=3)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"Saved artifact to {output_path}")
    print(f"Saved report to {report_path}")
    return artifact


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the AgriNexus soil crop classifier")
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--trees", type=int, default=300)
    args = parser.parse_args()
    train(args.dataset, args.output, args.report, args.trees)


if __name__ == "__main__":
    main()
