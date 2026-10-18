#!/usr/bin/env python3
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from PIL import Image
from ml.disease.inference import DiseaseInferenceEngine

def run_diag(image_path):
    print(f"\n{'='*60}")
    print("LOADING ENGINE...")
    engine = DiseaseInferenceEngine()
    if not getattr(engine, "_ready", False):
        print("ERROR: Engine not ready — check colab_trained/best_model.pth exists")
        return
    print(f"Engine ready. background_idx={engine.background_idx}")
    print(f"Thresholds: confidence={engine.confidence_threshold}, energy={engine.energy_threshold}, entropy={engine.entropy_threshold}")

    img = Image.open(image_path).convert("RGB")
    print(f"Image: {image_path} | size={img.size}")
    print("--- Running predict() ---")
    res = engine.predict(img)
    for k, v in res.items():
        if k != "top3_predictions":
            print(f"  {k}: {v}")
    print("  top3_predictions:")
    for p in (res.get("top3_predictions") or []):
        print(f"    {p}")
    print('='*60)

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "apps/web/public/specimens/tomato_late_blight.jpg"
    run_diag(path)
