"""
AgriNexus AI - Disease Model Two-Phase Transfer Learning Pipeline
Phase 1: Freeze backbone, train classification head (warm-up)
Phase 2: Fine-tune entire network with low learning rate and cosine/plateau annealing.
Produces structured training reports and saves best-performing weights.
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
logger = logging.getLogger("DiseaseTrainer")

try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import DataLoader, Subset
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


def parse_args():
    parser = argparse.ArgumentParser(description="Train AgriNexus Disease Classification Model")
    parser.add_argument("--config", type=str, default="ml/disease/config.yaml", help="Path to config YAML")
    parser.add_argument("--data-dir", type=str, default=None, help="Root directory for dataset")
    parser.add_argument("--phase1-epochs", type=int, default=None, help="Phase 1 head warm-up epochs")
    parser.add_argument("--phase2-epochs", type=int, default=None, help="Phase 2 full fine-tuning epochs")
    parser.add_argument("--batch-size", type=int, default=None, help="Batch size")
    return parser.parse_args()


def calculate_metrics(true_labels, pred_labels, num_classes):
    true_arr = np.array(true_labels)
    pred_arr = np.array(pred_labels)
    acc = float(np.sum(true_arr == pred_arr) / max(1, len(true_arr)))

    precisions, recalls, f1s = [], [], []
    for c in range(num_classes):
        tp = int(np.sum((pred_arr == c) & (true_arr == c)))
        fp = int(np.sum((pred_arr == c) & (true_arr != c)))
        fn = int(np.sum((pred_arr != c) & (true_arr == c)))

        p = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        r = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * p * r / (p + r)) if (p + r) > 0 else 0.0
        precisions.append(p)
        recalls.append(r)
        f1s.append(f1)

    return {
        "accuracy": float(round(acc, 4)),
        "macro_precision": float(round(float(np.mean(precisions)), 4)),
        "macro_recall": float(round(float(np.mean(recalls)), 4)),
        "macro_f1": float(round(float(np.mean(f1s)), 4)),
    }


def main():
    args = parse_args()
    config_path = Path(args.config)
    if not config_path.exists():
        logger.error(f"Config not found at {config_path}")
        sys.exit(1)

    with open(config_path, "r") as f:
        config = yaml.safe_load(f)

    data_dir = args.data_dir or config.get("paths", {}).get("data_dir", "ml/datasets")
    p1_epochs = args.phase1_epochs or config.get("training", {}).get("phase1_epochs", 10)
    p2_epochs = args.phase2_epochs or config.get("training", {}).get("phase2_epochs", 20)
    batch_size = args.batch_size or config.get("training", {}).get("batch_size", 32)
    checkpoint_dir = Path(config.get("paths", {}).get("checkpoint_dir", "ml/disease/checkpoints"))
    checkpoint_dir.mkdir(parents=True, exist_ok=True)

    disease_data_dir = os.path.join(data_dir, "disease")
    if not os.path.isdir(disease_data_dir):
        logger.warning(
            f"TRAINING BLOCKED: Dataset directory not found at '{disease_data_dir}'.\n"
            "Please ensure PlantVillage or custom agricultural images are populated."
        )
        report = {
            "status": "BLOCKED",
            "reason": "Training blocked because dataset assets are unavailable at specified path.",
            "target_dir": disease_data_dir,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        with open(checkpoint_dir / "disease_training_report.json", "w") as f:
            json.dump(report, f, indent=2)
        return

    if not TORCH_AVAILABLE:
        logger.error("PyTorch is required for model training.")
        sys.exit(1)

    from ml.disease.dataset import AgriDiseaseDataset, create_leakage_free_splits
    from ml.disease.transforms import get_training_transforms, get_validation_transforms
    from ml.disease.model import build_disease_model

    img_size = config["model"]["image_size"]
    train_trans = get_training_transforms(img_size)
    val_trans = get_validation_transforms(img_size)

    full_ds = AgriDiseaseDataset(disease_data_dir)
    if len(full_ds) == 0:
        logger.warning(f"No image samples found in '{disease_data_dir}'.")
        return

    train_idx, val_idx, test_idx = create_leakage_free_splits(full_ds, seed=config["training"].get("seed", 42))

    train_ds = Subset(AgriDiseaseDataset(disease_data_dir, transform=train_trans), train_idx)
    val_ds = Subset(AgriDiseaseDataset(disease_data_dir, transform=val_trans), val_idx)

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    num_classes = len(full_ds.classes)
    model = build_disease_model(
        model_name=config["model"]["backbone"],
        num_classes=num_classes,
        pretrained=True
    ).to(device)

    criterion = nn.CrossEntropyLoss(label_smoothing=config["training"].get("label_smoothing", 0.1))

    # Phase 1: Train classifier head only
    logger.info(f"--- Phase 1: Head Warm-up ({p1_epochs} epochs) ---")
    for param in model.parameters():
        param.requires_grad = False
    # Unfreeze classifier
    for param in (model.classifier.parameters() if hasattr(model, "classifier") else model.parameters()):
        param.requires_grad = True

    optimizer_p1 = optim.AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=config["training"].get("head_lr", 0.001))

    for epoch in range(p1_epochs):
        model.train()
        for imgs, labels in train_loader:
            imgs, labels = imgs.to(device), labels.to(device)
            optimizer_p1.zero_grad()
            outputs = model(imgs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer_p1.step()

    # Phase 2: Fine-tune entire model
    logger.info(f"--- Phase 2: Full Fine-Tuning ({p2_epochs} epochs) ---")
    for param in model.parameters():
        param.requires_grad = True

    optimizer_p2 = optim.AdamW(model.parameters(), lr=config["training"].get("backbone_lr", 0.00005))
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer_p2, mode="max", patience=3, factor=0.5)

    best_f1 = 0.0
    best_metrics = {}

    for epoch in range(p2_epochs):
        model.train()
        for imgs, labels in train_loader:
            imgs, labels = imgs.to(device), labels.to(device)
            optimizer_p2.zero_grad()
            outputs = model(imgs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer_p2.step()

        # Validation
        model.eval()
        val_preds, val_targets = [], []
        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs, labels = imgs.to(device), labels.to(device)
                outputs = model(imgs)
                preds = outputs.argmax(dim=1)
                val_preds.extend(preds.cpu().numpy().tolist())
                val_targets.extend(labels.cpu().numpy().tolist())

        metrics = calculate_metrics(val_targets, val_preds, num_classes)
        scheduler.step(metrics["macro_f1"])
        logger.info(f"Epoch {epoch+1}/{p2_epochs} - Metrics: {metrics}")

        if metrics["macro_f1"] > best_f1:
            best_f1 = metrics["macro_f1"]
            best_metrics = metrics
            save_path = checkpoint_dir / "leaf_disease_efficientnet.pth"
            torch.save(model.state_dict(), save_path)
            logger.info(f"Saved best model with F1: {best_f1:.4f} to {save_path}")

    # Write training report
    final_report = {
        "status": "COMPLETED",
        "model": config["model"]["name"],
        "backbone": config["model"]["backbone"],
        "num_classes": num_classes,
        "metrics": best_metrics,
        "timestamp": datetime.utcnow().isoformat()
    }
    with open(checkpoint_dir / "disease_training_report.json", "w") as f:
        json.dump(final_report, f, indent=2)


if __name__ == "__main__":
    main()
