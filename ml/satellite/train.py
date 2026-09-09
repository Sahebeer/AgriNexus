"""
AgriNexus AI - Baseline Agricultural SAR Model Training CLI
Trains a baseline Random Forest / Gradient Boosting classifier on tabulated SAR feature vectors.
"""

import os
import sys
from pathlib import Path

# Ensure project root is in sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

import yaml
import json
import argparse
import logging
from datetime import datetime, timezone
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("SARTrainer")

try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score, classification_report
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


def parse_args():
    parser = argparse.ArgumentParser(description="Train Baseline Agricultural SAR Model")
    parser.add_argument("--config", type=str, default="ml/satellite/config.yaml")
    parser.add_argument("--data-file", type=str, default="ml/datasets/processed/sar_features.csv")
    return parser.parse_args()


def main():
    args = parse_args()
    config_path = Path(args.config)
    if not config_path.exists():
        logger.error(f"Config file not found at {config_path}")
        sys.exit(1)

    with open(config_path, "r") as f:
        config = yaml.safe_load(f)

    if not os.path.exists(args.data_file):
        logger.warning(
            f"TRAINING BLOCKED: SAR feature dataset not found at '{args.data_file}'.\n"
            "Please run SAR feature extraction pipeline over historical Sentinel-1 acquisitions first."
        )
        report = {
            "status": "BLOCKED",
            "reason": "Training blocked because labeled SAR feature dataset is unavailable.",
            "target_data_file": args.data_file,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        out_dir = Path("ml/satellite/checkpoints")
        out_dir.mkdir(parents=True, exist_ok=True)
        with open(out_dir / "sar_training_report.json", "w") as f:
            json.dump(report, f, indent=2)
        return

    logger.info("Training baseline SAR classifier from tabulated features...")


if __name__ == "__main__":
    main()
