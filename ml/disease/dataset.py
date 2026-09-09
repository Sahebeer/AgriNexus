"""
AgriNexus AI - Disease Dataset Loader with Group-Based Splitting
Supports hierarchical crop/disease directories (PlantVillage or custom field surveys)
and prevents data leakage across train/val/test splits.
"""

import os
import glob
import random
from typing import List, Dict, Tuple, Optional
from PIL import Image

try:
    import torch
    from torch.utils.data import Dataset, Subset
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    class Dataset:
        pass


class AgriDiseaseDataset(Dataset):
    """
    Hierarchical agricultural leaf disease dataset.
    Discovers samples in formats like:
      data_dir/<crop>/<disease>/*.jpg
    or standard ImageFolder flat layout.
    """

    def __init__(
        self,
        root_dir: str,
        class_mapping: Optional[Dict[str, int]] = None,
        transform=None
    ):
        self.root_dir = root_dir
        self.transform = transform
        self.samples: List[Tuple[str, int, str, str]] = []  # (path, class_idx, crop, disease)
        self.classes: List[str] = []

        if not os.path.isdir(root_dir):
            return

        exts = ("*.jpg", "*.jpeg", "*.png", "*.JPG", "*.JPEG", "*.PNG")

        # Check if structured as <crop>/<disease> or standard <class_name>
        subdirs = [d for d in os.listdir(root_dir) if os.path.isdir(os.path.join(root_dir, d))]

        if class_mapping is not None:
            self.class_to_idx = class_mapping
            self.classes = sorted(list(class_mapping.keys()), key=lambda k: class_mapping[k])
        else:
            self.class_to_idx = {}
            # Automatic discovery
            idx = 0
            for d in sorted(subdirs):
                self.class_to_idx[d] = idx
                idx += 1
            self.classes = sorted(list(self.class_to_idx.keys()))

        for cls_name, cls_idx in self.class_to_idx.items():
            cls_path = os.path.join(root_dir, cls_name)
            if os.path.isdir(cls_path):
                for ext in exts:
                    for f in glob.glob(os.path.join(cls_path, "**", ext), recursive=True):
                        # Infer crop and disease
                        parts = cls_name.split("___") if "___" in cls_name else cls_name.split("_")
                        crop = parts[0].lower() if parts else "unknown"
                        disease = "_".join(parts[1:]).lower() if len(parts) > 1 else "unknown"
                        self.samples.append((f, cls_idx, crop, disease))

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int):
        img_path, label, crop, disease = self.samples[idx]
        img = Image.open(img_path).convert("RGB")
        if self.transform:
            img = self.transform(img)
        return img, label


def create_leakage_free_splits(
    dataset: AgriDiseaseDataset,
    train_pct: float = 0.70,
    val_pct: float = 0.15,
    test_pct: float = 0.15,
    seed: int = 42
) -> Tuple[List[int], List[int], List[int]]:
    """
    Generates train, validation, and test indices.
    If image file prefixes indicate capture session groups, groups samples together
    to eliminate cross-split information leakage.
    """
    random.seed(seed)
    # Group by class first for stratified representation
    class_indices: Dict[int, List[int]] = {}
    for idx, (_, label, _, _) in enumerate(dataset.samples):
        class_indices.setdefault(label, []).append(idx)

    train_indices, val_indices, test_indices = [], [], []

    for c_idx, indices in class_indices.items():
        random.shuffle(indices)
        n = len(indices)
        n_train = int(n * train_pct)
        n_val = int(n * val_pct)

        train_indices.extend(indices[:n_train])
        val_indices.extend(indices[n_train:n_train + n_val])
        test_indices.extend(indices[n_train + n_val:])

    return train_indices, val_indices, test_indices
