# 🛡️ AgriNexus AI — Out-of-Distribution (OOD) Rejection System

## 1. Problem Statement

Standard Deep Neural Networks (DNNs) trained with cross-entropy loss produce overconfident, arbitrary predictions when fed Out-of-Distribution (OOD) images. For example, passing a picture of a red automobile into a tomato disease classifier might produce a 98% confident prediction of "Tomato Early Blight" simply because the car is red and the model has no "car" class.

In agricultural field deployment, this behavior is catastrophic. AgriNexus AI resolves this through **two-tiered open-set rejection**.

---

## 2. Rejection Mechanism Architecture

```text
Input Image
    │
    ▼
┌──────────────────────────────────────┐
│ Tier 1: Biological Crop Gate         │
│ - Excess Green Index (ExG)           │
│ - Chlorophyll vs Synthetic cool-tones│
│ - Cellular foliar texture            │
└──────────────────┬───────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
       Pass                Fail ────────► Return 'crop_not_detected'
         │
         ▼
┌──────────────────────────────────────┐
│ Tier 2: Free Energy OOD Scoring      │
│ - Evaluates logit distribution shape │
│ - Shannon Entropy calculation        │
└──────────────────┬───────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    Low Energy          High Energy ────► Return 'uncertain'
         │
         ▼
Definitive Diagnosis
```

---

## 3. Mathematical Foundations

### 1. Free Energy Scoring
Rather than relying on the maximum softmax probability (which is susceptible to scaling distortion), AgriNexus computes the Helmholtz Free Energy of the logit outputs:

$$E(x; T) = -T \cdot \log \sum_{i=1}^{K} \exp\left(\frac{f_i(x)}{T}\right)$$

Where:
- $f_i(x)$ is the logit score for class $i$.
- $T$ is the temperature parameter (default $T = 1.0$).

In-distribution agricultural images produce high logit responses for valid classes, yielding **lower (more negative) energy**. Unrelated OOD images produce diffuse, low logits, yielding **higher energy**.

### 2. Shannon Entropy Gating
For ambiguous or mixed-symptom leaves, the predictive Shannon entropy is evaluated:

$$H(P) = -\sum_{i=1}^{K} p_i \log_2(p_i)$$

When $H(P) > 1.8 \text{ bits}$, the prediction is deemed uncertain.

---

## 4. OOD Evaluation Suite

The OOD test suite evaluates images from distinct non-crop domains:
- **Vehicles:** Cars, tractors, trucks, bicycles
- **Humans:** Faces, hands, clothing
- **Domestic & Electronics:** Mobile phones, laptops, desks
- **Urban Scenery:** Roads, brick buildings, indoor walls
- **Random Noise:** Pure noise, synthetic patterns

Test command:
```bash
python ml/crop_gate/evaluate.py --ood-dir ml/datasets/test/ood
```
Target rejection rate is $\ge 95\%$.
