# 🛠️ AgriNexus AI — Model Training Pipeline

## 1. Overview

The AgriNexus AI machine learning infrastructure provides fully reproducible CLI training pipelines for:
1. **Crop/Plant Gate** (`ml/crop_gate/train.py`)
2. **Crop Disease Classifier** (`ml/disease/train.py`)
3. **Sentinel-1 SAR Baseline Model** (`ml/satellite/train.py`)

---

## 2. Directory Layout

```text
ml/
├── datasets/
│   ├── raw/
│   ├── processed/
│   ├── train/
│   ├── validation/
│   └── test/
├── crop_gate/
│   ├── train.py
│   ├── evaluate.py
│   ├── dataset.py
│   ├── model.py
│   └── config.yaml
├── disease/
│   ├── train.py
│   ├── evaluate.py
│   ├── inference.py
│   ├── dataset.py
│   ├── transforms.py
│   ├── model.py
│   └── config.yaml
└── satellite/
    ├── preprocessing/
    ├── features.py
    ├── model.py
    ├── train.py
    └── evaluate.py
```

---

## 3. Training the Crop Gate Model

The Crop Gate binary model separates positive agricultural foliage from negative out-of-distribution (OOD) objects.

### Dataset Preparation
Populate positive and negative samples:
```text
ml/datasets/crop_gate/
├── positive/
│   ├── tomato/
│   ├── potato/
│   └── bell_pepper/
└── negative/
    ├── vehicles/
    ├── people/
    ├── electronics/
    └── indoor/
```

### Execution Command
```bash
python ml/crop_gate/train.py \
  --config ml/crop_gate/config.yaml \
  --epochs 15 \
  --batch-size 32
```

When datasets are not populated, the script outputs a blocked status without fabricating results:
```text
TRAINING BLOCKED: Dataset directories not populated at:
  Positives: ml/datasets/crop_gate/positive
  Negatives: ml/datasets/crop_gate/negative
```

---

## 4. Training the Disease Classifier

The disease classifier utilizes a **two-phase transfer learning pipeline**:
- **Phase 1 (Warm-up):** Freezes the backbone (`EfficientNet-B0`), training only the classifier head at `head_lr = 0.001`.
- **Phase 2 (Fine-tuning):** Unfreezes the full network, fine-tuning at `backbone_lr = 0.00005` with `ReduceLROnPlateau` scheduler.

### Agricultural Augmentations
The pipeline applies biologically realistic leaf augmentations in `ml/disease/transforms.py`:
- `RandomResizedCrop(224, scale=(0.8, 1.0))`
- `RandomHorizontalFlip(p=0.5)` & `RandomVerticalFlip(p=0.5)`
- `RandomRotation(degrees=15)`
- `ColorJitter(brightness=0.15, contrast=0.15, saturation=0.15)`
- `GaussianBlur(kernel_size=(3, 3), sigma=(0.1, 1.5))`
- `RandomErasing(p=0.15)`

### Execution Command
```bash
python ml/disease/train.py \
  --config ml/disease/config.yaml \
  --phase1-epochs 10 \
  --phase2-epochs 20 \
  --batch-size 32
```

Outputs a structured training report `ml/disease/checkpoints/disease_training_report.json`.

---

## 5. Training the Sentinel-1 SAR Baseline Model

Trains a Random Forest classifier on tabulated SAR polarimetric features:
- $VV$, $VH$, $VV/VH$ ratio
- Radar Vegetation Index (RVI)
- Temporal dynamics: $\Delta VV$, $\Delta VH$

### Execution Command
```bash
python ml/satellite/train.py \
  --config ml/satellite/config.yaml \
  --data-file ml/datasets/processed/sar_features.csv
```
