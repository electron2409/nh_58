import pandas as pd, os

parts = []

# 1. The one real COOLR event you read from NASA
parts.append(pd.DataFrame([{
    "lat": 30.13, "lon": 78.32, "date": "2012-07-05", "source": "coolr",
    "notes": "Badrinath Rd Rishikesh; cloudburst debris slide; GLC 4445; within 1 km"}]))

# 2. GEE proxy candidates
if os.path.exists("data/processed/scar_candidates.csv"):
    parts.append(pd.read_csv("data/processed/scar_candidates.csv"))

# 3. Your own visually confirmed points (optional)
if os.path.exists("data/raw/my_marked.csv"):
    parts.append(pd.read_csv("data/raw/my_marked.csv"))

inv = pd.concat(parts, ignore_index=True)
inv["k"] = inv.lat.round(4).astype(str) + inv.lon.round(4).astype(str)
inv = inv.drop_duplicates("k").drop(columns="k")
inv.to_csv("data/raw/inventory.csv", index=False)
print(len(inv), "points in inventory")
print(inv.source.value_counts())