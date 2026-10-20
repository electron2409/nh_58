import os, json, logging
from pathlib import Path
from typing import Optional
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logger = logging.getLogger("nh58_backend")
logging.basicConfig(level=logging.INFO)

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

cache = pd.read_csv(ROOT / "data/processed/risk_cache.csv", parse_dates=["date"])
cache["date"] = cache["date"].dt.strftime("%Y-%m-%d")
static = pd.read_csv(ROOT / "data/processed/segments_static_scores.csv")
metrics = json.loads((ROOT / "models/metrics.json").read_text())

dyn_metrics_file = ROOT / "models/dynamic_metrics.json"
dyn_metrics = json.loads(dyn_metrics_file.read_text()) if dyn_metrics_file.exists() else {}

geo = json.loads((ROOT / "data/processed/segments_crop.geojson").read_text())
DATES = sorted(cache.date.unique())
LATEST = DATES[-1]

app = FastAPI(
    title="NH-58 Landslide Decision Support",
    description="Screening-level susceptibility and risk for NH-58 Rishikesh–Devprayag stretch. Not an exact landslide prediction."
)

cors_origins_env = os.getenv("CORS_ORIGINS", "").strip()
cors_origins_list = [o.strip() for o in cors_origins_env.split(",") if o.strip()]

if cors_origins_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins_list,
        allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def records(df):
    return json.loads(df.to_json(orient="records"))  # NaN becomes null


def pick(d: Optional[str]) -> str:
    d = d or LATEST
    if d not in DATES:
        raise HTTPException(404, f"No data for {d}. Available {DATES[0]} to {DATES[-1]}")
    return d


def one(seg_id: int, d: str) -> dict:
    r = cache[(cache.seg_id == seg_id) & (cache.date == d)]
    if r.empty:
        raise HTTPException(404, f"Segment {seg_id} not found for {d}")
    return records(r)[0]


@app.get("/")
def root():
    return {
        "status": "ok",
        "dates": [DATES[0], DATES[-1]],
        "segments": int(cache.seg_id.nunique()),
        "corridor": "NH-58 Rishikesh to Devprayag",
        "latest_date": LATEST
    }


@app.get("/dates")
def dates():
    return DATES


@app.get("/risk")
def risk(date: Optional[str] = None):
    return records(cache[cache.date == pick(date)].sort_values("seg_id"))


@app.get("/risk/{seg_id}")
def risk_one(seg_id: int, date: Optional[str] = None):
    return one(seg_id, pick(date))


@app.get("/risk/{seg_id}/timeseries")
def timeseries(seg_id: int):
    r = cache[cache.seg_id == seg_id].sort_values("date")
    if r.empty:
        raise HTTPException(404, "Unknown segment")
    return records(r[["date", "rain_1d", "rain_3d", "rain_7d", "rain_14d",
                      "trigger_name", "susc_class_name", "current_risk"]])


@app.get("/rainfall")
def rainfall(date: Optional[str] = None):
    d = pick(date)
    return records(cache[cache.date == d][["seg_id", "label", "rain_1d", "rain_3d", "rain_7d",
                                           "rain_14d", "trigger_pct", "trigger_name"]])


@app.get("/susceptibility")
def susceptibility():
    return records(static.sort_values("seg_id"))


@app.get("/factors/{seg_id}")
def factors(seg_id: int, date: Optional[str] = None):
    r = one(seg_id, pick(date))
    return {"seg_id": seg_id, "date": r["date"], "dominant_factors": r["dominant_factors"]}


@app.get("/metrics")
def get_metrics():
    # Return both static and dynamic metrics while keeping top-level keys backwards-compatible
    return {
        "features": metrics.get("features", []),
        "n_landslide": metrics.get("n_landslide", 0),
        "n_nonlandslide": metrics.get("n_nonlandslide", 0),
        "cv_blocks": metrics.get("cv_blocks", 5),
        "metrics": metrics.get("metrics", {}),
        "static": metrics,
        "dynamic": dyn_metrics
    }


@app.get("/metrics/dynamic")
def get_dynamic_metrics():
    return dyn_metrics


@app.get("/geojson")
def geojson(date: Optional[str] = None):
    d = pick(date)
    by = {int(r["seg_id"]): r for r in records(cache[cache.date == d])}
    feats = []
    for f in geo["features"]:
        sid = int(f["properties"]["seg_id"])
        if sid in by:
            feats.append({
                "type": "Feature",
                "geometry": f["geometry"],
                "properties": {**f["properties"], **by[sid]}
            })
    return {"type": "FeatureCollection", "features": feats}


@app.get("/ai-status")
def ai_status():
    key = os.getenv("GEMINI_API_KEY")
    return {
        "ai_enabled": bool(key),
        "configured_model": os.getenv("GEMINI_MODEL", "gemini-3.5-flash"),
        "gee_project": os.getenv("GEE_PROJECT", "not configured")
    }


PROMPT = """You are writing a screening-level landslide risk note for a highway segment.
Use ONLY the JSON data below. Do not invent rainfall, susceptibility, geology, causes,
measurements or events. If a field is null or missing, write "not available".
Do not predict when a landslide will occur. This is decision support, not a substitute
for a geotechnical assessment.
Write exactly four short sections with these headings:
1. Risk Summary
2. Why This Segment Is Risky
3. Current Contributing Factors
4. Recommended Actions
DATA:
"""


def template_report(r: dict) -> str:
    susc_mean = r.get("susc_mean")
    susc_str = f"{susc_mean:.2f}" if susc_mean is not None else "not available"
    slope_mean = r.get("slope_mean")
    slope_str = f"{slope_mean:.1f}" if slope_mean is not None else "not available"
    rain_1d = r.get("rain_1d", 0)
    rain_3d = r.get("rain_3d", 0)
    rain_7d = r.get("rain_7d", 0)
    rain_14d = r.get("rain_14d", 0)

    return (
        f"1. Risk Summary\n"
        f"Segment {r.get('label', r.get('seg_id'))} on {r.get('date', 'N/A')}: "
        f"current risk {r.get('current_risk', 'UNKNOWN')} "
        f"(terrain susceptibility class {r.get('susc_class_name', 'N/A')}, "
        f"rainfall trigger {r.get('trigger_name', 'N/A')}).\n\n"
        f"2. Why This Segment Is Risky\n"
        f"Mean modelled susceptibility {susc_str}; mean slope {slope_str} degrees.\n\n"
        f"3. Current Contributing Factors\n"
        f"{r.get('dominant_factors', 'none flagged')}. Rainfall: 1-day {rain_1d:.0f} mm, "
        f"3-day {rain_3d:.0f} mm, 7-day {rain_7d:.0f} mm, 14-day {rain_14d:.0f} mm (CHIRPS). "
        f"NDVI change: not available.\n\n"
        f"4. Recommended Actions\n"
        f"{r.get('recommended_action', 'Routine screening monitoring.')}\n\n"
        f"[Screening template fallback. Live AI assessment was not invoked or unavailable.]"
    )


class ReportReq(BaseModel):
    seg_id: int
    date: Optional[str] = None


@app.post("/generate-report")
def generate_report(req: ReportReq):
    r = one(req.seg_id, pick(req.date))
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return {
            "source": "template",
            "report": template_report(r),
            "note": "GEMINI_API_KEY environment variable is not configured."
        }

    # Model resolution: try preferred env model first, then fallback to fast stable models
    configured_model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash").strip()
    candidate_models = [configured_model]
    for m in ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-flash-latest"]:
        if m not in candidate_models:
            candidate_models.append(m)

    last_error_detail = None
    for model_name in candidate_models:
        try:
            from google import genai
            client = genai.Client(api_key=key)
            resp = client.models.generate_content(
                model=model_name,
                contents=PROMPT + json.dumps(r)
            )

            # Extract generated text safely
            text_output = ""
            if resp.candidates and resp.candidates[0].content and resp.candidates[0].content.parts:
                text_output = "".join([
                    part.text for part in resp.candidates[0].content.parts
                    if getattr(part, "text", None)
                ])
            if not text_output:
                text_output = getattr(resp, "text", "") or ""

            if text_output.strip():
                return {
                    "source": "gemini",
                    "model": model_name,
                    "report": text_output.strip()
                }
        except Exception as e:
            last_error_detail = f"{type(e).__name__}: {str(e)[:180]}"
            logger.warning("Gemini generation attempt with model %s failed: %s", model_name, e)
            continue

    # Fallback gracefully to template if all API calls fail
    return {
        "source": "template",
        "report": template_report(r),
        "note": f"Gemini API call failed ({last_error_detail})" if last_error_detail else "Gemini unavailable"
    }