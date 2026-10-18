# AgriNexus: Real-Data Integration Report

Branch: `real-data-integration` (one commit per step, so any step can be rolled back).
Donor code: `sample proj/OpenFarm-main` (BSD-3-Clause). `sample proj/geokml-oss-master` (MIT) was used only for ideas, not code.

---

## Step 0: Audit (before integration)

### 0.1 Our backend: mocked vs real

| Area | File(s) | State before | Consumed by (frontend) |
|---|---|---|---|
| Sentinel-2 NDVI / field analysis | `services/satellite_provider.py` (`DemoSatelliteProvider`, `SentinelSatelliteProvider`) | **Mocked.** `get_default_satellite_provider()` always returns the demo provider. `SentinelSatelliteProvider` falls back to the demo in both branches. NDVI comes from `partition_farm_into_zones` (synthetic), and `growth_history` is a hard-coded curve (`mean * 0.45 … 0.98`). | `app/dashboard/satellite/page.tsx` → `GET /satellite-maps/demo-farm`, `POST /satellite-maps/analyze-boundary`; rendered by `components/farm/FarmAnalysisPanel.tsx` (`ndvi_mean`, `growth_history`, `satellite_source`, `is_demo`) |
| NDVI/NDWI history per farm | `services/satellite.py::compute_satellite_indices` | **Mocked.** Crop-curve formula plus random noise. | `GET /farms/{id}/satellite-history` (no UI found calling it) |
| Sentinel-1 SAR | `services/sar/processor.py`, `api/satellite.py` | Seeded or synthetic observations (out of scope here; left untouched) | satellite page radar panel |
| Weather | `services/weather.py::get_state_weather` | **Partly real.** Live Open-Meteo forecast, but at farm GPS **or state centroid**. On failure it silently returns `get_state_weather_fallback` (simulated) with **no source label**. No GDD, water balance or drought index. | `components/modules/WeatherModule.tsx`, `app/dashboard/weather/page.tsx` → `GET /weather/forecast`; advisor context |
| Soil (farm) | `api/farms.py::create_farm`, `services/satellite.py::ingest_automated_farm_data` | **Mocked for demo users.** Soil reports are seeded from `seed_factor = lat*10000+lon*10000`. Manual entry otherwise. | `ProfileModule.tsx`, `SoilPredictionModule.tsx` |
| SoilGrids helper | `services/satellite.py::fetch_soilgrids_baseline` | Calls the real API, but **unit bugs** (SOC dg/kg÷10 is labelled "%" but is g/kg; nitrogen cg/kg÷100 is labelled mg/kg but is g/kg). Silently mixes in coordinate-hashed fake values for missing properties. | indirect (seeding) |
| Soil prediction / crop recommender | `services/soil_predictor.py`, `services/crop_recommender.py` | Real models (RF + OOD gating) on **user-entered** inputs. | `SoilPredictionModule.tsx`, `CropRecommendationModule.tsx` |
| Earth forecasts | `services/earth_intelligence.py` | Mocked ("ensemble forecasting simulation") | `GET /farms/{id}/earth-forecasts` |
| Barren land | `services/barren_land.py` | Mocked (deterministic synthetic parcels) | FarmAnalysisPanel "barren" tab |
| Area | `services/geospatial/geometry.py` | Real (spherical approximation) | satellite page |
| Disease, mandi, advisor/RAG, expenses | — | **Out of scope: must stay untouched** | — |

### 0.2 Field geometry format (new code must match)

- `farms.boundary_geojson` is a `Text` column holding a **GeoJSON geometry string** (not a Feature), `{"type":"Polygon","coordinates":[[[lon,lat],...]]}`, WGS84, lon/lat order. Example: seeded farm #1.
- The frontend sends `boundary` as a bare ring `[[lon,lat],...]` to `/satellite-maps/analyze-boundary`.
- `CreateFarmRequest` / `FarmOut` do **not** expose `boundary_geojson` today, so the UI cannot set a boundary when creating a farm.
- DB: local dev runs **SQLite** (`agrinexus_dev.db`), because `psycopg2` is not installed in `.venv`. Docker uses plain Postgres 15 (**no PostGIS**). Decision: keep GeoJSON-as-text and compute geometry with shapely/pyproj.
- Local venv is Python **3.9**, so new code avoids `X | Y` type syntax at runtime.

### 0.3 OpenFarm modules: REUSE / ADAPT / SKIP

| OpenFarm module | Decision | Reason |
|---|---|---|
| `tasks/indices.py` (index formulas + alert defaults) | **ADAPT** | Formulas are correct only for reflectance. Their pipeline feeds raw DNs, which breaks EVI (the `+1` term) and biases NDVI. We apply STAC `scale`/`offset` first, and reuse the alert defaults (NDVI threshold 0.3 / high 0.15 / drop 15 %). |
| `tasks/pipeline.py::search_scenes` | **ADAPT** | Same Element84 STAC idea, but plain HTTP (no `pystac-client`, which has no compatible wheel on our Py3.9). Weekly binning kept; scene-level cloud filter loosened because we mask per pixel. |
| `tasks/pipeline.py::read_band_windowed` | **ADAPT (rewritten)** | It reprojects raw bands to EPSG:4326 with **bilinear** resampling and fill 0. That blurs field edges, and 0-fill pixels pollute stats. We read in native UTM, with nearest-neighbour for SCL. |
| `tasks/pipeline.py` cloud handling | **N/A, add our own** | **No cloud masking at all** (only scene-level `eo:cloud_cover < 20`). We add an SCL mask (classes 0,1,3,8,9,10,11). |
| `tasks/pipeline.py::compute_zonal_stats` | **ADAPT** | Its `quality_score` divides by the bbox+buffer pixel count, not the field pixel count. We compute valid-pixel % against the field mask. |
| `tasks/pipeline.py::run_alerts` | **ADAPT** | Rules reused (threshold + drop vs rolling mean). Added: suppression on low valid-pixel %, evidence/confidence/action payload. No DB `Alert` table; computed on read. |
| `tasks/pipeline.py::write_cog`, MinIO, TiTiler | **SKIP** | Infrastructure we were told not to add. |
| `tasks/ndvi.py`, `vegetation.py`, `backfill.py` | **SKIP** | Celery wrappers around the pipeline. |
| `tasks/weather.py::_calculate_gdd` | **REUSE** | Standard averaging GDD; base temperature made a constant. |
| `tasks/weather.py::_update_water_balance` drought index | **ADAPT** | Their index is `sum30(P-ET0) / stddev(daily P-ET0 over 30d)`. That mixes a 30-day sum with a daily std, and the scale depends on window variability rather than climatology. We use a z-score of the current 30-day balance against all rolling 30-day balances in the past 365 days (SPEI-like proxy, still uncalibrated). |
| `tasks/weather.py::_fetch_open_meteo` | **ADAPT** | Same API; we use the archive endpoint for history and keep daily variables only. |
| `tasks/soil.py` SoilGrids WCS + unit table | **ADAPT** | Unit conversion table reused (it matches the ISRIC FAQ). We use the simpler SoilGrids REST point query (1 call instead of ~180 WCS calls). |
| `tasks/soil.py::_classify_texture` | **REUSE** | USDA triangle classifier (with BSD notice). |
| `tasks/soil.py` POLARIS, Rosetta PTF, carbon stock | **SKIP** | POLARIS is US-only. Rosetta needs extra deps and time. |
| `core/soil_intelligence.py` (68 crop profiles) | **SKIP (for now)** | 2.2k lines, overlaps our RF crop recommender. Candidate for later. |
| `tasks/detection.py`, `routers/detection.py` (FTW) | **SKIP** | Explicitly excluded (heavy model). |
| `routers/*` (farms, fields, orgs, share, jobs, scouting) | **SKIP** | Multi-tenant org/RBAC model differs from ours; we keep our routers. |
| `routers/uploads.py` (KML) | **IDEA ONLY** | Our parser is written fresh with stdlib XML + shapely (KMZ multi-file, MultiPolygon, altitude strip). |
| GeoKML (whole project) | **IDEA ONLY** | KMZ import/export and inspection workflow ideas. No code taken. |
