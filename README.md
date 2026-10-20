# NH-58 Landslide Decision Support System

A screening-level landslide susceptibility and rainfall-risk dashboard for the **NH-58 Rishikesh – Devprayag** corridor in Uttarakhand, India.

The road is split into 70 one-kilometre segments. Each segment gets a terrain susceptibility score from machine-learning models trained on mapped landslide scars, combined with daily CHIRPS rainfall to produce a current risk level (Very Low → Very High). Results are served through a FastAPI backend and explored in a React + Leaflet dashboard, with optional AI-generated segment assessments via Google Gemini.

> **Note:** This is a screening tool, not an exact landslide prediction. It does not replace site investigation or geotechnical assessment.

## Features

- **Interactive risk map** of all corridor segments, switchable between current risk and terrain susceptibility
- **Date slider** to replay risk across the monsoon demo period (Jul – Sep 2023)
- **Segment detail** with rainfall time series (1/3/7-day), contributing factors and slope statistics
- **Analytics and segment table** for corridor-wide comparison
- **Model performance view** with ROC-AUC, precision, recall, F1 and confusion matrices
- **AI assessment** (optional) – generates an engineer-oriented report for a segment using Gemini

## Tech Stack

| Layer | Tools |
|---|---|
| Data & ML | Google Earth Engine, GeoPandas, scikit-learn, CHIRPS rainfall, SRTM terrain |
| Backend | FastAPI, Uvicorn, pandas |
| Frontend | React 19, Vite, Leaflet / React-Leaflet, Recharts |
| AI | Google Gemini (`google-genai`) |

## Project Structure

```
├── backend/app/main.py     FastAPI server (risk, rainfall, metrics, GeoJSON, AI report)
├── frontend/               React + Vite dashboard
├── ml/                     Data preparation, training and risk-engine scripts
├── data/
│   ├── gee/                Rainfall exports from Earth Engine
│   └── processed/          Segments, training table, risk cache used by the API
├── models/                 Trained models (.joblib) and metrics
├── docs/                   Validation summary and recommendation note
└── requirements.txt
```

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+
- (Optional) A Google Earth Engine project – only needed to re-run the ML pipeline
- (Optional) A Gemini API key – only needed for the AI assessment tab

### 1. Backend

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env          # then fill in your values
uvicorn backend.app.main:app --reload
```

The API runs at `http://127.0.0.1:8000` (interactive docs at `/docs`).

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env          # optional, defaults to http://127.0.0.1:8000
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `GEE_PROJECT` | `.env` | Google Earth Engine cloud project ID (ML scripts) |
| `GEMINI_API_KEY` | `.env` | Enables AI-generated segment reports |
| `GEMINI_MODEL` | `.env` | Gemini model name (default `gemini-3.5-flash`) |
| `CORS_ORIGINS` | `.env` | Comma-separated allowed origins for production |
| `VITE_API_URL` | `frontend/.env` | Backend base URL |

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Health check and available date range |
| GET | `/dates` | All dates with risk data |
| GET | `/risk?date=` | Risk for every segment on a date |
| GET | `/risk/{seg_id}` | Risk for one segment |
| GET | `/risk/{seg_id}/timeseries` | Risk and rainfall history for a segment |
| GET | `/rainfall?date=` | Rainfall per segment |
| GET | `/susceptibility` | Static terrain susceptibility scores |
| GET | `/factors/{seg_id}` | Factors driving a segment's risk |
| GET | `/metrics` | Terrain model metrics |
| GET | `/metrics/dynamic` | Rainfall-trigger model metrics |
| GET | `/geojson?date=` | Segment geometries with risk attributes |
| GET | `/ai-status` | Whether Gemini is configured |
| POST | `/generate-report` | AI assessment for `{ seg_id, date }` |

## ML Pipeline

The processed data and trained models are already included, so the dashboard works without re-running anything. To rebuild from scratch (requires Earth Engine access and the raw inputs in `data/raw/`), run the scripts in `ml/` roughly in this order:

1. `make_segments.py` → `crop_segments.py` – split the NH-58 road line into 1 km segments
2. `extract_static.py` – terrain features (elevation, slope, aspect, curvature) per segment
3. `kml_to_csv.py`, `find_scars.py`, `build_inventory.py` – build the landslide inventory
4. `train.py` – terrain susceptibility models (Logistic Regression, Random Forest)
5. `make_dynamic_points.py` → `train_dynamic.py` – preliminary rainfall-trigger model
6. `risk_engine.py` – combine susceptibility with daily rainfall into `risk_cache.csv`
7. `validation_summary.py`, `make_recommendation_notes.py` – generate the reports in `docs/`

## Model Results

Terrain susceptibility (37 landslide vs 37 random corridor points, spatial block CV):

| Model | ROC-AUC | Accuracy | F1 |
|---|---|---|---|
| Logistic Regression | 0.834 | 0.797 | 0.805 |
| Random Forest | 0.866 | 0.743 | 0.753 |

With this sample size the difference between the models is within noise. See [docs/validation_summary.md](docs/validation_summary.md) for full results and caveats, and [docs/recommendation_note.md](docs/recommendation_note.md) for an example segment-level recommendation report.

## Limitations

- Small, partly hand-labelled landslide inventory; negatives are random points, not confirmed stable slopes
- No validation against documented 2022–23 road closures
- Geology, fault distance, soil depth and NDVI change are not yet included
- Rainfall-trigger probabilities are uncalibrated and not used directly in the dashboard risk matrix
