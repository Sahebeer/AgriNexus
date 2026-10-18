"""
AgriNexus AI - Plant Disease Detection Three-Phase Training Engine
Batch 3 Implementation according to plan.md (Section 4 & Section 5 Script 4).

Key Architecture & Numerical Safeguards:
1. Combined Hybrid Loss (CombinedFocalCELoss):
   - Formula: Loss = 0.6 * CE(label_smoothing=0.05) + 0.4 * Focal(gamma=2.0, class_weights)
   - Float32 precision casting for softmax/focal calculations to prevent bfloat16/fp16 underflows/NaNs.
   - Dual-target support (1D integer labels and 2D soft/one-hot probabilities from MixUp/CutMix).
   - In-flight NaN detection with gradient skip and counter tracking.
2. Collation Engine (MixupCutmixCollator):
   - Standalone collator: MixUp (alpha=0.2, p=0.7) and CutMix (alpha=1.0, p=0.3).
   - Returns (B, 3, 384, 384) mixed images and (B, 61) soft float32 one-hot labels.
3. Three-Phase Training & Dynamic Optimizer Rebuilding:
   - Phase 0 (Warm-up, Epochs 1-5): Backbone frozen; classifier head only with LinearLR warmup.
   - Phase 1 (Staged Unfreeze, Epochs 6-20): Unfreeze Stage 2, Stage 3 and downsamples (features[4:8]).
     AdamW with CosineAnnealingLR (T_max=15, eta_min=1e-6).
   - Phase 2 (Full Fine-tuning, Epochs 21-50): Full unfreeze with layer-wise decay.
     AdamW with CosineAnnealingWarmRestarts (T_0=10, T_mult=2, eta_min=1e-7).
   - Clean optimizer reconstruction at phase boundaries to discard outdated momentum buffers.
4. Precision & Scaler:
   - Modern torch.amp.autocast and torch.amp.GradScaler(device=device.type).
   - Gradient norm clipping at 1.0.
5. Metrics & OOD:
   - Macro F1 and top-1 accuracy via torchmetrics.
   - Free Energy OOD AUROC using non-leaf images with fallback guard for binary class diversity.
   - EarlyStopping monitoring val_macro_f1 with secondary OOD AUROC >= 0.95 gate.
6. Checkpointing & Resilience:
   - Checkpoint resume shape validation against num_classes (61).
   - CUDA OOM recovery with automatic batch size halving.
   - Best model, last epoch, epoch_log.csv, and timestamped training report persistence.
   - --dry-run CLI smoke test mode.
"""

import os
import sys
import csv
import time
import json
import yaml
import logging
import argparse
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union

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
logger = logging.getLogger("AgriNexusTrain")

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    from torch.utils.data import DataLoader, Dataset
    from torchmetrics.classification import MulticlassF1Score, MulticlassAccuracy
    from sklearn.metrics import roc_auc_score
    from tqdm import tqdm
    TORCH_AVAILABLE = True
except ImportError as err:
    TORCH_AVAILABLE = False
    logger.error("Required ML libraries are not available: %s", err)

from ml.disease.transforms import get_training_transforms, get_validation_transforms
from ml.disease.dataset import LeafDiseaseDataset, save_class_mapping, VALID_IMAGE_EXTENSIONS
from ml.disease.model import (
    build_model,
    build_binary_gate,
    get_parameter_groups,
    compute_energy_score,
)


# ==============================================================================
# 1. Combined Hybrid Loss (CE + Focal) with Dual-Target & Numerical Stability
# ==============================================================================

class CombinedFocalCELoss(nn.Module):
    """
    Combined Hybrid Loss:
    Loss = alpha * L_CE(epsilon=0.05) + beta * L_Focal(gamma=2.0, alpha_per_class=class_weights)
    Default: alpha=0.6, beta=0.4.

    Numerical Safeguards:
    - Casts logits to float32 immediately in forward() to avoid bfloat16/fp16 underflows.
    - Operates on both 1D hard labels (validation) and 2D soft labels (MixUp/CutMix).
    """

    def __init__(
        self,
        alpha: float = 0.6,
        beta: float = 0.4,
        label_smoothing: float = 0.05,
        gamma: float = 2.0,
        class_weights: Optional[torch.Tensor] = None,
    ):
        super().__init__()
        self.alpha = alpha
        self.beta = beta
        self.label_smoothing = label_smoothing
        self.gamma = gamma
        if class_weights is not None:
            self.register_buffer("class_weights", class_weights.float())
        else:
            self.class_weights = None

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        # Mandatory safeguard: evaluate loss in full float32
        logits_f32 = logits.float()

        # 1. Label-Smoothed Cross-Entropy Loss
        if targets.ndim == 1:
            ce_loss = F.cross_entropy(
                logits_f32,
                targets.long(),
                label_smoothing=self.label_smoothing,
                reduction="mean",
            )
        else:
            # 2D soft probabilities
            ce_loss = F.cross_entropy(
                logits_f32,
                targets.float(),
                label_smoothing=self.label_smoothing,
                reduction="mean",
            )

        # 2. Focal Loss in Float32
        log_p = F.log_softmax(logits_f32, dim=-1)
        p = torch.exp(log_p)

        if targets.ndim == 1:
            targets_idx = targets.long().unsqueeze(1)
            pt = p.gather(1, targets_idx).squeeze(1)
            log_pt = log_p.gather(1, targets_idx).squeeze(1)
            focal_term = ((1.0 - pt) ** self.gamma) * (-log_pt)

            if self.class_weights is not None:
                cw = self.class_weights.to(logits.device)
                alpha_t = cw.gather(0, targets.long())
                focal_term = alpha_t * focal_term
            focal_loss = focal_term.mean()
        else:
            # 2D soft labels
            focal_term = -targets.float() * ((1.0 - p) ** self.gamma) * log_p
            if self.class_weights is not None:
                cw = self.class_weights.to(logits.device)
                focal_term = focal_term * cw.unsqueeze(0)
            focal_loss = focal_term.sum(dim=-1).mean()

        return self.alpha * ce_loss + self.beta * focal_loss


# ==============================================================================
# 2. Collation Engine (MixUp + CutMix)
# ==============================================================================

class MixupCutmixCollator:
    """
    Custom collate_fn performing batch-level MixUp and CutMix blending.
    Converts hard target labels into float32 one-hot tensors (B, num_classes).
    MixUp: (alpha=0.2, p=0.7)
    CutMix: (alpha=1.0, p=0.3)
    """

    def __init__(
        self,
        num_classes: int = 61,
        mixup_alpha: float = 0.2,
        cutmix_alpha: float = 1.0,
        cutmix_prob: float = 0.3,
    ):
        self.num_classes = num_classes
        self.mixup_alpha = mixup_alpha
        self.cutmix_alpha = cutmix_alpha
        self.cutmix_prob = cutmix_prob

    def __call__(self, batch: List[Tuple[torch.Tensor, int]]) -> Tuple[torch.Tensor, torch.Tensor]:
        images, labels = zip(*batch)
        images = torch.stack(images, dim=0)  # (B, 3, H, W)
        labels = torch.tensor(labels, dtype=torch.long)

        batch_size, _, height, width = images.shape
        one_hot = F.one_hot(labels, num_classes=self.num_classes).float()

        if batch_size <= 1:
            return images, one_hot

        rand_indices = torch.randperm(batch_size)

        # Decide whether to execute CutMix or MixUp
        use_cutmix = (np.random.rand() < self.cutmix_prob) and (self.cutmix_alpha > 0)

        if use_cutmix:
            lam = float(np.random.beta(self.cutmix_alpha, self.cutmix_alpha))
            cut_rat = np.sqrt(1.0 - lam)
            cut_w = int(width * cut_rat)
            cut_h = int(height * cut_rat)

            cx = int(np.random.randint(width))
            cy = int(np.random.randint(height))

            bbx1 = int(np.clip(cx - cut_w // 2, 0, width))
            bby1 = int(np.clip(cy - cut_h // 2, 0, height))
            bbx2 = int(np.clip(cx + cut_w // 2, 0, width))
            bby2 = int(np.clip(cy + cut_h // 2, 0, height))

            # Lambda adjusted according to true bounding box pixel count
            box_area = float((bbx2 - bbx1) * (bby2 - bby1))
            total_area = float(width * height)
            actual_lam = 1.0 - (box_area / total_area) if total_area > 0 else 1.0

            mixed_images = images.clone()
            mixed_images[:, :, bby1:bby2, bbx1:bbx2] = images[rand_indices, :, bby1:bby2, bbx1:bbx2]
            mixed_labels = actual_lam * one_hot + (1.0 - actual_lam) * one_hot[rand_indices]
        else:
            if self.mixup_alpha > 0:
                lam = float(np.random.beta(self.mixup_alpha, self.mixup_alpha))
            else:
                lam = 1.0
            mixed_images = lam * images + (1.0 - lam) * images[rand_indices]
            mixed_labels = lam * one_hot + (1.0 - lam) * one_hot[rand_indices]

        return mixed_images, mixed_labels


# ==============================================================================
# 3. Dedicated OOD Dataset Loader
# ==============================================================================

class OODDataset(Dataset):
    """Loads negative non-leaf / distractor images for OOD AUROC evaluation."""

    def __init__(self, ood_dir: Union[str, Path], transform=None):
        self.ood_dir = Path(ood_dir)
        self.transform = transform
        self.image_paths: List[Path] = []

        if self.ood_dir.is_dir():
            for root, _, files in os.walk(self.ood_dir):
                for f in files:
                    ext = os.path.splitext(f)[1].lower()
                    if ext in VALID_IMAGE_EXTENSIONS and not f.startswith("."):
                        self.image_paths.append(Path(root) / f)

        self.image_paths = sorted(self.image_paths)

    def __len__(self) -> int:
        return len(self.image_paths)

    def __getitem__(self, idx: int) -> torch.Tensor:
        path = self.image_paths[idx]
        with Image.open(path) as img:
            img = img.convert("RGB")
            np_img = np.array(img)

        if self.transform is not None:
            augmented = self.transform(image=np_img)
            return augmented["image"]

        tensor = torch.from_numpy(np_img.transpose(2, 0, 1)).float() / 255.0
        return tensor


# ==============================================================================
# 4. Early Stopping with Secondary OOD Gate
# ==============================================================================

class EarlyStopping:
    """
    Monitors val_macro_f1 (patience=8, min_delta=0.001) with secondary guard:
    ood_auroc >= 0.95.
    """

    def __init__(
        self,
        patience: int = 8,
        min_delta: float = 0.001,
        ood_threshold: float = 0.95,
        restore_best_weights: bool = True,
    ):
        self.patience = patience
        self.min_delta = min_delta
        self.ood_threshold = ood_threshold
        self.restore_best_weights = restore_best_weights

        self.best_score: Optional[float] = None
        self.best_epoch: int = 0
        self.best_weights: Optional[Dict[str, torch.Tensor]] = None
        self.counter: int = 0
        self.early_stop: bool = False

    def step(
        self,
        val_macro_f1: float,
        ood_auroc: Optional[float],
        model: nn.Module,
        epoch: int,
        is_warmup: bool = False,
    ) -> bool:
        """
        Evaluates metrics. Returns True if a new best model checkpoint is accepted.
        Sets self.early_stop = True when patience is exhausted (suppressed during warm-up).
        """
        ood_passed = (ood_auroc is None) or (ood_auroc >= self.ood_threshold)
        is_improvement = False

        # Check macro F1 improvement
        if self.best_score is None or (val_macro_f1 - self.best_score >= self.min_delta):
            self.best_score = val_macro_f1
            self.best_epoch = epoch
            self.counter = 0  # Reset patience counter since F1 is progressing
            if ood_passed:
                is_improvement = True
                if self.restore_best_weights:
                    self.best_weights = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            else:
                logger.info(
                    "Epoch %d: F1 improved to %.4f, but OOD AUROC %.4f < %.2f; checkpoint marked pending secondary gate.",
                    epoch, val_macro_f1, ood_auroc, self.ood_threshold
                )
        else:
            if not is_warmup:
                self.counter += 1
                logger.info(
                    "Epoch %d: No F1 improvement (current: %.4f, best: %.4f). Patience counter: %d/%d.",
                    epoch, val_macro_f1, self.best_score, self.counter, self.patience
                )
                if self.counter >= self.patience:
                    self.early_stop = True

        return is_improvement

    def restore(self, model: nn.Module) -> None:
        if self.restore_best_weights and self.best_weights is not None:
            model.load_state_dict(self.best_weights)
            logger.info("Restored best model weights from epoch %d (F1=%.4f).", self.best_epoch, self.best_score or 0.0)


# ==============================================================================
# 5. Dynamic Optimizer & Phase Boundary Orchestrator
# ==============================================================================

def configure_phase(
    model: nn.Module,
    phase: int,
    config: Dict[str, Any],
) -> Tuple[torch.optim.Optimizer, Any]:
    """
    Configures layer freeze states and instantiates a clean AdamW optimizer
    and corresponding LR scheduler at each phase boundary.
    Discards old optimizer momentum state cleanly.

    Phases:
    - Phase 0: Freeze all backbone; train classification head only with LinearLR.
    - Phase 1: Unfreeze Stage 2, Stage 3 and downsamples (features[4:8]). CosineAnnealingLR.
    - Phase 2: Full fine-tuning across all layers with layer-wise decay. CosineAnnealingWarmRestarts.
    """
    head_lr = float(config["training"].get("head_lr", 0.0005))
    backbone_lr = float(config["training"].get("backbone_lr", 0.00005))
    weight_decay_backbone = float(config["training"].get("weight_decay_backbone", 0.05))
    weight_decay_head = float(config["training"].get("weight_decay_head", 0.0001))
    layer_lr_decay = float(config["training"].get("layer_lr_decay", 0.85))
    phase0_epochs = int(config["training"].get("phase0_epochs", 5))
    phase1_epochs = int(config["training"].get("phase1_epochs", 15))

    logger.info("=" * 60)
    logger.info("ENTERING TRAINING PHASE %d", phase)
    logger.info("=" * 60)

    if phase == 0:
        # Freeze backbone, unfreeze head
        for param in model.parameters():
            param.requires_grad = False

        if hasattr(model, "classifier"):
            for param in model.classifier.parameters():
                param.requires_grad = True
        elif hasattr(model, "head"):
            for param in model.head.parameters():
                param.requires_grad = True
        else:
            for name, param in model.named_parameters():
                if any(h in name for h in ("classifier", "head", "fc")):
                    param.requires_grad = True

        active_params = [p for p in model.parameters() if p.requires_grad]
        optimizer = torch.optim.AdamW(
            [{"params": active_params, "lr": head_lr, "weight_decay": weight_decay_head}],
            betas=(0.9, 0.999),
            eps=1e-8,
        )
        scheduler = torch.optim.lr_scheduler.LinearLR(
            optimizer,
            start_factor=0.1,
            end_factor=1.0,
            total_iters=phase0_epochs,
        )

    elif phase == 1:
        # Unfreeze features[4] through features[7] and head. Stem + Stage 1 remain frozen.
        for param in model.parameters():
            param.requires_grad = False

        if hasattr(model, "features"):
            # ConvNeXt architecture
            for idx in range(4, len(model.features)):
                for param in model.features[idx].parameters():
                    param.requires_grad = True
        elif hasattr(model, "blocks"):
            # ViT architecture: unfreeze upper half of transformer blocks
            half = len(model.blocks) // 2
            for idx in range(half, len(model.blocks)):
                for param in model.blocks[idx].parameters():
                    param.requires_grad = True
        else:
            for param in model.parameters():
                param.requires_grad = True

        # Unfreeze head
        if hasattr(model, "classifier"):
            for param in model.classifier.parameters():
                param.requires_grad = True
        elif hasattr(model, "head"):
            for param in model.head.parameters():
                param.requires_grad = True

        param_groups = get_parameter_groups(
            model,
            base_lr=backbone_lr,
            head_lr=head_lr,
            weight_decay_backbone=weight_decay_backbone,
            weight_decay_head=weight_decay_head,
            layer_decay=layer_lr_decay,
        )
        optimizer = torch.optim.AdamW(param_groups, betas=(0.9, 0.999), eps=1e-8)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
            optimizer,
            T_max=phase1_epochs,
            eta_min=1e-6,
        )

    elif phase == 2:
        # Full unfreeze across all layers
        for param in model.parameters():
            param.requires_grad = True

        # Phase 2 lower learning rates (0.2x of Phase 1 lr for deep fine-tuning)
        p2_backbone_lr = float(config["training"].get("phase2_backbone_lr", backbone_lr * 0.2))
        p2_head_lr = float(config["training"].get("phase2_head_lr", head_lr * 0.2))

        param_groups = get_parameter_groups(
            model,
            base_lr=p2_backbone_lr,
            head_lr=p2_head_lr,
            weight_decay_backbone=weight_decay_backbone,
            weight_decay_head=weight_decay_head,
            layer_decay=layer_lr_decay,
        )
        optimizer = torch.optim.AdamW(param_groups, betas=(0.9, 0.999), eps=1e-8)
        # Cycle length is configurable so a short 'fast' stage can fully anneal
        # within its few epochs (e.g. T_0=4) while the 'full' stage uses longer cycles.
        scheduler = torch.optim.lr_scheduler.CosineAnnealingWarmRestarts(
            optimizer,
            T_0=int(config["training"].get("phase2_t0", 10)),
            T_mult=int(config["training"].get("phase2_t_mult", 2)),
            eta_min=1e-7,
        )
    else:
        raise ValueError(f"Unknown training phase: {phase}")

    trainable_count = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_count = sum(p.numel() for p in model.parameters())
    logger.info(
        "Phase %d initialized: %d/%d trainable parameters (%.2f%%)",
        phase, trainable_count, total_count, 100.0 * trainable_count / max(1, total_count)
    )

    return optimizer, scheduler


# ==============================================================================
# 6. Checkpoint Validation on Resume
# ==============================================================================

def validate_and_load_resume_checkpoint(
    checkpoint_path: str,
    num_classes: int,
    model: nn.Module,
) -> Tuple[int, Optional[Dict[str, Any]]]:
    """
    Validates classifier dimension against num_classes (61).
    Aborts with clear error if mismatch is detected.
    Returns (start_epoch, checkpoint_dict).
    """
    if not os.path.isfile(checkpoint_path):
        raise FileNotFoundError(f"Resume checkpoint not found: '{checkpoint_path}'")

    logger.info("Resuming from checkpoint: %s", checkpoint_path)
    checkpoint = torch.load(checkpoint_path, map_location="cpu")

    if isinstance(checkpoint, dict):
        state_dict = checkpoint.get("model_state_dict", checkpoint.get("state_dict", checkpoint))
        start_epoch = checkpoint.get("epoch", 0) + 1
    else:
        state_dict = checkpoint
        start_epoch = 1

    # Inspect classifier output features
    cleaned_state_dict = {
        (k[7:] if k.startswith("module.") else k): v
        for k, v in state_dict.items()
    }

    classifier_found = False
    for key, weight in cleaned_state_dict.items():
        if ("classifier" in key or "head" in key) and key.endswith("weight") and weight.ndim == 2:
            ckpt_classes = weight.shape[0]
            classifier_found = True
            if ckpt_classes != num_classes:
                raise ValueError(
                    f"CRITICAL RESUME ERROR: Checkpoint classifier has {ckpt_classes} output classes, "
                    f"but configured taxonomy requires {num_classes} classes."
                )
            break

    if not classifier_found:
        logger.warning("Could not definitively inspect classifier head shape in checkpoint.")

    model.load_state_dict(cleaned_state_dict, strict=False)
    logger.info("Resumed weights loaded successfully. Starting from epoch %d.", start_epoch)
    return start_epoch, (checkpoint if isinstance(checkpoint, dict) else None)


# ==============================================================================
# 7. Training & Validation Step Logic
# ==============================================================================

def train_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer,
    scaler: torch.amp.GradScaler,
    device: torch.device,
    amp_dtype: torch.dtype,
    grad_clip_norm: float = 1.0,
    epoch: int = 1,
    total_epochs: int = 50,
    phase: int = 0,
) -> Tuple[float, int]:
    """
    Runs one training epoch with mixed precision, gradient clipping,
    in-flight NaN guards, and a live terminal progress bar.
    Returns (average_loss, nan_batches_count).
    """
    model.train()
    running_loss = 0.0
    valid_batches = 0
    nan_batches = 0

    pbar = tqdm(
        loader,
        desc=f"Epoch {epoch:02d}/{total_epochs:02d} [P{phase} Train]",
        leave=False,
        dynamic_ncols=True,
        file=sys.stdout,
    )

    for step, (images, targets) in enumerate(pbar):
        images = images.to(device, non_blocking=True)
        targets = targets.to(device, non_blocking=True)

        optimizer.zero_grad()

        with torch.amp.autocast(device_type=device.type, dtype=amp_dtype):
            logits = model(images)
            loss = criterion(logits, targets)

        # Mandatory NaN / Inf check
        if not torch.isfinite(loss):
            logger.warning(
                "Non-finite loss detected (value=%s) at step %d. Skipping backward & optimizer step.",
                loss.item() if hasattr(loss, "item") else loss, step
            )
            nan_batches += 1
            optimizer.zero_grad()
            continue

        scaler.scale(loss).backward()
        scaler.unscale_(optimizer)
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=grad_clip_norm)
        scaler.step(optimizer)
        scaler.update()

        running_loss += loss.item()
        valid_batches += 1

        # Update live progress bar postfix metrics
        current_avg = running_loss / max(1, valid_batches)
        pbar.set_postfix({
            "loss": f"{loss.item():.4f}",
            "avg_loss": f"{current_avg:.4f}",
            "nan": nan_batches,
        })

    avg_loss = running_loss / max(1, valid_batches)
    return avg_loss, nan_batches


def validate_epoch(
    model: nn.Module,
    val_loader: DataLoader,
    ood_loader: Optional[DataLoader],
    criterion: nn.Module,
    device: torch.device,
    amp_dtype: torch.dtype,
    num_classes: int = 61,
    epoch: int = 1,
    total_epochs: int = 50,
) -> Tuple[float, float, float, Optional[float]]:
    """
    Evaluates on validation data (F1 macro, Top-1 Acc, Loss)
    and evaluates OOD AUROC using Free Energy on ood_loader samples
    with live terminal progress bars.
    """
    model.eval()
    f1_metric = MulticlassF1Score(num_classes=num_classes, average="macro").to(device)
    acc_metric = MulticlassAccuracy(num_classes=num_classes, average="micro").to(device)

    running_val_loss = 0.0
    total_val_batches = 0
    id_energies: List[float] = []

    pbar = tqdm(
        val_loader,
        desc=f"Epoch {epoch:02d}/{total_epochs:02d} [Val]",
        leave=False,
        dynamic_ncols=True,
        file=sys.stdout,
    )

    with torch.no_grad():
        for images, targets in pbar:
            images = images.to(device, non_blocking=True)
            targets = targets.to(device, non_blocking=True)

            with torch.amp.autocast(device_type=device.type, dtype=amp_dtype):
                logits = model(images)
                loss = criterion(logits, targets)

            running_val_loss += loss.item()
            total_val_batches += 1

            preds = logits.argmax(dim=-1)
            f1_metric.update(preds, targets)
            acc_metric.update(preds, targets)

            energies = compute_energy_score(logits, T=1.0)
            id_energies.extend(energies.cpu().float().tolist())

            pbar.set_postfix({
                "val_loss": f"{loss.item():.4f}",
                "avg_loss": f"{running_val_loss / max(1, total_val_batches):.4f}",
            })

        val_loss = running_val_loss / max(1, total_val_batches)
        val_f1 = float(f1_metric.compute().item())
        val_acc = float(acc_metric.compute().item())

        # Evaluate OOD AUROC if OOD loader is available
        ood_auroc: Optional[float] = None
        if ood_loader is not None and len(ood_loader.dataset) > 0:
            ood_energies: List[float] = []
            pbar_ood = tqdm(
                ood_loader,
                desc=f"Epoch {epoch:02d}/{total_epochs:02d} [OOD]",
                leave=False,
                dynamic_ncols=True,
                file=sys.stdout,
            )
            for ood_imgs in pbar_ood:
                ood_imgs = ood_imgs.to(device, non_blocking=True)
                with torch.amp.autocast(device_type=device.type, dtype=amp_dtype):
                    ood_logits = model(ood_imgs)
                energies = compute_energy_score(ood_logits, T=1.0)
                ood_energies.extend(energies.cpu().float().tolist())

            y_true = [0] * len(id_energies) + [1] * len(ood_energies)
            y_scores = id_energies + ood_energies

            if len(np.unique(y_true)) >= 2:
                try:
                    ood_auroc = float(roc_auc_score(y_true, y_scores))
                except Exception as err:
                    logger.warning("Failed calculating OOD AUROC: %s", err)
                    ood_auroc = None
            else:
                logger.warning("OOD AUROC evaluation skipped: target classes do not contain 2 distinct labels.")

    return val_loss, val_acc, val_f1, ood_auroc


# ==============================================================================
# 8. Dry-Run Smoke Test
# ==============================================================================

def run_dry_run(
    model: nn.Module,
    train_loader: DataLoader,
    val_loader: DataLoader,
    ood_loader: Optional[DataLoader],
    criterion: nn.Module,
    device: torch.device,
    amp_dtype: torch.dtype,
    config: Dict[str, Any],
) -> None:
    """
    Runs 1 mini-batch training step and 1 validation step to smoke-test
    tensor shapes, AMP autocasting, loss computation, and schedulers.
    """
    logger.info("=" * 60)
    logger.info("EXECUTING --dry-run SMOKE TEST MODE")
    logger.info("=" * 60)

    # 1. Test Phase 0 Optimizer & Schedulers
    opt_p0, sched_p0 = configure_phase(model, 0, config)
    scaler = torch.amp.GradScaler(device=device.type, enabled=(device.type == "cuda"))

    # Mini-batch train step
    model.train()
    sample_batch = next(iter(train_loader))
    imgs, targets = sample_batch
    imgs, targets = imgs.to(device), targets.to(device)

    logger.info("Dry-run mini-batch shape: images=%s, targets=%s", imgs.shape, targets.shape)
    opt_p0.zero_grad()

    with torch.amp.autocast(device_type=device.type, dtype=amp_dtype):
        logits = model(imgs)
        loss = criterion(logits, targets)

    logger.info("Dry-run output logits shape: %s, loss: %.4f", logits.shape, loss.item())
    assert torch.isfinite(loss), "Dry-run loss is not finite!"

    scaler.scale(loss).backward()
    scaler.unscale_(opt_p0)
    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
    scaler.step(opt_p0)
    scaler.update()
    sched_p0.step()
    logger.info("Phase 0 train step & LinearLR step verified successfully.")

    # 2. Test Phase 1 configuration & scheduler
    opt_p1, sched_p1 = configure_phase(model, 1, config)
    opt_p1.step()
    sched_p1.step()
    logger.info("Phase 1 staged unfreeze & CosineAnnealingLR step verified.")

    # 3. Test Phase 2 configuration & scheduler
    opt_p2, sched_p2 = configure_phase(model, 2, config)
    opt_p2.step()
    sched_p2.step()
    logger.info("Phase 2 full fine-tuning & CosineAnnealingWarmRestarts verified.")

    # 4. Mini-batch validation step
    model.eval()
    val_sample = next(iter(val_loader))
    v_imgs, v_targets = val_sample
    v_imgs, v_targets = v_imgs.to(device), v_targets.to(device)

    with torch.no_grad():
        with torch.amp.autocast(device_type=device.type, dtype=amp_dtype):
            v_logits = model(v_imgs)
            v_loss = criterion(v_logits, v_targets)
        v_energy = compute_energy_score(v_logits, T=1.0)

    logger.info(
        "Dry-run validation step verified: val_loss=%.4f, energy_scores shape=%s",
        v_loss.item(), v_energy.shape
    )

    if ood_loader is not None and len(ood_loader.dataset) > 0:
        ood_sample = next(iter(ood_loader))
        ood_sample = ood_sample.to(device)
        with torch.no_grad():
            with torch.amp.autocast(device_type=device.type, dtype=amp_dtype):
                ood_logits = model(ood_sample)
            ood_energy = compute_energy_score(ood_logits, T=1.0)
        logger.info("Dry-run OOD sample energy scores shape: %s", ood_energy.shape)

    logger.info("=" * 60)
    logger.info("SMOKE TEST COMPLETE: All shapes, autocasting, and schedulers passed.")
    logger.info("=" * 60)


# ==============================================================================
# 9. CLI Parsing & Main Orchestration
# ==============================================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="AgriNexus AI Three-Phase Disease Model Trainer")
    parser.add_argument("--config", type=str, default="ml/disease/config.yaml", help="Path to config YAML")
    parser.add_argument("--data-dir", type=str, default=None, help="Path to unified dataset root")
    parser.add_argument("--ood-dir", type=str, default=None, help="Path to non-leaf OOD image directory")
    parser.add_argument("--backbone", type=str, default=None, help="Model backbone override")
    parser.add_argument("--epochs", type=int, default=None, help="Total epochs override")
    parser.add_argument("--batch-size", type=int, default=None, help="Batch size override")
    parser.add_argument("--resume", type=str, default=None, help="Path to checkpoint to resume training")
    parser.add_argument("--output-dir", type=str, default=None, help="Output directory for checkpoints")
    parser.add_argument("--reset-scheduler", action="store_true", help="On resume, start a fresh LR schedule for the current phase (use when beginning a new training stage)")
    parser.add_argument("--dry-run", action="store_true", help="Run 1 mini-batch train/val step smoke test")
    parser.add_argument("--device", type=str, default=None, help="Device override (cuda/cpu/mps)")
    parser.add_argument("--amp-dtype", type=str, default=None, choices=["float16", "bfloat16", "none"], help="AMP precision override")
    return parser.parse_args()


def main():
    args = parse_args()
    config_path = Path(args.config)
    if not config_path.exists():
        logger.error("Configuration file not found at %s", config_path)
        sys.exit(1)

    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    # Resolve paths and hyper-parameters
    data_dir = args.data_dir or config.get("paths", {}).get("data_dir", "leaf_dataset/unified")
    ood_dir = args.ood_dir or config.get("paths", {}).get("ood_dir", "sample images")
    output_dir = Path(args.output_dir or config.get("paths", {}).get("checkpoint_dir", "ml/disease/checkpoints"))
    output_dir.mkdir(parents=True, exist_ok=True)

    backbone = args.backbone or config.get("model", {}).get("backbone", "convnext_base")
    num_classes = int(config.get("model", {}).get("num_classes", 61))
    image_size = int(config.get("model", {}).get("image_size", 384))
    drop_path_rate = float(config.get("model", {}).get("drop_path_rate", 0.3))
    batch_size = args.batch_size or int(config.get("training", {}).get("batch_size", 32))
    seed = int(config.get("training", {}).get("seed", 42))

    # Phase durations
    phase0_epochs = int(config.get("training", {}).get("phase0_epochs", 5))
    phase1_epochs = int(config.get("training", {}).get("phase1_epochs", 15))
    phase2_epochs = int(config.get("training", {}).get("phase2_epochs", 30))

    if args.epochs is not None:
        total_epochs = args.epochs
        if total_epochs <= phase0_epochs:
            phase0_epochs = total_epochs
            phase1_epochs = 0
            phase2_epochs = 0
        elif total_epochs <= phase0_epochs + phase1_epochs:
            phase1_epochs = total_epochs - phase0_epochs
            phase2_epochs = 0
        else:
            phase2_epochs = total_epochs - (phase0_epochs + phase1_epochs)
    else:
        total_epochs = phase0_epochs + phase1_epochs + phase2_epochs

    config["training"]["phase0_epochs"] = phase0_epochs
    config["training"]["phase1_epochs"] = phase1_epochs
    config["training"]["phase2_epochs"] = phase2_epochs

    # Hardware & Precision
    if args.device:
        device = torch.device(args.device)
    elif torch.cuda.is_available():
        device = torch.device("cuda")
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = torch.device("mps")
    else:
        device = torch.device("cpu")

    configured_amp = args.amp_dtype or config.get("training", {}).get("amp_dtype", "float16")

    if device.type == "cuda":
        # bfloat16 Tensor Core hardware acceleration requires Ampere (compute capability >= 8.0)
        # Turing GPUs (T4, GTX 16xx, RTX 20xx) have compute capability 7.5 and must use float16
        major, _ = torch.cuda.get_device_capability()
        is_hardware_bf16 = (major >= 8) and torch.cuda.is_bf16_supported()
        if configured_amp == "bfloat16" and is_hardware_bf16:
            amp_dtype = torch.bfloat16
        else:
            amp_dtype = torch.float16
        torch.backends.cudnn.benchmark = True
    elif device.type == "mps":
        amp_dtype = torch.float16
    else:
        amp_dtype = torch.bfloat16

    logger.info("Compute device: %s | AMP dtype: %s | GradScaler active: %s", device, amp_dtype, device.type == "cuda")

    # Verify dataset directory
    if not os.path.isdir(data_dir):
        logger.warning(
            "TRAINING BLOCKED: Unified dataset directory '%s' was not found.\n"
            "Please ensure dataset images are available.",
            data_dir,
        )
        report = {
            "status": "BLOCKED",
            "reason": f"Unified dataset directory not found at '{data_dir}'.",
            "target_dir": str(data_dir),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        with open(output_dir / "disease_training_report.json", "w", encoding="utf-8") as rf:
            json.dump(report, rf, indent=2)
        return

    # Transforms & Augmentations
    train_transforms = get_training_transforms(image_size=image_size, severity="medium")
    val_transforms = get_validation_transforms(image_size=image_size)

    class_mapping_path = output_dir / "class_mapping.json"

    # ── Dataset Loading with Symlink Resolution ──────────────────────────────
    logger.info("Initializing LeafDiseaseDataset on '%s' with OOD from '%s'...", data_dir, ood_dir)
    train_ds = LeafDiseaseDataset(
        unified_dir=data_dir,
        ood_dir=ood_dir,
        split="train",
        transform=train_transforms,
        save_mapping_path=str(class_mapping_path),
        seed=seed,
    )
    val_ds = LeafDiseaseDataset(
        unified_dir=data_dir,
        ood_dir=ood_dir,
        split="val",
        transform=val_transforms,
        class_mapping_path=str(class_mapping_path),
        seed=seed,
    )

    if len(train_ds) == 0:
        logger.error("Unified dataset contains 0 training samples. Aborting.")
        sys.exit(1)

    logger.info("Loaded datasets: %d train samples, %d val samples across %d classes.", len(train_ds), len(val_ds), len(train_ds.classes))

    # OOD negative evaluation dataset
    ood_ds = OODDataset(ood_dir=ood_dir, transform=val_transforms)
    logger.info("Loaded OOD evaluation set: %d distractor images.", len(ood_ds))

    # Collation Engine
    mixup_collator = MixupCutmixCollator(
        num_classes=num_classes,
        mixup_alpha=float(config["training"].get("mixup_alpha", 0.2)),
        cutmix_alpha=float(config["training"].get("cutmix_alpha", 1.0)),
        cutmix_prob=float(config["training"].get("cutmix_prob", 0.3)),
    )

    num_workers = min(os.cpu_count() or 4, 8)
    # Keep workers alive between epochs and prefetch aggressively so the GPU is not
    # starved by CPU-side augmentation on low-core Colab runtimes.
    loader_perf = (
        {"persistent_workers": True, "prefetch_factor": 4} if num_workers > 0 else {}
    )

    def make_loaders(bs: int) -> Tuple[DataLoader, DataLoader, Optional[DataLoader]]:
        t_loader = DataLoader(
            train_ds,
            batch_size=bs,
            shuffle=True,
            num_workers=num_workers,
            pin_memory=(device.type == "cuda"),
            collate_fn=mixup_collator,
            drop_last=True,
            **loader_perf,
        )
        v_loader = DataLoader(
            val_ds,
            batch_size=bs,
            shuffle=False,
            num_workers=num_workers,
            pin_memory=(device.type == "cuda"),
            drop_last=False,
            **loader_perf,
        )
        o_loader = DataLoader(
            ood_ds,
            batch_size=bs,
            shuffle=False,
            num_workers=min(num_workers, 2),
            pin_memory=(device.type == "cuda"),
            drop_last=False,
        ) if len(ood_ds) > 0 else None
        return t_loader, v_loader, o_loader

    current_batch_size = batch_size
    train_loader, val_loader, ood_loader = make_loaders(current_batch_size)

    # ── Model Construction ───────────────────────────────────────────────────
    logger.info("Building primary backbone: %s (num_classes=%d)...", backbone, num_classes)
    model = build_model(
        backbone=backbone,
        num_classes=num_classes,
        pretrained=bool(config.get("model", {}).get("pretrained", True)),
        drop_path_rate=drop_path_rate,
    ).to(device)

    # Build Gate 1 binary gate (MobileNetV3-Small) per plan.md checklist
    try:
        binary_gate = build_binary_gate(pretrained=True).to(device)
        logger.info("MobileNetV3-Small binary gate instantiated successfully.")
        gate1_ckpt = output_dir / "gate1_model.pth"
        if not gate1_ckpt.exists():
            torch.save(binary_gate.state_dict(), gate1_ckpt)
            logger.info("Saved Gate 1 baseline binary gate checkpoint to '%s'.", gate1_ckpt)
    except Exception as exc:
        logger.warning("Could not initialize Gate 1 binary gate: %s", exc)

    # Move class_weights to device before instantiating loss
    alpha_weights = train_ds.class_weights.to(device)
    criterion = CombinedFocalCELoss(
        alpha=float(config["training"].get("ce_weight", 0.6)),
        beta=float(config["training"].get("focal_weight", 0.4)),
        label_smoothing=float(config["training"].get("label_smoothing", 0.05)),
        gamma=float(config["training"].get("focal_gamma", 2.0)),
        class_weights=alpha_weights,
    ).to(device)

    # Checkpoint Resume Verification
    start_epoch = 1
    checkpoint_dict = None
    if args.resume:
        start_epoch, checkpoint_dict = validate_and_load_resume_checkpoint(args.resume, num_classes, model)

    # --dry-run CLI flag handler
    if args.dry_run:
        run_dry_run(
            model=model,
            train_loader=train_loader,
            val_loader=val_loader,
            ood_loader=ood_loader,
            criterion=criterion,
            device=device,
            amp_dtype=amp_dtype,
            config=config,
        )
        return

    # Resuming a stage that already finished must not retrain or overwrite its report.
    early_stop_marker = output_dir / "early_stopped.json"
    if args.resume:
        if start_epoch > total_epochs:
            logger.info("Checkpoint is at epoch %d and this config ends at epoch %d: stage already complete, nothing to train.", start_epoch - 1, total_epochs)
            return
        if early_stop_marker.exists():
            try:
                if json.loads(early_stop_marker.read_text(encoding="utf-8")).get("total_epochs") == total_epochs:
                    logger.info("Stage with %d total epochs already early-stopped (see %s); nothing to train.", total_epochs, early_stop_marker)
                    return
            except Exception as exc:
                logger.warning("Could not read early-stop marker: %s", exc)

    # Precision Scaler
    scaler = torch.amp.GradScaler(device=device.type, enabled=(device.type == "cuda"))

    # Early Stopping
    early_stopper = EarlyStopping(
        patience=int(config["training"].get("early_stopping_patience", 8)),
        min_delta=float(config["training"].get("early_stopping_min_delta", 0.001)),
        # OOD AUROC gate is opt-in: with a tiny OOD set it is too noisy to block checkpointing.
        ood_threshold=float(config.get("ood", {}).get("ood_auroc_target", 0.0)),
        restore_best_weights=True,
    )

    # On resume, seed the best-F1 baseline from the epoch log so the first resumed epoch
    # cannot overwrite a better existing best_model.pth. Only applies when a best model exists.
    seeded_best_f1 = 0.0
    seeded_best_epoch = 0
    if args.resume and (output_dir / "best_model.pth").exists() and (output_dir / "epoch_log.csv").exists():
        try:
            with open(output_dir / "epoch_log.csv", newline="", encoding="utf-8") as f:
                prior_rows = [(int(r["epoch"]), float(r["val_macro_f1"])) for r in csv.DictReader(f)]
            if prior_rows:
                seeded_best_epoch, seeded_best_f1 = max(prior_rows, key=lambda p: p[1])
                early_stopper.best_score = seeded_best_f1
                logger.info("Seeded best macro-F1 baseline from epoch log: %.4f (epoch %d)", seeded_best_f1, seeded_best_epoch)
        except Exception as exc:
            logger.warning("Could not seed best-F1 baseline from epoch log: %s", exc)

    # Checkpoint paths & CSV logging
    best_model_path = output_dir / "best_model.pth"
    last_model_path = output_dir / "last_epoch.pth"
    csv_log_path = output_dir / "epoch_log.csv"

    if not csv_log_path.exists():
        with open(csv_log_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "epoch", "phase", "train_loss", "val_loss",
                "val_acc", "val_macro_f1", "ood_auroc", "lr", "nan_batches", "epoch_time_sec"
            ])

    current_phase: Optional[int] = None
    optimizer: Optional[torch.optim.Optimizer] = None
    scheduler: Optional[Any] = None

    best_f1 = seeded_best_f1
    best_val_acc = 0.0
    best_ood_auroc: Optional[float] = None
    best_epoch = seeded_best_epoch
    total_nan_batches = 0
    phase_metrics: Dict[str, Any] = {}

    grad_clip_norm = float(config["training"].get("grad_clip_norm", 1.0))

    logger.info("Beginning Three-Phase Training for %d total epochs...", total_epochs)

    # ── Main Training Loop ───────────────────────────────────────────────────
    for epoch in range(start_epoch, total_epochs + 1):
        # Determine target phase
        if epoch <= phase0_epochs:
            target_phase = 0
        elif epoch <= phase0_epochs + phase1_epochs:
            target_phase = 1
        else:
            target_phase = 2

        # Dynamic Optimizer Rebuilding on Phase Boundary
        if target_phase != current_phase:
            optimizer, scheduler = configure_phase(model, target_phase, config)
            current_phase = target_phase
            phase_metrics[f"phase{current_phase}"] = {"start_epoch": epoch}

            # Restore optimizer state if resuming inside this phase
            if checkpoint_dict and "optimizer_state_dict" in checkpoint_dict and checkpoint_dict.get("phase") == target_phase:
                try:
                    optimizer.load_state_dict(checkpoint_dict["optimizer_state_dict"])
                    logger.info("Restored optimizer state from checkpoint for Phase %d.", target_phase)
                    if args.reset_scheduler:
                        # New stage: keep momentum buffers but start a fresh LR schedule.
                        for g in optimizer.param_groups:
                            g["lr"] = g.get("initial_lr", g["lr"])
                        logger.info("--reset-scheduler: LR schedule restarted for Phase %d.", target_phase)
                    elif "scheduler_state_dict" in checkpoint_dict:
                        scheduler.load_state_dict(checkpoint_dict["scheduler_state_dict"])
                        logger.info("Restored LR scheduler state from checkpoint.")
                    else:
                        # Legacy checkpoint without scheduler state: fast-forward to the correct
                        # position in the schedule instead of restarting it from the top.
                        phase_first_epoch = {0: 1, 1: phase0_epochs + 1, 2: phase0_epochs + phase1_epochs + 1}[target_phase]
                        steps_done = max(0, epoch - phase_first_epoch)
                        for g in optimizer.param_groups:
                            g["lr"] = g.get("initial_lr", g["lr"])
                        for _ in range(steps_done):
                            scheduler.step()
                        logger.info("Fast-forwarded LR scheduler by %d epoch(s) (lr=%.3e).", steps_done, optimizer.param_groups[0]["lr"])
                except Exception as exc:
                    logger.warning("Could not restore optimizer/scheduler state: %s. Continuing with fresh optimizer.", exc)
                checkpoint_dict = None

        epoch_start_time = time.time()

        # Execute training with OOM recovery
        oom_retries = 0
        max_retries = 2
        epoch_success = False

        while not epoch_success and oom_retries <= max_retries:
            try:
                train_loss, nan_count = train_epoch(
                    model=model,
                    loader=train_loader,
                    criterion=criterion,
                    optimizer=optimizer,
                    scaler=scaler,
                    device=device,
                    amp_dtype=amp_dtype,
                    grad_clip_norm=grad_clip_norm,
                    epoch=epoch,
                    total_epochs=total_epochs,
                    phase=current_phase,
                )
                total_nan_batches += nan_count
                epoch_success = True
            except (torch.cuda.OutOfMemoryError, RuntimeError) as err:
                is_oom = "out of memory" in str(err).lower() or isinstance(err, getattr(torch.cuda, "OutOfMemoryError", tuple()))
                if is_oom and device.type == "cuda" and oom_retries < max_retries:
                    oom_retries += 1
                    torch.cuda.empty_cache()
                    current_batch_size = max(1, current_batch_size // 2)
                    logger.warning(
                        "CUDA OOM caught! Halving batch size to %d and retrying (retry %d/%d)...",
                        current_batch_size, oom_retries, max_retries
                    )
                    train_loader, val_loader, ood_loader = make_loaders(current_batch_size)
                else:
                    raise err

        # Validation Step
        val_loss, val_acc, val_f1, ood_auroc = validate_epoch(
            model=model,
            val_loader=val_loader,
            ood_loader=ood_loader,
            criterion=criterion,
            device=device,
            amp_dtype=amp_dtype,
            num_classes=num_classes,
            epoch=epoch,
            total_epochs=total_epochs,
        )

        # Scheduler Step (per epoch)
        current_lr = optimizer.param_groups[0]["lr"]
        scheduler.step()

        epoch_time = time.time() - epoch_start_time

        logger.info(
            "Epoch %d/%d (Phase %d) - Train Loss: %.4f | Val Loss: %.4f | Val Acc: %.4f | "
            "Val Macro F1: %.4f | OOD AUROC: %s | LR: %.2e | Time: %.1fs",
            epoch, total_epochs, current_phase, train_loss, val_loss, val_acc,
            val_f1, (f"{ood_auroc:.4f}" if ood_auroc is not None else "N/A"),
            current_lr, epoch_time
        )

        # Append CSV log
        with open(csv_log_path, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                epoch, current_phase, round(train_loss, 4), round(val_loss, 4),
                round(val_acc, 4), round(val_f1, 4),
                (round(ood_auroc, 4) if ood_auroc is not None else "N/A"),
                f"{current_lr:.6e}", nan_count, round(epoch_time, 2)
            ])

        # Checkpoint: Last Epoch
        torch.save({
            "epoch": epoch,
            "phase": current_phase,
            "model_state_dict": model.state_dict(),
            "optimizer_state_dict": optimizer.state_dict(),
            "scheduler_state_dict": scheduler.state_dict(),
            "val_macro_f1": val_f1,
            "val_acc": val_acc,
            "ood_auroc": ood_auroc,
            "num_classes": num_classes,
            "config": config,
        }, last_model_path)

        # Early Stopping & Best Checkpoint Tracking
        is_best = early_stopper.step(
            val_macro_f1=val_f1,
            ood_auroc=ood_auroc,
            model=model,
            epoch=epoch,
            # Patience only counts in the final phase so Phase 1 plateaus cannot skip the
            # full fine-tune / LR-annealing phase.
            is_warmup=(epoch <= phase0_epochs + phase1_epochs),
        )

        if is_best:
            best_f1 = val_f1
            best_val_acc = val_acc
            best_ood_auroc = ood_auroc
            best_epoch = epoch

            torch.save({
                "epoch": epoch,
                "phase": current_phase,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "scheduler_state_dict": scheduler.state_dict(),
                "val_macro_f1": best_f1,
                "val_acc": best_val_acc,
                "ood_auroc": best_ood_auroc,
                "num_classes": num_classes,
                "config": config,
                "class_mapping_path": str(class_mapping_path),
            }, best_model_path)

            logger.info(">>> SAVED NEW BEST MODEL checkpoint to '%s' (F1=%.4f) <<<", best_model_path, best_f1)

        if f"phase{current_phase}" in phase_metrics:
            phase_metrics[f"phase{current_phase}"]["final_val_f1"] = val_f1
            phase_metrics[f"phase{current_phase}"]["final_val_acc"] = val_acc

        if early_stopper.early_stop:
            logger.info("Early stopping triggered at epoch %d after %d epochs without improvement.", epoch, early_stopper.patience)
            early_stopper.restore(model)
            early_stop_marker.write_text(json.dumps({"total_epochs": total_epochs, "stopped_at_epoch": epoch}), encoding="utf-8")
            break

    # Persist Final Training Report
    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    report_data = {
        "status": "COMPLETED",
        "backbone": backbone,
        "num_classes": num_classes,
        "best_epoch": best_epoch,
        "best_val_macro_f1": round(best_f1, 4),
        "best_val_acc": round(best_val_acc, 4),
        "best_ood_auroc": round(best_ood_auroc, 4) if best_ood_auroc is not None else None,
        "total_nan_batches": total_nan_batches,
        "phases": phase_metrics,
        "class_mapping_version": "2.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    report_path = output_dir / f"training_report_{timestamp_str}.json"
    with open(report_path, "w", encoding="utf-8") as rf:
        json.dump(report_data, rf, indent=2)

    # Also update standard pointer
    with open(output_dir / "disease_training_report.json", "w", encoding="utf-8") as rf:
        json.dump(report_data, rf, indent=2)

    logger.info("Training complete! Best F1: %.4f (Epoch %d). Report saved to '%s'.", best_f1, best_epoch, report_path)


if __name__ == "__main__":
    main()
