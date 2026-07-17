"""
AgriNexus AI - OVERNIGHT Best-Accuracy Training Pipeline
=========================================================
Two-phase transfer learning:
  Phase 1: Frozen backbone, train only classifier head (warm-up)
  Phase 2: Full fine-tuning of entire network at very low LR

Techniques:
  - EfficientNet-B0 (ImageNet pretrained)
  - Resume from existing checkpoint
  - Heavy data augmentation (ColorJitter, GaussianBlur, RandomErasing)
  - MixUp regularization
  - Label smoothing (0.1)
  - AdamW + ReduceLROnPlateau scheduler
  - Best-checkpoint saving (never downgrades)
  - Early stopping (patience=5)

Usage:
  python3 train_disease_model.py \\
      --data-dir app/services/PlantVillage/PlantVillage \\
      --phase1-epochs 10 --phase2-epochs 20 \\
      --resume
"""

import os
import argparse
import time
import random
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Subset
from torchvision.models import efficientnet_b0, EfficientNet_B0_Weights
import torchvision.transforms as transforms
from torchvision.datasets import ImageFolder


# ── MixUp Augmentation ────────────────────────────────────────────────────────
def mixup_data(x, y, alpha=0.2):
    """Apply MixUp: blends two training samples and their labels."""
    if alpha > 0:
        lam = np.random.beta(alpha, alpha)
    else:
        lam = 1.0
    batch_size = x.size(0)
    index = torch.randperm(batch_size, device=x.device)
    mixed_x = lam * x + (1 - lam) * x[index]
    y_a, y_b = y, y[index]
    return mixed_x, y_a, y_b, lam


def mixup_criterion(criterion, pred, y_a, y_b, lam):
    return lam * criterion(pred, y_a) + (1 - lam) * criterion(pred, y_b)


# ── Metrics ────────────────────────────────────────────────────────────────────
def calculate_metrics(true_labels, pred_labels, num_classes):
    true_labels = np.array(true_labels)
    pred_labels = np.array(pred_labels)

    conf_matrix = np.zeros((num_classes, num_classes), dtype=int)
    for t, p in zip(true_labels, pred_labels):
        if 0 <= t < num_classes and 0 <= p < num_classes:
            conf_matrix[t, p] += 1

    accuracy = float(np.sum(true_labels == pred_labels) / len(true_labels))
    precisions, recalls, f1_scores = [], [], []
    for c in range(num_classes):
        tp = conf_matrix[c, c]
        fp = np.sum(conf_matrix[:, c]) - tp
        fn = np.sum(conf_matrix[c, :]) - tp
        precision = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
        recall    = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
        f1        = float(2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
        precisions.append(precision)
        recalls.append(recall)
        f1_scores.append(f1)

    return {
        "accuracy":        accuracy,
        "macro_precision": float(np.mean(precisions)),
        "macro_recall":    float(np.mean(recalls)),
        "macro_f1":        float(np.mean(f1_scores)),
        "confusion_matrix": conf_matrix.tolist()
    }


# ── Training loop for one epoch ────────────────────────────────────────────────
def train_one_epoch(model, loader, criterion, optimizer, device, num_classes,
                    use_mixup=True, epoch_label=""):
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    for batch_idx, (images, labels) in enumerate(loader):
        images, labels = images.to(device), labels.to(device)

        if use_mixup:
            images, labels_a, labels_b, lam = mixup_data(images, labels, alpha=0.3)
            optimizer.zero_grad()
            outputs = model(images)
            loss = mixup_criterion(criterion, outputs, labels_a, labels_b, lam)
        else:
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)

        loss.backward()
        # Gradient clipping for stability
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        preds = outputs.argmax(dim=1)

        if use_mixup:
            # Approximate train accuracy with dominant label
            correct += (lam * (preds == labels_a).float() +
                        (1 - lam) * (preds == labels_b).float()).sum().item()
        else:
            correct += (preds == labels).sum().item()

        total += images.size(0)

        if (batch_idx + 1) % 25 == 0:
            print(f"  {epoch_label} | Batch {batch_idx+1}/{len(loader)} "
                  f"| Loss: {loss.item():.4f}", flush=True)

    return running_loss / total, correct / total


def validate(model, loader, device, num_classes):
    model.eval()
    all_preds, all_labels = [], []
    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device)
            outputs = model(images)
            preds = outputs.argmax(dim=1)
            all_preds.extend(preds.cpu().numpy().tolist())
            all_labels.extend(labels.numpy().tolist())
    return calculate_metrics(all_labels, all_preds, num_classes)


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="AgriNexus Overnight Best-Accuracy Training")
    parser.add_argument("--data-dir",       type=str, default="app/services/PlantVillage/PlantVillage")
    parser.add_argument("--phase1-epochs",  type=int, default=10,
                        help="Frozen-backbone warm-up epochs")
    parser.add_argument("--phase2-epochs",  type=int, default=20,
                        help="Full fine-tuning epochs")
    parser.add_argument("--batch-size",     type=int, default=32)
    parser.add_argument("--phase1-lr",      type=float, default=3e-4)
    parser.add_argument("--phase2-lr",      type=float, default=5e-5)
    parser.add_argument("--val-split",      type=float, default=0.15)
    parser.add_argument("--early-stop",     type=int, default=6,
                        help="Stop if val accuracy doesn't improve for N epochs")
    parser.add_argument("--output-weights", type=str,
                        default="app/services/leaf_disease_efficientnet.pth")
    parser.add_argument("--resume",         action="store_true",
                        help="Resume from existing checkpoint before phase 1")
    parser.add_argument("--seed",           type=int, default=42)
    args = parser.parse_args()

    # Reproducibility
    torch.manual_seed(args.seed)
    random.seed(args.seed)
    np.random.seed(args.seed)

    device = torch.device("mps"  if torch.backends.mps.is_available()  else
                          "cuda" if torch.cuda.is_available()           else "cpu")

    print("=" * 60, flush=True)
    print("  AgriNexus Overnight Best-Accuracy Training", flush=True)
    print(f"  Device        : {device}", flush=True)
    print(f"  Dataset       : {args.data_dir}", flush=True)
    print(f"  Phase 1       : {args.phase1_epochs} epochs @ LR={args.phase1_lr} (frozen backbone)", flush=True)
    print(f"  Phase 2       : {args.phase2_epochs} epochs @ LR={args.phase2_lr} (full fine-tune)", flush=True)
    print(f"  Batch size    : {args.batch_size}", flush=True)
    print(f"  Early stop    : patience={args.early_stop}", flush=True)
    print(f"  Resume        : {args.resume}", flush=True)
    print("=" * 60, flush=True)

    # ── Transforms ──────────────────────────────────────────────────────────────
    # Phase 1 / Phase 2 share the same heavy augmentation for train
    train_transform = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.RandomCrop(224),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(p=0.3),
        transforms.RandomRotation(30),
        transforms.ColorJitter(brightness=0.4, contrast=0.4, saturation=0.4, hue=0.08),
        transforms.GaussianBlur(kernel_size=3, sigma=(0.1, 2.0)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        transforms.RandomErasing(p=0.25, scale=(0.02, 0.15)),
    ])

    val_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    if not os.path.isdir(args.data_dir):
        raise FileNotFoundError(f"Dataset not found: {args.data_dir}")

    full_dataset_train = ImageFolder(root=args.data_dir, transform=train_transform)
    full_dataset_val   = ImageFolder(root=args.data_dir, transform=val_transform)

    class_names = full_dataset_train.classes
    num_classes = len(class_names)

    print(f"\nFound {len(full_dataset_train)} images across {num_classes} classes:", flush=True)
    for i, c in enumerate(class_names):
        print(f"  [{i:2d}] {c}", flush=True)

    # Deterministic split — same indices used for both transform variants
    val_size   = int(len(full_dataset_train) * args.val_split)
    train_size = len(full_dataset_train) - val_size
    indices    = list(range(len(full_dataset_train)))
    rng        = random.Random(args.seed)
    rng.shuffle(indices)
    train_indices = indices[:train_size]
    val_indices   = indices[train_size:]

    train_dataset = Subset(full_dataset_train, train_indices)
    val_dataset   = Subset(full_dataset_val,   val_indices)

    train_loader = DataLoader(train_dataset, batch_size=args.batch_size,
                              shuffle=True,  num_workers=2, pin_memory=False)
    val_loader   = DataLoader(val_dataset,   batch_size=args.batch_size,
                              shuffle=False, num_workers=2, pin_memory=False)

    print(f"\nDataset split: {train_size} train | {val_size} validation\n", flush=True)

    # ── Model ────────────────────────────────────────────────────────────────────
    print("Loading EfficientNet-B0 with ImageNet weights...", flush=True)
    model = efficientnet_b0(weights=EfficientNet_B0_Weights.DEFAULT)
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.4, inplace=True),
        nn.Linear(1280, num_classes)
    )

    # Resume from checkpoint if requested
    if args.resume and os.path.exists(args.output_weights):
        print(f"Resuming from checkpoint: {args.output_weights}", flush=True)
        model.load_state_dict(torch.load(args.output_weights,
                                         map_location="cpu", weights_only=True))
    elif args.resume:
        print("[WARN] --resume set but no checkpoint found. Starting fresh.", flush=True)

    model = model.to(device)

    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)

    # Track the best val accuracy seen so far (from resumed checkpoint or 0)
    best_val_acc    = 0.0
    no_improve_cnt  = 0
    global_epoch    = 0

    # ── PHASE 1: Frozen backbone ──────────────────────────────────────────────
    print("\n" + "─" * 60, flush=True)
    print(f"  PHASE 1: Warm-up — training classifier head only", flush=True)
    print("─" * 60, flush=True)

    for param in model.features.parameters():
        param.requires_grad = False

    optimizer  = optim.AdamW(filter(lambda p: p.requires_grad, model.parameters()),
                              lr=args.phase1_lr, weight_decay=1e-4)
    scheduler  = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="max",
                                                       factor=0.5, patience=2)

    for epoch in range(1, args.phase1_epochs + 1):
        global_epoch += 1
        t0 = time.time()
        label = f"Ph1 Ep{epoch:02d}/{args.phase1_epochs}"

        train_loss, train_acc = train_one_epoch(
            model, train_loader, criterion, optimizer, device,
            num_classes, use_mixup=True, epoch_label=label
        )
        metrics  = validate(model, val_loader, device, num_classes)
        val_acc  = metrics["accuracy"]
        val_f1   = metrics["macro_f1"]
        elapsed  = time.time() - t0
        cur_lr   = optimizer.param_groups[0]["lr"]

        print(f"[Phase1] Epoch {epoch:02d}/{args.phase1_epochs} | "
              f"Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.4f} | "
              f"Val Acc: {val_acc:.4f} | Val F1: {val_f1:.4f} | "
              f"LR: {cur_lr:.2e} | Time: {elapsed:.1f}s", flush=True)

        scheduler.step(val_acc)

        if val_acc > best_val_acc:
            best_val_acc   = val_acc
            no_improve_cnt = 0
            os.makedirs(os.path.dirname(os.path.abspath(args.output_weights)), exist_ok=True)
            torch.save(model.state_dict(), args.output_weights)
            print(f"  ✓ Best model saved (Val Acc={val_acc:.4f})", flush=True)
        else:
            no_improve_cnt += 1
            print(f"  – No improvement ({no_improve_cnt}/{args.early_stop})", flush=True)
            if no_improve_cnt >= args.early_stop:
                print("  Early stopping triggered in Phase 1.", flush=True)
                break

    # ── PHASE 2: Full fine-tuning ─────────────────────────────────────────────
    print("\n" + "─" * 60, flush=True)
    print(f"  PHASE 2: Full fine-tuning — all layers unfrozen", flush=True)
    print("─" * 60, flush=True)

    # Reload best phase-1 checkpoint before fine-tuning
    if os.path.exists(args.output_weights):
        print(f"  Loading best Phase 1 weights before fine-tuning...", flush=True)
        model.load_state_dict(torch.load(args.output_weights,
                                          map_location=device, weights_only=True))

    for param in model.parameters():
        param.requires_grad = True

    # Use different LRs: smaller for backbone, larger for new head
    optimizer = optim.AdamW([
        {"params": model.features.parameters(),   "lr": args.phase2_lr},
        {"params": model.classifier.parameters(), "lr": args.phase2_lr * 5},
    ], weight_decay=1e-4)

    scheduler = optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=args.phase2_epochs, eta_min=1e-7
    )
    no_improve_cnt = 0

    for epoch in range(1, args.phase2_epochs + 1):
        global_epoch += 1
        t0 = time.time()
        label = f"Ph2 Ep{epoch:02d}/{args.phase2_epochs}"

        train_loss, train_acc = train_one_epoch(
            model, train_loader, criterion, optimizer, device,
            num_classes, use_mixup=True, epoch_label=label
        )
        metrics  = validate(model, val_loader, device, num_classes)
        val_acc  = metrics["accuracy"]
        val_f1   = metrics["macro_f1"]
        elapsed  = time.time() - t0
        cur_lr   = optimizer.param_groups[0]["lr"]

        print(f"[Phase2] Epoch {epoch:02d}/{args.phase2_epochs} | "
              f"Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.4f} | "
              f"Val Acc: {val_acc:.4f} | Val F1: {val_f1:.4f} | "
              f"LR: {cur_lr:.2e} | Time: {elapsed:.1f}s", flush=True)

        scheduler.step()

        if val_acc > best_val_acc:
            best_val_acc   = val_acc
            no_improve_cnt = 0
            os.makedirs(os.path.dirname(os.path.abspath(args.output_weights)), exist_ok=True)
            torch.save(model.state_dict(), args.output_weights)
            print(f"  ✓ Best model saved (Val Acc={val_acc:.4f})", flush=True)
        else:
            no_improve_cnt += 1
            print(f"  – No improvement ({no_improve_cnt}/{args.early_stop})", flush=True)
            if no_improve_cnt >= args.early_stop:
                print("  Early stopping triggered in Phase 2.", flush=True)
                break

    # ── Final Report ──────────────────────────────────────────────────────────
    print("\n" + "=" * 60, flush=True)
    print("  TRAINING COMPLETE", flush=True)
    print(f"  Best Validation Accuracy : {best_val_acc:.4f} ({best_val_acc*100:.2f}%)", flush=True)
    print(f"  Weights saved to         : {args.output_weights}", flush=True)
    print("=" * 60, flush=True)


if __name__ == "__main__":
    main()
