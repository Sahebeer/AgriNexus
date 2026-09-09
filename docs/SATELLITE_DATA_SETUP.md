# 🛰️ AgriNexus AI — Satellite Data Setup Guide

## 1. Prerequisites & Access

AgriNexus AI interfaces with open-access Copernicus Earth observation data providers:
- **AWS Earth Search STAC API:** `https://earth-search.aws.element84.com/v1` (Default, no authentication required for metadata queries)
- **Copernicus Data Space Ecosystem (CDSE):** `https://dataspace.copernicus.eu/`
- **Microsoft Planetary Computer:** `https://planetarycomputer.microsoft.com/api/stac/v1`

---

## 2. Configuration Settings

Settings can be customized via `.env` or FastAPI settings:

```ini
# Satellite Provider Configuration
SENTINEL1_STAC_URL=https://earth-search.aws.element84.com/v1
COPERNICUS_CLIENT_ID=your_client_id_here
COPERNICUS_CLIENT_SECRET=your_client_secret_here
```

---

## 3. Registering a Field for Satellite Surveillance

In AgriNexus Farm OS, fields are tied to geographic coordinates:
1. Navigate to **Farm Management** (`/dashboard/profile` or `/dashboard/centers`).
2. Add GPS coordinates (e.g. `30.9012 N, 75.8568 E`) or GeoJSON boundary polygon.
3. Once registered, the system can acquire Sentinel-1 observations for that geometry.

---

## 4. Querying the Satellite API

### Get Latest SAR Telemetry
```http
GET /api/v1/satellite/field/{field_id}
Authorization: Bearer <jwt_token>
```

#### Response Example:
```json
{
  "status": "success",
  "field_id": 1,
  "field_name": "Field 01 - North Sector",
  "crop": "Tomato",
  "satellite": "Sentinel-1",
  "observation_date": "2026-09-08",
  "orbit": "ASCENDING",
  "polarization": "VV+VH",
  "features": {
    "vv": -12.45,
    "vh": -18.7,
    "vv_vh_ratio": 6.25,
    "radar_vegetation_index": 0.52,
    "normalized_polarization_ratio": 0.44
  },
  "temporal": {
    "has_temporal_history": true,
    "observations_count": 4,
    "delta_vv": 0.2,
    "delta_vh": 0.5,
    "delta_ratio": -0.3,
    "trend": "vegetation_expansion",
    "anomaly_detected": false
  },
  "condition": "normal",
  "confidence": 0.85,
  "interpretation": "Field backscatter aligns with standard seasonal vegetative growth."
}
```

### Get Historical Radar Observations
```http
GET /api/v1/satellite/field/{field_id}/history
Authorization: Bearer <jwt_token>
```
