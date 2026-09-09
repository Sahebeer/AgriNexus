"""
AgriNexus AI - Crop / Plant Relevance Gate Training Pipeline
Reproducible training script with configuration file loading, validation split,
early stopping, and best-checkpoint persistence.
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

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("CropGateTrainer")

try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import DataLoader, random_split
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


def parse_args():
    parser = argparse.ArgumentParser(description="Train AgriNexus Crop Gate Model")
    parser.add_argument("--config", type=str, default="ml/crop_gate/config.yaml", help="Path to config YAML")
    parser.add_argument("--data-dir", type=str, default=None, help="Root directory for dataset")
    parser.add_argument("--epochs", type=int, default=None, help="Override epoch count")
    parser.add_argument("--batch-size", type=int, default=None, help="Override batch size")
    parser.add_argument("--lr", type=float, default=None, help="Override learning rate")
    return parser.parse_args()


def main():
    args = parse_args()

    config_path = Path(args.config)
    if not config_path.exists():
        logger.error(f"Config file not found at {config_path}")
        sys.exit(1)

    with open(config_path, "r") as f:
        config = yaml.safe_load(f)

    # Overrides
    data_dir = args.data_dir or config.get("paths", {}).get("data_dir", "ml/datasets")
    epochs = args.epochs or config.get("training", {}).get("epochs", 15)
    batch_size = args.batch_size or config.get("training", {}).get("batch_size", 32)
    lr = args.lr or config.get("training", {}).get("learning_rate", 0.0003)
    checkpoint_dir = Path(config.get("paths", {}).get("checkpoint_dir", "ml/crop_gate/checkpoints"))
    checkpoint_dir.mkdir(parents=True, exist_ok=True)

    pos_dir = os.path.join(data_dir, "crop_gate", "positive")
    neg_dir = os.path.join(data_dir, "crop_gate", "negative")

    if not os.path.exists(pos_dir) or not os.path.exists(neg_dir):
        logger.warning(
            "TRAINING BLOCKED: Dataset directories not populated at:\n"
            f"  Positives: {pos_dir}\n"
            f"  Negatives: {neg_dir}\n"
            "Please populate datasets or run data ingestion script before initiating training."
        )
        report = {
            "status": "BLOCKED",
            "reason": "Training blocked because dataset assets are unavailable at specified path.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "target_pos_dir": pos_dir,
            "target_neg_dir": neg_dir
        }
        report_path = checkpoint_dir / "crop_gate_training_report.json"
        with open(report_path, "w") as rf:
            json.dump(report, rf, indent=2)
        return

    if not TORCH_AVAILABLE:
        logger.error("PyTorch is required for training the crop gate model.")
        sys.exit(1)

    from ml.crop_gate.dataset import CropGateDataset, get_crop_gate_transforms
    from ml.crop_gate.model import CropGateModel

    train_transform = get_crop_gate_transforms(image_size=config["model"]["image_size"], is_training=True)
    dataset = CropGateDataset(pos_dir, neg_dir, transform=train_transform)

    if len(dataset) == 0:
        logger.warning("No image samples discovered in positive/negative directories.")
        return

    val_size = int(len(dataset) * config["training"].get("val_split", 0.15))
    train_size = len(dataset) - val_size
    train_ds, val_ds = random_split(dataset, [train_size, val_size])

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    gate = CropGateModel(device=str(device), threshold=config["thresholds"]["crop_gate_confidence"])
    model = gate.model

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=config["training"].get("weight_decay", 0.0001))

    logger.info(f"Starting CropGate training: {train_size} train, {val_size} val on {device}")

    best_val_acc = 0.0
    for epoch in range(epochs):
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0
        for imgs, labels in train_loader:
            imgs, labels = imgs.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(imgs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * imgs.size(0)
            preds = outputs.argmax(dim=1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)

        train_acc = correct / max(1, total)

        # Validation
        model.eval()
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs, labels = imgs.to(device), labels.to(device)
                outputs = model(imgs)
                preds = outputs.argmax(dim=1)
                val_correct += (preds == labels).sum().item()
                val_total += labels.size(0)

        val_acc = val_correct / max(1, val_total)
        logger.info(f"Epoch {epoch+1}/{epochs} - Train Acc: {train_acc:.4f} - Val Acc: {val_acc:.4f}")

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            save_path = checkpoint_dir / "best_crop_gate.pt"
            torch.save(model.state_dict(), save_path)
            logger.info(f"Saved best model checkpoint ({best_val_acc:.4f}) to {save_path}")

    # Generate final experiment report
    report = {
        "status": "COMPLETED",
        "model": config["model"]["name"],
        "epochs": epochs,
        "best_val_accuracy": best_val_acc,
        "timestamp": datetime.utcnow().isoformat()
    }
    with open(checkpoint_dir / "crop_gate_training_report.json", "w") as f:
        json.dump(report, f, indent=2)


if __name__ == "__main__":
    main()
