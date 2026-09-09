"""
AgriNexus AI - Baseline Agricultural SAR Model Evaluation CLI
"""

import os
import sys
from pathlib import Path

# Ensure project root is in sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

import argparse
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("SAREvaluator")


def parse_args():
    parser = argparse.ArgumentParser(description="Evaluate Agricultural SAR Model")
    parser.add_argument("--test-file", type=str, default="ml/datasets/test/sar_test.csv")
    return parser.parse_args()


def main():
    args = parse_args()
    if not os.path.exists(args.test_file):
        print("\n" + "=" * 50)
        print("SAR EVALUATION BLOCKED")
        print(f"Test SAR dataset '{args.test_file}' not found.")
        print("TARGET NOT ACHIEVED")
        print("=" * 50)
        return

    print("Evaluating SAR Model...")


if __name__ == "__main__":
    main()
