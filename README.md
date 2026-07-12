# 🌾 AgriNexus AI - Smart Farm Operating System (Farm OS)

AgriNexus AI is a production-grade, consolidated enterprise Smart Farm Operating System designed for modern precision agriculture. It unifies real-time crop disease classification, AI-driven agronomy advisory threads, state/central subsidy calculations, microclimate alert systems, and commodity Mandi pricing models into a single, cohesive developer workspace.

---

## 🛠️ Technology Stack & Architecture

AgriNexus is structured as a **Dockerized Monorepo** separating the presentation client from the high-throughput FastAPI gateway.

* **Frontend Console:** Next.js `16.2.10`, React `19.0.0`, Zustand State, Tailwind CSS.
* **API Gateway Services:** FastAPI (Python `3.10-slim`), Uvicorn, SQLAlchemy Core.
* **Inference Models:** PyTorch CPU classification tensor pipeline (`torch`, `torchvision`).
* **AI Processing:** Google Gemini API integration (`gemini-1.5-flash`).
* **Database Ledger:** PostgreSQL (automated schema bootstraps).
* **Containerization:** Orchestrated via Docker & Docker Compose.

---

## 📂 Repository Directory Tree

```bash
agrinexus-monorepo/
├── apps/
│   ├── web/               # Next.js 16 Client Portal & Dashboard
│   │   ├── app/           # App Router (Disease, Advisor, Schemes, Weather, Prices, Profile)
│   │   ├── components/    # Reusable Glassmorphic Components
│   │   └── store/         # Zustand Client State Stores
│   └── backend/           # FastAPI Services Gateway
│       └── app/
│           ├── api/       # Controller Routers (Auth, Advisor, Disease, Schemes, Weather, Prices)
│           ├── models/    # Database Schema Definitions (SQLAlchemy)
│           ├── services/  # Core Domain Engines (Gemini advisor, PyTorch classification, Matching rules)
│           └── db/        # Database Connection Hooks
├── docs/                  # Project Specifications & Roadmaps
└── docker-compose.yml     # Monorepo containerization orchestration
```

---

## 🚀 Local Development Quickstart

### Prerequisites
Ensure you have the following installed locally:
* **Docker & Docker Compose**
* **Node.js** (v18+ or v20+) & **NPM**

### 1. Configure Credentials Environment
Create a `.env` file inside the `apps/backend/` directory to configure the AI advisor:
```bash
GEMINI_API_KEY=your_google_gemini_api_key
```

### 2. Orchestrate and Run Containers
Build the dependency layers and boot up the microservices:
```bash
docker-compose down
docker-compose up --build
```

The stack coordinates the following endpoints:
* **Presentation Web Portal:** [http://localhost:3000](http://localhost:3000)
* **API Documentation (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
* **PostgreSQL Port Binding:** `localhost:5432`

---

## 💎 Core Operations & Modules

### 1. Access Credentials & Gateways
* **State Management:** Zustand manages auth tokens, loading sequences, and session caching.
* **Data Isolation:** User parameters, chat histories, and registered farm fields are isolated based on authenticated JWT credentials to prevent crossover leakage.
* **Route Guards:** Restricts layout dashboards based on roles (Farmer, Agronomy Expert, Admin).

### 2. Leaf Pathogen CNN Scanner
* **PyTorch Classifier:** A custom convolutional neural network running tensor transformations (`Resize`, `ToTensor`, `Normalize`) to process uploaded images.
* **Pathologies Diagnostic Database:** Diagnoses Early Blight, Late Blight, Tomato Leaf Rust, Leaf Rot, or confirms Healthy status. Returns localized treatment and prevention checklists.

### 3. AI Crop Advisor (Persisted Threads)
* **Session Persistence:** Saves session details under SQL ledgers, enabling operators to resume previous agronomy questions.
* **Gemini LLM Integration:** Employs the `gemini-1.5-flash` model to analyze soil structures, crop plans, and diagnose complex farming parameters.

### 4. Government Subsidies Matching Engine
* **Rules Registry:** Programmed to check eligibility against central (PM-KISAN, Kisan Credit Card, crop insurance PMFBY, PKVY organic) and state-specific machinery programs.
* **Match Score Calculation:** Evaluates state boundaries, land size limits (hectares), and crop compatibility, displaying validation checkmarks (e.g. State: Punjab [Matches]) and document requirements.

### 5. Climate Alerts & Commodity Prices
* **Contextual Weather:** Simulates region-specific microclimates (e.g. frost warnings in Himachal, wind alerts in Punjab) with custom agricultural advisories.
* **Mandi Rate Ticker:** Integrates wholesale Mandi pricing compared to national Minimum Support Price (MSP) benchmarks across regional hubs.

### 6. Operator Profile & Multi-Field Registry
* **Coordinates Logging:** Map coordinates and acreage size logs.
* **Soil Profile Configuration:** Saves soil conditions (Clay, Sandy, Loam) per field to optimize irrigation methods (Drip, Sprinklers, Flood).

---

## 📡 Developer Telemetry Ingress
Third-party IoT soil sensor nodes can feed data directly to the gateway using the telemetry API:

```bash
# Ingest local field soil moisture readings
curl -X POST "http://localhost:8000/api/v1/telemetry" \
  -H "Authorization: Bearer $AGRINEXUS_JWT" \
  -H "Content-Type: application/json" \
  -d '{"sensor_id": "moisture_north_field_02", "depth_cm": 15, "pct": 42.8}'
```
Response:
```json
{
  "status": "Ingested",
  "warning": null,
  "irrigation_required": false
}
```
*Review the complete API schemas inside [api-policy](apps/web/app/api-policy/page.tsx).*
