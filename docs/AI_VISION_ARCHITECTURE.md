# 🌿 AgriNexus AI — Computer Vision Architecture

## 1. Executive Summary

AgriNexus AI implements a multi-stage, safety-critical agricultural computer vision pipeline designed for real-world farming environments. A traditional single-softmax neural network tends to force an arbitrary disease diagnosis even when presented with unrelated objects (cars, humans, buildings, or random internet images). AgriNexus AI prevents this through sequential gating:

```text
                     USER IMAGE
                         │
                         ▼
              ┌─────────────────────┐
              │ 1. Image Validation │  (Format, Integrity, Contrast, Blur)
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  2. Crop/Plant Gate │  (Foliar chlorophyll, Spectral ratio)
              └──────────┬──────────┘
                         │
             ┌───────────┴───────────┐
             │                       │
           FAIL                    PASS
             │                       │
             ▼                       ▼
    Crop Not Detected       ┌─────────────────────┐
                            │ 3. Crop Classifier  │ (Species: Tomato, Potato, Pepper)
                            └──────────┬──────────┘
                                       │
                                       ▼
                            ┌─────────────────────┐
                            │ 4. Pathology Head   │ (Disease vs Healthy)
                            └──────────┬──────────┘
                                       │
                                       ▼
                            ┌─────────────────────┐
                            │ 5. Energy OOD Gate  │ (Confidence & Outlier check)
                            └──────────┬──────────┘
                                       │
                        ┌──────────────┴──────────────┐
                        │                             │
                    Confident                      Uncertain
                        │                             │
                        ▼                             ▼
                    Diagnosis                 Needs Inspection
```

---

## 2. Multi-Stage Pipeline Stages

### Stage 1: Image Quality Assessment (IQA) & Validation
Before any neural processing occurs, the raw image bytes undergo verification:
- **File Integrity & Format:** Validates JPEG, PNG, and WebP payloads up to 5MB.
- **Minimum Resolution:** Rejects any image smaller than $64 \times 64$ pixels.
- **Exposure Diagnostics:** Rejects solid black ($< 12$ mean brightness), solid white ($> 245$ mean brightness with low contrast), or flat zero-contrast frames.
- **Blur Detection:** Computes the Laplacian kernel variance ($\sigma_{\text{Lap}}^2$). Frames with variance below threshold ($< 20.0$) are rejected with `IMAGE_QUALITY_TOO_LOW`.

### Stage 2: Crop / Plant Relevance Gate
- **Responsibility:** Validates whether the image contains actual agricultural crop foliage or unrelated non-crop objects (vehicles, humans, electronics, domestic interiors, documents).
- **Architecture:** Binary classifier with transfer learning backbone (`EfficientNet-B0` / `MobileNet-V3`) and deterministic botanical feature fallback.
- **Decision Contract:** If `is_crop == False`, downstream disease inference is strictly bypassed, returning `status: "crop_not_detected"`.

### Stage 3: Crop Classification
- Identifies the host agricultural crop species (e.g., Tomato, Potato, Bell Pepper, Wheat, Corn).
- Verifies crop taxonomy against the supported diagnostic registry. If unrecognized, returns `status: "unsupported_crop"`.

### Stage 4: Disease Pathology Classification
- Evaluates specific foliar disease pathogens (e.g., Early Blight, Late Blight, Bacterial Spot, Leaf Mold, Mosaic Virus, or Healthy Foliage).
- Computes Grad-CAM spatial activation heatmaps to highlight visual symptom localization.

### Stage 5: Calibrated Confidence & OOD Evaluation
- **Energy-based Out-of-Distribution Scoring:**
  $$E(x) = -T \cdot \log \sum_{i} \exp\left(\frac{f_i(x)}{T}\right)$$
- If the free energy score exceeds the in-distribution threshold, the image is flagged as out-of-distribution or uncertain.

---

## 3. Supported Crops & Pathologies

| Crop | Supported Conditions |
|---|---|
| **Tomato** | Healthy, Early Blight, Late Blight, Bacterial Spot, Leaf Mold, Septoria Leaf Spot, Spider Mites, Target Spot, Yellow Leaf Curl Virus, Mosaic Virus |
| **Potato** | Healthy, Early Blight, Late Blight |
| **Bell Pepper** | Healthy, Bacterial Spot |
| **Corn** | Healthy, Common Rust |
| **Wheat** | Healthy, Stripe Rust |

---

## 4. API Endpoints

### Primary Analysis Endpoint
`POST /api/v1/disease/analyze`
- **Content-Type:** `multipart/form-data`
- **Body:** `image` (or `file`)
- **Headers:** `Authorization: Bearer <jwt_token>`

#### Successful Diagnosis Response:
```json
{
  "status": "diagnosed",
  "crop": "tomato",
  "crop_confidence": 0.98,
  "disease": "early_blight",
  "disease_name": "Tomato Early Blight",
  "disease_confidence": 0.94,
  "supported": true,
  "message": "Definitive diagnosis: Tomato Early Blight at 94% confidence.",
  "treatment": "Apply copper-based fungicides or mancozeb...",
  "prevention": "Practice 3-year crop rotation...",
  "gradcam_overlay": "data:image/jpeg;base64,..."
}
```

#### Non-Crop Rejection Response:
```json
{
  "status": "crop_not_detected",
  "error_code": "CROP_NOT_DETECTED",
  "crop": null,
  "crop_confidence": 0.05,
  "disease": null,
  "disease_confidence": null,
  "supported": false,
  "message": "No supported crop or agricultural plant detected in the image."
}
```

---

## 5. Performance & Hardware Requirements
- **Inference Runtime:** Supports pure CPU inference without requiring dedicated GPUs.
- **Quantization & Size:** EfficientNet-B0 checkpoint is approximately 16MB.
- **Latency:** ~120ms per image on modern multi-core CPU.
