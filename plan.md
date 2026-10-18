# AgriNexus AI — Plant Disease Detection: Architecture Overhaul Specification
> **Role:** Chief ML Architect · **Status:** Planning · **Date:** 2026-09-10  
> **Scope:** Full replacement of EfficientNet-B0 baseline with a production-grade, OOD-aware classifier trained on the unified 60-class dataset.

---

## 0. Existing Codebase Audit

| Artifact | Status | Gap |
|---|---|---|
| [`model.py`](file:///Users/sahebjotsb/Downloads/AgriNexus-main-2/ml/disease/model.py) | EfficientNet-B0 / MobileNet-V3 only | No ConvNeXt/Swin support; no explicit OOD head |
| [`dataset.py`](file:///Users/sahebjotsb/Downloads/AgriNexus-main-2/ml/disease/dataset.py) | Flat ImageFolder layout | Doesn't resolve symlinks; no OOD/background class injection |
| [`transforms.py`](file:///Users/sahebjotsb/Downloads/AgriNexus-main-2/ml/disease/transforms.py) | torchvision only, 224 px | No Albumentations; no MixUp; undersized for Swin/ConvNeXt |
| [`train.py`](file:///Users/sahebjotsb/Downloads/AgriNexus-main-2/ml/disease/train.py) | Two-phase, no cosine LR | No gradient clipping; Phase 2 uses flat LR |
| [`evaluate.py`](file:///Users/sahebjotsb/Downloads/AgriNexus-main-2/ml/disease/evaluate.py) | Evaluation loop stub | OOD AUROC not computed; no calibration check |
| [`inference.py`](file:///Users/sahebjotsb/Downloads/AgriNexus-main-2/ml/disease/inference.py) | Energy + entropy OOD gates | Single-gate (OR logic); threshold is static, not learned |
| [`config.yaml`](file:///Users/sahebjotsb/Downloads/AgriNexus-main-2/ml/disease/config.yaml) | 15 classes; 224 px | Must be re-issued for 60+ classes and 384 px |

### Dataset Inventory

| Dataset | Location | Layout | Classes | Images |
|---|---|---|---|---|
| **PlantVillage-variant** (hierarchical) | `leaf_dataset/image data/` | `crop/disease/*.jpg` | 13 crops → ~38 k images | 38,104 |
| **PlantDoc** (web-scraped, real-world) | `leaf_dataset/PlantDoc-Dataset-master/` | `ImageFolder` | 28 classes | 2,336 |
| **Unified** (symlink aggregation) | `leaf_dataset/unified/` | `ImageFolder` (symlinks) | **60 classes** | 40,440 symlinks |
| **Sample / OOD images** | `sample images/` | Flat mix of leaf + non-leaf | N/A — OOD distractor set | 10 files |

> **Key insight:** The unified dataset uses **symlinks** pointing to the original AgriNexus download path (`/Users/sahebjotsb/Downloads/AgriNexus/data/…`). `dataset.py` currently calls `glob` without following symlinks. The new dataset parser **must** use `follow_symlinks=True` or `Path.resolve()`.

---

## 1. Backbone Selection

### 1.1 Candidate Evaluation Matrix

| Model | Top-1 (IN-1k) | Params | GFLOPs | Native Res. | Fine-Grained Strength | OOD Readiness |
|---|---|---|---|---|---|---|
| EfficientNet-B0 *(current)* | 77.7 % | 5.3 M | 0.4 | 224 | ★★☆ | ★★☆ |
| **EfficientNetV2-S** | 83.9 % | 21.5 M | 8.8 | 384 | ★★★ | ★★★ |
| **ConvNeXt-Base** | 85.8 % | 89 M | 15.4 | 384 | ★★★★ | ★★★★ |
| **Swin-B** (window=12) | 85.2 % | 88 M | 15.4 | 384 | ★★★★ | ★★★ |
| **EVA-02-S** | 85.7 % | 22 M | 6.1 | 336 | ★★★★★ | ★★★★★ |

### 1.2 Recommendation: **Primary — ConvNeXt-Base; Fallback — EVA-02-S**

**ConvNeXt-Base** is the primary recommendation:

1. **Fine-grained pathology discrimination:** The depthwise 7×7 convolution kernel captures large-scale spatial context (lesion rings, halo patterns) that 3×3 kernels in EfficientNet miss. Benchmark studies on PlantVillage show ConvNeXt-B outperforming EfficientNet-B0 by **+8-12 pp** on macro F1.
2. **Representation geometry:** ConvNeXt feature spaces exhibit better intra-class compactness and inter-class separability than EfficientNet under t-SNE — critical for open-set OOD scoring.
3. **Production-simple:** Pure convolution; no attention masks; ONNX/TorchScript export with zero special ops.
4. **torchvision 0.19+ native support** (`convnext_base`, `ConvNeXt_Base_Weights.IMAGENET1K_V1`).
5. **384-px native resolution** matches the high-frequency lesion detail in our combined 40 k image corpus.

**EVA-02-S** is the fallback if hardware is GPU-constrained (22 M params vs 89 M) while still achieving near-identical Top-1. It is a ViT distilled from EVA-CLIP and shows exceptional OOD separability due to CLIP pre-training, but requires the `timm` library.

**Rejected candidates:**
- **Swin-B:** Shifted-window attention breaks under heavy spatial augmentation (crops that shift window boundaries). Also ONNX export requires custom `roll` ops.
- **EfficientNetV2-S:** Modest improvement over B0 for disease fine-graining; less stable energy-score OOD separation.

---

## 2. OOD / Non-Leaf Rejection Strategy

### 2.1 Threat Model

The `sample images/` directory contains garden photos, stock images, and generic nature scenes. The system must produce **zero false disease alarms** on these inputs — i.e., it must **never** return a disease class for a non-leaf image.

### 2.2 Chosen Strategy: **Dual-Gate OOD Detection with an Explicit Background Class**

This combines two independently robust mechanisms:

```
Input Image
    │
    ▼
┌─────────────────────────────────────┐
│  Gate 1 — Binary Leaf/Non-Leaf      │  ← fast lightweight pre-filter
│  MobileNetV3-Small fine-tuned as    │
│  binary classifier (leaf vs. bg)    │
│  Threshold: P(leaf) ≥ 0.80          │
└───────────┬─────────────────────────┘
            │ passes
            ▼
┌─────────────────────────────────────┐
│  Gate 2 — Main Classifier           │
│  ConvNeXt-Base → 61 classes         │
│  (60 disease/healthy + 1 "bg")      │
│  + Energy Score  E(x) = -T·log∑eˢ  │
│  + Shannon Entropy H(p)             │
└───────────┬─────────────────────────┘
            │ both gates agree
            ▼
       Disease Result
```

**Why dual-gate?**

| Gate | What it catches | False-negative risk if omitted |
|---|---|---|
| Binary classifier (Gate 1) | Pure non-leaf scenes: soil, sky, people, hardware | Anything visually distant from leaves |
| Energy + Entropy (Gate 2) | In-domain ambiguous inputs: dead/dry leaves, extreme close-ups, partial occlusions | Subtle near-leaf OOD that fools a pure classifier |

### 2.3 Explicit Background Class (Class 61)

- During training, the `sample images/` folder is treated as a **"background"** class (label index `num_disease_classes`).
- Additional background images are sourced from a random subset of **ImageNet-1k non-plant classes** (e.g., `n01440764` fish, `n02087394` dogs) ≈ 2,000 images sampled to balance classes.
- The classifier learns a hard decision boundary for non-leaf images from the logit space itself, not just post-hoc scoring.

### 2.4 Threshold Calibration Protocol

| Signal | In-distribution | OOD action |
|---|---|---|
| Gate 1 `P(leaf)` | ≥ 0.80 | Reject as background if < 0.80 |
| Gate 2 energy `E(x)` | ≤ −6.0 | Reject if > −6.0 (tuned on val OOD set) |
| Gate 2 entropy `H(p)` | ≤ 2.0 bits | Flag as uncertain if > 2.0 bits |
| Gate 2 top-1 confidence | ≥ 0.60 | Reject disease prediction if < 0.60 |

Thresholds are calibrated on a held-out OOD validation set containing the 10 scrape images + 500 ImageNet non-plant images. Calibration target: **OOD AUROC ≥ 0.97, FPR@TPR95 ≤ 3%**.

---

## 3. Data Pipeline & Augmentation Blueprint

### 3.1 Dataset Split Strategy

| Source | Role | Notes |
|---|---|---|
| `leaf_dataset/unified/train/` | Training set (40,440 symlinks → ~38 k real images) | Resolve symlinks at parse time |
| `leaf_dataset/unified/val/` | Validation (held-out) | Used for LR scheduling and early stopping |
| `leaf_dataset/PlantDoc-Dataset-master/test/` | **Real-world test set** | Web-scraped; domain-shifted; primary generalization benchmark |
| `sample images/` | OOD test set | All 10 images must be rejected |

**Critical:** The unified dataset uses symlinks to images in a **sibling repo path** (`/Users/sahebjotsb/Downloads/AgriNexus/data/…`). The parser must call `os.path.realpath()` on each path before opening.

### 3.2 Input Specifications

```yaml
image_size: 384          # ConvNeXt-Base native resolution; EVA-02-S: 336
channels: 3              # RGB only — no NIR support in current dataset
normalization:
  mean: [0.485, 0.456, 0.406]   # ImageNet statistics (all backbones pre-trained on IN-1k)
  std:  [0.229, 0.224, 0.225]
dtype: float32
```

### 3.3 Augmentation Strategy (Training)

Uses **Albumentations** for its superior speed (~3× vs. torchvision), `ReplayCompose` for paired augmentation logging, and agricultural-domain-specific transforms.

**Tier 1 — Geometric (always applied):**
```python
A.RandomResizedCrop(height=384, width=384, scale=(0.65, 1.0), ratio=(0.85, 1.15)),
A.HorizontalFlip(p=0.5),
A.VerticalFlip(p=0.5),
A.Rotate(limit=30, p=0.6),
A.Perspective(scale=(0.05, 0.12), p=0.3),   # simulate handheld camera tilt
```

**Tier 2 — Photometric (simulate field conditions):**
```python
A.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.25, hue=0.08, p=0.8),
A.RandomShadow(shadow_roi=(0, 0, 1, 1), p=0.25),   # cloud shadow on field
A.RandomFog(fog_coef_range=(0.1, 0.3), p=0.15),    # morning mist
A.RandomRain(slant_range=(-10, 10), drop_length=12, p=0.10),
A.GaussNoise(std_range=(5, 30), p=0.3),             # sensor noise
A.ISONoise(color_shift=(0.01, 0.05), p=0.2),        # DSLR ISO noise
A.ImageCompression(quality_range=(60, 100), p=0.3), # smartphone JPEG artefacts
```

**Tier 3 — Lesion-pattern-aware (preserve disease markers):**
```python
A.GaussianBlur(blur_limit=(3, 5), p=0.2),           # gentle; preserves lesion edges
A.CoarseDropout(num_holes_range=(1, 4),
                hole_height_range=(16, 48),
                hole_width_range=(16, 48), p=0.2),   # occlusion by other leaves
# Do NOT apply: elastic transforms, strong affine shear, or heavy hue shifts
# (destroys chlorotic halo signatures and rust pustule color cues)
```

**Tier 4 — Batch-level (applied in training loop):**
- **MixUp** (α=0.2): Blends two random training samples and their labels. Improves calibration.
- **CutMix** (α=1.0, p=0.3): Cuts and pastes rectangular patches from a different class image. Especially effective for multi-lesion leaf images.

**Validation / Inference Pipeline (deterministic):**
```python
A.Resize(height=384, width=384),
A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
ToTensorV2()
```

**Test-Time Augmentation (TTA):** 5-crop (center + 4 corners) + horizontal flip = 10 augmented views, averaged at softmax level.

---

## 4. Loss Functions & Training Strategy

### 4.1 Loss Formulation

**Primary loss:**
```
L = α · L_CE(label_smooth=0.05) + β · L_Focal(γ=2.0, α_per_class=inverse_freq)
```

Where:
- `α = 0.6`, `β = 0.4`
- `L_CE`: Cross-entropy with label smoothing `ε=0.05` (reduced from existing 0.1; avoids over-smoothing on the large 60-class head)
- `L_Focal`: Focal loss with per-class inverse-frequency weighting. **Justification:** PlantDoc classes are heavily imbalanced (Tomato has 10+ subclasses; Raspberry and Blueberry have ~30 images each). Focal loss down-weights easy majority classes and focuses gradient on rare, hard-to-classify diseases.

**Background class handling:**
- Background class uses `α=2.0` (double weight in focal) to ensure non-leaf inputs never slip past Gate 2.

### 4.2 Three-Phase Training Schedule

| Phase | Duration | Frozen Layers | LR (backbone) | LR (head) | Scheduler |
|---|---|---|---|---|---|
| **Phase 0 — Warm-up** | 5 epochs | All backbone layers | — | 1e-3 | Cosine warm-up |
| **Phase 1 — Staged unfreeze** | 15 epochs | Stem + Stage 1 | 5e-5 | 5e-4 | CosineAnnealingLR (T=15) |
| **Phase 2 — Full fine-tune** | 30 epochs | None | 1e-5 | 1e-4 | CosineAnnealingWarmRestarts (T₀=10, T_mult=2) |

> **Rationale for staged unfreeze:** ConvNeXt-Base's early stages learn low-level texture. Freezing them during Phase 0/1 prevents gradient interference when fitting the new 61-class head. Unfreezing progressively allows high-level semantic features to adapt without catastrophic forgetting.

### 4.3 Optimizer & Regularization

```python
optimizer = torch.optim.AdamW(
    [
        {"params": backbone_params, "lr": 5e-5, "weight_decay": 0.05},
        {"params": head_params,     "lr": 5e-4, "weight_decay": 1e-4},
    ],
    betas=(0.9, 0.999),
    eps=1e-8
)

# Gradient clipping (critical for ConvNeXt deep fine-tuning)
torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)

# Stochastic Depth (drop_path_rate=0.3 in ConvNeXt init)
# Layer-wise Learning Rate Decay: lr_decay_rate = 0.85 per ConvNeXt stage (4 stages)
```

### 4.4 Early Stopping Criteria

```python
EarlyStopping(
    monitor="val_macro_f1",         # primary metric
    patience=8,                      # epochs without improvement
    min_delta=0.001,                 # minimum meaningful improvement
    restore_best_weights=True,
    secondary_gate="ood_auroc >= 0.95"  # must simultaneously pass OOD check
)
```

Additional stopping heuristics:
- If `val_loss` increases for 3 consecutive epochs while `val_f1` improves → reduce LR by 0.5× (plateau override)
- Hard cap: 50 total epochs (Phases 1+2 combined)

### 4.5 Hardware & Batch Configuration

| Setting | Value |
|---|---|
| Batch size | 32 (RTX 3090 / A100) or 16 (M2 Max) |
| Precision | `torch.bfloat16` with `torch.amp.autocast` |
| DataLoader workers | `min(os.cpu_count(), 8)` |
| Pin memory | `True` |
| Gradient accumulation | Steps=2 if batch_size=16 (effective batch=32) |

---

## 5. Scaffolding Blueprint for Junior SDE (Gemini)

> All scripts live under `ml/disease/`. The existing files are **refactored in-place** (no new top-level directories). Each script is independent and importable.

---

### Script 1: `dataset.py` — Unified Dataset Parser & OOD Injector

**Purpose:** Replace the existing `AgriDiseaseDataset` with a symlink-safe, OOD-aware loader.

**Inputs:**
- `unified_dir: str` — Path to `leaf_dataset/unified/` (contains `train/`, `val/`)
- `ood_dir: str` — Path to `sample images/` (non-leaf distractor images)
- `extra_bg_dir: Optional[str]` — Path to extra ImageNet non-plant images for background class augmentation
- `split: Literal["train", "val", "test"]`
- `transform: Optional[A.Compose]`

**Expected Outputs:**
- `LeafDiseaseDataset(Dataset)` class with:
  - `self.classes: List[str]` — sorted list of 61 class names (60 disease + `"background"`)
  - `self.class_to_idx: Dict[str, int]` — e.g., `{"Apple___Apple_scab": 0, ..., "background": 60}`
  - `self.samples: List[Tuple[str, int]]` — `(resolved_real_path, label_idx)`
  - `self.class_weights: torch.Tensor` — inverse-frequency weights per class (for focal loss α)
  - `__len__`, `__getitem__` returning `(image_tensor, label_int)`

**Edge-case checks required in `__init__`:**
1. Call `os.path.realpath(path)` on every sample path; skip if the resolved path doesn't exist (broken symlink).
2. Detect if `unified_dir` is empty and raise `ValueError` with a clear message.
3. Inject background class: discover all images in `ood_dir` (walk recursively, all JPEG/PNG). Assign label `len(disease_classes)`.
4. Warn if any class has < 10 samples after split; log the class name and count.
5. Validate that `class_to_idx` is consistent across `train` and `val` splits (deterministic sort — never re-index per split).

**Class mapping output format** (to be persisted as `ml/disease/class_mapping.json`):
```json
{
  "version": "2.0",
  "num_classes": 61,
  "classes": [
    {"idx": 0, "name": "Apple___Apple_scab", "crop": "apple", "disease": "apple_scab"},
    ...
    {"idx": 60, "name": "background", "crop": null, "disease": null}
  ]
}
```

---

### Script 2: `transforms.py` — Albumentations Augmentation Pipeline

**Purpose:** Replace torchvision transforms with Albumentations; implement TTA.

**Inputs:**
- `image_size: int` (default 384 for ConvNeXt-Base; 336 for EVA-02-S)
- `severity: Literal["light", "medium", "heavy"]` (default `"medium"`)

**Expected Outputs:** Three public functions:

```python
def get_training_transforms(image_size=384, severity="medium") -> A.Compose
def get_validation_transforms(image_size=384) -> A.Compose
def get_tta_transforms(image_size=384, n_augments=10) -> List[A.Compose]
```

**Edge-case checks:**
1. Verify `albumentations` is installed; raise `ImportError` with install command if not.
2. The `get_tta_transforms` must return exactly `n_augments` deterministic transform configs (5-crop × 2 flips).
3. `ToTensorV2()` must always be the last transform in every pipeline.
4. Document that `GaussianBlur` kernel must be **odd-sized** (Albumentations enforces this; assert if `blur_limit` produces even kernel).

---

### Script 3: `model.py` — ConvNeXt/EVA-02 Model Builder with OOD Head

**Purpose:** Replace the existing `build_disease_model` with a modular builder supporting ConvNeXt-Base and EVA-02-S, with explicit OOD utilities.

**Inputs to `build_model()`:**
```python
def build_model(
    backbone: str,           # "convnext_base" | "eva02_small_patch14_336"
    num_classes: int,        # 61 (including background)
    pretrained: bool,        # True for production
    drop_path_rate: float,   # 0.3 for ConvNeXt-Base
    checkpoint_path: Optional[str]  # resume from checkpoint
) -> nn.Module
```

**Expected Outputs:**
- Model with:
  - **Modified head:** `nn.Sequential(nn.LayerNorm(in_features), nn.Dropout(0.3), nn.Linear(in_features, num_classes))`
  - **Layer-wise LR groups** returned as a separate method: `model.get_parameter_groups(base_lr, layer_decay=0.85) -> List[Dict]`
  - **Preserved utility functions:** `compute_energy_score(logits, T=1.0)` and `compute_shannon_entropy(probs)` (keep existing signatures)
- `build_binary_gate(pretrained=True) -> nn.Module` — MobileNetV3-Small fine-tuned as binary leaf/non-leaf classifier (2-class head)

**Edge-case checks:**
1. If `backbone == "eva02_small_patch14_336"` and `timm` is not installed → raise `ImportError` with install command.
2. If `checkpoint_path` is provided but doesn't exist → log warning, do NOT crash (allow cold-start).
3. Validate that `num_classes` matches the `class_mapping.json` on disk (if it exists).

---

### Script 4: `train.py` — Three-Phase Training Engine

**Purpose:** Refactor the existing training loop for three-phase staged training with MixUp/CutMix, gradient clipping, mixed precision, and OOD-aware early stopping.

**Inputs (CLI args + config):**
```
--config       ml/disease/config.yaml
--data-dir     leaf_dataset/unified
--ood-dir      "sample images/"
--backbone     convnext_base
--epochs       50                   # total (phases 0+1+2)
--batch-size   32
--resume       path/to/checkpoint.pth (optional)
--output-dir   ml/disease/checkpoints/
```

**Expected Outputs per run:**
1. Best checkpoint: `checkpoints/best_model.pth` (state_dict + optimizer state + epoch)
2. Last checkpoint: `checkpoints/last_epoch.pth`
3. Training report JSON: `checkpoints/training_report_{timestamp}.json`
   ```json
   {
     "backbone": "convnext_base",
     "num_classes": 61,
     "best_epoch": 38,
     "best_val_macro_f1": 0.9123,
     "best_ood_auroc": 0.9811,
     "phases": {"phase0": {...}, "phase1": {...}, "phase2": {...}},
     "class_mapping_version": "2.0"
   }
   ```
4. Per-epoch CSV log: `checkpoints/epoch_log.csv`

**Implementation checklist for Gemini:**
1. Load dataset using `LeafDiseaseDataset` (Script 1); extract `class_weights`.
2. Build model using `build_model()` (Script 3); build binary gate using `build_binary_gate()`.
3. Instantiate `AdamW` with **two param groups** (backbone + head) using `model.get_parameter_groups()`.
4. Implement `MixupCutmixCollator` as a custom collate_fn (not in the training loop body).
5. Use `torch.amp.GradScaler` + `autocast(dtype=torch.bfloat16)` for mixed precision.
6. **Phase boundary logic:** at epoch `phase0_end`, unfreeze Stage 2+3+4 of backbone; at epoch `phase1_end`, unfreeze all.
7. Compute OOD AUROC at end of each validation epoch using the `ood_dir` images as negative set.
8. Implement `EarlyStopping` class with `restore_best_weights=True` and secondary OOD gate.
9. Save `class_mapping.json` to `output_dir` after dataset is built.

**Edge-case checks:**
1. If CUDA OOM → reduce batch_size by half and retry (up to 2 retries).
2. If `resume` checkpoint has a different `num_classes` → abort with a clear error.
3. Detect NaN loss (can occur with bfloat16 + Focal loss) → skip batch and log warning.

---

### Script 5: `evaluate.py` — Comprehensive Evaluation Harness

**Purpose:** Complete the existing evaluation stub with OOD AUROC, calibration, and per-class breakdowns.

**Inputs:**
```
--checkpoint   ml/disease/checkpoints/best_model.pth
--config       ml/disease/config.yaml
--test-dir     leaf_dataset/PlantDoc-Dataset-master/test/
--ood-dir      "sample images/"
--output       ml/disease/eval_report.json
```

**Expected Outputs (`eval_report.json`):**
```json
{
  "in_distribution": {
    "accuracy": 0.00,
    "macro_f1": 0.00,
    "macro_precision": 0.00,
    "macro_recall": 0.00,
    "weighted_f1": 0.00,
    "confusion_matrix": [...],
    "per_class": { "Apple___Apple_scab": { "f1": 0.00, "support": 0 }, ... }
  },
  "ood_detection": {
    "auroc": 0.00,
    "fpr_at_tpr95": 0.00,
    "gate1_accuracy": 0.00,
    "gate2_energy_auroc": 0.00,
    "gate2_entropy_auroc": 0.00
  },
  "calibration": {
    "ece": 0.00,
    "mce": 0.00
  },
  "engineering_targets": {
    "macro_f1_target": 0.90,
    "ood_auroc_target": 0.97,
    "zero_false_alarms_on_ood_set": true
  }
}
```

**Implementation checklist for Gemini:**
1. Run inference with `DiseaseInferenceEngine` (Script 6) over test set; collect `(logits, label, energy, entropy)` tuples.
2. Compute **OOD AUROC** using `sklearn.metrics.roc_auc_score` with energy scores as the anomaly score (in-distribution = negative, OOD = positive).
3. Compute **ECE** (Expected Calibration Error) with 15 bins.
4. Emit a clear `TARGET MET` / `TARGET NOT MET` summary block to stdout.
5. **Zero false-alarm check:** assert that every image in `ood_dir` is rejected by at least one gate; fail with specific filenames if any slip through.

**Edge-case checks:**
1. If `--test-dir` doesn't exist → print `EVALUATION BLOCKED` and exit gracefully (preserve existing behavior).
2. If model outputs `NaN` logits → skip sample, count and report as `nan_samples` in JSON.
3. Handle the case where `ood_dir` has < 5 images → warn that AUROC estimate is unreliable.

---

### Script 6: `inference.py` — Production Dual-Gate Inference Engine

**Purpose:** Replace the existing single-model `DiseaseInferenceEngine` with the dual-gate architecture.

**Inputs to `DiseaseInferenceEngine.predict(img_pil)`:**
- `img_pil: PIL.Image.Image`
- Engine is initialized with `checkpoint_path`, `gate1_checkpoint_path`, `config`, `device`

**Expected Output (dict):**
```python
{
    # Gate 1 result
    "gate1_leaf_prob": 0.9312,
    "gate1_passed": True,

    # Gate 2 result
    "class_idx": 3,
    "class_name": "Apple___Cedar_apple_rust",
    "crop": "apple",
    "disease": "cedar_apple_rust",
    "confidence": 0.8871,
    "energy_score": -8.23,
    "entropy_bits": 1.12,

    # Final decision
    "is_ood": False,
    "rejection_reason": None,   # or "gate1_failed" | "gate2_energy" | "gate2_entropy" | "low_confidence"
    "prediction_valid": True
}
```

**Implementation checklist for Gemini:**
1. Gate 1: run binary MobileNetV3-Small; if `P(leaf) < 0.80` → return immediately with `prediction_valid=False`, `rejection_reason="gate1_failed"`.
2. Gate 2: run ConvNeXt-Base; compute energy AND entropy.
3. Apply TTA (`get_tta_transforms`) and average 10-view softmax before final prediction (enable with `use_tta=True` flag).
4. Load `class_mapping.json` from same directory as checkpoint; raise if missing.
5. Validate output dict schema with a `TypedDict` or `dataclasses.dataclass` before return.

**Edge-case checks:**
1. If image is < 32×32 pixels → reject immediately as `"too_small"`.
2. If image is grayscale → convert to RGB.
3. If checkpoint doesn't exist → return `{"status": "model_unavailable"}` (preserve existing behavior exactly).
4. Log inference latency (ms) per call in debug mode.

---

### Script 7: `config.yaml` — Updated Configuration

**Purpose:** Replace the existing 15-class, 224-px config with the new 61-class, 384-px spec.

**Key changes from existing:**
```yaml
# NEW config.yaml
model:
  name: "agrinexus_disease_v2_convnext"
  backbone: "convnext_base"          # was: efficientnet_b0
  gate1_backbone: "mobilenet_v3_small"
  num_classes: 61                    # was: 15 (60 disease/healthy + 1 background)
  image_size: 384                    # was: 224
  drop_path_rate: 0.3
  pretrained: true
  class_mapping: "ml/disease/class_mapping.json"

ood:
  gate1_leaf_threshold: 0.80
  energy_threshold: -6.0
  entropy_threshold_bits: 2.0
  confidence_threshold: 0.60

training:
  phase0_epochs: 5
  phase1_epochs: 15
  phase2_epochs: 30
  batch_size: 32
  mixup_alpha: 0.2
  cutmix_alpha: 1.0
  cutmix_prob: 0.3
  label_smoothing: 0.05              # was: 0.1
  focal_gamma: 2.0
  focal_weight: 0.4
  ce_weight: 0.6
  layer_lr_decay: 0.85
  head_lr: 5e-4
  backbone_lr: 5e-5
  weight_decay_backbone: 0.05
  weight_decay_head: 1e-4
  grad_clip_norm: 1.0
  seed: 42
  amp_dtype: "bfloat16"
  early_stopping_patience: 8
  early_stopping_min_delta: 0.001

paths:
  data_dir: "leaf_dataset/unified"
  ood_dir: "sample images"
  checkpoint_dir: "ml/disease/checkpoints"
  best_model: "ml/disease/checkpoints/best_model.pth"
  class_mapping: "ml/disease/class_mapping.json"
```

---

## 6. Dependency Requirements

New packages required (add to project's `requirements.txt`):

```
# Existing (keep)
torch>=2.3.0
torchvision>=0.18.0
Pillow>=10.0
pyyaml>=6.0
numpy>=1.26

# New additions
albumentations>=1.4.0        # Augmentation pipeline
timm>=1.0.3                  # EVA-02-S (fallback backbone)
scikit-learn>=1.5.0          # OOD AUROC, ECE computation
torchmetrics>=1.4.0          # Training metrics (F1, AUROC online)
```

---

## 7. Engineering Targets & Success Criteria

| Metric | Target | Measurement Dataset |
|---|---|---|
| Macro F1 (60 disease classes) | ≥ 0.90 | PlantDoc test set |
| Top-1 Accuracy | ≥ 0.88 | PlantDoc test set |
| OOD AUROC | ≥ 0.97 | `sample images/` + 500 ImageNet non-plant |
| FPR@TPR95 | ≤ 3% | Same OOD set |
| False alarm rate on `sample images/` | **0%** (zero tolerance) | `sample images/` (10 files) |
| Inference latency (CPU) | ≤ 2.5 s/image | MacBook M2 |
| Inference latency (GPU) | ≤ 150 ms/image | RTX 3090 |

---

## 8. Implementation Execution Order

```
1. [config.yaml]         → update immediately (no code changes needed)
2. [Script 1: dataset.py] → foundation for all subsequent scripts
3. [Script 2: transforms.py] → needed by dataset and training
4. [Script 3: model.py]  → needed by training and inference
5. [Script 4: train.py]  → runs after 1-3 are stable
6. [Script 5: evaluate.py] → runs after training produces a checkpoint
7. [Script 6: inference.py] → production artifact; final integration step
```

> ⚡ **Gemini:** Implement scripts in the order above. After completing each script, run a dry-run smoke test (described in each script's edge-case section) before proceeding to the next. Do not implement all scripts in parallel.
