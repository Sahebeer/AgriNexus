# 🛰️ AgriNexus AI — Sentinel-1 SAR Radar Architecture

## 1. Overview

AgriNexus AI incorporates active microwave Earth observation data from **Sentinel-1 C-Band Synthetic Aperture Radar (SAR)**.

Unlike passive optical sensors (such as Sentinel-2 or Landsat) which are blinded by heavy monsoon cloud cover, haze, and night, SAR actively transmits microwaves at **5.405 GHz** ($\lambda \approx 5.5 \text{ cm}$) and measures the returned backscatter.

---

## 2. Fundamental Capabilities & Limitations

> [!IMPORTANT]
> **Core Architectural Rule:**
> SAR does NOT diagnose individual leaf spots or microscopic fungal spores. SAR operates at field-level scale ($10\text{m} \times 10\text{m}$ resolution) and measures:
> - Surface roughness & soil moisture dielectric properties
> - Canopy biomass density & structure
> - Temporal phenological changes & vegetative lodging anomalies

---

## 3. SAR Pipeline Architecture

```text
Sentinel-1 Acquisition (STAC API / Copernicus Hub)
            │
            ▼
Radiometric Calibration
(Linear intensity to Sigma Nought dB: 10 * log10(sigma0))
            │
            ▼
Dual-Polarization Processing
(VV: Co-pol dielectric / VH: Cross-pol volume scattering)
            │
            ▼
Field Polygon Geometric Intersection
(Extract raster backscatter within registered farm boundary)
            │
            ▼
Temporal Dynamics & Anomaly Detection
(ΔVV, ΔVH, ΔRatio, Rolling Mean, Variance)
            │
            ▼
Baseline Agricultural Model
(Predicts: normal, excess_moisture, moisture_deficit, biomass_growth)
            │
            ▼
Database Persistence & REST API
(Stored in PostgreSQL satellite_observations)
```

---

## 4. Key Radar Indices

### 1. Backscatter Decibel Scale
$$\sigma^0_{\text{dB}} = 10 \cdot \log_{10}(\sigma^0_{\text{linear}})$$

Typical agricultural values:
- **VV:** $-18 \text{ dB}$ (dry/rough) to $-7 \text{ dB}$ (saturated/flooded)
- **VH:** $-28 \text{ dB}$ (bare soil) to $-12 \text{ dB}$ (dense canopy)

### 2. Dual-Polarization Radar Vegetation Index (RVI)
For dual-pol ($VV + VH$) C-band collections:
$$\text{RVI} = \frac{4 \cdot \sigma^0_{VH,\text{linear}}}{\sigma^0_{VV,\text{linear}} + \sigma^0_{VH,\text{linear}}}$$
Ranges from $0.0$ (bare soil, flat surface) to $\sim 1.0$ (dense vegetative volume scattering).

### 3. Cross-Polarization Ratio
$$\text{Ratio}_{\text{dB}} = \sigma^0_{VV,\text{dB}} - \sigma^0_{VH,\text{dB}}$$

---

## 5. Temporal Anomaly Detection

Sequential observations over the 12-day Sentinel-1 revisit cycle provide high-value agricultural telemetry:
- **$\Delta VV > +2.5 \text{ dB}$:** Soil moisture saturation, rain accumulation, or irrigation.
- **$\Delta VH > +1.8 \text{ dB}$:** Vigorous vegetative growth and canopy expansion.
- **$\Delta VH < -2.2 \text{ dB}$:** Canopy defoliation, lodging, or harvesting events.
