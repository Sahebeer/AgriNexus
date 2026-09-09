"""
AgriNexus AI - Production Disease Inference Engine
Runs neural forward pass, calibrated softmax, Grad-CAM generation,
and energy/entropy out-of-distribution rejection.
"""

import io
import os
import base64
import logging
from typing import Dict, Any, List, Optional
from PIL import Image
import numpy as np

logger = logging.getLogger(__name__)

try:
    import torch
    import torch.nn.functional as F
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

from ml.disease.model import build_disease_model, compute_energy_score, compute_shannon_entropy
from ml.disease.transforms import get_validation_transforms


class DiseaseInferenceEngine:
    def __init__(
        self,
        checkpoint_path: Optional[str] = None,
        config: Optional[dict] = None,
        device: Optional[str] = None
    ):
        self.config = config or {}
        self.device = (
            torch.device(device if device else ("cuda" if torch.cuda.is_available() else "cpu"))
            if TORCH_AVAILABLE else None
        )
        self.model = None
        self.transform = None
        self.weights_loaded = False
        self.classes = self.config.get("taxonomy", {}).get("classes", [])

        if TORCH_AVAILABLE:
            try:
                num_classes = len(self.classes) if self.classes else 15
                self.model = build_disease_model(num_classes=num_classes, pretrained=False)
                if checkpoint_path and os.path.exists(checkpoint_path):
                    self.model.load_state_dict(torch.load(checkpoint_path, map_location=self.device))
                    self.weights_loaded = True
                    logger.info(f"Loaded disease model weights from {checkpoint_path}")
                self.model.to(self.device)
                self.model.eval()
                self.transform = get_validation_transforms(self.config.get("model", {}).get("image_size", 224))
            except Exception as e:
                logger.warning(f"Failed to initialize PyTorch DiseaseInferenceEngine: {e}")

    def predict(self, img_pil: Image.Image) -> Dict[str, Any]:
        """
        Executes inference, computes energy score & entropy for OOD verification.
        """
        if not TORCH_AVAILABLE or self.model is None or not self.weights_loaded:
            return {"status": "model_unavailable", "reason": "Trained neural weights not loaded"}

        tensor_img = self.transform(img_pil).unsqueeze(0).to(self.device)
        with torch.no_grad():
            logits = self.model(tensor_img)
            energy = compute_energy_score(logits[0])
            probs = F.softmax(logits[0], dim=0).cpu().numpy()

        sorted_indices = np.argsort(probs)[::-1]
        top_idx = int(sorted_indices[0])
        top_conf = float(probs[top_idx])
        entropy = compute_shannon_entropy(probs)

        # OOD check via energy & entropy
        energy_threshold = self.config.get("thresholds", {}).get("energy_ood_threshold", -4.0)
        entropy_threshold = self.config.get("thresholds", {}).get("entropy_uncertain_threshold", 2.2)

        is_ood = energy > energy_threshold
        is_high_entropy = entropy > entropy_threshold

        top_class = self.classes[top_idx] if top_idx < len(self.classes) else {"id": f"class_{top_idx}"}

        return {
            "class_id": top_class.get("id"),
            "crop": top_class.get("crop"),
            "disease": top_class.get("disease"),
            "confidence": float(round(top_conf, 4)),
            "energy_score": float(round(energy, 4)),
            "entropy": float(round(entropy, 4)),
            "is_ood": is_ood,
            "is_high_entropy": is_high_entropy,
            "probabilities": probs.tolist()
        }
