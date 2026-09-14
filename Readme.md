# AQUIS — Aquifer Query and User Information System

A role-based groundwater monitoring platform built on NWDP telemetry and CGWB assessment data, with a pooled XGBoost machine-learning forecasting engine, quantile uncertainty calibration, a station-locked AI assistant, and interactive dashboards.

**Authors:** Dr. Himani, Srijan Anand Gupta, Utkarsh Srivastava, Ritik Dhingra — BPIT, Rohini, New Delhi

---

## What We Built

AQUIS is a full-stack groundwater monitoring system that turns raw telemetry into actionable forecasts. The platform ingests 6-hourly water-level readings from 1,353 stations across 34 districts in Uttar Pradesh, trains a pooled XGBoost model on the 600 best-covered stations, and serves 30-day forecasts with calibrated uncertainty bands through a web dashboard and a React Native mobile app.

### Key Capabilities

- **Pooled ML Forecasting** — A single XGBoost regressor trained across 600 stations predicts 30-day groundwater level changes as a delta from the current reading, beating a persistence baseline by 1.8% on honest, non-overlapping evaluation windows.
- **Trajectory v2 Engine** — A direct multi-horizon model producing 120 genuine 6-hourly steps (not interpolated) with per-horizon q05/q50/q95 quantile bands calibrated to 90% coverage at every horizon.
- **Evidence-Based Confidence** — Each trajectory point carries a HIGH / DIRECTIONAL / LOW label computed from interval quality, performance against persistence, directional agreement, data freshness, and driver availability.
- **Fleet-Wide Monitoring** — Automated scans across 502+ active stations surface decline/recovery trends, zone classifications (safe / caution / critical), and district-level summaries.
- **Station-Locked AI Assistant** — A local LLM (Ollama, llama3.2:3b) answers questions grounded in pre-computed station facts and forecast data — no hallucinated numbers.
- **Real-Time Refresh Daemon** — A 6-hourly cycle (01/07/13/19 IST) fetches fresh NWIC telemetry, recomputes features, runs inference, and publishes forecast files.
- **Mobile App** — A React Native (Expo) app with map view, station search/browse, forecast visualization, live telemetry analysis, driver analysis, and the AI assistant — all consuming the same ML API.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Mobile App (Expo)                        │
│            React Native · Leaflet/OSM · WebView                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP
┌───────────────────────────▼─────────────────────────────────────┐
│                     Node.js / Express API                       │
│            port 3000 · PostgreSQL · ML Gateway                  │
│   stations · telemetry · assessments · trends · ML proxy        │
└───────────┬───────────────────────────────┬─────────────────────┘
            │ HTTP :5000                    │ SQL
┌───────────▼───────────────┐   ┌───────────▼─────────────────────┐
│    Flask ML API (v3.4.0)  │   │         PostgreSQL              │
│    port 5000              │   │  stations · telemetry ·          │
│    JSON endpoints         │   │  assessments · model_outputs     │
└───────────┬───────────────┘   └─────────────────────────────────┘
            │ reads
┌───────────▼─────────────────────────────────────────────────────┐
│                    ML Artifacts (parquet + JSON)                 │
│   data/aligned/table_6h.parquet · models/ · outputs/            │
│   data/refresh/forecasts/ · data/cfs/                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              Refresh Daemon (6-hourly cycle)                     │
│   fetch NWIC → features → inference → publish per-station JSON  │
└─────────────────────────────────────────────────────────────────┘
```

**Data flow:**
NWDP Telemetry API + Assessment Excel files → PostgreSQL → Statistical Analysis + ML → Flask API → Node Gateway → Express API → Frontend / Mobile App

---

## Project Structure

```
AQUIS/
├── back-end/               Node.js + Express API server
│   ├── server.js           Entry point (port 3000)
│   ├── app.js              Middleware + route mounting
│   ├── routes/             11 route modules (stations, telemetry, ml, etc.)
│   ├── controllers/        11 controllers
│   ├── services/           12 services (mlGateway, statistics, ingestion, etc.)
│   ├── db/                 PostgreSQL pool, schema, migration scripts
│   ├── middleware/          Error handler, validators
│   ├── scripts/            migrate, importData, ingestAssessments, ingestTelemetry
│   └── test/               Backend test suite
│
├── ml/                     Python ML module
│   ├── api.py              Flask HTTP API (v3.4.0, port 5000)
│   ├── app.py              Streamlit dashboard (4 pages)
│   ├── _trajectory.py      Trajectory v2 engine (120-step, 6-hourly)
│   ├── _model.py           Pooled XGBoost model loader
│   ├── _assistant.py       LLM assistant logic (Ollama)
│   ├── 00_probe.py … 33_traj_reliability.py   Numbered pipeline
│   ├── refresh/            Near-real-time refresh daemon
│   ├── data/               Aligned parquets, driver data, metadata
│   ├── models/             Trained weights (joblib + JSON)
│   ├── outputs/            Metrics, fleet scans, correlations
│   ├── tests/              151-unit test suite
│   └── MODEL_CARD.md       Model lifecycle card
│
├── mobile/                 React Native (Expo) mobile app
│   ├── app/                File-based routing (Expo Router)
│   │   ├── (tabs)/         Tab screens: Map, Watchlist, Forecast, Assistant
│   │   ├── station/[slug].tsx   Live Telemetry Analysis
│   │   ├── drivers/[slug].tsx   Driver Analysis
│   │   ├── station-search.tsx   Station Search/Browse
│   │   └── _layout.tsx     Root layout with Stack + Tab navigation
│   ├── components/         BottomNav, StationCard, StationDetailSheet, etc.
│   ├── lib/                API client, hooks, env config, timezone utils
│   ├── theme/              Colors, spacing design tokens
│   └── types/              TypeScript interfaces (station, forecast, assistant)
│
├── front-end/              Next.js 16 web frontend (build artifacts only)
├── docs/                   Architecture, API reference, ML specs
├── design/                 Design assets
├── paper/                  Research paper (LaTeX, IEEE format)
├── index.html              Standalone vanilla HTML dashboard
└── Readme.md               This file
```

---

## Scope & Data Coverage

**Uttar Pradesh groundwater monitoring is mostly *manual*, not real-time.** This is the single most important constraint on what AQUIS can forecast.

- UP has ~**75 districts**, and groundwater there is monitored through two separate networks on the National Water Data Portal (NWDP/NWIC):
  - **Manual** — measured a few times a year by field staff (CGWB ~1,000 UP wells, 4×/yr; UPGW publishes its own *"Ground Water Level (Manual - Quarterly)"* dataset, 1991–2020).
  - **Telemetry** — automated 6-hourly Digital Water Level Recorders, a *narrow, recently-deployed slice* of the network.
- **AQUIS only ingests the telemetry feed** (`GWL Telemetry 6-Hourly, UPGW`). That feed wires just **1,353 stations across 34 of UP's ~75 districts**. Districts without telemetry gauges never appear in the archive.
- Therefore: **1,353 stations / 34 districts = "everything the telemetry archive has"**, and **600 stations / 29 districts = "the ones still alive in 2026"** (selected by `01_select.py`, ≥8 of 9 Jan–Sep 2026 months with a reading). Neither number is a scope preference — the data decides.

---

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Python 3.11+ (venv/packages tested on 3.14)
- Expo CLI (for mobile app)
- Ollama (for AI assistant)

### 1. Backend

```bash
cd back-end
cp .env.example .env        # Edit with your database credentials
npm install
npm run migrate             # Apply schema
npm run import-assessments  # Import assessment Excel files
npm run import-telemetry    # Import NWDP telemetry data
npm start                   # Start API at http://localhost:3000
```

### 2. ML Service

```bash
cd ml
pip install -r ../requirements.txt   # Or use the venv
python api.py                        # Flask API at http://localhost:5000
```

The ML pipeline (numbered scripts 00–33) must be run in order to generate model artifacts. See `ml/README.md` for the full pipeline reference.

### 3. Refresh Daemon (optional, production)

```bash
cd ml
python -m refresh.cli schedule       # Runs on 6-hourly wall-clock grid
python -m refresh.cli status         # Check current state
```

### 4. Mobile App

```bash
cd mobile
npm install
npx expo start -c                    # Scan QR with Expo Go on Android
```

The mobile app connects to the ML API via a Cloudflare tunnel (URL configured in `mobile/lib/env.ts`). Update `API_BASE` when the tunnel rotates.

### 5. Frontend (web)

```bash
cd front-end
npm install
npm run dev                          # Next.js at http://localhost:3000
```

> Note: Express runs on `:3000`; if both run, pick a different port for one of them.

---

## ML Service API (Flask, v3.4.0)

The Flask API serves JSON endpoints on port 5000. The Node gateway proxies these under `/ml/*`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service status, model version, dataset recency, Ollama availability |
| GET | `/stations` | Station list with coordinates (supports `district`, `q`, `limit`) |
| GET | `/stations/<slug>` | Per-station facts: last GWL, district ranking, forecast summary |
| GET | `/stations/<slug>/series` | 6-hourly GWL + driver time series (`from`, `to`, `drivers`, `limit`) |
| GET | `/stations/<slug>/alerts` | Notification-ready zone + reasons + top drivers |
| GET | `/fleet/alerts` | Fleet-wide zone classification (safe / caution / critical) |
| GET | `/fleet/forecasts` | Full fleet forecast table |
| GET | `/fleet/recovery` | Recovery/decline ranking across active stations |
| GET | `/fleet/scan` | Scan metadata (eligible vs. scanned, horizon, timestamp) |
| GET | `/forecast/<slug>` | 120-step trajectory (q05/q50/q95) with confidence labels |
| GET | `/districts` | District list with water-scarcity status |
| GET | `/districts/<name>` | District detail: levels, stressed stations, top driver |
| GET | `/models` | Trained-model index (specs, calibration timestamps) |
| POST | `/assistant/chat` | Station-locked LLM answer (Ollama, llama3.2:3b) |

---

## Node Gateway Proxy

The Express server consumes the Flask API through a stateless HTTP proxy (`services/mlGateway.js`) using Node's built-in `http` module — no external HTTP library.

| Node Route | Forwards To |
|------------|-------------|
| `GET /ml/health` | `GET /health` |
| `GET /ml/stations` | `GET /stations` |
| `GET /ml/stations/:slug` | `GET /stations/:slug` |
| `GET /ml/stations/:slug/series` | `GET /stations/:slug/series` |
| `GET /ml/live/forecast/:slug` | `GET /forecast/:slug` |
| `GET /ml/live/fleet/forecasts` | `GET /fleet/forecasts` |
| `GET /ml/live/fleet/recovery` | `GET /fleet/recovery` |
| `GET /ml/live/fleet/scan` | `GET /fleet/scan` |
| `GET /ml/districts` | `GET /districts` |
| `GET /ml/live/models` | `GET /models` |
| `POST /ml/assistant/chat` | `POST /assistant/chat` |

**Timeout:** 60s default (`ML_TIMEOUT_MS` env var). On timeout: socket destroyed, HTTP 502 returned.
**Error handling:** 3-tier — connection-refused (503), timeout (502), upstream errors (502). All propagated as structured JSON. No retry — fail-fast.
**Legacy routes:** `/ml/forecast/:stationId`, `/ml/anomalies`, `/ml/risk/:unitId` read from PostgreSQL `model_outputs` table (backward compatibility, to be deprecated).

---

## Mobile App

A React Native (Expo ~52) app with file-based routing via Expo Router. Runs on Android via Expo Go.

### Screens

| Screen | Route | Description |
|--------|-------|-------------|
| **Map** | `(tabs)/index.tsx` | Leaflet/OpenStreetMap WebView with 600 station pins, marker clustering, tap-to-detail |
| **Watchlist** | `(tabs)/watchlist.tsx` | Saved stations with search, district filter chips, inline cards |
| **Forecast** | `(tabs)/forecast.tsx` | Station picker → inline 30-day trajectory chart with data-driven tier labels, direction banner, live/forecast toggle |
| **Assistant** | `(tabs)/assistant.tsx` | AI chat with station-pinned context, inline station picker, bottom-sheet input |
| **Live Telemetry** | `station/[slug].tsx` | 9-panel analysis: level, rank, trend, confidence, gauge, chart (restructured Y-axis), driver button |
| **Driver Analysis** | `drivers/[slug].tsx` | All 8 driver correlations, charts, insights, no minimum threshold |
| **Station Search** | `station-search.tsx` | Shared search: name/district cards, `?returnTo=assistant` support |

### Tech

- **Map:** Leaflet/OpenStreetMap via `react-native-webview` (no native maps dependency)
- **Navigation:** Expo Router tabs + Stack with `slide_from_right` transitions
- **Bottom nav:** 4 tabs (Map/Watchlist/Forecast/Assistant) with Ionicons, identical 56x56 icon circles, blue circle active indicator
- **API:** Cloudflare tunnel to Flask ML API (`mobile/lib/env.ts`)
- **Theme:** `primary: "#0284C7"`, spacing tokens, `BOTTOM_NAV_CLEARANCE = 100`

---

## ML Module in Detail

### Pipeline (run in order from `ml/`)

```
00_probe.py           probe every NWIC resource → meta/probe.json
01_select.py          select GWL anchor stations with full-2026 coverage → 600 of 1,353
02_fetch_selected.py  fetch each driver for selected districts (resume-safe)
03_merge_normalize.py plausibility caps → raw/<source>_norm.parquet + manifest
04_align.py           daily station×day table with spatial association
04b_align_6h.py       6-hourly station×slot table (production-consistent cadence)
05_correlate.py       driver correlation report, recharge-lag curve, charts
06_features.py        feature/target engineering on the 6h grid
06_train.py           pooled XGBoost + Ridge (delta target), writes models/
07_evaluate.py        4-way benchmark + honest re-score
10_ablate.py          drop-group ablation sweep
11_quantile.py        pooled q05/q50/q95 + empirical coverage calibration
11_fleet.py           whole-fleet 30-day forecast scan + recovery snapshot
12_diagnostics.py     VIF + permutation importance + OAT sensitivity
13_refresh_nwic.py    incremental NWIC refresh (+ optional retrain/deploy)
14_6h_features.py     causal 6h feature frames (for traj v2)
16_future_drivers.py  driver-climatology refresh + future-driver bridge
18_cwc_river_forecast.py  CWC 3-day river forecast fetch
20_openmeteo_fetch.py     Open-Meteo daily weather: 365d history + 16d forecast
30_traj_datasets.py       trajectory v2 feature frames
31_train_traj.py          trajectory shared multi-horizon XGBoost (q05/q50/q95)
32_backtest_traj.py       honest non-overlap trajectory backtest + calibration
33_traj_reliability.py    reliability bucket rules + evidence weights
```

### Data

- **Archive:** `data/processed/common.parquet` — cleaned 6-hourly telemetry: **~5.3M records / 1,353 UP stations, 2021-01-01 → 2026-09-05**
- **6h grid:** `data/aligned/table_6h.parquet` — 2.99M rows / 600 stations
- **Cleaning:** telemetry sentinels and `|GWL|>100 m` spikes dropped; per-station 0.5–99.5% quantile trim; stations with >15 m annual-median regime shift excluded; features are causal (lags only)

### Model

- **Pooled XGBoost** (not one model per station): 6-hourly grid, 30-day horizon, delta target `GWL(t+120) − GWL(t)`
- **Quantile uncertainty:** native `reg:quantileerror` q05/q50/q95, empirically calibrated → 90% coverage, median half-width ~1.03 m
- **Trajectory v2:** direct multi-horizon shared XGBoost, horizon h ∈ 1..120 as input feature, no recursion, no interpolation

### Benchmarks

| Model | RMSE (m) | Notes |
|-------|----------|-------|
| **XGBoost (pooled)** | **2.242** | beats persistence +2.1% |
| Persistence | 2.290 | |
| Ridge | 2.456 | |
| Climatology | 3.572 | |

**Honest evaluation:** Stride RMSE = 2.339 m vs persistence 2.382 m (+1.8%) on 3,371 independent windows. Spatial CV = 1.97 m mean / 1.82 m median. Calibrated 90% interval coverage = 0.911.

**Trajectory v2:** 30-day RMSE 2.106 m < direct-30d 2.132 m < persistence 2.151 m. Calibrated to 90% coverage at every horizon.

### Testing

```bash
cd ml
python -m unittest discover -s tests    # 151-unit test suite
python gate_check.py                    # Regression gate (GATE PASS 10/10)
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `PORT` | 3000 | Backend port |
| `NODE_ENV` | development | Environment |
| `ML_SERVICE_URL` | `http://localhost:5000` | Flask ML API URL |
| `ML_TIMEOUT_MS` | 60000 | ML request timeout (ms) |
| `EXPO_PUBLIC_API_URL` | Cloudflare tunnel URL | Mobile app API base |
| `AQUIS_OLLAMA_MODEL` | llama3.2:3b | Assistant LLM model |
| `LULC_STATISTICS_API_KEY` | — | ISRO Bhuvan LULC API key |

---

## Testing

```bash
# Backend
cd back-end && npm test

# ML module
cd ml && python -m unittest discover -s tests
cd ml && python gate_check.py

# Mobile (TypeScript check)
cd mobile && npx tsc --noEmit
```

---

## Key Data Facts

- NWDP telemetry: ~7.4M records across India (backend scope); ML archive = **5.3M records / 1,353 UP stations, 6-hourly, 2021-01-01 → 2026-09-05**; **600 stations / 29 districts** quality as pooled-model anchors.
- Assessment years: 2016–17 through 2025–26, 154-column CentralReport Excel.
- CGWB classification: Safe (<70%) / Semi-Critical (70–90%) / Critical (90–100%) / Over-Exploited (>100%).
- Forecast uncertainty: **calibrated 90% interval** (q05/q95, k=1.0), median half-width ≈1.03 m.
- Fleet (Sep 2026 scan): **502 stations scored** — median Δ +0.32 m, 0 declining, 259 recovering.
- Assistant: Ollama llama3.2:3b, station-pinned, grounded in pre-computed facts.

---

## Tech Stack

| Layer | Stack |
|-------|-------|
| Backend | Node.js, Express.js, PostgreSQL |
| ML Engine | Python, Flask, XGBoost, scikit-learn, joblib, scipy |
| LLM Assistant | Ollama, llama3.2:3b |
| ML Dashboard | Streamlit, Plotly, Altair |
| Web Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4, Chart.js |
| Mobile App | React Native (Expo ~52), Expo Router, WebView (Leaflet/OSM) |
| Data Sources | NWIC Telemetry API (2021→2026), CGWB Assessment Excels, Open-Meteo, CWC |

---

## Documentation

| File | Contents |
|------|----------|
| `docs/api.md` | Full API reference (Node + Flask endpoints) |
| `docs/architecture.md` | System architecture and component diagram |
| `docs/data-model.md` | PostgreSQL schema |
| `docs/ingestion.md` | Data ingestion pipeline |
| `docs/ml-contract.md` | ML service HTTP contract |
| `docs/ml-system-spec.md` | ML system specification |
| `docs/ml-trajectory-v2-spec.md` | Trajectory v2 model spec and backtest results |
| `ml/MODEL_CARD.md` | Model lifecycle card |
| `ml/STREAMLIT_GUIDE.md` | Streamlit dashboard page reference |
| `paper/` | LaTeX research paper (IEEE conference format) |

---

## License

Internal research project — Bhagwan Parshuram Institute of Technology (BPIT), Rohini, New Delhi.
