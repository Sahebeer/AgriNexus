"""
AgriNexus AI - Crop Gate Dataset Loader
Handles loading positive agricultural crop foliage images and negative/OOD images.
"""

import os
import glob
from pathlib import Path
from typing import List, Tuple, Optional
from PIL import Image

try:
    import torch
    from torch.utils.data import Dataset
    import torchvision.transforms as transforms
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    class Dataset:
        pass


class CropGateDataset(Dataset):
    """
    Dataset for binary crop/plant gate training and evaluation.
    Class 0: Negative / Out-of-Distribution (OOD) / Non-crop
    Class 1: Positive agricultural crop / foliage
    """

    def __init__(
        self,
        positive_dir: str,
        negative_dir: str,
        transform=None,
        max_samples_per_class: Optional[int] = None
    ):
        self.samples: List[Tuple[str, int]] = []
        self.transform = transform

        pos_exts = ("*.jpg", "*.jpeg", "*.png", "*.JPG", "*.JPEG", "*.PNG")
        
        # Load positives (label 1)
        if os.path.isdir(positive_dir):
            pos_files = []
            for ext in pos_exts:
                pos_files.extend(glob.glob(os.path.join(positive_dir, "**", ext), recursive=True))
            if max_samples_per_class:
                pos_files = pos_files[:max_samples_per_class]
            for p in pos_files:
                self.samples.append((p, 1))

        # Load negatives (label 0)
        if os.path.isdir(negative_dir):
            neg_files = []
            for ext in pos_exts:
                neg_files.extend(glob.glob(os.path.join(negative_dir, "**", ext), recursive=True))
            if max_samples_per_class:
                neg_files = neg_files[:max_samples_per_class]
            for p in neg_files:
                self.samples.append((p, 0))

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int):
        img_path, label = self.samples[idx]
        img = Image.open(img_path).convert("RGB")
        if self.transform:
            img = self.transform(img)
        return img, label


def get_crop_gate_transforms(image_size: int = 224, is_training: bool = True):
    """Returns standardized training or validation/test transforms."""
    if not TORCH_AVAILABLE:
        return None
    if is_training:
        return transforms.Compose([
            transforms.RandomResizedCrop(image_size, scale=(0.8, 1.0)),
            transforms.RandomHorizontalFlip(),
            transforms.RandomVerticalFlip(),
            transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
    else:
        return transforms.Compose([
            transforms.Resize((image_size, image_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
