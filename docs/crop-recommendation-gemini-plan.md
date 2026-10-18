# Crop Recommendation ("What should I plant?") — Plan + Gemini Prompt

## 1. Audit: what already exists (do NOT rebuild)

| Piece | Where | Notes |
|---|---|---|
| RF crop classifier (22 crops) | `apps/backend/app/services/artifacts/soil_crop_classifier.joblib` | Features: `N,P,K,temperature,humidity,ph,rainfall` (the Kaggle Crop Recommendation dataset) |
| Model loader + Mahalanobis OOD gate | `apps/backend/app/services/soil_model.py` | `load_soil_model()`, `mahalanobis_distance()`, `FEATURE_NAMES` |
| Predict logic, hard OOD rules, fertilizer advice | `apps/backend/app/services/soil_predictor.py` | `predict_soil()` answers "is soil X good for crop Y?" |
| API | `apps/backend/app/api/soil.py` → `/api/v1/soil/predict` | Takes a **user-chosen crop**; returns only top-3 |
| UI | `apps/web/components/modules/SoilPredictionModule.tsx` | Manual form |
| Farm + soil data | `models/farm.py` (`Farm`, `SoilReport`) | Latest `SoilReport` has N,P,K,pH,moisture,temp,humidity,texture |
| Weather | `services/weather.py::get_state_weather(state, lat, lon)` | Open-Meteo, with fallback |

**The gap:** the existing feature does not rank crops for a farm. A farmer cannot ask "given my farm's soil, the live weather and the current season, what are the best crops to sow?" That is the new feature.

## 2. Decision on forking GitHub repos
Do **not** fork a repo. The model, dataset and OOD gate are already in the repo. A fork would add a second framework (Flask/Streamlit), a duplicate model and licence overhead for no accuracy gain. The ~99% accuracy on this dataset comes from the dataset's well-separated classes, not from any repo's code. The real value is in the season logic and farm integration, which no fork has.

## 3. Scope

**In v1:** one new endpoint, one new service module, one new UI module, tests, docs.
**Out of v1 (do not build):** price/profit ranking, new model training, new DB tables or migrations, multilingual UI, any change to the disease, mandi or advisor features.

## 4. API contract

`POST /api/v1/crops/recommend` — auth required (`deps.get_current_active_user`).

Request:
```json
{
  "farm_id": 1,
  "month": 10,
  "top_n": 5,
  "overrides": {"nitrogen": 90, "phosphorus": 42, "potassium": 43, "ph": 6.5, "moisture": 30,
                "temperature": 24, "humidity": 80, "rainfall": 200}
}
```
- `farm_id`: int ≥ 1, required unless all overrides are given.
- `month`: int 1–12, optional (default: current month in Asia/Kolkata).
- `top_n`: int 1–10, default 5.
- `overrides`: optional; each field validated with the same ranges as `SoilPredictionRequest`.

Response:
```json
{
  "farm_id": 1, "month": 10, "season": "kharif",
  "soil_source": "latest_soil_report|overrides",
  "weather_source": "live|safe_defaults|manual_inputs",
  "ood_status": "ok|soft_ood|hard_ood", "ood_reason": null,
  "recommendations": [
    {"rank": 1, "crop": "Rice", "model_probability": 0.91, "season_fit": "in_season",
     "season_multiplier": 1.0, "texture_multiplier": 1.0, "score": 91.0,
     "reasons": ["Soil N, P, K close to rice benchmark"], "cautions": []}
  ],
  "model_version": "soil-crop-rf-v1"
}
```
Errors: 401 unauthenticated, 404 farm not found or not owned, 422 invalid input or no soil data (message says what is missing), 503 model unavailable (reuse `SoilModelUnavailable`).

## 5. Ranking rule (exact)
```
score = model_probability * season_multiplier * texture_multiplier * 100   (rounded to 1 decimal)
season_multiplier: in_season 1.0 | perennial 0.9 | off_season 0.6
texture_multiplier: reuse existing TEXTURE_PREFERENCES logic (1.0 or 0.85)
```
Sort by score descending. Ties are broken by model_probability, then crop name.
If hard OOD: return `recommendations: []`, `ood_status: "hard_ood"` and the reasons. Never recommend on hostile inputs.

Season by month: kharif = 6–10, rabi = 11–3, zaid = 4–5.

Crop seasons (static dict in `crop_seasons.py`; agronomic approximations, flag for expert review in a code comment):

| Crop | Season |
|---|---|
| rice, cotton, jute, pigeonpeas, mothbeans, kidneybeans | kharif |
| chickpea, lentil | rabi |
| maize | kharif, rabi |
| mungbean, blackgram | kharif, zaid |
| watermelon, muskmelon | zaid |
| pomegranate, banana, mango, grapes, apple, orange, papaya, coconut, coffee | perennial |

## 6. Files (exact)

Backend (new):
- `apps/backend/app/services/crop_seasons.py` — the dict above + `season_for_month()` + `season_fit()`
- `apps/backend/app/services/crop_recommender.py` — `recommend_crops(...)`
- `apps/backend/app/schemas/crops.py` — request/response models
- `apps/backend/app/api/crops.py` — router
- `apps/backend/tests/test_crop_recommend.py`

Backend (edit, minimal):
- `apps/backend/app/main.py` — import + `include_router(crops_router, prefix=f"{settings.API_V1_STR}/crops", tags=["crops"])`
- `apps/backend/app/services/soil_predictor.py` — only if needed: extract `_hard_ood_reasons` so it works on plain values. Behaviour must not change.

Frontend (new):
- `apps/web/components/modules/CropRecommendationModule.tsx`
- `apps/web/app/dashboard/crop-recommendation/page.tsx` (mirror `soil-prediction/page.tsx`)

Frontend (edit):
- `apps/web/app/page.tsx` — add `"crop-recommendation"` to the tab union (~L69), the nav list (~L89, category `insights`, icon `Sprout`) and the render line (~L431)

Docs: add a short "Crop Recommendation" section to `README.md`.

---

## 7. THE PROMPT FOR GEMINI (copy everything inside the block)

````
ROLE: You are a senior full-stack engineer working in an existing monorepo (AgriNexus AI). Implement exactly the feature below. Do not add extras. Do not refactor unrelated code.

FEATURE: "Crop Recommendation" — rank the best crops to sow for a farm using the farm's latest soil report, live weather, and the current season.

HARD CONSTRAINTS
1. Reuse; do not duplicate: model loading and OOD from apps/backend/app/services/soil_model.py (load_soil_model, mahalanobis_distance, FEATURE_NAMES, SoilModelUnavailable); texture logic (TEXTURE_PREFERENCES), SAFE_WEATHER_DEFAULTS and hard-OOD rules from apps/backend/app/services/soil_predictor.py; weather via services/weather.py get_state_weather(state, lat, lon) and services/satellite.py parse_gps_coordinates (see how api/weather.py uses them); auth via app.api.deps.get_current_active_user; DB via app.db.database.get_db.
2. Do NOT train or modify any model. Do NOT create DB tables or migrations. Do NOT touch disease, mandi, advisor, prices, schemes code.
3. Security: validate all inputs with Pydantic (ranges identical to SoilPredictionRequest); farm lookups must filter by Farm.user_id == current_user.id (return 404 otherwise); never return stack traces or internal paths; never accept a model path from the user.
4. Latest-stable libraries only; no new dependencies. If you think one is needed, stop and ask.
5. Follow existing code style, naming and test conventions in apps/backend/tests. Keep comments minimal and only where they explain non-obvious logic. Preserve all existing comments/docstrings you don't change.
6. Frontend: Next.js App Router + Tailwind, matching the glassmorphic look of components/modules/SoilPredictionModule.tsx. Use the existing axios client from apps/web/lib/api.ts (never hard-code URLs or tokens). Mark client components with "use client" only where needed.

REUSE DETAILS (verified against the current code; follow exactly)
- Classes and probabilities: artifact = load_soil_model(); probs = artifact["model"].predict_proba([[N, P, K, temperature, humidity, ph, rainfall]]) with the feature order taken from artifact["feature_names"] (== FEATURE_NAMES). Class names are artifact["classes"], lowercase (e.g. "kidneybeans"). Display names use .title(). This is exactly how soil_predictor.predict_soil builds model_features; mirror it, do not change it.
- Soft-OOD signals to reuse: Mahalanobis via mahalanobis_distance(model_features, artifact) compared with artifact.get("mahalanobis_threshold", MAHALANOBIS_THRESHOLD); max probability < 0.40; weather defaults used.
- Texture: reuse TEXTURE_PREFERENCES from soil_predictor.py. A crop missing from that dict defaults to ["Loamy"]. Multiplier is 1.0 if the farm's soil_texture (case-insensitive) is in the crop's list, else 0.85. If the texture is unknown or blank, use 1.0 and add no caution.
- Hard OOD: soil_predictor._hard_ood_reasons(payload) currently takes a SoilPredictionRequest, which needs crop and texture. Do NOT build a fake request. Add a new function _hard_ood_reasons_from_values(ph, nitrogen, phosphorus, potassium, moisture: Optional[float]) -> list[str] that holds the existing rules verbatim, and make _hard_ood_reasons delegate to it. Behaviour of /soil/predict must stay identical. In the new function the moisture rule is skipped when moisture is None. For the recommender, moisture comes from overrides.moisture if given, else the latest SoilReport.soil_moisture, else None (no moisture rule, and do not invent a value).
- Add "moisture" as an optional override field (0-100) alongside the others.
- Weather rainfall: inspect what get_state_weather() actually returns before choosing a key. If it only has current/hourly precipitation and no monthly total, use SAFE_WEATHER_DEFAULTS["rainfall"] and set weather_source="safe_defaults". Do not scale or fabricate a monthly figure.
- Session/farm lookup pattern: copy api/weather.py (Farm filtered by Farm.id and Farm.user_id, parse_gps_coordinates from app.services.satellite). SoilReport is in app.models.farm.

API: POST /api/v1/crops/recommend (auth required)
Request JSON: {"farm_id": int>=1 (optional only if all overrides given), "month": int 1-12 (optional, default current month Asia/Kolkata), "top_n": int 1-10 (default 5), "overrides": {nitrogen, phosphorus, potassium, ph, moisture, temperature, humidity, rainfall} (all optional, same ranges as SoilPredictionRequest)}
Soil source: overrides if all of N,P,K,ph are given; otherwise the farm's latest SoilReport (order by test_date desc). If neither exists -> 422 with a message saying "No soil report for this farm; add one or provide overrides".
Weather: temperature/humidity from get_state_weather for the farm (use farm lat/lon if gps_coordinates parse, else farm.state); rainfall: use a real value from the weather result if one exists, else SAFE_WEATHER_DEFAULTS["rainfall"] and set weather_source="safe_defaults". Never invent numbers. weather_source is one of: "live", "safe_defaults", "manual_inputs".
Response JSON: {farm_id, month, season, soil_source ("latest_soil_report"|"overrides"), weather_source, ood_status ("ok"|"soft_ood"|"hard_ood"), ood_reason, recommendations: [{rank, crop, model_probability, season_fit ("in_season"|"perennial"|"off_season"), season_multiplier, texture_multiplier, score, reasons: [str], cautions: [str]}], model_version}
Errors: 401, 404 (farm missing/not owned), 422 (bad input/no soil data), 503 (SoilModelUnavailable).

RANKING (exact)
score = round(model_probability * season_multiplier * texture_multiplier * 100, 1)
season_multiplier: in_season=1.0, perennial=0.9, off_season=0.6. texture_multiplier: existing 1.0/0.85 logic using the soil report's soil_texture (default 1.0 if unknown).
Sort by score desc, tie-break model_probability desc then crop name asc. Return top_n.
Hard OOD (reuse existing hard-OOD rules; refactor them minimally to take plain values if needed, with NO behaviour change and existing tests still passing): return recommendations=[], ood_status="hard_ood", ood_reason set.
Soft OOD (Mahalanobis > threshold, or max probability < 0.40, or weather_source=="safe_defaults"): still return ranking, ood_status="soft_ood", add a caution to every item.
Season by month: kharif 6-10, rabi 11-3, zaid 4-5.
Create apps/backend/app/services/crop_seasons.py with this static dict (comment: "agronomic approximations; review with an agronomist"):
 kharif: rice, cotton, jute, pigeonpeas, mothbeans, kidneybeans
 rabi: chickpea, lentil
 kharif+rabi: maize
 kharif+zaid: mungbean, blackgram
 zaid: watermelon, muskmelon
 perennial: pomegranate, banana, mango, grapes, apple, orange, papaya, coconut, coffee
A crop is "in_season" if the current season is in its list; "perennial" if perennial; else "off_season".
reasons: 1-3 short factual strings derived from real values (e.g. top model probability, season fit). cautions: off-season, texture mismatch, soft-OOD, safe-default weather. No generic filler.

FILES TO CREATE: apps/backend/app/services/crop_seasons.py, apps/backend/app/services/crop_recommender.py, apps/backend/app/schemas/crops.py, apps/backend/app/api/crops.py, apps/backend/tests/test_crop_recommend.py, apps/web/components/modules/CropRecommendationModule.tsx, apps/web/app/dashboard/crop-recommendation/page.tsx.
FILES TO EDIT (minimal): apps/backend/app/main.py (register router at prefix {API_V1_STR}/crops, tag "crops"); apps/web/app/page.tsx (add "crop-recommendation" to the tab union near line 69, nav list near line 89 with category "insights" and the lucide "Sprout" icon, and the render line near line 431); README.md (short "Crop Recommendation" section).

FRONTEND REQUIREMENTS
- Farm selector (load farms with the existing farms endpoint used elsewhere in the app), month selector (default current), top_n fixed at 5.
- Result cards ranked 1..5: crop name, score bar, season badge, reasons, cautions. A banner for soft/hard OOD.
- States: loading skeleton, empty state (no farms or no soil report -> CTA to Profile/Soil), error state with retry. Mobile-first responsive. Subtle fade/slide-in animation on cards.
- Unique descriptive id on every interactive element.

TESTS (pytest, apps/backend/tests/test_crop_recommend.py): unauthenticated -> 401; other user's farm -> 404; farm without soil report and no overrides -> 422; valid request returns sorted scores and <= top_n items; month 7 ranks kharif crops above rabi crops given equal probability (unit test season logic directly); hard-OOD input returns empty list; overrides path works without a farm_id. Run the whole existing backend test suite and make sure nothing regresses.

DO NOT: add dependencies, create migrations, change the model artifact, restyle other pages, rename existing files, or write placeholder/mock data in production code.

DELIVERABLE (reply format): (1) list of files created/edited, (2) the exact commands you ran for tests (backend pytest, web lint+build) and their pass/fail result, (3) any assumption you had to make, (4) anything you did NOT do. If a requirement is ambiguous or conflicts with the repo, STOP and ask one concise question instead of guessing.
````

## 8. Suggested execution order for Gemini
1. Backend service + schema + router + tests (run pytest).
2. Register router in `main.py`.
3. Frontend module + page + nav registration (run lint and build).
4. README.

## 9. Acceptance checklist
- [ ] `POST /api/v1/crops/recommend` works with `farm_id` for the demo user (seeded by `seed_demo_farm.py`).
- [ ] Other users' farms return 404.
- [ ] October request ranks kharif crops above rabi crops; January does the reverse.
- [ ] Hard-OOD soil returns no recommendations plus a reason.
- [ ] Existing `/soil/predict` behaviour is unchanged and its tests pass.
- [ ] Web build and lint pass; the new tab shows loading, empty and error states.
