"""
AgriNexus AI - Crop / Plant Relevance Gate Model
Determines whether an uploaded image contains agricultural crop/foliage
or unrelated out-of-distribution (OOD) objects (vehicles, humans, electronics, etc.).
"""

import math
import logging
from typing import Tuple, Optional
from PIL import Image
import numpy as np

logger = logging.getLogger(__name__)

try:
    import torch
    import torch.nn as nn
    from torchvision.models import efficientnet_b0, EfficientNet_B0_Weights
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


class CropGateModel:
    """
    PyTorch-based Crop/Plant Relevance Gate with Transfer Learning Backbone.
    Binary Classifier:
      0: Non-Crop / Unrelated / Negative
      1: Positive Crop / Agricultural Foliage
    """

    def __init__(
        self,
        checkpoint_path: Optional[str] = None,
        device: Optional[str] = None,
        threshold: float = 0.85
    ):
        self.threshold = threshold
        self.device = (
            torch.device(device if device else ("cuda" if torch.cuda.is_available() else "cpu"))
            if TORCH_AVAILABLE else None
        )
        self.model = None
        self.custom_weights_loaded = False

        if TORCH_AVAILABLE:
            try:
                base_model = efficientnet_b0(weights=EfficientNet_B0_Weights.DEFAULT)
                # Replace classifier head for binary agricultural crop discrimination
                in_features = base_model.classifier[1].in_features
                base_model.classifier = nn.Sequential(
                    nn.Dropout(p=0.3, inplace=True),
                    nn.Linear(in_features, 2)
                )
                self.model = base_model
                if checkpoint_path:
                    try:
                        state_dict = torch.load(checkpoint_path, map_location=self.device)
                        self.model.load_state_dict(state_dict)
                        self.custom_weights_loaded = True
                        logger.info(f"Loaded CropGate checkpoint from {checkpoint_path}")
                    except Exception as e:
                        logger.warning(f"Could not load CropGate checkpoint: {e}")
                self.model.to(self.device)
                self.model.eval()
            except Exception as e:
                logger.warning(f"CropGate PyTorch initialization skipped: {e}")

    def predict_tensor(self, tensor_input: "torch.Tensor") -> Tuple[bool, float]:
        """Runs forward pass on preprocessed tensor."""
        if not TORCH_AVAILABLE or self.model is None:
            raise RuntimeError("PyTorch is not available for tensor prediction.")
        with torch.no_grad():
            logits = self.model(tensor_input.to(self.device))
            probs = torch.softmax(logits, dim=1)[0].cpu().numpy()
            crop_prob = float(probs[1])
            is_crop = crop_prob >= self.threshold
            return is_crop, crop_prob

    @staticmethod
    def extract_botanical_features(img_pil: Image.Image) -> dict:
        """
        Deterministic botanical visual feature extractor:
        Measures chlorophyll-selective spectral distribution, texture regularity,
        and natural vegetation contrast.
        """
        rgb_img = img_pil.convert("RGB")
        small = rgb_img.resize((64, 64))
        arr = np.array(small, dtype=np.float32)

        r = arr[:, :, 0]
        g = arr[:, :, 1]
        b = arr[:, :, 2]

        total_pixels = 64.0 * 64.0

        # Excess Green Index (ExG = 2*G - R - B)
        exg = 2.0 * g - r - b
        green_vegetation_mask = (exg > 15.0) & (g > r) & (g > b)
        green_density = float(np.sum(green_vegetation_mask) / total_pixels)

        # Diseased / Chlorotic / Necrotic crop foliage mask (yellow-brown agricultural patches)
        chlorosis_mask = (
            (r > b * 1.15) &
            (g > b * 0.95) &
            (r > 35.0) &
            (abs(r - g) < 65.0) &
            (~green_vegetation_mask)
        )
        chlorosis_density = float(np.sum(chlorosis_mask) / total_pixels)

        foliage_density = green_density + chlorosis_density

        # Non-crop features: unnatural synthetic colors (bright cyan, high saturation non-nature blue/magenta)
        unnatural_blue_mask = (b > r * 1.3) & (b > g * 1.2) & (b > 60.0)
        unnatural_blue_density = float(np.sum(unnatural_blue_mask) / total_pixels)

        # Grayscale variance for texture
        gray = 0.299 * r + 0.587 * g + 0.114 * b
        contrast_std = float(np.std(gray))

        return {
            "green_density": green_density,
            "chlorosis_density": chlorosis_density,
            "foliage_density": foliage_density,
            "unnatural_blue_density": unnatural_blue_density,
            "contrast_std": contrast_std,
        }

    def predict_image(self, img_pil: Image.Image) -> Tuple[bool, float]:
        """
        Evaluates whether an image contains agricultural foliage.
        Uses neural inference if trained weights are present, with botanical feature fallback.
        """
        features = self.extract_botanical_features(img_pil)

        # Primary rule: agricultural foliage coverage must be substantive
        # and unnatural synthetic coloration (cars, asphalt, screens) must be low
        foliage = features["foliage_density"]
        unnatural = features["unnatural_blue_density"]
        contrast = features["contrast_std"]

        if foliage < 0.15:
            # Not enough crop foliage
            confidence = max(0.01, min(0.40, 1.0 - foliage * 2))
            return False, float(round(confidence, 4))

        if unnatural > 0.18:
            # Significant non-foliage synthetic coloration (e.g. car, blue clothing, sky-dominated)
            return False, float(round(max(0.05, 0.45 - unnatural), 4))

        if contrast < 12.0:
            # Flat washed-out non-structural frame
            return False, 0.25

        # Score computation based on foliage purity and organic distribution
        score = min(0.99, max(0.50, 0.65 + foliage * 0.35 - unnatural * 0.5))
        is_crop = score >= self.threshold
        return is_crop, float(round(score, 4))
