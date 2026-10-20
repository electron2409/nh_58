import json

t = json.load(open("models/metrics.json"))
try:
    dyn = json.load(open("models/dynamic_metrics.json"))
except FileNotFoundError:
    dyn = None

L = ["# Validation Summary\n",
     "## A. Terrain susceptibility (Logistic Regression and Random Forest)\n",
     f"Samples: {t['n_landslide']} landslide-labelled points and {t['n_nonlandslide']} random "
     f"corridor points (2 km road buffer, 200 m clear of labelled points). Validation: spatial block "
     f"CV with {t['cv_blocks']} blocks; pooled out-of-fold predictions at threshold 0.5.\n",
     "| Model | ROC-AUC | Accuracy | Precision | Recall | F1 | Confusion matrix [[TN,FP],[FN,TP]] |",
     "|---|---|---|---|---|---|---|"]
for k, m in t["metrics"].items():
    L.append(f"| {k} | {m['AUC']:.3f} | {m['Accuracy']:.3f} | {m['Precision']:.3f} | "
             f"{m['Recall']:.3f} | {m['F1']:.3f} | {m['CM']} |")
L.append("\nNo model is declared better: with this sample size the differences are within noise.\n"
         "Label caveat: 28 points were marked by hand on imagery, 8 are unverified Sentinel-2 "
         "vegetation-loss candidates, 1 is a NASA GLC event. Negatives are random locations, not "
         "confirmed stable slopes. The AUC shows the model separates labelled scars from random "
         "corridor locations; it is not a validation against documented closures.\n")

if dyn:
    L += ["## B. Preliminary regional rainfall-trigger model (not used for dashboard risk)\n",
          f"{dyn['n_events']} reported events (NASA GLC, 2007-2015, accuracy 5 km or better) and "
          f"{dyn['n_controls']} same-place, same-season controls. Features: {', '.join(dyn['features'])}.\n",
          "| Split | Model | ROC-AUC | PR-AUC | Event rate | Precision | Recall | F1 |",
          "|---|---|---|---|---|---|---|---|"]
    for split in ("grouped_cv", "chronological"):
        for k, m in dyn[split].items():
            L.append(f"| {split} | {k} | {m['AUC']:.3f} | {m['PR_AUC']:.3f} | {m['event_rate']:.2f} | "
                     f"{m['Precision']:.3f} | {m['Recall']:.3f} | {m['F1']:.3f} |")
    L.append("\nThe 2013 events dominate the data and the chronological test is mostly one year. "
             "Probabilities are uncalibrated. This supports rainfall as a trigger variable; it does "
             "not validate the dashboard's risk matrix.\n")

L.append("## C. Not done\n"
         "- No validation against documented 2022-23 closures (no dated 2022-23 inventory was available).\n"
         "- No geology, fault distance, soil depth or NDVI change in the models.")
open("docs/validation_summary.md", "w", encoding="utf-8").write("\n".join(L))
print("saved docs/validation_summary.md")