import pandas as pd

c = pd.read_csv("data/processed/risk_cache.csv", parse_dates=["date"])
peak = c.groupby("date").rain_3d.mean().idxmax()
ORDER = {"VERY LOW": 0, "LOW": 1, "MODERATE": 2, "HIGH": 3, "VERY HIGH": 4}
d = c[c.date == peak].copy()
d["r"] = d.current_risk.map(ORDER)
top = d.sort_values(["r", "susc_mean", "rain_3d"], ascending=False).head(5)

L = ["# Recommendation Note: NH-58 Rishikesh to Devprayag",
     f"\nScenario date: **{peak.date()}** (wettest 3-day period in the demo range, "
     f"corridor-mean 3-day rainfall {d.rain_3d.mean():.0f} mm, CHIRPS).\n",
     "> **Screening guidance only.** Produced from a terrain-only susceptibility model and a "
     "rule-based rainfall trigger. It does not replace site investigation or geotechnical "
     "assessment. Chainage is approximate distance along the OSM road line from Rishikesh.\n",
     "## Top segments\n",
     "| Segment (approx. km) | Current risk | Terrain susceptibility | Rain 1d / 3d / 7d (mm) | Mean slope |",
     "|---|---|---|---|---|"]
for _, r in top.iterrows():
    L.append(f"| {r.label} | {r.current_risk} | {r.susc_class_name} | "
             f"{r.rain_1d:.0f} / {r.rain_3d:.0f} / {r.rain_7d:.0f} | {r.slope_mean:.1f} deg |")

L.append("\n## Per-segment notes and candidate measures (for engineer review)\n")
for _, r in top.iterrows():
    L.append(f"### {r.label}: {r.current_risk}")
    L.append(f"- Flagged factors: {r.dominant_factors}")
    m = ["Inspect cut slopes and road-edge drains before and after heavy rain.",
         f"Early-warning trigger for engineer review: rainfall at or above the "
         f"{r.trigger_name.lower()} trigger band for this CHIRPS pixel."]
    if r.slope_mean >= 20 or "steep slope" in str(r.dominant_factors):
        m.append("Assess slope stabilisation options for steep cut slopes (benching, "
                 "bio-engineering, surface protection).")
    if r.rain_7d >= 100 or "rainfall" in str(r.dominant_factors):
        m.append("Check culverts and side drains for blockage; consider extra surface drainage.")
    m.append("A geotechnical engineer should decide whether retaining structures are needed.")
    L += [f"- {x}" for x in m]
    L.append("")

L.append("## Limits of this note\n"
         "- Susceptibility comes from terrain only (SRTM, 30 m) and a small, mixed-quality inventory.\n"
         "- Rainfall is CHIRPS (about 5 km), so neighbouring segments often share one value.\n"
         "- Geology, soil depth and NDVI change are not included in this version.\n"
         "- Risk classes use an expert-judgement matrix that is not calibrated on events.")
open("docs/recommendation_note.md", "w", encoding="utf-8").write("\n".join(L))
print("saved docs/recommendation_note.md")
print(top[["label", "current_risk", "rain_3d"]])