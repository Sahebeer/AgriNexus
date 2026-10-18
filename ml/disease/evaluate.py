"""
AgriNexus AI - Comprehensive Disease Classifier Evaluation Harness
Batch 4 Implementation according to plan.md (Section 5 Script 5, Section 7).

Metrics computed:
  In-Distribution (PlantDoc test set):
    - Top-1 Accuracy, Macro F1, Macro Precision, Macro Recall, Weighted F1
    - Per-class F1, Precision, Recall, Support
    - Confusion Matrix

  Calibration:
    - Expected Calibration Error (ECE) with 15 confidence bins
    - Maximum Calibration Error (MCE)

  OOD Detection:
    - Energy-score AUROC (in-distribution vs. sample images)
    - FPR@TPR95
    - Gate 1 accuracy on OOD set
    - Gate 2 energy AUROC, Gate 2 entropy AUROC

  Zero-False-Alarm Gate Test (Hard):
    - Every image in --ood-dir must be rejected by at least one gate.
    - Any slip-through is reported by filename.

CLI:
  python3 ml/disease/evaluate.py \
    --checkpoint ml/disease/checkpoints/best_model.pth \
    --config ml/disease/config.yaml \
    --test-dir leaf_dataset/PlantDoc-Dataset-master/test/ \
    --ood-dir "sample images/" \
    --output ml/disease/eval_report.json
"""

import os
import sys
import json
import csv
import logging
import argparse
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timezone

import numpy as np
from PIL import Image

# Ensure project root is in sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("DiseaseEvaluator")

try:
    import torch
    import torch.nn.functional as F
    from torch.utils.data import DataLoader, Dataset
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.error("PyTorch is not installed. Evaluation cannot run.")

try:
    from sklearn.metrics import roc_auc_score, roc_curve, classification_report
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    logger.error("scikit-learn is not installed. OOD AUROC cannot be computed.")

import yaml

from ml.disease.model import build_model, compute_energy_score, compute_shannon_entropy
from ml.disease.transforms import get_validation_transforms
from ml.disease.dataset import load_class_mapping, VALID_IMAGE_EXTENSIONS
from ml.disease.inference import DiseaseInferenceEngine


# ==============================================================================
# 1. CLI Argument Parsing
# ==============================================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="AgriNexus AI Disease Model Evaluation Harness")
    parser.add_argument(
        "--checkpoint",
        type=str,
        default="ml/disease/checkpoints/best_model.pth",
        help="Path to trained model checkpoint",
    )
    parser.add_argument(
        "--gate1-checkpoint",
        type=str,
        default="ml/disease/checkpoints/gate1_model.pth",
        help="Path to Gate 1 MobileNetV3 binary gate checkpoint",
    )
    parser.add_argument(
        "--config",
        type=str,
        default="ml/disease/config.yaml",
        help="Path to config.yaml",
    )
    parser.add_argument(
        "--test-dir",
        type=str,
        default="leaf_dataset/PlantDoc-Dataset-master/test/",
        help="Path to test directory (ImageFolder layout)",
    )
    parser.add_argument(
        "--ood-dir",
        type=str,
        default="sample images",
        help="Path to OOD distractor images directory",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="ml/disease/eval_report.json",
        help="Path to write evaluation report JSON",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=16,
        help="Batch size for evaluation inference",
    )
    parser.add_argument(
        "--device",
        type=str,
        default=None,
        help="Device override (cuda/cpu/mps)",
    )
    parser.add_argument(
        "--use-tta",
        action="store_true",
        help="Enable 10-view test-time augmentation",
    )
    return parser.parse_args()


# ==============================================================================
# 2. Dataset Utilities
# ==============================================================================

class TestImageDataset(Dataset):
    """
    Lightweight ImageFolder-style dataset for evaluation.
    Discovers class directories, maps to known class_to_idx from training.
    Returns (image_path, resolved_label_idx) tuples.
    """

    def __init__(
        self,
        test_dir: str,
        class_to_idx: Dict[str, int],
        transform=None,
    ):
        self.transform = transform
        self.class_to_idx = class_to_idx
        self.samples: List[Tuple[str, int]] = []
        self.unmapped_classes: List[str] = []

        test_path = Path(test_dir)
        for cls_dir in sorted(test_path.iterdir()):
            if not cls_dir.is_dir() or cls_dir.name.startswith("."):
                continue

            # Map PlantDoc class names to unified taxonomy using fuzzy prefix matching
            label_idx = self._resolve_class(cls_dir.name, class_to_idx)
            if label_idx is None:
                self.unmapped_classes.append(cls_dir.name)
                continue

            for img_file in sorted(cls_dir.iterdir()):
                if img_file.suffix.lower() in VALID_IMAGE_EXTENSIONS and not img_file.name.startswith("."):
                    resolved = os.path.realpath(str(img_file))
                    if os.path.exists(resolved):
                        self.samples.append((resolved, label_idx))

    @staticmethod
    def _resolve_class(class_dir_name: str, class_to_idx: Dict[str, int]) -> Optional[int]:
        """
        Maps PlantDoc folder names (e.g. "Apple Scab Leaf") to taxonomy class indices.
        Uses keyword overlap matching against known class names.
        """
        # Exact match first
        if class_dir_name in class_to_idx:
            return class_to_idx[class_dir_name]

        # Normalize and try token overlap
        query_tokens = set(class_dir_name.lower().replace("_", " ").replace("___", " ").split())
        best_idx, best_score = None, 0

        for cls_name, idx in class_to_idx.items():
            if cls_name == "background":
                continue
            cand_tokens = set(cls_name.lower().replace("_", " ").replace("___", " ").split())
            overlap = len(query_tokens & cand_tokens)
            # Require at least 2 matching tokens or full match on at least 60% of tokens
            score = overlap / max(len(query_tokens), len(cand_tokens))
            if overlap >= 2 and score > best_score:
                best_score = score
                best_idx = idx

        return best_idx

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        img_path, label = self.samples[idx]
        try:
            with Image.open(img_path) as img:
                np_img = np.array(img.convert("RGB"), dtype=np.uint8)
        except Exception as exc:
            logger.warning("Failed to load image '%s': %s. Using blank fallback.", img_path, exc)
            np_img = np.zeros((384, 384, 3), dtype=np.uint8)

        if self.transform is not None:
            out = self.transform(image=np_img)
            return out["image"], label
        return torch.from_numpy(np_img.transpose(2, 0, 1)).float() / 255.0, label


class OODEvalDataset(Dataset):
    """Loads all images from a flat directory for OOD scoring."""

    def __init__(self, ood_dir: str, transform=None):
        self.transform = transform
        self.image_paths: List[Path] = []

        ood_path = Path(ood_dir)
        if ood_path.is_dir():
            for root, _, files in os.walk(ood_path):
                for f in sorted(files):
                    if os.path.splitext(f)[1].lower() in VALID_IMAGE_EXTENSIONS and not f.startswith("."):
                        self.image_paths.append(Path(root) / f)

        self.image_paths = sorted(self.image_paths)

    def __len__(self) -> int:
        return len(self.image_paths)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, str]:
        path = self.image_paths[idx]
        try:
            with Image.open(path) as img:
                np_img = np.array(img.convert("RGB"), dtype=np.uint8)
        except Exception:
            np_img = np.zeros((384, 384, 3), dtype=np.uint8)

        if self.transform is not None:
            out = self.transform(image=np_img)
            return out["image"], str(path)
        return torch.from_numpy(np_img.transpose(2, 0, 1)).float() / 255.0, str(path)


# ==============================================================================
# 3. Calibration Metrics
# ==============================================================================

def compute_ece(confidences: np.ndarray, corrects: np.ndarray, n_bins: int = 15) -> float:
    """
    Expected Calibration Error (ECE) with n_bins equal-width bins.
    ECE = Σ_b |B_b|/n * |acc(b) - conf(b)|
    """
    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    n = len(confidences)
    ece = 0.0

    for i in range(n_bins):
        lo, hi = bin_edges[i], bin_edges[i + 1]
        # Last bin is inclusive on right
        if i < n_bins - 1:
            mask = (confidences >= lo) & (confidences < hi)
        else:
            mask = (confidences >= lo) & (confidences <= hi)

        bin_n = mask.sum()
        if bin_n == 0:
            continue
        bin_acc = float(corrects[mask].mean())
        bin_conf = float(confidences[mask].mean())
        ece += (bin_n / n) * abs(bin_acc - bin_conf)

    return float(ece)


def compute_mce(confidences: np.ndarray, corrects: np.ndarray, n_bins: int = 15) -> float:
    """
    Maximum Calibration Error (MCE): max over bins of |acc(b) - conf(b)|.
    """
    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    mce = 0.0

    for i in range(n_bins):
        lo, hi = bin_edges[i], bin_edges[i + 1]
        if i < n_bins - 1:
            mask = (confidences >= lo) & (confidences < hi)
        else:
            mask = (confidences >= lo) & (confidences <= hi)

        if mask.sum() == 0:
            continue
        bin_acc = float(corrects[mask].mean())
        bin_conf = float(confidences[mask].mean())
        mce = max(mce, abs(bin_acc - bin_conf))

    return float(mce)


def compute_fpr_at_tpr95(y_true: List[int], y_scores: List[float]) -> float:
    """Returns FPR at the threshold achieving TPR ≥ 95%."""
    if not SKLEARN_AVAILABLE or len(np.unique(y_true)) < 2:
        return float("nan")
    fpr_arr, tpr_arr, _ = roc_curve(y_true, y_scores)
    idx = np.searchsorted(tpr_arr, 0.95)
    idx = int(np.clip(idx, 0, len(fpr_arr) - 1))
    return float(fpr_arr[idx])


# ==============================================================================
# 4. In-Distribution Metrics
# ==============================================================================

def compute_per_class_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    class_names: List[str],
) -> Tuple[Dict[str, Any], np.ndarray]:
    """Computes per-class precision, recall, F1, support and confusion matrix."""
    n_classes = len(class_names)
    matrix = np.zeros((n_classes, n_classes), dtype=int)
    for t, p in zip(y_true, y_pred):
        if 0 <= t < n_classes and 0 <= p < n_classes:
            matrix[t, p] += 1

    per_class: Dict[str, Any] = {}
    precisions, recalls, f1s, weights = [], [], [], []

    for idx, name in enumerate(class_names):
        tp = int(matrix[idx, idx])
        fp = int(np.sum(matrix[:, idx]) - tp)
        fn = int(np.sum(matrix[idx, :]) - tp)
        support = int(np.sum(matrix[idx, :]))

        p = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        r = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * p * r / (p + r)) if (p + r) > 0 else 0.0

        precisions.append(p)
        recalls.append(r)
        f1s.append(f1)
        weights.append(support)

        per_class[name] = {
            "f1": round(f1, 4),
            "precision": round(p, 4),
            "recall": round(r, 4),
            "support": support,
        }

    total_support = sum(weights)
    weighted_f1 = float(np.average(f1s, weights=[w if w > 0 else 1 for w in weights])) if total_support > 0 else 0.0
    accuracy = float(np.sum(y_true == y_pred) / max(1, len(y_true)))

    summary = {
        "accuracy": round(accuracy, 4),
        "macro_f1": round(float(np.mean(f1s)), 4),
        "macro_precision": round(float(np.mean(precisions)), 4),
        "macro_recall": round(float(np.mean(recalls)), 4),
        "weighted_f1": round(weighted_f1, 4),
        "confusion_matrix": matrix.tolist(),
        "per_class": per_class,
    }
    return summary, matrix


# ==============================================================================
# 5. Main Evaluation Orchestration
# ==============================================================================

def main():
    args = parse_args()

    # ── Config Loading ───────────────────────────────────────────────────────
    config: Dict[str, Any] = {}
    if os.path.isfile(args.config):
        with open(args.config, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f) or {}
    else:
        logger.warning("Config not found at '%s'. Using defaults.", args.config)

    model_cfg = config.get("model", {})
    ood_cfg = config.get("ood", {})
    num_classes = int(model_cfg.get("num_classes", 61))
    image_size = int(model_cfg.get("image_size", 384))
    energy_threshold = float(ood_cfg.get("energy_threshold", -6.0))
    entropy_threshold = float(ood_cfg.get("entropy_threshold_bits", 2.0))
    confidence_threshold = float(ood_cfg.get("confidence_threshold", 0.60))
    gate1_threshold = float(ood_cfg.get("gate1_leaf_threshold", 0.80))

    # ── Test Directory Validation ────────────────────────────────────────────
    if not os.path.isdir(args.test_dir):
        print("\n" + "=" * 70)
        print("EVALUATION BLOCKED: test directory not found")
        print("=" * 70)
        print(f"Test directory '{args.test_dir}' does not exist or is empty.")
        print("Please ensure PlantDoc test images are present at the configured path.")
        print("=" * 70)
        sys.exit(0)

    # ── Class Mapping ────────────────────────────────────────────────────────
    mapping_candidates = [
        model_cfg.get("class_mapping"),
        config.get("paths", {}).get("class_mapping"),
        "ml/disease/class_mapping.json",
        os.path.join(os.path.dirname(__file__), "class_mapping.json"),
    ]
    classes, class_to_idx = [], {}
    class_meta = []
    for cpath in mapping_candidates:
        if cpath and os.path.isfile(cpath):
            try:
                classes, class_to_idx = load_class_mapping(cpath)
                with open(cpath, "r", encoding="utf-8") as f:
                    raw_mapping = json.load(f)
                class_meta = sorted(raw_mapping.get("classes", []), key=lambda x: x["idx"])
                logger.info("Loaded class mapping: %d classes from '%s'.", len(classes), cpath)
                break
            except Exception as exc:
                logger.warning("Could not load class mapping from '%s': %s", cpath, exc)

    if not classes:
        logger.error("No class_mapping.json found. Cannot evaluate per-class metrics.")
        sys.exit(1)

    background_idx = class_to_idx.get("background", num_classes - 1)
    disease_classes = [c for c in classes if c != "background"]

    # ── Device Selection ─────────────────────────────────────────────────────
    if args.device:
        device = torch.device(args.device)
    elif torch.cuda.is_available():
        device = torch.device("cuda")
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = torch.device("mps")
    else:
        device = torch.device("cpu")

    logger.info("Evaluation device: %s", device)

    # ── Model Loading ────────────────────────────────────────────────────────
    if not os.path.isfile(args.checkpoint):
        logger.error("Checkpoint not found at '%s'. Aborting.", args.checkpoint)
        output_report = {
            "status": "BLOCKED",
            "reason": f"Checkpoint not found: {args.checkpoint}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        _save_report(args.output, output_report)
        sys.exit(0)

    logger.info("Loading ConvNeXt-Base checkpoint from '%s'...", args.checkpoint)
    model = build_model(
        backbone=model_cfg.get("backbone", "convnext_base"),
        num_classes=num_classes,
        pretrained=False,
        checkpoint_path=args.checkpoint,
    ).to(device)
    model.eval()

    # ── Transforms & DataLoaders ─────────────────────────────────────────────
    val_transform = get_validation_transforms(image_size=image_size)

    test_ds = TestImageDataset(
        test_dir=args.test_dir,
        class_to_idx=class_to_idx,
        transform=val_transform,
    )

    if test_ds.unmapped_classes:
        logger.warning("Unmapped PlantDoc classes (excluded from eval): %s", test_ds.unmapped_classes)

    if len(test_ds) == 0:
        print("EVALUATION BLOCKED: test directory contains no mappable images.")
        sys.exit(0)

    logger.info("Test dataset: %d images mapped to %d classes.", len(test_ds), num_classes)

    test_loader = DataLoader(
        test_ds,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=min(os.cpu_count() or 2, 4),
        pin_memory=(device.type == "cuda"),
    )

    ood_ds = OODEvalDataset(ood_dir=args.ood_dir, transform=val_transform)
    logger.info("OOD distractor set: %d images from '%s'.", len(ood_ds), args.ood_dir)

    if len(ood_ds) < 5:
        logger.warning("OOD set has only %d images — AUROC estimate is unreliable (< 5 images).", len(ood_ds))

    ood_loader = DataLoader(
        ood_ds,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=min(os.cpu_count() or 2, 4),
        pin_memory=(device.type == "cuda"),
    )

    # ===========================================================================
    # Phase 1: In-Distribution Evaluation
    # ===========================================================================
    logger.info("=" * 60)
    logger.info("PHASE 1: In-Distribution Evaluation")
    logger.info("=" * 60)

    y_true: List[int] = []
    y_pred: List[int] = []
    confidences: List[float] = []
    id_energies: List[float] = []
    id_entropy: List[float] = []
    nan_samples = 0

    amp_dtype = torch.bfloat16 if device.type == "cuda" else torch.float32

    with torch.no_grad():
        for batch_idx, (images, labels) in enumerate(test_loader):
            images = images.to(device, non_blocking=True)
            labels_np = labels.numpy()

            with torch.amp.autocast(device_type=device.type, dtype=amp_dtype, enabled=(device.type == "cuda")):
                logits = model(images)

            if not torch.isfinite(logits).all():
                nan_count = (~torch.isfinite(logits)).any(dim=1).sum().item()
                logger.warning("Batch %d: %d samples produced NaN logits — skipping.", batch_idx, nan_count)
                nan_samples += int(nan_count)
                # Filter valid samples
                valid_mask = torch.isfinite(logits).all(dim=1)
                logits = logits[valid_mask]
                labels_np = labels_np[valid_mask.cpu().numpy()]

            if len(logits) == 0:
                continue

            probs = F.softmax(logits.float(), dim=-1)
            preds = probs.argmax(dim=-1)
            top_confs = probs.max(dim=-1).values

            energies = compute_energy_score(logits.float(), T=1.0)
            entropies = compute_shannon_entropy(probs)

            y_true.extend(labels_np.tolist())
            y_pred.extend(preds.cpu().numpy().tolist())
            confidences.extend(top_confs.cpu().numpy().tolist())
            id_energies.extend(energies.cpu().numpy().tolist())
            id_entropy.extend(entropies.cpu().numpy().tolist())

    logger.info("In-distribution inference complete: %d samples, %d NaN-skipped.", len(y_true), nan_samples)

    # Compute in-distribution classification metrics
    y_true_arr = np.array(y_true)
    y_pred_arr = np.array(y_pred)
    conf_arr = np.array(confidences)
    corrects_arr = (y_true_arr == y_pred_arr).astype(float)

    in_dist_metrics, conf_matrix = compute_per_class_metrics(y_true_arr, y_pred_arr, classes)

    ece = compute_ece(conf_arr, corrects_arr, n_bins=15)
    mce = compute_mce(conf_arr, corrects_arr, n_bins=15)

    # ===========================================================================
    # Phase 2: OOD Detection Evaluation
    # ===========================================================================
    logger.info("=" * 60)
    logger.info("PHASE 2: OOD Detection Evaluation")
    logger.info("=" * 60)

    ood_energies: List[float] = []
    ood_entropy: List[float] = []
    ood_paths: List[str] = []

    with torch.no_grad():
        for images, paths in ood_loader:
            images = images.to(device, non_blocking=True)
            with torch.amp.autocast(device_type=device.type, dtype=amp_dtype, enabled=(device.type == "cuda")):
                logits = model(images)
            probs = F.softmax(logits.float(), dim=-1)
            energies = compute_energy_score(logits.float(), T=1.0)
            entropies = compute_shannon_entropy(probs)

            ood_energies.extend(energies.cpu().numpy().tolist())
            ood_entropy.extend(entropies.cpu().numpy().tolist())
            ood_paths.extend(list(paths))

    # Compute OOD AUROC using energy scores (in-dist=0, OOD=1)
    energy_y_true = [0] * len(id_energies) + [1] * len(ood_energies)
    energy_y_scores = id_energies + ood_energies

    entropy_y_true = [0] * len(id_entropy) + [1] * len(ood_entropy)
    entropy_y_scores = id_entropy + ood_entropy

    gate2_energy_auroc: Optional[float] = None
    gate2_entropy_auroc: Optional[float] = None
    combined_ood_auroc: Optional[float] = None
    fpr_at_tpr95: float = float("nan")

    if SKLEARN_AVAILABLE and len(np.unique(energy_y_true)) >= 2:
        try:
            gate2_energy_auroc = float(roc_auc_score(energy_y_true, energy_y_scores))
            combined_ood_auroc = gate2_energy_auroc
            fpr_at_tpr95 = compute_fpr_at_tpr95(energy_y_true, energy_y_scores)
            logger.info("Energy OOD AUROC: %.4f | FPR@TPR95: %.4f", gate2_energy_auroc, fpr_at_tpr95)
        except Exception as exc:
            logger.warning("Could not compute energy AUROC: %s", exc)

    if SKLEARN_AVAILABLE and len(np.unique(entropy_y_true)) >= 2:
        try:
            gate2_entropy_auroc = float(roc_auc_score(entropy_y_true, entropy_y_scores))
            logger.info("Entropy OOD AUROC: %.4f", gate2_entropy_auroc)
        except Exception as exc:
            logger.warning("Could not compute entropy AUROC: %s", exc)

    # ===========================================================================
    # Phase 3: Zero-False-Alarm Hard Gate Test (using DiseaseInferenceEngine)
    # ===========================================================================
    logger.info("=" * 60)
    logger.info("PHASE 3: Zero-False-Alarm Gate Penetration Test")
    logger.info("=" * 60)

    engine = DiseaseInferenceEngine(
        checkpoint_path=args.checkpoint,
        gate1_checkpoint_path=args.gate1_checkpoint,
        config_path=args.config,
        device=str(device),
        num_classes=num_classes,
    )

    gate1_correct = 0
    gate1_total = 0
    slip_through_files: List[str] = []
    gate_results: Dict[str, str] = {}

    for img_path in sorted(Path(args.ood_dir).rglob("*")):
        if img_path.suffix.lower() not in VALID_IMAGE_EXTENSIONS or img_path.name.startswith("."):
            continue
        if not os.path.isfile(str(img_path)):
            continue

        try:
            with Image.open(str(img_path)) as pil_img:
                result = engine.predict(pil_img.copy(), use_tta=args.use_tta)
        except Exception as exc:
            logger.warning("Engine error on '%s': %s — counting as slip-through.", img_path.name, exc)
            slip_through_files.append(str(img_path))
            gate_results[img_path.name] = "engine_error"
            continue

        gate1_total += 1

        # A file passes the gate test if it is rejected by ANY gate
        if not result.get("prediction_valid", True) or result.get("is_ood", False):
            gate1_correct += 1
            gate_results[img_path.name] = result.get("rejection_reason", "rejected")
        else:
            slip_through_files.append(str(img_path))
            gate_results[img_path.name] = "SLIP_THROUGH"
            logger.error(
                "!!! GATE BREACH: OOD image '%s' was NOT rejected! Confidence=%.4f, Energy=%.4f",
                img_path.name,
                result.get("confidence") or 0.0,
                result.get("energy_score") or 0.0,
            )

    gate1_accuracy = float(gate1_correct / max(1, gate1_total))
    zero_false_alarms = len(slip_through_files) == 0

    logger.info(
        "Gate test: %d/%d OOD images rejected. Slip-throughs: %d. Zero-alarm: %s",
        gate1_correct, gate1_total, len(slip_through_files), zero_false_alarms
    )

    if slip_through_files:
        logger.error("SLIP-THROUGH FILES:")
        for f in slip_through_files:
            logger.error("  - %s", f)

    # ===========================================================================
    # Phase 4: Build Report & Print Summary
    # ===========================================================================
    report = {
        "status": "COMPLETED",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checkpoint": args.checkpoint,
        "backbone": model_cfg.get("backbone", "convnext_base"),
        "num_classes": num_classes,
        "test_dir": args.test_dir,
        "ood_dir": args.ood_dir,
        "nan_samples_skipped": nan_samples,
        "in_distribution": {
            "accuracy": in_dist_metrics["accuracy"],
            "macro_f1": in_dist_metrics["macro_f1"],
            "macro_precision": in_dist_metrics["macro_precision"],
            "macro_recall": in_dist_metrics["macro_recall"],
            "weighted_f1": in_dist_metrics["weighted_f1"],
            "confusion_matrix": in_dist_metrics["confusion_matrix"],
            "per_class": in_dist_metrics["per_class"],
        },
        "calibration": {
            "ece": round(ece, 4),
            "mce": round(mce, 4),
            "n_bins": 15,
        },
        "ood_detection": {
            "auroc": round(gate2_energy_auroc, 4) if gate2_energy_auroc is not None else None,
            "fpr_at_tpr95": round(fpr_at_tpr95, 4) if np.isfinite(fpr_at_tpr95) else None,
            "gate1_accuracy": round(gate1_accuracy, 4),
            "gate2_energy_auroc": round(gate2_energy_auroc, 4) if gate2_energy_auroc is not None else None,
            "gate2_entropy_auroc": round(gate2_entropy_auroc, 4) if gate2_entropy_auroc is not None else None,
            "gate_results": gate_results,
        },
        "zero_false_alarm_gate_test": {
            "passed": zero_false_alarms,
            "total_ood_images": gate1_total,
            "rejected": gate1_correct,
            "slip_through_count": len(slip_through_files),
            "slip_through_files": slip_through_files,
        },
        "engineering_targets": {
            "macro_f1_target": 0.90,
            "macro_f1_met": in_dist_metrics["macro_f1"] >= 0.90,
            "accuracy_target": 0.88,
            "accuracy_met": in_dist_metrics["accuracy"] >= 0.88,
            "ood_auroc_target": 0.97,
            "ood_auroc_met": (gate2_energy_auroc is not None and gate2_energy_auroc >= 0.97),
            "fpr_at_tpr95_target": 0.03,
            "fpr_at_tpr95_met": (np.isfinite(fpr_at_tpr95) and fpr_at_tpr95 <= 0.03),
            "zero_false_alarms_on_ood_set": zero_false_alarms,
        },
        "unmapped_test_classes": test_ds.unmapped_classes,
    }

    _save_report(args.output, report)

    _print_summary(report)

    return report


def _save_report(output_path: str, report: Dict[str, Any]) -> None:
    """Persists evaluation report to JSON."""
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, default=str)
    logger.info("Evaluation report saved to '%s'.", output_path)


def _print_summary(report: Dict[str, Any]) -> None:
    """Prints a formatted evaluation summary table to stdout."""
    targets = report.get("engineering_targets", {})
    in_dist = report.get("in_distribution", {})
    ood = report.get("ood_detection", {})
    calib = report.get("calibration", {})
    gate_test = report.get("zero_false_alarm_gate_test", {})

    sep = "=" * 70

    print()
    print(sep)
    print("  AgriNexus AI — Disease Classifier Evaluation Report")
    print(sep)
    print(f"  Checkpoint : {report.get('checkpoint', 'N/A')}")
    print(f"  Backbone   : {report.get('backbone', 'N/A')} | Classes: {report.get('num_classes', 'N/A')}")
    print(f"  Test Dir   : {report.get('test_dir', 'N/A')}")
    print(f"  OOD Dir    : {report.get('ood_dir', 'N/A')}")
    print(sep)

    def _status(met: bool) -> str:
        return "✓ TARGET MET" if met else "✗ TARGET NOT MET"

    print()
    print("  IN-DISTRIBUTION METRICS (PlantDoc Test Set)")
    print(f"  {'Metric':<30} {'Value':>10}  {'Target':>10}  {'Status':<16}")
    print("  " + "-" * 66)
    print(f"  {'Top-1 Accuracy':<30} {in_dist.get('accuracy', 0):>10.4f}  {'≥ 0.88':>10}  {_status(targets.get('accuracy_met', False))}")
    print(f"  {'Macro F1':<30} {in_dist.get('macro_f1', 0):>10.4f}  {'≥ 0.90':>10}  {_status(targets.get('macro_f1_met', False))}")
    print(f"  {'Macro Precision':<30} {in_dist.get('macro_precision', 0):>10.4f}  {'—':>10}")
    print(f"  {'Macro Recall':<30} {in_dist.get('macro_recall', 0):>10.4f}  {'—':>10}")
    print(f"  {'Weighted F1':<30} {in_dist.get('weighted_f1', 0):>10.4f}  {'—':>10}")

    print()
    print("  CALIBRATION")
    print(f"  {'ECE (15 bins)':<30} {calib.get('ece', 0):>10.4f}  {'—':>10}")
    print(f"  {'MCE':<30} {calib.get('mce', 0):>10.4f}  {'—':>10}")

    print()
    print("  OOD DETECTION")
    auroc_val = ood.get('auroc') or 0.0
    fpr_val = ood.get('fpr_at_tpr95') or float('nan')
    print(f"  {'OOD AUROC (energy)':<30} {auroc_val:>10.4f}  {'≥ 0.97':>10}  {_status(targets.get('ood_auroc_met', False))}")
    if np.isfinite(fpr_val):
        print(f"  {'FPR@TPR95':<30} {fpr_val:>10.4f}  {'≤ 0.03':>10}  {_status(targets.get('fpr_at_tpr95_met', False))}")
    else:
        print(f"  {'FPR@TPR95':<30} {'N/A':>10}  {'≤ 0.03':>10}")
    print(f"  {'Gate 1 Accuracy on OOD':<30} {ood.get('gate1_accuracy', 0):>10.4f}  {'—':>10}")
    if ood.get('gate2_entropy_auroc') is not None:
        print(f"  {'Gate 2 Entropy AUROC':<30} {ood.get('gate2_entropy_auroc', 0):>10.4f}  {'—':>10}")

    print()
    print("  ZERO-FALSE-ALARM GATE TEST")
    print(f"  Total OOD images tested  : {gate_test.get('total_ood_images', 0)}")
    print(f"  Correctly rejected       : {gate_test.get('rejected', 0)}")
    print(f"  Slip-throughs            : {gate_test.get('slip_through_count', 0)}")
    if gate_test.get("slip_through_files"):
        print("  BREACH FILES:")
        for f in gate_test["slip_through_files"]:
            print(f"    - {f}")

    zero_alarm_met = targets.get("zero_false_alarms_on_ood_set", False)
    print(f"  Zero False Alarms        : {_status(zero_alarm_met)}")

    print()
    print(sep)
    all_met = all([
        targets.get("macro_f1_met", False),
        targets.get("accuracy_met", False),
        targets.get("ood_auroc_met", False),
        targets.get("zero_false_alarms_on_ood_set", False),
    ])
    if all_met:
        print("  ✓ ALL ENGINEERING TARGETS MET — MODEL READY FOR PRODUCTION")
    else:
        print("  ✗ ONE OR MORE ENGINEERING TARGETS NOT MET — CONTINUE TRAINING")
    print(sep)
    print()


if __name__ == "__main__":
    main()
