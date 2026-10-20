import glob, json, os, joblib, numpy as np, pandas as pd
from sklearn.model_selection import GroupKFold
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (roc_auc_score, average_precision_score, precision_score,
                             recall_score, f1_score, brier_score_loss, confusion_matrix)

pts = pd.read_csv("data/processed/dyn_points.csv")
rain = pd.concat(map(pd.read_csv, glob.glob("data/gee/nh58_rain_*.csv")), ignore_index=True)
df = pts.merge(rain.drop(columns=["event_id", "label", "obs_date"]), on="sample_id")

ok = np.all([df[f"rain_{n}d_ndays"] == n for n in (1, 3, 7, 14)], axis=0) & df.rain_7d_ref_sd.notna()
print("dropped for incomplete rainfall:", int((~ok).sum()))
df = df[ok].copy()

SD_FLOOR = 5.0   # mm; tunable screening value, not a published number
df["rain_anom_z"] = (df.rain_7d - df.rain_7d_ref_mean) / df.rain_7d_ref_sd.clip(lower=SD_FLOOR)
for n in (1, 3, 7, 14):
    df[f"lr_{n}d"] = np.log1p(df[f"rain_{n}d"])
FEATS = ["lr_1d", "lr_3d", "lr_7d", "lr_14d", "rain_anom_z"]

df["year"] = df.obs_ymd // 10000
print("\nrows per year (label 0 = control, 1 = event):")
print(df.groupby(["year", "label"]).size().unstack(fill_value=0))

X, y, g = df[FEATS].values, df.label.values, df.storm_id.values
print("\nevents:", int(y.sum()), "controls:", int((y == 0).sum()),
      "event rate: %.2f" % y.mean())

def models():
    return {"LR": make_pipeline(StandardScaler(),
                                LogisticRegression(max_iter=2000, class_weight="balanced")),
            "RF": RandomForestClassifier(300, min_samples_leaf=5, random_state=42,
                                         class_weight="balanced_subsample")}

def oof(name, X, y, g):
    k = min(5, len(set(g)))
    p = np.zeros(len(y))
    for tr, te in GroupKFold(k).split(X, y, g):
        p[te] = models()[name].fit(X[tr], y[tr]).predict_proba(X[te])[:, 1]
    return p

def best_thr(y, p):
    ts = np.linspace(0.05, 0.95, 91)
    f = [f1_score(y, (p >= t).astype(int), zero_division=0) for t in ts]
    return float(ts[int(np.argmax(f))])

def report(name, y, p, thr):
    pred = (p >= thr).astype(int)
    r = y.mean()
    print(f"{name}: AUC={roc_auc_score(y, p):.3f}  PR-AUC={average_precision_score(y, p):.3f} "
          f"(chance={r:.2f})  Brier={brier_score_loss(y, p):.3f} (constant guess={r*(1-r):.3f})")
    print(f"   at threshold {thr:.2f}: P={precision_score(y, pred, zero_division=0):.3f} "
          f"R={recall_score(y, pred, zero_division=0):.3f} F1={f1_score(y, pred, zero_division=0):.3f} "
          f"CM={confusion_matrix(y, pred).tolist()}")
    return dict(AUC=float(roc_auc_score(y, p)), PR_AUC=float(average_precision_score(y, p)),
                event_rate=float(r), threshold=float(thr),
                Precision=float(precision_score(y, pred, zero_division=0)),
                Recall=float(recall_score(y, pred, zero_division=0)),
                F1=float(f1_score(y, pred, zero_division=0)),
                CM=confusion_matrix(y, pred).tolist())

out = {"features": FEATS, "sd_floor_mm": SD_FLOOR, "n_events": int(y.sum()),
       "n_controls": int((y == 0).sum()), "grouped_cv": {}, "chronological": {}}

print("\n== storm-grouped CV (balanced class weights, threshold 0.5) ==")
for name in ("LR", "RF"):
    out["grouped_cv"][name] = report(name, y, oof(name, X, y, g), 0.5)

print("\n== chronological: train before 2013, test 2013 onward ==")
tr, te = (df.obs_ymd < 20130101).values, (df.obs_ymd >= 20130101).values
print(f"train rows {int(tr.sum())} (event rate {y[tr].mean():.2f}); "
      f"test rows {int(te.sum())} (event rate {y[te].mean():.2f})")
print("threshold is chosen on TRAIN out-of-fold predictions only, never on the test set")
for name in ("LR", "RF"):
    thr = best_thr(y[tr], oof(name, X[tr], y[tr], g[tr]))
    m = models()[name].fit(X[tr], y[tr])
    out["chronological"][name] = report(name, y[te], m.predict_proba(X[te])[:, 1], thr)

os.makedirs("models", exist_ok=True)
for name in ("LR", "RF"):
    joblib.dump(models()[name].fit(X, y), f"models/dynamic_{name}.joblib")
json.dump(out, open("models/dynamic_metrics.json", "w"), indent=2)
print("\nSaved models/dynamic_LR.joblib, models/dynamic_RF.joblib, models/dynamic_metrics.json")