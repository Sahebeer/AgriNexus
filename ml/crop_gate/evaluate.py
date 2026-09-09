"""
AgriNexus AI - Crop / Plant Relevance Gate Evaluation CLI
Measures binary classification accuracy, precision, recall, F1, confusion matrix,
and Out-of-Distribution (OOD) random image rejection rate.
"""

import os
import sys
from pathlib import Path

# Ensure project root is in sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

import glob
import argparse
import logging
from PIL import Image
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("CropGateEvaluator")

from ml.crop_gate.model import CropGateModel


def parse_args():
    parser = argparse.ArgumentParser(description="Evaluate AgriNexus Crop Gate Model")
    parser.add_argument("--checkpoint", type=str, default=None, help="Path to model checkpoint")
    parser.add_argument("--ood-dir", type=str, default="ml/datasets/test/ood", help="Directory containing OOD images")
    parser.add_argument("--pos-dir", type=str, default="ml/datasets/test/positive", help="Directory containing positive crop images")
    parser.add_argument("--threshold", type=float, default=0.85, help="Crop gate confidence threshold")
    return parser.parse_args()


def main():
    args = parse_args()
    gate = CropGateModel(checkpoint_path=args.checkpoint, threshold=args.threshold)

    exts = ("*.jpg", "*.jpeg", "*.png", "*.JPG", "*.JPEG", "*.PNG")

    # 1. Evaluate OOD Rejection
    ood_files = []
    if os.path.isdir(args.ood_dir):
        for ext in exts:
            ood_files.extend(glob.glob(os.path.join(args.ood_dir, "**", ext), recursive=True))

    total_ood = len(ood_files)
    correctly_rejected = 0
    incorrectly_accepted = 0

    if total_ood > 0:
        for fpath in ood_files:
            try:
                img = Image.open(fpath)
                is_crop, conf = gate.predict_image(img)
                if not is_crop:
                    correctly_rejected += 1
                else:
                    incorrectly_accepted += 1
            except Exception as e:
                logger.warning(f"Error reading {fpath}: {e}")

        ood_rejection_rate = (correctly_rejected / total_ood) * 100.0
        print("\n" + "=" * 40)
        print("OOD Random / Negative Image Evaluation")
        print("=" * 40)
        print(f"Total OOD Images:        {total_ood}")
        print(f"Correctly Rejected:      {correctly_rejected}")
        print(f"Incorrectly Accepted:    {incorrectly_accepted}")
        print(f"OOD Rejection Rate:      {ood_rejection_rate:.2f}%")
        print("=" * 40)
    else:
        print(f"\n[INFO] No OOD test images found at '{args.ood_dir}'.")

    # 2. Evaluate Positives if present
    pos_files = []
    if os.path.isdir(args.pos_dir):
        for ext in exts:
            pos_files.extend(glob.glob(os.path.join(args.pos_dir, "**", ext), recursive=True))

    total_pos = len(pos_files)
    correctly_accepted = 0
    incorrectly_rejected = 0

    if total_pos > 0:
        for fpath in pos_files:
            try:
                img = Image.open(fpath)
                is_crop, conf = gate.predict_image(img)
                if is_crop:
                    correctly_accepted += 1
                else:
                    incorrectly_rejected += 1
            except Exception as e:
                logger.warning(f"Error reading {fpath}: {e}")

        pos_acc = (correctly_accepted / total_pos) * 100.0
        print("\n" + "=" * 40)
        print("Positive Agricultural Crop Evaluation")
        print("=" * 40)
        print(f"Total Positive Images:   {total_pos}")
        print(f"Correctly Accepted:      {correctly_accepted}")
        print(f"Incorrectly Rejected:    {incorrectly_rejected}")
        print(f"Positive Pass Rate:      {pos_acc:.2f}%")
        print("=" * 40)


if __name__ == "__main__":
    main()
