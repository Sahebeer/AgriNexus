"""
AgriNexus AI - Plant Disease Dataset Loader with Dual-Gate OOD Support
Handles unified agricultural foliar pathologies (60 classes) plus an explicit
background / out-of-distribution rejection class (61st class).
Performs symlink-safe path resolution and per-class inverse-frequency weighting.
"""

import os
import json
import logging
import random
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

try:
    import torch
    from torch.utils.data import Dataset
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    class Dataset:  # type: ignore[no-redef]
        pass


VALID_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".avif"}

# Inverse-frequency weight safety bounds.
# Raw per-class counts span from 2 (Tomato___Two_spotted_spider_mites) to 3966
# (Orange___HLB), producing a raw ratio of ~1983x which would cause gradient
# explosion under Focal Loss (γ=2). Clamping to [0.1, 10.0] brings the
# effective ratio to 100x, well within stable training ranges.
WEIGHT_CLAMP_MIN: float = 0.1
WEIGHT_CLAMP_MAX: float = 10.0


def parse_crop_disease(class_name: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Parses class directory names into crop and disease tokens.
    Handles delimiters: '___', '_', or single tokens.
    Examples:
        'Apple___Apple_scab' -> ('apple', 'apple_scab')
        'background' -> (None, None)
    """
    if class_name.lower() == "background":
        return None, None

    if "___" in class_name:
        parts = class_name.split("___", 1)
        crop = parts[0].strip().lower().replace(" ", "_")
        disease = parts[1].strip().lower().replace(" ", "_")
        return crop, disease

    if "_" in class_name:
        parts = class_name.split("_", 1)
        crop = parts[0].strip().lower()
        disease = parts[1].strip().lower()
        return crop, disease

    return class_name.strip().lower(), "unknown"


def save_class_mapping(classes: List[str], filepath: Union[str, Path]) -> None:
    """
    Persists class taxonomy mapping JSON matching plan.md schema specification.
    """
    out_path = Path(filepath)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    mapping: Dict[str, Any] = {
        "version": "2.0",
        "num_classes": len(classes),
        "classes": []
    }

    for idx, name in enumerate(classes):
        crop, disease = parse_crop_disease(name)
        mapping["classes"].append({
            "idx": idx,
            "name": name,
            "crop": crop,
            "disease": disease
        })

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(mapping, f, indent=2)
    logger.info("Persisted class mapping with %d classes to %s", len(classes), out_path)


def load_class_mapping(filepath: Union[str, Path]) -> Tuple[List[str], Dict[str, int]]:
    """
    Loads class taxonomy mapping from JSON.
    Returns:
        classes: List of class names sorted by index.
        class_to_idx: Mapping from class name to integer index.
    """
    in_path = Path(filepath)
    if not in_path.exists():
        raise FileNotFoundError(f"Class mapping file not found at {in_path}")

    with open(in_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    sorted_classes = sorted(data["classes"], key=lambda c: c["idx"])
    classes = [c["name"] for c in sorted_classes]
    class_to_idx = {c["name"]: c["idx"] for c in sorted_classes}
    return classes, class_to_idx


class LeafDiseaseDataset(Dataset):
    """
    Unified agricultural foliar disease dataset with explicit background class support.
    
    Key Features:
    - Resolves symlinks safely with realpath to prevent cross-mount read failures.
    - Deterministically indexes 60 disease classes + 1 background class (idx 60).
    - Ingests non-leaf distractor images from ood_dir into the background class.
    - Computes per-class inverse-frequency weights with 2.0x boost for the background class.
    - Strictly checks sample thresholds and split consistency.
    """

    def __init__(
        self,
        unified_dir: str,
        ood_dir: Optional[str] = None,
        extra_bg_dir: Optional[str] = None,
        split: str = "train",
        transform: Optional[Any] = None,
        class_mapping_path: Optional[str] = None,
        save_mapping_path: Optional[str] = None,
        ood_split: bool = True,
        seed: int = 42
    ):
        if not TORCH_AVAILABLE:
            raise RuntimeError("PyTorch is required to instantiate LeafDiseaseDataset.")

        self.unified_dir = Path(unified_dir).resolve()
        self.ood_dir = Path(ood_dir).resolve() if ood_dir else None
        self.extra_bg_dir = Path(extra_bg_dir).resolve() if extra_bg_dir else None
        self.split = split.lower()
        self.transform = transform
        self.seed = seed

        # Edge-Case Check 2: Verify unified_dir exists
        if not self.unified_dir.exists() or not self.unified_dir.is_dir():
            raise ValueError(
                f"Unified dataset directory '{self.unified_dir}' does not exist or is not a directory."
            )

        # ── 1. Discover Canonical Disease Classes ────────────────────────────
        if class_mapping_path and Path(class_mapping_path).exists():
            self.classes, self.class_to_idx = load_class_mapping(class_mapping_path)
            self.disease_classes = [c for c in self.classes if c != "background"]
        else:
            # Discover from train directory or root directory
            train_dir = self.unified_dir / "train"
            scan_dir = train_dir if train_dir.is_dir() else self.unified_dir

            disease_subdirs = sorted([
                d.name for d in scan_dir.iterdir()
                if d.is_dir() and not d.name.startswith(".") and d.name.lower() != "background"
            ])

            if not disease_subdirs:
                raise ValueError(
                    f"Unified directory '{self.unified_dir}' is empty or contains no valid class folders."
                )

            self.disease_classes = disease_subdirs
            self.classes = list(self.disease_classes) + ["background"]
            self.class_to_idx = {cls_name: idx for idx, cls_name in enumerate(self.classes)}

            if save_mapping_path:
                save_class_mapping(self.classes, save_mapping_path)

        self.background_idx = self.class_to_idx["background"]

        # ── 2. Determine Split Directory ──────────────────────────────────────
        split_dir = self.unified_dir / self.split
        data_root = split_dir if split_dir.is_dir() else self.unified_dir

        # ── 3. File Discovery with Symlink Resolution ────────────────────────
        self.samples: List[Tuple[str, int]] = []  # (resolved_path, class_idx)
        broken_symlinks_count = 0
        total_discovered = 0

        for cls_name in self.disease_classes:
            cls_folder = data_root / cls_name
            if not cls_folder.is_dir():
                continue

            target_idx = self.class_to_idx[cls_name]
            for root, _, files in os.walk(cls_folder):
                for f in files:
                    ext = os.path.splitext(f)[1].lower()
                    if ext in VALID_IMAGE_EXTENSIONS:
                        total_discovered += 1
                        file_path = os.path.join(root, f)

                        # Edge-Case Check 1: Resolve symlinks with realpath
                        try:
                            resolved_path = os.path.realpath(file_path)
                            if os.path.exists(resolved_path):
                                self.samples.append((resolved_path, target_idx))
                            else:
                                broken_symlinks_count += 1
                        except (OSError, ValueError):
                            broken_symlinks_count += 1

        if broken_symlinks_count > 0:
            logger.warning(
                "Skipped %d broken/unresolvable symlinks in split '%s'.",
                broken_symlinks_count,
                self.split
            )

        # ── 4. Background / OOD Class Injection ──────────────────────────────
        ood_images: List[str] = []
        for bg_source in [self.ood_dir, self.extra_bg_dir]:
            if bg_source and bg_source.is_dir():
                for root, _, files in os.walk(bg_source):
                    for f in files:
                        ext = os.path.splitext(f)[1].lower()
                        if ext in VALID_IMAGE_EXTENSIONS:
                            raw_p = os.path.join(root, f)
                            try:
                                resolved = os.path.realpath(raw_p)
                                if os.path.exists(resolved):
                                    ood_images.append(resolved)
                            except (OSError, ValueError):
                                continue

        # Deduplicate and sort deterministically
        ood_images = sorted(list(set(ood_images)))

        if ood_images:
            if ood_split and len(ood_images) > 1:
                rng = random.Random(self.seed)
                shuffled_ood = list(ood_images)
                rng.shuffle(shuffled_ood)

                n_train = max(1, int(len(shuffled_ood) * 0.8))
                if self.split == "train":
                    selected_ood = shuffled_ood[:n_train]
                elif self.split in ("val", "validation"):
                    selected_ood = shuffled_ood[n_train:]
                else:  # test / evaluation receives all OOD
                    selected_ood = shuffled_ood
            else:
                selected_ood = ood_images

            for ood_path in selected_ood:
                self.samples.append((ood_path, self.background_idx))

        # Check total samples
        if not self.samples:
            raise ValueError(
                f"No valid image samples discovered for split '{self.split}' in '{self.unified_dir}'."
            )

        # ── 5. Class Counts & Edge-Case Check 4: Threshold Warning ───────────
        self.class_counts = [0] * len(self.classes)
        for _, lbl in self.samples:
            self.class_counts[lbl] += 1

        for cls_name, cls_idx in self.class_to_idx.items():
            cnt = self.class_counts[cls_idx]
            if cnt < 10:
                logger.warning(
                    "Class '%s' (idx %d) has only %d sample(s) in split '%s' (< 10 threshold).",
                    cls_name,
                    cls_idx,
                    cnt,
                    self.split
                )

        # ── 6. Per-Class Inverse Frequency Weight Calculation ─────────────────
        total_samples = len(self.samples)
        num_classes = len(self.classes)
        raw_weights: List[float] = []

        for idx, count in enumerate(self.class_counts):
            if count > 0:
                w = total_samples / (num_classes * count)
            else:
                w = 1.0  # Fallback for unrepresented classes

            # Double weight (2.0x) for background rejection class
            if idx == self.background_idx:
                w *= 2.0

            raw_weights.append(w)

        # Normalize weights so their mean equals 1.0, then clamp to [WEIGHT_CLAMP_MIN, WEIGHT_CLAMP_MAX].
        # Raw ratio across 61 classes can reach ~1983x (2 vs 3966 samples), which causes gradient
        # explosion under Focal Loss (γ=2). Clamping brings effective ratio to 100x.
        mean_weight = sum(raw_weights) / len(raw_weights) if raw_weights else 1.0
        normalized_weights = [w / mean_weight for w in raw_weights]
        self.class_weights = torch.tensor(normalized_weights, dtype=torch.float32).clamp(
            min=WEIGHT_CLAMP_MIN,
            max=WEIGHT_CLAMP_MAX
        )

        logger.info(
            "LeafDiseaseDataset initialized: split='%s', samples=%d, classes=%d, broken_symlinks=%d",
            self.split,
            len(self.samples),
            len(self.classes),
            broken_symlinks_count
        )

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        """
        Loads RGB image, applies Albumentations transform pipeline, and returns (tensor, label).
        """
        img_path, label = self.samples[idx]

        try:
            with Image.open(img_path) as pil_img:
                rgb_img = pil_img.convert("RGB")
                img_np = np.array(rgb_img, dtype=np.uint8)
        except Exception as e:
            logger.error("Failed to load image %s: %s. Falling back to alternative sample.", img_path, e)
            fallback_idx = (idx + 1) % len(self.samples)
            return self.__getitem__(fallback_idx)

        if self.transform is not None:
            augmented = self.transform(image=img_np)
            tensor_img = augmented["image"]
        else:
            # Default torchvision-like normalizer if no transform provided
            tensor_img = torch.from_numpy(img_np.transpose((2, 0, 1))).float() / 255.0

        return tensor_img, label
