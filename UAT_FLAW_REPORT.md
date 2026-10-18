# 🧾 AgriNexus — UAT & Production-Readiness Audit Report

**Product:** AgriNexus AI — Smart Farm Management & Precision Agriculture Platform
**Scope:** Full-stack review — Backend (FastAPI), Frontend (Next.js), Auth flow, API contracts, ML services
**Auditor:** Buffy (Freebuff) — Professional UAT / QA Audit
**Date:** September 10, 2026
**Environment audited:** `apps/backend` (FastAPI v0.110, SQLAlchemy 2.0, Pydantic v2), `apps/web` (Next.js 16, React 19, Zustand, Axios)

---

## 1. Executive Summary

| Category | Count |
|---|---|
| 🔴 Critical (security / auth) | 10 |
| 🟠 High (broken API contracts / wrong connections) | 10 |
| 🟡 Medium (backend logic errors) | 13 |
| 🟡 Medium (frontend logic / UI errors) | 10 |
| 🔵 Low (hygiene / consistency) | 6 |
| **Total findings** | **49** |

**Verdict: ❌ NOT production-ready.** The application compiles and typechecks (`tsc --noEmit` → 0 errors; Python `compileall` → clean), but contains **authentication backdoors, cross-tenant data access (IDOR), and 8 silently broken frontend→backend integrations**. Every flaw below was verified by reading the shipped source code — none are speculative.

### Verification Performed
- **Frontend:** `tsc --noEmit` → **0 type errors**. All reported bugs are runtime/logic bugs — the API-contract breaks compile cleanly because responses are typed `any`.
- **Backend:** `python -m compileall` → clean. Full `pytest` could not run in the audit environment (no Python deps installed) — recommend running `pytest tests/` in the container.
- **Contract cross-check:** every `api.*` call site in the web app (97 call sites) was grepped and matched against the backend router table.

---

## 2. 🔴 CRITICAL — Security & Authentication (10)

### C-01. Hardcoded login backdoor
**File:** `apps/backend/app/api/auth.py` → `login_access_token`
Any login request with the password `password123`, `admin123`, or `Password123!` succeeds for **any admin user or any user with id 1 or 2, regardless of the account's real password.**
```python
if not password_valid and form_data.password in ["password123", "admin123", "Password123!"]:
    if user.role == "admin" or user.id in [1, 2]:
        password_valid = True
```
**Impact:** Full account takeover of the primary accounts with publicly guessable credentials. Ship-blocking.

### C-02. Self-service privilege escalation
**Files:** `apps/backend/app/api/auth.py` → `register_user`, `update_user_me`; `apps/web/app/register/page.tsx`
- `POST /auth/register` accepts `role` from the client body — anyone can register directly as `admin`/`expert`. The registration UI even offers "System Administrator" in the role dropdown.
- `PUT /auth/me` lets an authenticated user change **their own role** (`if user_in.role is not None: current_user.role = user_in.role`).
**Impact:** Any visitor can become an admin in one request.

### C-03. Unauthenticated requests silently act as the admin user
**File:** `apps/backend/app/api/deps.py` → `get_current_user_optional`
With no token or an invalid token, the dependency falls back to `db.query(User).filter(User.role == "admin").first()` and returns that admin. Used by **advisor chat, advisor sessions list/delete, and ALL calendar routes**.
**Impact:** Anonymous users read and write the admin's chat history and calendars; all "optional auth" endpoints are effectively public.

### C-04. Calendar IDOR — cross-tenant read/modify/delete
**File:** `apps/backend/app/api/calendar.py`
- `GET /calendar/{cal_id}`, `PATCH /calendar/{cal_id}/events/{event_id}`, `PATCH /calendar/events/{event_id}/toggle`, `DELETE /calendar/{cal_id}` never filter by `user_id`.
- `GET /calendar/` **falls back to returning every user's calendars** when the caller has none:
```python
if not cals:
    cals = db.query(CropCalendar).order_by(CropCalendar.created_at.desc()).all()
```
**Impact:** Any user (or anonymous caller, per C-03) can view, toggle, and delete other farmers' crop schedules.

### C-05. Advisor feedback IDOR
**File:** `apps/backend/app/api/advisor.py` → `post_message_feedback`
Verifies only that the message exists — no `user_id` ownership check. Any user can overwrite `thumbs_up`/`thumbs_down`/`expert_correction` on any other user's chat messages.

### C-06. Hardcoded JWT secret & overlong admin tokens
**Files:** `apps/backend/app/core/config.py`, `apps/backend/app/api/admin.py`
- `SECRET_KEY: str = "supersecretjwtkeyforagrinexusdevonly123!"` — committed default. If `.env` is absent in a deployment, tokens are forgeable by anyone with the repo.
- Admin login issues tokens valid for `ACCESS_TOKEN_EXPIRE_MINUTES * 2` = **14 days**.
- Combined with the hardcoded secret: trivially forgeable 14-day admin sessions.

### C-07. No rate limiting or login throttling
No `slowapi`/middleware rate limiting anywhere. Combined with C-01's known passwords and wildcard email matching (`User.email.ilike(username)` — `%`/`_` are live SQL LIKE wildcards), both brute force and account enumeration are trivial.

### C-08. Public ML / inference endpoints (no auth dependency)
**Files:** `apps/backend/app/api/soil.py`, `apps/backend/app/api/satellite_maps.py`
`POST /soil/predict`, `GET /soil/benchmarks`, `GET /satellite-maps/demo-farm`, `POST /satellite-maps/analyze-boundary`, `POST /satellite-maps/calculate-area` have **no auth dependency at all** — inconsistent with the rest of the API. Model-inference and geospatial compute endpoints are open to anonymous abuse (cost/DoS vector).

### C-09. CORS configuration blocks real deployments; frontend breaks HTTPS
**Files:** `apps/backend/app/main.py`, `apps/web/lib/api.ts`
- `main.py` allow-origin regex covers only `localhost` + RFC1918 LAN IPs. The configured `BACKEND_CORS_ORIGINS` in `config.py` is **dead code — never applied** to the middleware.
- Frontend interceptor force-rewrites `config.baseURL` to `http://<hostname>:8000` for any non-localhost host → breaks HTTPS/proxied deployments (mixed-content blocked by browsers) and hard-codes port 8000.
**Impact:** The app works only on a laptop LAN demo; any hosted deployment fails CORS or mixed-content.

### C-10. Auth route protection misses its own admin routes
**File:** `apps/web/components/AuthProvider.tsx`
- `PUBLIC_ROUTES = ["/login", "/register", "/"]` excludes `/admin/login`, `/terms`, `/api-policy` → anonymous visitors to `/admin/login` are bounced to `/login` first (the admin console is only reachable while already logged in).
- Role gating checks `pathname.startsWith("/dashboard/admin")`, but the admin console lives at `/admin` — **the admin-route check can never fire.**

---

## 3. 🟠 HIGH — Broken API Contracts / Wrong Connections (10)

Every item below was verified by grepping all 97 frontend `api.*` call sites against the backend router table. Each one fails **silently** — the UI falls back to fake data or ignores the error.

### H-11. Schemes module calls a non-existent endpoint
- **Frontend:** `components/modules/SchemesModule.tsx` → `GET /api/v1/schemes/catalog`
- **Backend:** exposes `GET /schemes/all` and `GET /schemes/recommend`
- **Result:** 404 on every load; users permanently see the hardcoded demo schemes, never real data.

### H-12. Satellite boundary analysis posts to the wrong route with the wrong body
- **Frontend:** `components/modules/SatelliteModule.tsx` → `POST /satellite-maps/analyze-polygon` with `{coordinates, name, crop}`
- **Backend:** `POST /satellite-maps/analyze-boundary` expects `{boundary, crop, farm_name}`
- **Result:** user-drawn field analysis never reaches the backend; the UI toasts "Applied fallback agronomic analysis."

### H-13. Profile page calls two endpoints that don't exist
- **Frontend:** `app/dashboard/profile/page.tsx` → `GET /satellite-maps/history?farm_id=` and `GET /satellite-maps/forecast?farm_id=`
- **Backend:** the real routes are `GET /farms/{farm_id}/satellite-history` and `GET /farms/{farm_id}/earth-forecasts`
- **Result:** satellite history and Earth-intelligence forecasts never load in the profile console.

### H-14. Timeline module uses the wrong URL prefix
- **Frontend:** `components/modules/TimelineModule.tsx` → `/api/v1/activities/`, `/api/v1/activities/{id}`
- **Backend:** the router prefix is `/api/v1/activity` (the legacy `dashboard/timeline` page uses the correct one)
- **Result:** diary list/create/delete all 404; the module then renders fake demo entries which, when deleted, throw 404 toasts.

### H-15. Shopping-list item toggle hits a non-existent route; list rendering crashes
- **Frontend:** `components/modules/ShoppingModule.tsx` → `PATCH /shopping/items/{itemId}/toggle`
- **Backend:** only `PATCH /shopping/{list_id}/items/{item_id}` exists
- **Also:** `GET /shopping/` returns **summaries without `items`**, but the module immediately sets the first row as `activeList` and renders `activeList.items.map(...)` → **runtime TypeError** on first load with existing lists.
- **Result:** purchase checkboxes never persist; checklist view crashes.

### H-16. Expense optimizer body is silently ignored
- **Frontend:** `app/dashboard/expenses/page.tsx` → `POST /expenses/optimize` with JSON body `{farm_size_hectares, crop}`
- **Backend:** reads **query parameters** `farm_size` (default 1.5) and `crop_context` (default "")
- **Result:** HTTP 200, but the user's farm size and crop are discarded; the forecast silently uses defaults.

### H-17. Advisor feedback route mismatch
- **Frontend:** `app/dashboard/advisor/page.tsx` → `POST /advisor/messages/{id}/feedback`
- **Backend:** `POST /advisor/feedback/{id}`
- **Result:** thumbs-up/down and expert corrections always 404.

### H-18. Weather module reads field names the backend never sends
- **Frontend:** `components/modules/WeatherModule.tsx` reads `data.rain_probability` and `data.daily_forecast`
- **Backend:** returns `rain_chance` and `forecast`
- **Result:** the real 5-day forecast never renders — the hardcoded sample cards ("Today…Day 5") always display. `rain_chance` shows as `undefined` in the header.

### H-19. Advisor "farmer context" built by the UI is discarded
- **Frontend:** `app/dashboard/advisor/page.tsx` assembles `farmer_context.farms` from localStorage and sends it
- **Backend:** `api/advisor.py` → `enriched_context.update({"farms": farms_list, ...})` **overwrites the `farms` key** with DB farms
- **Result:** any farm context the UI supplies is thrown away; the two data sources also conflict in shape.

### H-20. Two divergent frontend implementations shipped at once
`components/modules/*` (live on `/`) and `app/dashboard/*` (legacy; `/dashboard` only redirects to `/`) implement the same screens against **different endpoints with different bugs**. Half the codebase is dead but shipped, and bug fixes applied to one copy do not reach the other.

---

## 4. 🟡 MEDIUM — Backend Logic Errors (13)

### B-21. Ambiguous admin lookup on username login
`auth.py`: username `admin` resolves via `or_(User.role == "admin", User.email.ilike("admin%"))` → arbitrary first row. With multiple admins, the wrong account can be selected.

### B-22. Dead heavy-rain alert logic
`services/weather.py` checks `daily_data.get("precipitation_sum")` but the Open-Meteo request never asks for `precipitation_sum` → that alert path can never trigger.

### B-23. GPS validation is geographically meaningless
`services/satellite.py check_gps_state_match` and the weather "Location Mismatch" alert use a **6-degree Euclidean threshold (~660 km)** — a field in Delhi "matches" Punjab. GPS is also only validated at farm creation.

### B-24. GPS parser corrupts valid input
`parse_gps_coordinates` deletes every `N/S/E/W` letter anywhere in the string and negates latitude/longitude if `S`/`W` appears anywhere — e.g. a place name containing "W" silently negates the longitude.

### B-25. Hardcoded personal names in business logic
`is_demo_user()` returns True if the email contains `"sahebjot"` or `"rajesh"`. Demo auto-seeding of soil reports/telemetry is keyed to these names: real users get blank behavior; an unrelated real user named Rajesh gets synthetic data injected.

### B-26. Hardcoded `server_time`
`api/admin.py` returns `server_time: "2026-09-09T23:30:00Z"` as a constant — already stale and wrong.

### B-27. Startup DB bootstrap swallows all errors
`main.py` wraps `Base.metadata.create_all` + demo seeding in one broad `try/except print`. A broken database looks "healthy" at boot. Seeding also runs on **every** startup (slow boots; writes demo data in prod).

### B-28. Soil model crash path & silent dataset fallback
`services/soil_predictor.py`:
- `classes.index(crop)` raises `ValueError` (→ HTTP 500) if a dataset crop label isn't in the model's class list.
- When `datasets/soil recommendation/Crop_recommendation.csv` isn't shipped (as in Docker), requirements silently fall back to 6 hardcoded crops with no signal to the caller.

### B-29. No server-side validation of enumerated values
Expense `category`, mandi listing `status` (`active|completed|cancelled`), activity types, and password strength are client-side only or absent — invalid values persist straight to the DB.

### B-30. Login UI contradicts backend capability
Backend supports email/phone/username login, but `/login` uses `type="email"` → browser validation blocks phone-number login entirely.

### B-31. Scan history cannot be re-verified
`api/disease.py` stores only `image_path=upload.filename` in `ScanLog` — the image itself is never persisted, so expert feedback/audit flows reference unverifiable records.

### B-32. Deprecated / truncated-password handling
`datetime.utcnow()` (deprecated) used in token creation and event completion; bcrypt silently truncates passwords at 72 bytes instead of rejecting long passwords.

### B-33. Mutable-state & staleness details
`updated_at` relies on `onupdate` only; `SatelliteObservation` dedupe updates today's row but leaves SAR columns stale; `watch_and_reload.py` dev tooling shipped in the app image.

---

## 5. 🟡 MEDIUM — Frontend Logic / UI Errors (10)

### F-34. Admin Grad-CAM image is always broken
`app/admin/page.tsx getHeatmapSrc` builds `` `data:image/jpeg;base64,{overlay}` `` — **missing the `$`**, so the literal string `{overlay}` is used as base64. Heatmaps never render in the admin vision lab.

### F-35. Hardcoded fake KPIs presented as computed data
`components/modules/ExpensesModule.tsx`: "Projected Harvest Yield: 8.4 Tonnes", "₹1,85,000 revenue", "+68.4% ROI" are **constants**; only "Net Margin" subtracts real spend. Misleading on a farmer-finance screen.

### F-36. "Wind Safety: Safe" badge contradicts the live alert
`WeatherModule.tsx` hardcodes `Safe (<15 km/h)` even when the backend is simultaneously raising a "High winds — defer pesticide sprays" alert.

### F-37. Silent demo fallbacks mask real failures
`OverviewModule` (fake 12.4 ha / 94.2% health stats), `TimelineModule` (fake diary entries), `ExpensesModule`, `SchemesModule`, `ShoppingModule`: on **any** API error the UI renders plausible fake data instead of an error. In UAT this makes broken features look like working demo content.

### F-38. 401 interceptor is incomplete
`lib/api.ts` removes the token on 401 but doesn't reset the Zustand auth store or redirect — the user stays on the protected page while every subsequent call fails, until a manual refresh.

### F-39. Axios 8s timeout vs slow endpoints
`timeout: 8000` globally; advisor chat (Gemini round-trip) and satellite ingestion routinely exceed it → spurious failures with misleading error toasts.

### F-40. The two farm-creation forms collect different data
Module version (`components/modules/ProfileModule.tsx`) collects no district/village (required backend fields → stored as empty strings); the legacy page collects them. Data quality drifts depending on which screen was used.

### F-41. Admin and farmer tokens share one localStorage key
Admin login overwrites the farmer token (and vice versa). "Back to Farmer Console" from admin shows broken/mixed auth state.

### F-42. Race conditions in async UI
`DiseaseModule` quick-specimen clicks can overlap in-flight inferences; `AdvisorModule` `fetchSessions` races `setActiveSessionId` after the first message.

### F-43. JWT stored in localStorage
XSS-stealable token storage — standard note, but combined with the 14-day admin token (C-06) the blast radius is large.

---

## 6. 🔵 LOW — Hygiene & Consistency (6)

| # | Finding |
|---|---|
| L-44 | Frontend expense categories ("Machinery & Fuel", "Harvest & Transport") don't match backend optimizer keys ("Machinery", "Transport") — optimizer rules never match |
| L-45 | `apps/web/Untitled.md` documents `POST /api/v1/telemetry` — endpoint doesn't exist (doc rot) |
| L-46 | Stray root-level `app/services/leaf_disease_efficientnet.pth` outside `apps/backend` — confusing duplicate model file |
| L-47 | `config.py` uses Pydantic v1-style `@validator` with Pydantic v2.6 (deprecated shim warnings) |
| L-48 | `expense_optimizer` reads `eie_forecast` from farm context that no caller ever populates (dead branch); `calculate-area` returns zeros instead of 400 for malformed polygons |
| L-49 | Public landing page renders modules whose APIs all require auth → every module shows an error/fallback for anonymous visitors (design contradiction with `isPublic="/"` ) |

---

## 7. Fix Priority — Top 5 First

| Priority | Fix | Covers |
|---|---|---|
| **1** | Remove the login backdoor; strip `role` from register and profile-update request handling | C-01, C-02 |
| **2** | Remove the anonymous-admin fallback in `get_current_user_optional`; add `user_id` ownership filters to calendar & advisor feedback | C-03, C-04, C-05 |
| **3** | Fix the 8 broken frontend→backend contracts (schemes, satellite polygon, profile satellite routes, activity prefix, shopping toggle+items, optimizer params, advisor feedback, weather field names) | H-11 → H-18 |
| **4** | Remove hardcoded demo KPIs and silent fake-data fallbacks; show real errors | F-34 → F-37 |
| **5** | Move SECRET_KEY/CORS/env config out of code; fix the CORS regex and frontend baseURL rewriting | C-06, C-09 |

---

## 8. Sign-off Checklist for Production

- [ ] C-01/C-02 removed and regression-tested (login with backdoor password must fail; role escalation via register/PUT me must fail)
- [ ] All `*_optional` dependencies audited; calendar/advisor IDOR fixed with multi-tenant tests
- [ ] JWT secret injected via environment; token lifetimes reduced (≤24h)
- [ ] All 97 frontend API call sites re-verified against OpenAPI spec (`/docs`)
- [ ] Rate limiting on `/auth/login` and public inference endpoints
- [ ] Decide the single frontend implementation (`/` modules vs `/dashboard/*`) and delete the other
- [ ] Run `pytest tests/` in CI with the real dependency set
- [ ] Load/weather/secrets validated in a staged HTTPS deployment (CORS + mixed content)

---

*Report generated by Buffy via Freebuff — full audit performed against the repository source on September 10, 2026.*
