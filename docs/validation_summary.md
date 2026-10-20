# Validation Summary

## A. Terrain susceptibility (Logistic Regression and Random Forest)

Samples: 37 landslide-labelled points and 37 random corridor points (2 km road buffer, 200 m clear of labelled points). Validation: spatial block CV with 5 blocks; pooled out-of-fold predictions at threshold 0.5.

| Model | ROC-AUC | Accuracy | Precision | Recall | F1 | Confusion matrix [[TN,FP],[FN,TP]] |
|---|---|---|---|---|---|---|
| LogisticRegression | 0.834 | 0.797 | 0.775 | 0.838 | 0.805 | [[28, 9], [6, 31]] |
| RandomForest | 0.866 | 0.743 | 0.725 | 0.784 | 0.753 | [[26, 11], [8, 29]] |

No model is declared better: with this sample size the differences are within noise.
Label caveat: 28 points were marked by hand on imagery, 8 are unverified Sentinel-2 vegetation-loss candidates, 1 is a NASA GLC event. Negatives are random locations, not confirmed stable slopes. The AUC shows the model separates labelled scars from random corridor locations; it is not a validation against documented closures.

## B. Preliminary regional rainfall-trigger model (not used for dashboard risk)

50 reported events (NASA GLC, 2007-2015, accuracy 5 km or better) and 150 same-place, same-season controls. Features: lr_1d, lr_3d, lr_7d, lr_14d, rain_anom_z.

| Split | Model | ROC-AUC | PR-AUC | Event rate | Precision | Recall | F1 |
|---|---|---|---|---|---|---|---|
| grouped_cv | LR | 0.699 | 0.453 | 0.25 | 0.404 | 0.720 | 0.518 |
| grouped_cv | RF | 0.704 | 0.459 | 0.25 | 0.519 | 0.540 | 0.529 |
| chronological | LR | 0.761 | 0.727 | 0.49 | 0.600 | 0.265 | 0.367 |
| chronological | RF | 0.766 | 0.730 | 0.49 | 0.742 | 0.676 | 0.708 |

The 2013 events dominate the data and the chronological test is mostly one year. Probabilities are uncalibrated. This supports rainfall as a trigger variable; it does not validate the dashboard's risk matrix.

## C. Not done
- No validation against documented 2022-23 closures (no dated 2022-23 inventory was available).
- No geology, fault distance, soil depth or NDVI change in the models.