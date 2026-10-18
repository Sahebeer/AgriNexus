"""
AgriNexus AI - Plant Disease Detection Backbone & OOD Architecture
Batch 2 Implementation according to plan.md (Section 1, Section 2.2, Section 5 Script 3).

Supported Architectures:
- Primary: ConvNeXt-Base (torchvision) with custom LayerNorm+Dropout+Linear head
- Fallback: EVA-02-S (timm: eva02_small_patch14_336)
- Gate 1: MobileNetV3-Small binary gate (leaf vs non-leaf background)
- Out-of-Distribution (OOD): Free Energy score & Shannon Entropy helpers
- Optimization: Layer-wise learning rate decay across backbone stages
"""

import os
import json
import logging
import types
from typing import Dict, Any, List, Optional, Union
import numpy as np

import torch
import torch.nn as nn
from torchvision.models import (
    convnext_base,
    ConvNeXt_Base_Weights,
    mobilenet_v3_small,
    MobileNet_V3_Small_Weights,
)

logger = logging.getLogger(__name__)


def _load_weights_from_checkpoint(model: nn.Module, checkpoint_path: Optional[str]) -> nn.Module:
    """
    Safely loads weights from checkpoint_path into model.
    Logs warning if file does not exist or loading fails without crashing.
    """
    if checkpoint_path is None:
        return model

    if not os.path.isfile(checkpoint_path):
        logger.warning("Checkpoint path '%s' does not exist. Initializing without checkpoint.", checkpoint_path)
        return model

    try:
        checkpoint = torch.load(checkpoint_path, map_location="cpu")
        if isinstance(checkpoint, dict):
            if "model_state_dict" in checkpoint:
                state_dict = checkpoint["model_state_dict"]
            elif "state_dict" in checkpoint:
                state_dict = checkpoint["state_dict"]
            else:
                state_dict = checkpoint
        else:
            state_dict = checkpoint

        # Strip DistributedDataParallel 'module.' prefix if present
        cleaned_state_dict = {
            (k[7:] if k.startswith("module.") else k): v
            for k, v in state_dict.items()
        }
        msg = model.load_state_dict(cleaned_state_dict, strict=False)
        logger.info("Successfully loaded checkpoint from '%s': %s", checkpoint_path, msg)
    except Exception as exc:
        logger.warning("Failed to load checkpoint from '%s': %s. Continuing with initialized weights.", checkpoint_path, exc)

    return model


def _validate_num_classes_against_mapping(num_classes: int) -> None:
    """Validates requested num_classes against class_mapping.json if present."""
    candidate_paths = [
        "ml/disease/class_mapping.json",
        os.path.join(os.path.dirname(__file__), "class_mapping.json"),
    ]
    for path in candidate_paths:
        if os.path.isfile(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    mapping_data = json.load(f)
                    expected = mapping_data.get("num_classes")
                    if expected is None and "classes" in mapping_data:
                        expected = len(mapping_data["classes"])
                    if expected is not None and expected != num_classes:
                        logger.warning(
                            "Requested num_classes (%d) does not match %s (%d classes).",
                            num_classes,
                            path,
                            expected,
                        )
                break
            except Exception as e:
                logger.debug("Could not parse class mapping at %s: %s", path, e)


def build_model(
    backbone: str = "convnext_base",
    num_classes: int = 61,
    pretrained: bool = True,
    drop_path_rate: float = 0.3,
    checkpoint_path: Optional[str] = None,
) -> nn.Module:
    """
    Instantiates vision backbone with custom classification head for 61-class
    plant disease taxonomy (60 disease/healthy + 1 explicit background class).

    Args:
        backbone: Model architecture ('convnext_base' or 'eva02_small_patch14_336').
        num_classes: Number of target classes (default 61).
        pretrained: Whether to load ImageNet-1k pretrained weights.
        drop_path_rate: Stochastic depth / drop path rate (0.3 for ConvNeXt-Base).
        checkpoint_path: Optional path to saved checkpoint weights.

    Returns:
        nn.Module: Configured neural network.
    """
    _validate_num_classes_against_mapping(num_classes)

    backbone_norm = backbone.lower().strip()

    if backbone_norm == "convnext_base":
        weights = ConvNeXt_Base_Weights.IMAGENET1K_V1 if pretrained else None
        # torchvision convnext_base accepts stochastic_depth_prob in kwargs
        model = convnext_base(weights=weights, stochastic_depth_prob=drop_path_rate)

        # In torchvision ConvNeXt, classifier[2] is the Linear layer
        in_features = model.classifier[2].in_features

        # Ensure spatial avgpool output (B, C, 1, 1) is flattened to (B, C) before entering classifier
        model.avgpool = nn.Sequential(model.avgpool, nn.Flatten(1))

        # Standardized head replacement: LayerNorm(in_features) -> Dropout(0.3) -> Linear(in_features, num_classes)
        model.classifier = nn.Sequential(
            nn.LayerNorm(in_features),
            nn.Dropout(p=0.3),
            nn.Linear(in_features, num_classes),
        )

    elif backbone_norm in ("eva02_small_patch14_336", "eva02_s", "eva02"):
        try:
            import timm
        except ImportError as e:
            raise ImportError(
                "The 'timm' library is required to build the 'eva02_small_patch14_336' backbone. "
                "Please install it using: pip install 'timm>=1.0.0'"
            ) from e

        model = timm.create_model(
            "eva02_small_patch14_336",
            pretrained=pretrained,
            drop_path_rate=drop_path_rate,
        )

        in_features = model.num_features if hasattr(model, "num_features") else model.head.in_features
        model.head = nn.Sequential(
            nn.LayerNorm(in_features),
            nn.Dropout(p=0.3),
            nn.Linear(in_features, num_classes),
        )

    elif backbone_norm.startswith("efficientnet"):
        from torchvision.models import efficientnet_b0, EfficientNet_B0_Weights
        weights = EfficientNet_B0_Weights.DEFAULT if pretrained else None
        model = efficientnet_b0(weights=weights)
        in_features = model.classifier[1].in_features
        model.classifier = nn.Sequential(
            nn.Dropout(p=0.3),
            nn.Linear(in_features, num_classes),
        )

    else:
        raise ValueError(
            f"Unsupported backbone: '{backbone}'. Supported backbones are 'convnext_base' "
            f"and 'eva02_small_patch14_336'."
        )

    # Attach get_parameter_groups method to the model instance for convenience
    model.get_parameter_groups = types.MethodType(
        lambda self, base_lr=5e-5, head_lr=5e-4, weight_decay_backbone=0.05, weight_decay_head=1e-4, layer_decay=0.85:
            get_parameter_groups(
                self,
                base_lr=base_lr,
                head_lr=head_lr,
                weight_decay_backbone=weight_decay_backbone,
                weight_decay_head=weight_decay_head,
                layer_decay=layer_decay,
            ),
        model,
    )

    if checkpoint_path is not None:
        model = _load_weights_from_checkpoint(model, checkpoint_path)

    return model


def build_binary_gate(
    pretrained: bool = True,
    checkpoint_path: Optional[str] = None,
) -> nn.Module:
    """
    Builds Gate 1 MobileNetV3-Small binary pre-filter (leaf vs non-leaf background).

    Args:
        pretrained: Whether to use ImageNet-1k pretrained weights.
        checkpoint_path: Optional path to fine-tuned binary gate weights.

    Returns:
        nn.Module: MobileNetV3-Small with 2-class output projection.
    """
    weights = MobileNet_V3_Small_Weights.IMAGENET1K_V1 if pretrained else None
    gate = mobilenet_v3_small(weights=weights)

    # In MobileNetV3, classifier[3] is the final Linear projection
    in_features = gate.classifier[3].in_features
    gate.classifier[3] = nn.Linear(in_features, 2)

    if checkpoint_path is not None:
        gate = _load_weights_from_checkpoint(gate, checkpoint_path)

    return gate


def get_parameter_groups(
    model: nn.Module,
    base_lr: float = 5e-5,
    head_lr: float = 5e-4,
    weight_decay_backbone: float = 0.05,
    weight_decay_head: float = 1e-4,
    layer_decay: float = 0.85,
) -> List[Dict[str, Any]]:
    """
    Builds parameter groups with layer-wise learning rate decay.
    Assigns decaying learning rates backwards through ConvNeXt stages
    (stem -> stage 1 -> stage 2 -> stage 3) with full head_lr on classification head.

    Args:
        model: PyTorch neural network model.
        base_lr: Base learning rate for deepest backbone stage (stage 3).
        head_lr: Learning rate for the classification head.
        weight_decay_backbone: Weight decay for backbone parameters.
        weight_decay_head: Weight decay for classifier head parameters.
        layer_decay: Multiplicative decay factor per stage moving backwards.

    Returns:
        List[Dict[str, Any]]: Param groups compatible with PyTorch optimizers.
    """
    # 1. ConvNeXt architecture with features (8 child modules = 4 stages)
    if hasattr(model, "features") and hasattr(model, "classifier"):
        # ConvNeXt features layout:
        # features[0]: stem conv (downsample 0)
        # features[1]: stage 0 blocks
        # features[2]: downsample 1
        # features[3]: stage 1 blocks
        # features[4]: downsample 2
        # features[5]: stage 2 blocks
        # features[6]: downsample 3
        # features[7]: stage 3 blocks
        stage_to_decay_power = {
            0: 3,  # Stem / Stage 0: base_lr * (layer_decay ** 3)
            1: 2,  # Stage 1:         base_lr * (layer_decay ** 2)
            2: 1,  # Stage 2:         base_lr * (layer_decay ** 1)
            3: 0,  # Stage 3:         base_lr * (layer_decay ** 0) = base_lr
        }

        stage_groups: Dict[int, Dict[str, Any]] = {
            s: {
                "params": [],
                "lr": base_lr * (layer_decay ** stage_to_decay_power[s]),
                "weight_decay": weight_decay_backbone,
                "name": f"stage_{s}" if s > 0 else "stem_stage0",
            }
            for s in range(4)
        }

        head_group: Dict[str, Any] = {
            "params": [],
            "lr": head_lr,
            "weight_decay": weight_decay_head,
            "name": "classification_head",
        }

        for name, param in model.named_parameters():
            if not param.requires_grad:
                continue

            if name.startswith("classifier") or name.startswith("head"):
                head_group["params"].append(param)
            elif name.startswith("features."):
                parts = name.split(".")
                child_idx = int(parts[1])
                # Map child_idx 0..7 to stage 0..3
                if child_idx in (0, 1):
                    stage_idx = 0
                elif child_idx in (2, 3):
                    stage_idx = 1
                elif child_idx in (4, 5):
                    stage_idx = 2
                else:
                    stage_idx = 3
                stage_groups[stage_idx]["params"].append(param)
            else:
                # Other backbone parameters (e.g., avgpool norm if present)
                stage_groups[3]["params"].append(param)

        param_groups = [group for group in stage_groups.values() if group["params"]]
        if head_group["params"]:
            param_groups.append(head_group)
        return param_groups

    # 2. Vision Transformer (EVA-02 / ViT) with blocks
    elif hasattr(model, "blocks") and (hasattr(model, "head") or hasattr(model, "classifier")):
        head_attr = "head" if hasattr(model, "head") else "classifier"
        num_blocks = len(model.blocks)

        block_groups: Dict[int, Dict[str, Any]] = {
            b: {
                "params": [],
                "lr": base_lr * (layer_decay ** (num_blocks - 1 - b)),
                "weight_decay": weight_decay_backbone,
                "name": f"vit_block_{b}",
            }
            for b in range(num_blocks)
        }

        embed_group: Dict[str, Any] = {
            "params": [],
            "lr": base_lr * (layer_decay ** num_blocks),
            "weight_decay": weight_decay_backbone,
            "name": "vit_embeddings",
        }

        head_group = {
            "params": [],
            "lr": head_lr,
            "weight_decay": weight_decay_head,
            "name": "classification_head",
        }

        for name, param in model.named_parameters():
            if not param.requires_grad:
                continue

            if name.startswith(head_attr):
                head_group["params"].append(param)
            elif name.startswith("blocks."):
                block_idx = int(name.split(".")[1])
                block_groups[block_idx]["params"].append(param)
            else:
                embed_group["params"].append(param)

        param_groups = [embed_group] if embed_group["params"] else []
        param_groups.extend([g for g in block_groups.values() if g["params"]])
        if head_group["params"]:
            param_groups.append(head_group)
        return param_groups

    # 3. Fallback: Generic 2-group partitioning (backbone + head)
    head_params = []
    backbone_params = []
    for name, param in model.named_parameters():
        if not param.requires_grad:
            continue
        if any(head_name in name for head_name in ("classifier", "head", "fc")):
            head_params.append(param)
        else:
            backbone_params.append(param)

    groups = []
    if backbone_params:
        groups.append({
            "params": backbone_params,
            "lr": base_lr,
            "weight_decay": weight_decay_backbone,
            "name": "backbone",
        })
    if head_params:
        groups.append({
            "params": head_params,
            "lr": head_lr,
            "weight_decay": weight_decay_head,
            "name": "head",
        })
    return groups


def compute_energy_score(
    logits: torch.Tensor,
    T: float = 1.0,
    temperature: Optional[float] = None,
) -> torch.Tensor:
    r"""
    Computes Free Energy score for Out-of-Distribution (OOD) detection:
    $$E(x) = -T \cdot \log \sum_{i} e^{logits_i / T}$$

    Lower (more negative) energy indicates in-distribution samples.
    Higher (less negative / positive) energy indicates out-of-distribution (OOD) samples.

    Args:
        logits: Tensor of raw classification logits (..., num_classes).
        T: Temperature parameter (default 1.0).
        temperature: Optional alias for T to preserve legacy API signatures.

    Returns:
        torch.Tensor: Free energy score tensor with shape (...).
    """
    temp = float(temperature) if temperature is not None else float(T)
    if temp <= 0:
        raise ValueError(f"Temperature T must be positive, got {temp}")

    scaled_logits = logits / temp
    energy = -temp * torch.logsumexp(scaled_logits, dim=-1)
    return energy


def compute_shannon_entropy(
    probs: Union[torch.Tensor, np.ndarray],
    eps: float = 1e-8,
) -> torch.Tensor:
    r"""
    Computes Shannon entropy in bits for uncertainty / OOD detection:
    $$H(p) = -\sum_{i} p_i \log_2(p_i + \epsilon)$$

    Args:
        probs: Probabilities tensor or numpy array summing to 1 along the last dimension.
        eps: Numerical stability constant (default 1e-8).

    Returns:
        torch.Tensor: Shannon entropy in bits with shape (...).
    """
    if isinstance(probs, np.ndarray):
        p = torch.from_numpy(probs)
    elif isinstance(probs, torch.Tensor):
        p = probs
    else:
        p = torch.as_tensor(probs)

    entropy = -torch.sum(p * torch.log2(p + eps), dim=-1)
    return entropy


# Backward-compatibility alias for legacy code
def build_disease_model(
    model_name: str = "convnext_base",
    num_classes: int = 61,
    pretrained: bool = True,
    **kwargs,
) -> nn.Module:
    """Legacy alias redirecting to build_model."""
    return build_model(
        backbone=model_name,
        num_classes=num_classes,
        pretrained=pretrained,
        **kwargs,
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    print("=" * 70)
    print("AgriNexus AI - Batch 2 Model Smoke Tests & Edge Case Validation")
    print("=" * 70)

    # 1. ConvNeXt-Base forward pass validation
    print("\n[1/4] Testing ConvNeXt-Base Model Builder...")
    model = build_model(backbone="convnext_base", num_classes=61, pretrained=False, drop_path_rate=0.3)
    dummy_input = torch.randn(2, 3, 384, 384)
    model.eval()
    with torch.no_grad():
        out_convnext = model(dummy_input)
    print(f"  -> ConvNeXt-Base output shape: {out_convnext.shape}")
    assert out_convnext.shape == (2, 61), f"Expected (2, 61), got {out_convnext.shape}"
    assert torch.isfinite(out_convnext).all(), "ConvNeXt forward pass output contains NaN or Inf"
    print("  ✓ ConvNeXt-Base forward pass verified.")

    # 2. MobileNet-V3 binary gate forward pass validation
    print("\n[2/4] Testing MobileNet-V3 Binary Gate Builder...")
    gate = build_binary_gate(pretrained=False)
    gate.eval()
    with torch.no_grad():
        out_gate = gate(dummy_input)
    print(f"  -> MobileNet-V3 gate output shape: {out_gate.shape}")
    assert out_gate.shape == (2, 2), f"Expected (2, 2), got {out_gate.shape}"
    assert torch.isfinite(out_gate).all(), "Binary gate forward pass output contains NaN or Inf"
    print("  ✓ MobileNet-V3 binary gate verified.")

    # 3. Energy & Entropy OOD Helpers validation
    print("\n[3/4] Testing Energy and Shannon Entropy OOD Helpers...")
    energy_batch = compute_energy_score(out_convnext, T=1.0)
    print(f"  -> Energy score batch shape: {energy_batch.shape}, values: {energy_batch.tolist()}")
    assert energy_batch.shape == (2,), f"Expected shape (2,), got {energy_batch.shape}"
    assert torch.isfinite(energy_batch).all(), "Energy score contains NaN or Inf"

    # Single item 1D compatibility
    energy_single = compute_energy_score(out_convnext[0])
    assert torch.isfinite(energy_single), "Single item energy score is not finite"
    assert isinstance(float(energy_single), float), "Energy score float conversion failed"

    probs = torch.softmax(out_convnext, dim=-1)
    entropy_batch = compute_shannon_entropy(probs)
    print(f"  -> Shannon entropy batch shape: {entropy_batch.shape}, values: {entropy_batch.tolist()}")
    assert entropy_batch.shape == (2,), f"Expected shape (2,), got {entropy_batch.shape}"
    assert torch.isfinite(entropy_batch).all(), "Entropy score contains NaN or Inf"

    # NumPy compatibility test
    probs_np = probs.cpu().numpy()
    entropy_np = compute_shannon_entropy(probs_np)
    assert torch.isfinite(entropy_np).all(), "NumPy entropy computation failed"
    print("  ✓ Energy and Entropy OOD helpers verified.")

    # 4. Parameter Groups validation
    print("\n[4/4] Testing Layer-Wise Parameter Groups...")
    param_groups = model.get_parameter_groups(
        base_lr=5e-5,
        head_lr=5e-4,
        weight_decay_backbone=0.05,
        weight_decay_head=1e-4,
        layer_decay=0.85,
    )

    total_group_params = sum(len(g["params"]) for g in param_groups)
    total_trainable = len([p for p in model.parameters() if p.requires_grad])
    print(f"  -> Total parameter groups: {len(param_groups)}")
    for i, g in enumerate(param_groups):
        print(f"     Group {i} ({g['name']}): {len(g['params'])} params, lr={g['lr']:.8f}, wd={g['weight_decay']}")

    assert total_group_params == total_trainable, f"Param mismatch: {total_group_params} vs {total_trainable}"
    assert len(param_groups) == 5, f"Expected 5 groups (4 stages + head), got {len(param_groups)}"

    # Check that lrs decay backwards through the ConvNeXt stages
    stage_lrs = [g["lr"] for g in param_groups[:4]]
    assert stage_lrs[0] < stage_lrs[1] < stage_lrs[2] < stage_lrs[3] < param_groups[4]["lr"], (
        f"Learning rates are not strictly decaying backwards: {[g['lr'] for g in param_groups]}"
    )

    # Check optimizer instantiation with parameter groups
    optimizer = torch.optim.AdamW(param_groups)
    print("  ✓ Parameter groups and AdamW instantiation verified.")

    print("\n" + "=" * 70)
    print("ALL BATCH 2 SMOKE TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)
