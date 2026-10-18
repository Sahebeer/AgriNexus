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
| `tasks/indices.py` (index formulas + alert defaults) | **ADAPT** | Formulas are correct only for reflectance. Their pipeline feeds raw DNs. That is harmless for ratio indices (NDVI/NDWI/SAVI-ish), but wrong for EVI (the `+1` term). We convert to reflectance first, and reuse the alert defaults (NDVI threshold 0.3 / high 0.15 / drop 15 %). *Correction during step 1: my first draft said raw DNs also bias NDVI. They don't for these items, see 4.1.* |
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

---

# Final report (after steps 1–5)

Commits on `real-data-integration` (oldest first): `b9208fd1` audit · `9f2d6a1f` NDVI · `4cc8b6b5` weather · `92b2d04f` soil · `223f840f` KML/KMZ import · `0fed48ee` alerts · `0f420287` UI label fixes + demo script · (this report + requirements). Roll back any step with `git revert <sha>`.

## 1. Mocked vs real: before and after

| Data shown to the user | Before | After | Where it's served / shown |
|---|---|---|---|
| Field NDVI (mean, history) | Synthetic (`partition_farm_into_zones`, hard-coded growth curve) | **Real**: Sentinel-2 L2A via Element84 STAC, SCL cloud/shadow mask, per-scene mean/median/p10/p90/valid-pixel %, last 12 months; cached per field+scene | `POST /satellite-maps/analyze-boundary`, `GET /satellite-maps/demo-farm`, `GET /farms/{id}/vegetation` → satellite page, home Satellite module, Profile "real data" panel |
| EVI / SAVI / NDWI | NDWI random | **Real** (same code path, per-scene mean) | `/farms/{id}/vegetation` |
| Health score / status | From synthetic NDVI | **Derived from real NDVI** (same thresholds as before) | Satellite panel |
| Field area | Hard-coded (demo farm "12.4 ha") or spherical approximation | **Real**: pyproj WGS84 geodesic. The demo polygon is actually **50.39 ha** | Satellite panel, boundary upload response |
| Weather now + 5-day | Real Open-Meteo at GPS or **state centroid**, unlabelled simulated fallback; home Weather module showed a **hard-coded** forecast (wrong field names) | **Real** Open-Meteo at **field boundary centroid** (then GPS, then state centroid, labelled `location_basis`); fallback labelled `source: "demo"`; home module fixed | `GET /weather/forecast` → weather page, home Weather module |
| GDD, 30-day water balance, drought index | None | **Real** (ERA5 archive + forecast past_days, 10-year same-window climatology) | `agri_indices` in `/weather/forecast` |
| Soil properties | Coordinate-hashed fake values for demo users; manual entry otherwise | **Real estimate**: SoilGrids 2.0 (pH, SOC, clay/sand/silt, bulk density, total N, CEC, 0–30 cm, USDA texture), labelled "estimated, ~250 m resolution". Farmer N/P/K/pH untouched | `GET /farms/{id}/soil-estimate` → Profile panel |
| Field boundary | Draw only; API could not set one | **KML/KMZ/GeoJSON import** (+ `boundary_geojson` on create/list) | `POST /farms/boundary/parse`, `POST /farms/{id}/boundary` → Profile panel button |
| Field alerts | None (weather alerts only) | **Real-data alerts** with evidence and scene ids (NDVI drop, low NDVI, drought) | `GET /farms/{id}/alerts`, advisor context |
| Management zones, moisture index, barren land, crop type/“94 % match” on demo farm | Synthetic | **Still synthetic.** Now marked `data_provenance: demo` and prefixed “[demo layer]” in reasoning text | Satellite panel |
| Earth forecasts, Sentinel-1 SAR | Synthetic / seeded | **Unchanged (still synthetic)** | — |
| Disease classifier, mandi prices, advisor/RAG logic, expenses | — | **Untouched** (the advisor got one additive context block for alerts, see §3) | — |

## 2. OpenFarm: reused / adapted / skipped

See the table in §0.3. Code that came from OpenFarm lives in `apps/backend/app/services/realdata/`, and every file header names the source module and carries the BSD-3 notice; the full licence is in `LICENSE-OpenFarm.txt`.

| Our file | OpenFarm source | What changed |
|---|---|---|
| `realdata/sentinel2.py` | `tasks/pipeline.py`, `tasks/indices.py` | Plain-HTTP STAC (no pystac-client); reads in native UTM with nearest-neighbour SCL; **adds SCL masking** (OpenFarm has none); reflectance conversion; valid-pixel % vs field mask (theirs used the bbox); no COG/MinIO/Celery |
| `realdata/agro_weather.py` | `tasks/weather.py` | GDD reused; water balance same definition; **drought index replaced** with a climatology anomaly (theirs divides a 30-day sum by a daily std) |
| `realdata/soilgrids.py` | `tasks/soil.py` | Unit table + USDA texture triangle reused; **fixed WCS subsetting** (OpenFarm passes the Y subset as an ignored `SUBSETY` param); masked-pixel neighbourhood fallback |
| `realdata/alerts.py` | `tasks/indices.py` AlertDefaults, `pipeline.py::run_alerts` | Same thresholds; compare to previous clean reading; suppression on low valid-pixel % and long gaps; evidence/confidence/action payload |
| `realdata/boundary_import.py`, `realdata/geometry.py` | none (GeoKML idea only) | Written fresh |

Skipped: COG writing, MinIO, TiTiler, Celery/Redis, FTW boundary detection, POLARIS (US-only), Rosetta PTF, the 68-crop suitability engine, OpenFarm's org/RBAC routers.

## 3. Status: what works, what's partial, what's untested

**Works (actually run on 2026-10-19 against live services, local SQLite, `uvicorn` + `next dev`):**
- Real NDVI for the Niphad (Nashik) fixture polygon. The first uncached run took **42.8 s**: 40 scenes considered, 35 clear, 5 rejected for < 60 % valid pixels. Cached calls take **~5 s** (STAC search only).
- `scripts/demo_real_data.py` end to end, actual output:
  ```
  [boundary] saved Polygon 50.3927 ha (entered 12.4 ha); skipped: [{'name': 'Pump house', 'reason': 'no polygon (Point)'}]
  [ndvi] status=real scenes=40 rejected_low_valid=5
    2026-09-20  S2C_43QDC_20260920_0_L2A  cloud 48.4%  valid  89.2%  NDVI mean 0.336 median 0.246 p10 0.067 p90 0.730
    2026-10-02  S2A_43QCC_20261002_0_L2A  cloud  0.0%  valid 100.0%  NDVI mean 0.332 median 0.256 p10 0.082 p90 0.699
    2026-10-05  S2B_43QCC_20261005_0_L2A  cloud  0.0%  valid 100.0%  NDVI mean 0.325 median 0.251 p10 0.079 p90 0.678
    2026-10-15  S2B_43QCC_20261015_0_L2A  cloud  0.3%  valid 100.0%  NDVI mean 0.286 median 0.233 p10 0.077 p90 0.583
  [weather] source=open-meteo basis=field boundary centroid (20.078783, 74.111762) temp 24.2°C humidity 56% rain 20%
    gdd_last_30d 501.1, gdd_since_sowing 1927.2, precip_30d 13.6 mm, et0_30d 147.5 mm,
    water_balance_30d -133.8 mm, drought_index -2.87 (extreme drought, vs 10 prior years)
  [soil] estimated, ~250 m: pH 7.2, SOC 9.65 g/kg, clay 41.75 %, sand 24.07 %, silt 34.32 %,
    bulk density 1.55 kg/dm3, CEC 33.35 cmol/kg, USDA "clay" (median of 35 valid pixels within ~750 m)
  [alerts] ndvi_low [medium, conf 0.6]; drought [high, conf 0.7]
  ```
  Sanity checks: the NDVI curve is ~0.19 in dry May–June and rises to ~0.34 after the monsoon, with a Jun 17–Aug 26 monsoon cloud gap. The drought anomaly was checked against the raw windows: 14 mm vs 46–200 mm in the same window of 2016–2025, closest to 2018 (a known Maharashtra drought year). Clay ~42 % matches the region's black cotton soils (Vertisols). These are plausibility checks, **not ground-truth validation**.
- KMZ (multiple `.kml` inside), MultiPolygon with hole, Point skipped, bad file → clear 400, another user's farm → 404, over the live API.
- Frontend, checked in headless Chromium with a logged-in user: satellite page, weather page, `/dashboard/profile` panel (NDVI + soil + alerts rendered), home-page Weather/Satellite/Profile modules. All 14 `/dashboard/*` routes load with **no page errors**. Frontend `tsc` has only 1 error, `DiseaseModule.tsx:534`, which **already exists on `main`**.
- Tests: `pytest apps/backend/tests` gives **84 passed, 9 failed**. The 9 failures are all in `test_disease_api.py` and **fail identically on `main`** (verified with `git stash`). New tests (37) cover NDVI/EVI/SAVI/NDWI math, reflectance/offset handling, SCL masking, valid-pixel % maths, scene selection, geometry parsing, GDD/water balance/drought, SoilGrids units and masking (HTTP mocked), KML/KMZ/GeoJSON parsing and error cases, alert rules, and advisor prompt injection (Gemini stubbed).

**Partially working:**
- **Advisor citing alerts**: alerts go into the Gemini prompt (verified by a stubbed test). No `GEMINI_API_KEY` was configured here, so the live advisor answered with its canned offline reply, which ignores context. **Untested with real Gemini.**
- **Demo farm & drawn polygons**: NDVI, area and health are real, while zones, moisture and barren land remain synthetic (labelled).
- First NDVI request for a new field blocks the HTTP request (~45 s, 120 s budget). If the budget is hit, the response says how many scenes were skipped, and they are computed on the next request.

**Untested:**
- Postgres (Docker) path: the models are plain SQLAlchemy types, but only SQLite was run. Docker image build with the new `rasterio/shapely/pyproj` deps.
- Real Gemini responses. Large fields (> ~500 ha; hard limit 5000 ha). Fields straddling two MGRS tiles with no fully-containing tile (handled by masking but not exercised).
- Concurrent first-time requests for the same field (guarded by a unique constraint + rollback, not load-tested).
- SoilGrids under rate limiting / outage (falls back to `status: unavailable`, never fake values; only the mocked path is tested).

## 4. Known limits

1. **Earth Search metadata gotcha**: items declare `offset: -0.1` but, when `earthsearch:boa_offset_applied: true`, the pixels already have it applied. Applying it again pinned NDVI p90 to 1.0 (caught on scene `S2B_43QCC_20261015_0_L2A`). Handled in `effective_offset()`. If Element84 changes this convention, NDVI shifts.
2. **Monsoon cloud cover**: June–September often has no clear scene for weeks (the fixture had a 70-day gap). Alerts are suppressed when valid pixels < 80 % or readings are > 45 days apart, so expect few or no NDVI alerts in kharif. Sentinel-1 SAR is the real fix (not done).
3. **10 m pixels on small plots**: a 0.4 ha plot is ~40 pixels, and edge pixels mix in roads and bunds. Fields under 0.01 ha are rejected; tiny/narrow fields fall back to "all touched" pixels (noisier). Treat NDVI for plots < 1 ha as indicative.
4. **Soil is ~250 m modelled data**, not a soil test. Built-up/water pixels are masked; we then use the median within ~750 m (reported in `sampling`). Seeded demo farm #1 is in Ludhiana city and correctly returns "unavailable". `total_nitrogen` is total soil N (g/kg), **not** plant-available N.
5. **Drought index** is a 10-year standardized anomaly of 30-day P–ET0 (ERA5 ~25 km grid), not a fitted SPEI, and ERA5 lags ~5 days (filled from the forecast model).
6. **Alerts and confidence values have no accuracy validation**: thresholds come from OpenFarm defaults and confidences are hand-set heuristics. Low-NDVI alerts are expected on fallow or harvested fields; confidence drops when the sowing date doesn't place the crop at canopy stage.
7. The REST SoilGrids API returned all-null values during testing, so we use WCS (`maps.isric.org`), which is ~7 s for a cold point.
8. The existing `services/satellite.py::fetch_soilgrids_baseline` (unit bugs, fake fill-ins) is **still used by demo-user seeding**. I left it untouched to avoid changing seeding behaviour.

## 5. Commands to run and demo

```bash
git checkout real-data-integration
.venv/bin/pip install rasterio==1.4.3 shapely==2.0.6 pyproj==3.6.1 pytest==8.3.3   # Python 3.9 venv OK
node start-services.js            # backend :8000 + web :3000 (or run each as below)
# backend only:  .venv/bin/python -m uvicorn app.main:app --port 8000 --app-dir apps/backend
# web only:      npm run dev --workspace=apps/web

# end-to-end demo (creates realdata.demo@agrinexus.dev, uploads the Niphad KML, prints real values)
.venv/bin/python apps/backend/scripts/demo_real_data.py

# tests
cd apps/backend && ../../.venv/bin/python -m pytest tests -q            # 84 pass, 9 pre-existing disease failures
../../.venv/bin/python -m pytest tests/test_realdata_*.py -q             # 37 new tests, all pass
```
UI demo: log in as `realdata.demo@agrinexus.dev` / `RealData123!`, then:
- **Dashboard → Profile → Farm & Soil**: "Niphad Grape Block" → **Load real field data** (or **Import KML/KMZ/GeoJSON** with `apps/backend/tests/fixtures/niphad_fields.kml`).
- **Dashboard → Satellite**: the demo farm now shows real NDVI with scene id in the footer.
- **Dashboard → Weather**: source badge plus GDD, water balance and drought.

Pre-warm before a live demo: run the demo script once (first NDVI run ~45 s). Set `SATELLITE_PROVIDER=demo` to force the old synthetic provider offline.

## 6. Next steps if we get more time

1. **Real zones**: compute zone NDVI from the same masked raster (k-means or a grid over pixels) to replace the last synthetic layer on the satellite page; NDWI-based moisture instead of the demo moisture index.
2. **Background refresh**: a FastAPI startup task or cron that refreshes NDVI/weather for all bounded farms nightly, so no user waits ~45 s. Celery + Redis only if this outgrows a single process.
3. **Map tiles**: write per-scene NDVI COGs and serve them (TiTiler or static PNG overlays) for a real heatmap layer.
4. **PostGIS**: move `boundary_geojson` to `geometry(MultiPolygon,4326)` with Alembic once Docker Postgres becomes the primary DB.
5. **Scouting**: geotagged photo + note tied to an alert (OpenFarm `routers/scouting.py`), which also creates ground truth to **validate alert accuracy**.
6. Sentinel-1 SAR from real data (same STAC, `sentinel-1-grd`) to cover monsoon cloud gaps; fix or retire `fetch_soilgrids_baseline`.
