"""
AgriNexus AI - Agricultural Vision Augmentation Transforms
Production Albumentations pipeline tailored for plant disease pathology
and dual-gated out-of-distribution detection.
"""

import logging
from typing import List, Optional, Tuple, Union
import numpy as np

logger = logging.getLogger(__name__)

try:
    import albumentations as A
    from albumentations.pytorch import ToTensorV2
    ALBUMENTATIONS_AVAILABLE = True
except ImportError:
    ALBUMENTATIONS_AVAILABLE = False
    A = None
    ToTensorV2 = None


IMAGENET_MEAN: Tuple[float, float, float] = (0.485, 0.456, 0.406)
IMAGENET_STD: Tuple[float, float, float] = (0.229, 0.224, 0.225)


def _check_dependencies() -> None:
    """Validates that Albumentations and PyTorch bindings are installed."""
    if not ALBUMENTATIONS_AVAILABLE:
        raise ImportError(
            "Albumentations is required for AgriNexus disease transforms.\n"
            "Please install it using: pip install albumentations>=1.4.0 albumentations[extra]"
        )


def _build_random_resized_crop(
    image_size: int,
    scale: Tuple[float, float] = (0.65, 1.0),
    ratio: Tuple[float, float] = (0.85, 1.15)
) -> "A.RandomResizedCrop":
    """Constructs RandomResizedCrop supporting Albumentations 1.x and 2.x API schemas."""
    try:
        return A.RandomResizedCrop(
            size=(image_size, image_size),
            scale=scale,
            ratio=ratio
        )
    except TypeError:
        return A.RandomResizedCrop(
            height=image_size,
            width=image_size,
            scale=scale,
            ratio=ratio
        )


def get_training_transforms(
    image_size: int = 384,
    severity: str = "medium"
) -> "A.Compose":
    """
    Constructs the 3-tier agricultural domain training augmentation pipeline:
    - Tier 1 (Geometric): Scale/aspect-ratio crops, symmetrical flips, rotations, perspective tilts.
    - Tier 2 (Photometric): Field shadows, humidity fog, rain streaks, sensor/ISO noise, JPEG compression.
    - Tier 3 (Lesion-preserving): Odd-kernel Gaussian blur, localized leaf occlusion dropout, ImageNet normalization.

    Args:
        image_size: Input resolution (default 384 for ConvNeXt-Base).
        severity: Augmentation intensity ('light', 'medium', 'heavy').

    Returns:
        Albumentations Compose pipeline producing torch.FloatTensor of shape (3, H, W).
    """
    _check_dependencies()

    if severity not in ("light", "medium", "heavy"):
        raise ValueError(f"Invalid severity '{severity}'. Expected 'light', 'medium', or 'heavy'.")

    # Severity scaling factors
    if severity == "light":
        scale_range = (0.75, 1.0)
        rotate_limit = 15
        jitter_strength = 0.15
        shadow_p = 0.15
        fog_p = 0.08
        rain_p = 0.05
        noise_p = 0.15
        iso_p = 0.10
        compress_p = 0.15
        blur_p = 0.10
        dropout_p = 0.10
    elif severity == "heavy":
        scale_range = (0.55, 1.0)
        rotate_limit = 45
        jitter_strength = 0.35
        shadow_p = 0.35
        fog_p = 0.20
        rain_p = 0.15
        noise_p = 0.40
        iso_p = 0.30
        compress_p = 0.40
        blur_p = 0.30
        dropout_p = 0.30
    else:  # medium (production baseline)
        scale_range = (0.65, 1.0)
        rotate_limit = 30
        jitter_strength = 0.30
        shadow_p = 0.25
        fog_p = 0.15
        rain_p = 0.10
        noise_p = 0.30
        iso_p = 0.20
        compress_p = 0.30
        blur_p = 0.20
        dropout_p = 0.20

    # Strict check: GaussianBlur kernel must be odd-sized
    blur_kernel_min, blur_kernel_max = 3, 5
    assert blur_kernel_min % 2 == 1 and blur_kernel_max % 2 == 1, (
        f"GaussianBlur kernel limits must be strictly odd integers, got ({blur_kernel_min}, {blur_kernel_max})"
    )

    pipeline = [
        # ── Tier 1: Geometric Invariances ─────────────────────────────────────
        _build_random_resized_crop(image_size, scale=scale_range, ratio=(0.85, 1.15)),
        A.HorizontalFlip(p=0.5),
        A.VerticalFlip(p=0.5),
        A.Rotate(limit=rotate_limit, p=0.6),
        A.Perspective(scale=(0.05, 0.12), p=0.3),

        # ── Tier 2: Photometric & Field Conditions ────────────────────────────
        A.ColorJitter(
            brightness=jitter_strength,
            contrast=jitter_strength,
            saturation=jitter_strength * 0.83,
            hue=0.08,
            p=0.8
        ),
        A.RandomShadow(shadow_roi=(0, 0, 1, 1), p=shadow_p),
        A.RandomFog(fog_coef_range=(0.1, 0.3), p=fog_p),
        A.RandomRain(slant_range=(-10, 10), drop_length=12, p=rain_p),
        A.GaussNoise(std_range=(0.02, 0.10), p=noise_p),
        A.ISONoise(color_shift=(0.01, 0.05), p=iso_p),
        A.ImageCompression(quality_range=(60, 100), p=compress_p),

        # ── Tier 3: Lesion-Pattern-Aware & Regularization ──────────────────────
        A.GaussianBlur(blur_limit=(blur_kernel_min, blur_kernel_max), p=blur_p),
        A.CoarseDropout(
            num_holes_range=(1, 4),
            hole_height_range=(16, 48),
            hole_width_range=(16, 48),
            fill=0,
            p=dropout_p
        ),
        A.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ToTensorV2()
    ]

    # Verification: ToTensorV2 must be the terminal transform
    assert isinstance(pipeline[-1], ToTensorV2), "ToTensorV2 must always be the terminal transform in pipeline"

    return A.Compose(pipeline)


def get_validation_transforms(image_size: int = 384) -> "A.Compose":
    """
    Constructs deterministic validation and evaluation transform pipeline.

    Args:
        image_size: Target square image resolution (default 384).

    Returns:
        Albumentations Compose pipeline producing normalized (3, H, W) tensor.
    """
    _check_dependencies()

    pipeline = [
        A.Resize(height=image_size, width=image_size),
        A.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ToTensorV2()
    ]

    assert isinstance(pipeline[-1], ToTensorV2), "ToTensorV2 must always be the terminal transform in pipeline"
    return A.Compose(pipeline)


def get_tta_transforms(
    image_size: int = 384,
    n_augments: int = 10
) -> List["A.Compose"]:
    """
    Constructs deterministic Test-Time Augmentation (TTA) pipelines.
    Generates exactly n_augments (typically 10) views combining:
    - 5 spatial crops (center, top-left, top-right, bottom-left, bottom-right)
    - 2 horizontal flip states (unflipped, horizontally flipped)

    Args:
        image_size: Target cropped resolution (default 384).
        n_augments: Number of deterministic pipelines to generate (default 10).

    Returns:
        List of exactly n_augments Albumentations Compose pipelines.
    """
    _check_dependencies()

    # Scale base image up by ~1.143x to allow deterministic corner/center cropping
    scale_size = int(round(image_size * 1.143))
    delta = scale_size - image_size
    offset = delta // 2

    # Coordinates: (name, x_min, y_min, x_max, y_max)
    crop_boxes = [
        ("center", offset, offset, offset + image_size, offset + image_size),
        ("top_left", 0, 0, image_size, image_size),
        ("top_right", delta, 0, scale_size, image_size),
        ("bottom_left", 0, delta, image_size, scale_size),
        ("bottom_right", delta, delta, scale_size, scale_size),
    ]

    pipelines: List[A.Compose] = []

    # Outer loop: horizontal flip state (False then True)
    for hflip in [False, True]:
        for _, x_min, y_min, x_max, y_max in crop_boxes:
            steps = [
                A.Resize(height=scale_size, width=scale_size),
                A.Crop(x_min=x_min, y_min=y_min, x_max=x_max, y_max=y_max),
            ]
            if hflip:
                steps.append(A.HorizontalFlip(p=1.0))
            steps.extend([
                A.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
                ToTensorV2()
            ])

            assert isinstance(steps[-1], ToTensorV2), "ToTensorV2 must always terminate each TTA pipeline"
            pipelines.append(A.Compose(steps))

            if len(pipelines) == n_augments:
                return pipelines

    return pipelines
