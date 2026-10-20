import os, json, ee, joblib, numpy as np, pandas as pd, geopandas as gpd
from shapely.geometry import Point
from dotenv import load_dotenv
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.cluster import KMeans
from sklearn.model_selection import GroupKFold
from sklearn.metrics import (roc_auc_score, accuracy_score, precision_score,
                             recall_score, f1_score, confusion_matrix)

load_dotenv()
ee.Initialize(project=os.environ["GEE_PROJECT"])
rng = np.random.default_rng(42)
UTM = 32644

# ---------- 1. inventory + road ----------
inv = pd.read_csv("data/raw/inventory.csv").dropna(subset=["lat", "lon"])
seg = gpd.read_file("data/processed/segments_crop.geojson").to_crs(UTM)
road = seg.union_all() if hasattr(seg, "union_all") else seg.unary_union

pos = gpd.GeoDataFrame(inv, geometry=gpd.points_from_xy(inv.lon, inv.lat), crs=4326).to_crs(UTM)
pos["label"] = 1
pos = pos.reset_index(drop=True)

# ---------- 2. sample negatives: within 2 km of road, >=200 m from any landslide ----------
zone = road.buffer(2000)
pos_union = pos.geometry.union_all() if hasattr(pos.geometry, "union_all") else pos.geometry.unary_union
keep_away = pos_union.buffer(200)
minx, miny, maxx, maxy = zone.bounds

neg_pts = []
while len(neg_pts) < len(pos):
    p = Point(rng.uniform(minx, maxx), rng.uniform(miny, maxy))
    if zone.contains(p) and not keep_away.contains(p):
        neg_pts.append(p)
neg = gpd.GeoDataFrame({"label": [0] * len(neg_pts)}, geometry=neg_pts, crs=UTM)

data = pd.concat([pos[["geometry", "label"]], neg], ignore_index=True)
data = gpd.GeoDataFrame(data, geometry="geometry", crs=UTM)
data["dist_road"] = data.geometry.distance(road)
ll = data.to_crs(4326)
data["lon"], data["lat"] = ll.geometry.x.values, ll.geometry.y.values

# ---------- 3. terrain features from GEE (no NDVI on purpose) ----------
dem = ee.Image("USGS/SRTMGL1_003")
img = (dem.rename("elevation")
       .addBands(ee.Terrain.slope(dem).rename("slope"))
       .addBands(ee.Terrain.aspect(dem).rename("aspect"))
       .addBands(dem.convolve(ee.Kernel.laplacian8()).rename("curvature")))

fc = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Point([float(r.lon), float(r.lat)]), {"i": int(i)})
    for i, r in data.iterrows()])
out = img.reduceRegions(fc, ee.Reducer.first(), scale=30).getInfo()
feat = pd.DataFrame([f["properties"] for f in out["features"]]).set_index("i")
data = data.join(feat[["elevation", "slope", "aspect", "curvature"]])

# aspect is circular: sin/cos so 359 and 1 degrees are neighbours
data["aspect"] = data["aspect"].fillna(0)
data["asp_sin"] = np.sin(np.radians(data.aspect))
data["asp_cos"] = np.cos(np.radians(data.aspect))

FEATS = ["elevation", "slope", "asp_sin", "asp_cos", "curvature", "dist_road"]
before = len(data)
data = data.dropna(subset=FEATS).reset_index(drop=True)
print("rows dropped for missing terrain values:", before - len(data))
data.drop(columns="geometry").to_csv("data/processed/training_table.csv", index=False)
print("label counts:", data.label.value_counts().to_dict())

# ---------- 4. spatial cross-validation ----------
X, y = data[FEATS].values, data.label.values
k = min(5, max(3, len(data) // 12))
groups = KMeans(k, n_init=10, random_state=42).fit_predict(data[["lon", "lat"]])

models = {
    "LogisticRegression": make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000)),
    "RandomForest": RandomForestClassifier(n_estimators=300, min_samples_leaf=3, random_state=42),
}

res = {}
for name, m in models.items():
    prob = np.zeros(len(y))
    for tr, te in GroupKFold(k).split(X, y, groups):
        m.fit(X[tr], y[tr])
        prob[te] = m.predict_proba(X[te])[:, 1]
    pred = (prob >= 0.5).astype(int)
    res[name] = dict(
        AUC=float(roc_auc_score(y, prob)),
        Accuracy=float(accuracy_score(y, pred)),
        Precision=float(precision_score(y, pred, zero_division=0)),
        Recall=float(recall_score(y, pred, zero_division=0)),
        F1=float(f1_score(y, pred, zero_division=0)),
        CM=confusion_matrix(y, pred).tolist())
    print(f"\n{name}")
    for a, b in res[name].items():
        print(f"  {a}: {b}" if a == "CM" else f"  {a}: {b:.3f}")

# ---------- 5. final models on all data + interpretability ----------
os.makedirs("models", exist_ok=True)
for name, m in models.items():
    m.fit(X, y)
    joblib.dump(m, f"models/{name}.joblib")

lr = models["LogisticRegression"].named_steps["logisticregression"]
print("\nLR coefficients (standardised):", dict(zip(FEATS, lr.coef_[0].round(3))))
print("RF importance:", dict(zip(FEATS, models["RandomForest"].feature_importances_.round(3))))

json.dump({"features": FEATS, "n_landslide": int((y == 1).sum()),
           "n_nonlandslide": int((y == 0).sum()), "cv_blocks": int(k),
           "metrics": res}, open("models/metrics.json", "w"), indent=2)
print("\nSaved models/ and data/processed/training_table.csv")