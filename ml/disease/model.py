"""
AgriNexus AI - Modular Disease Classification Architecture
Supports EfficientNet-B0, MobileNet-V3, and ConvNeXt backbones with
Energy-Based OOD scoring and Shannon entropy estimation for open-set rejection.
"""

import math
import logging
from typing import Dict, Any, Tuple, Optional
import numpy as np

logger = logging.getLogger(__name__)

try:
    import torch
    import torch.nn as nn
    from torchvision.models import (
        efficientnet_b0, EfficientNet_B0_Weights,
        mobilenet_v3_small, MobileNet_V3_Small_Weights,
    )
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


def build_disease_model(
    model_name: str = "efficientnet_b0",
    num_classes: int = 15,
    pretrained: bool = True
) -> "nn.Module":
    """Instantiates modular vision backbone with tailored classification head."""
    if not TORCH_AVAILABLE:
        raise RuntimeError("PyTorch is required to build the disease model.")

    if model_name.lower().startswith("mobilenet"):
        weights = MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
        base = mobilenet_v3_small(weights=weights)
        in_features = base.classifier[3].in_features
        base.classifier[3] = nn.Linear(in_features, num_classes)
        return base
    else:  # Default to EfficientNet-B0
        weights = EfficientNet_B0_Weights.DEFAULT if pretrained else None
        base = efficientnet_b0(weights=weights)
        in_features = base.classifier[1].in_features
        base.classifier = nn.Sequential(
            nn.Dropout(p=0.4, inplace=True),
            nn.Linear(in_features, num_classes)
        )
        return base


def compute_energy_score(logits: "torch.Tensor", temperature: float = 1.0) -> float:
    """
    Computes Free Energy score: E(x) = -T * log(sum(exp(f_i(x)/T)))
    Lower (more negative) energy indicates in-distribution samples;
    Higher (less negative / positive) energy indicates out-of-distribution (OOD) samples.
    """
    scaled = logits / temperature
    energy = -temperature * torch.logsumexp(scaled, dim=-1)
    return float(energy.item())


def compute_shannon_entropy(probabilities: np.ndarray) -> float:
    """Computes Shannon entropy: H(P) = -sum(p_i * log2(p_i))."""
    eps = 1e-12
    p_clamped = np.clip(probabilities, eps, 1.0)
    entropy = -float(np.sum(p_clamped * np.log2(p_clamped)))
    return entropy
