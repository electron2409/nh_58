import os, json, joblib, ee, numpy as np, pandas as pd, geopandas as gpd
from dotenv import load_dotenv
load_dotenv()
ee.Initialize(project=os.environ["GEE_PROJECT"])

# ---------------- CONFIG ----------------
START, END = "2023-07-01", "2023-09-30"        # demo range, change freely
HIST_YEARS = range(2015, 2023)                 # rainfall history for percentiles
UTM = 32644
WINDOWS = (1, 3, 7, 14)
RISK = ["VERY LOW", "LOW", "MODERATE", "HIGH", "VERY HIGH"]
TRIG = ["LOW", "MODERATE", "HIGH", "EXTREME"]
TRIG_CUTS = (75, 90, 97)   # percentile cut points: SCREENING choices, not published thresholds
# rows = susceptibility class (very low..very high), cols = trigger level (low..extreme)
# Expert-judgement screening matrix, NOT calibrated on events.
MATRIX = [[0, 0, 1, 1],
          [0, 1, 1, 2],
          [1, 1, 2, 3],
          [1, 2, 3, 4],
          [2, 3, 4, 4]]
ACTION = {
    0: "Routine monitoring.",
    1: "Routine monitoring.",
    2: "Increase patrol frequency; check drains and cut-slope condition.",
    3: "Prioritise site inspection by a geotechnical engineer; clear drains; prepare traffic advisory.",
    4: "Consider a temporary traffic advisory or restriction and urgent inspection by a geotechnical engineer.",
}
DISCLAIMER = " (Screening guidance only; not a substitute for geotechnical assessment.)"

# =====================================================================
# PART A. Static susceptibility per segment (uses your trained models)
# =====================================================================
meta = json.load(open("models/metrics.json"))
FEATS = meta["features"]
lr_pipe = joblib.load("models/LogisticRegression.joblib")
rf = joblib.load("models/RandomForest.joblib")

seg = gpd.read_file("data/processed/segments_crop.geojson").sort_values("seg_id").reset_index(drop=True)
seg_u = seg.to_crs(UTM)

# sample a point every 100 m along every segment
rows = []
for _, r in seg_u.iterrows():
    L = r.geometry.length
    dists = np.arange(25, L, 100.0) if L > 25 else [L / 2]
    for d in dists:
        rows.append((int(r.seg_id), r.geometry.interpolate(float(d))))
gp = gpd.GeoDataFrame({"seg_id": [a for a, _ in rows]},
                      geometry=[b for _, b in rows], crs=UTM).to_crs(4326)
gp["lon"], gp["lat"] = gp.geometry.x, gp.geometry.y
gp = gp.reset_index(drop=True)
print(len(gp), "sample points along", seg.seg_id.nunique(), "segments")

# terrain from GEE (same recipe as train.py)
dem = ee.Image("USGS/SRTMGL1_003")
img = (dem.rename("elevation")
       .addBands(ee.Terrain.slope(dem).rename("slope"))
       .addBands(ee.Terrain.aspect(dem).rename("aspect"))
       .addBands(dem.convolve(ee.Kernel.laplacian8()).rename("curvature")))
recs = []
for s in range(0, len(gp), 400):
    chunk = gp.iloc[s:s + 400]
    fc = ee.FeatureCollection([
        ee.Feature(ee.Geometry.Point([float(r.lon), float(r.lat)]), {"i": int(i)})
        for i, r in chunk.iterrows()])
    out = img.reduceRegions(fc, ee.Reducer.first(), 30).getInfo()
    recs += [f["properties"] for f in out["features"]]
terr = pd.DataFrame(recs).set_index("i")
gp = gp.join(terr[["elevation", "slope", "aspect", "curvature"]])
gp["aspect"] = gp["aspect"].fillna(0)
gp["asp_sin"] = np.sin(np.radians(gp.aspect))
gp["asp_cos"] = np.cos(np.radians(gp.aspect))
gp["dist_road"] = 0.0          # these points lie ON the road
gp = gp.dropna(subset=["elevation", "slope", "curvature"])

X = gp[FEATS].values
gp["susc_lr"] = lr_pipe.predict_proba(X)[:, 1]
gp["susc_rf"] = rf.predict_proba(X)[:, 1]
gp["susc"] = (gp.susc_lr + gp.susc_rf) / 2      # mean of both models

agg = gp.groupby("seg_id").agg(
    susc_mean=("susc", "mean"), susc_max=("susc", "max"),
    susc_lr=("susc_lr", "mean"), susc_rf=("susc_rf", "mean"),
    elevation_mean=("elevation", "mean"), slope_mean=("slope", "mean"),
    slope_max=("slope", "max"), n_pts=("susc", "size")).reset_index()

# relative classes: quintiles of mean susceptibility ACROSS THIS CORRIDOR
agg["susc_class"] = pd.qcut(agg.susc_mean.rank(method="first"), 5, labels=False).astype(int)

# dominant terrain factors from LR contributions (coef x standardised value);
# dist_road is excluded because it is 0 for every on-road point
scaler = lr_pipe.named_steps["standardscaler"]
coef = lr_pipe.named_steps["logisticregression"].coef_[0]
fm = gp.groupby("seg_id")[FEATS].mean()
contrib = pd.DataFrame(scaler.transform(fm.values) * coef, index=fm.index, columns=FEATS)
LABEL = {"slope": "steep slope", "elevation": "low elevation (valley setting)",
         "curvature": "terrain curvature", "asp_sin": "slope aspect", "asp_cos": "slope aspect"}

def top_static(row):
    r = row.drop("dist_road")
    r = r[r > 0].sort_values(ascending=False)
    names = []
    for k in r.index:
        if LABEL[k] not in names:
            names.append(LABEL[k])
    return names[:2]

agg["static_factors"] = [top_static(contrib.loc[s]) for s in agg.seg_id]
static_tbl = seg[["seg_id", "label", "lat", "lon"]].merge(agg, on="seg_id")
static_tbl.assign(static_factors=static_tbl.static_factors.apply("; ".join)) \
    .to_csv("data/processed/segments_static_scores.csv", index=False)
print("saved data/processed/segments_static_scores.csv")

# =====================================================================
# PART B. CHIRPS rainfall -> trigger levels
# =====================================================================
seg["pix_x"] = np.floor(seg.lon / 0.05).astype(int)
seg["pix_y"] = np.floor(seg.lat / 0.05).astype(int)
seg["pixel"] = seg.pix_x.astype(str) + "_" + seg.pix_y.astype(str)
pix = seg.drop_duplicates("pixel")[["pixel", "pix_x", "pix_y"]].copy()
pix["lon"] = (pix.pix_x + 0.5) * 0.05
pix["lat"] = (pix.pix_y + 0.5) * 0.05
print(len(pix), "CHIRPS pixels cover the corridor")

def fetch_daily(pix, start, end):
    """Daily CHIRPS precipitation (mm/day) at each pixel centre. start/end inclusive."""
    fc = ee.FeatureCollection([
        ee.Feature(ee.Geometry.Point([float(r.lon), float(r.lat)]), {"pixel": r.pixel})
        for r in pix.itertuples()])
    rows, d0, d1 = [], pd.Timestamp(start), pd.Timestamp(end)
    while d0 <= d1:
        d_end = min(d0 + pd.Timedelta(days=39), d1)
        col = (ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
               .filterDate(d0.strftime("%Y-%m-%d"),
                           (d_end + pd.Timedelta(days=1)).strftime("%Y-%m-%d"))
               .select("precipitation"))

        def per_img(im):
            day = im.date().format("YYYY-MM-dd")
            return im.reduceRegions(fc, ee.Reducer.first(), 5566).map(
                lambda f: f.set("date", day))

        out = ee.FeatureCollection(col.map(per_img)).flatten().getInfo()
        for f in out["features"]:
            p = f["properties"]
            rows.append((p["pixel"], p["date"], p.get("first", p.get("precipitation"))))
        d0 = d_end + pd.Timedelta(days=1)
    df = pd.DataFrame(rows, columns=["pixel", "date", "p"])
    df["date"] = pd.to_datetime(df["date"])
    df["p"] = pd.to_numeric(df["p"], errors="coerce")
    return df

def add_windows(df):
    """Rolling totals INCLUDING the row's own day (conditions at end of that day)."""
    df = df.sort_values(["pixel", "date"]).copy()
    for n in WINDOWS:
        df[f"rain_{n}d"] = df.groupby("pixel")["p"].transform(
            lambda s: s.rolling(n, min_periods=n).sum())
    return df

# ---- monsoon history for percentiles (cached) ----
HIST_FILE = "data/processed/chirps_hist.csv"
if os.path.exists(HIST_FILE):
    hist = pd.read_csv(HIST_FILE, parse_dates=["date"])
else:
    parts = []
    for y in HIST_YEARS:
        print("fetching history", y)
        h = add_windows(fetch_daily(pix, f"{y}-05-15", f"{y}-09-30"))
        parts.append(h[h.date.dt.strftime("%m-%d") >= "06-15"])
    hist = pd.concat(parts, ignore_index=True)
    hist.to_csv(HIST_FILE, index=False)

ref, th = {}, []
for p, g in hist.groupby("pixel"):
    for n in WINDOWS:
        arr = np.sort(g[f"rain_{n}d"].dropna().values)
        ref[(p, n)] = arr
        if len(arr):
            th.append(dict(pixel=p, window_days=n,
                           **{f"p{c}_mm": float(np.percentile(arr, c)) for c in TRIG_CUTS}))
pd.DataFrame(th).to_csv("data/processed/rain_thresholds.csv", index=False)

def pct_rank(pixel, n, x):
    arr = ref.get((pixel, n))
    if arr is None or len(arr) == 0 or pd.isna(x):
        return np.nan
    return 100.0 * np.searchsorted(arr, x, side="left") / len(arr)

def level(p):
    return 0 if p < TRIG_CUTS[0] else 1 if p < TRIG_CUTS[1] else 2 if p < TRIG_CUTS[2] else 3

# ---- demo-range rainfall (14 days earlier are needed for the 14-day window) ----
fetch_start = (pd.Timestamp(START) - pd.Timedelta(days=14)).strftime("%Y-%m-%d")
dm = add_windows(fetch_daily(pix, fetch_start, END))
dm = dm[dm.date >= START].dropna(subset=[f"rain_{n}d" for n in WINDOWS]).copy()
for n in WINDOWS:
    dm[f"pct_{n}d"] = [pct_rank(p, n, x) for p, x in zip(dm.pixel, dm[f"rain_{n}d"])]
dm = dm.dropna(subset=[f"pct_{n}d" for n in WINDOWS]).copy()
dm["trigger_pct"] = dm[[f"pct_{n}d" for n in WINDOWS]].max(axis=1)
dm["trigger_level"] = [level(p) for p in dm.trigger_pct]

# =====================================================================
# PART C. Combine -> current risk
# =====================================================================
cache = seg[["seg_id", "pixel"]].merge(dm, on="pixel").merge(
    static_tbl.drop(columns=["lat", "lon"]), on="seg_id")
cache["current_risk_idx"] = [MATRIX[int(s)][int(t)]
                             for s, t in zip(cache.susc_class, cache.trigger_level)]
cache["current_risk"] = [RISK[i] for i in cache.current_risk_idx]
cache["susc_class_name"] = [RISK[i] for i in cache.susc_class]
cache["trigger_name"] = [TRIG[i] for i in cache.trigger_level]

def dyn_factors(r):
    out = []
    if r.pct_1d >= 90: out.append("intense 1-day rainfall")
    if r.pct_3d >= 90: out.append("high 3-day rainfall")
    if r.pct_7d >= 90: out.append("high 7-day cumulative rainfall")
    if r.pct_14d >= 90: out.append("high 14-day antecedent rainfall")
    return out

cache["dominant_factors"] = [
    "; ".join(dyn_factors(r) + list(r.static_factors)) or "no dominant factor flagged"
    for r in cache.itertuples()]
cache["recommended_action"] = [ACTION[i] + DISCLAIMER for i in cache.current_risk_idx]
cache["ndvi_change"] = np.nan        # NOT computed in this version; shown as unavailable

keep_cols = ["seg_id", "label", "date", "rain_1d", "rain_3d", "rain_7d", "rain_14d",
             "pct_1d", "pct_3d", "pct_7d", "pct_14d", "trigger_pct", "trigger_name",
             "susc_mean", "susc_max", "susc_lr", "susc_rf", "susc_class_name",
             "current_risk", "slope_mean", "slope_max", "elevation_mean",
             "ndvi_change", "dominant_factors", "recommended_action"]
cache = cache[keep_cols].sort_values(["date", "seg_id"])
cache.to_csv("data/processed/risk_cache.csv", index=False)
print("saved data/processed/risk_cache.csv:", len(cache), "rows")

# ---- demo summary: the real wettest 3-day period in your range ----
peak = cache.groupby("date").rain_3d.mean().idxmax()
print("\nWettest 3-day date in range:", peak.date(),
      "| corridor-mean 3-day rain: %.0f mm" % cache[cache.date == peak].rain_3d.mean())
for d in [peak - pd.Timedelta(days=2), peak - pd.Timedelta(days=1), peak]:
    c = cache[cache.date == d].current_risk.value_counts().reindex(RISK).fillna(0).astype(int)
    print(d.date(), c.to_dict())