# 📊 AgriNexus AI — Model Evaluation & Metrics

## 1. Principles of Honest Evaluation

AgriNexus AI enforces strict measurement integrity:
1. **Never Fake Accuracy Numbers:** Metrics must represent actual measured values against unseen test sets.
2. **Report Target Failures:** If a model fails to achieve the target threshold ($\ge 90\%$), it must report `TARGET NOT ACHIEVED` alongside the actual metrics.
3. **Leakage-Free Splitting:** Samples from the same plant, field, or capture session must not be split across train and test partitions.

---

## 2. Engineering Target Metrics

| Metric | Target | Description |
|---|---|---|
| **Crop/Plant Detection** | $\ge 95\%$ | Accuracy distinguishing agricultural foliage from OOD objects |
| **Disease Classification** | $\ge 90\%$ | Top-1 multi-class diagnosis accuracy across supported pathologies |
| **Random / OOD Rejection** | $\ge 95\%$ | Rejection rate against unrelated non-crop photographs |
| **Precision** | $\ge 90\%$ | Macro-averaged precision across all disease classes |
| **Recall** | $\ge 90\%$ | Macro-averaged recall (sensitivity) |

---

## 3. Crop Gate Evaluation CLI

Evaluate the binary crop gate against positive and negative test images:

```bash
python ml/crop_gate/evaluate.py \
  --ood-dir ml/datasets/test/ood \
  --pos-dir ml/datasets/test/positive \
  --threshold 0.85
```

### Sample Output Format:
```text
========================================
OOD Random / Negative Image Evaluation
========================================
Total OOD Images:        500
Correctly Rejected:      481
Incorrectly Accepted:    19
OOD Rejection Rate:      96.20%
========================================

========================================
Positive Agricultural Crop Evaluation
========================================
Total Positive Images:   500
Correctly Accepted:      486
Incorrectly Rejected:    14
Positive Pass Rate:      97.20%
========================================
```

---

## 4. Disease Classifier Evaluation CLI

Runs test set inference, constructs full confusion matrix, per-class metrics, false positive rates (FPR), and false negative rates (FNR):

```bash
python ml/disease/evaluate.py \
  --checkpoint app/services/leaf_disease_efficientnet.pth \
  --config ml/disease/config.yaml \
  --test-dir ml/datasets/test/disease
```

### Measured Metric Definitions:
- **Per-Class Precision:** $P_c = \frac{TP_c}{TP_c + FP_c}$
- **Per-Class Recall:** $R_c = \frac{TP_c}{TP_c + FN_c}$
- **F1 Score:** $F1_c = \frac{2 \cdot P_c \cdot R_c}{P_c + R_c}$
- **False Positive Rate:** $FPR_c = \frac{FP_c}{FP_c + TN_c}$
- **False Negative Rate:** $FNR_c = \frac{FN_c}{FN_c + TP_c}$
