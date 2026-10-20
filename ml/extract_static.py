import os, ee, json, pandas as pd, geopandas as gpd
from dotenv import load_dotenv
load_dotenv()
ee.Initialize(project=os.environ["GEE_PROJECT"])
from gee_static import static_stack

def extract(gdf_ll, buffer_m=100, scale=30):
    """gdf_ll: GeoDataFrame in EPSG:4326 with an 'id' column. Returns DataFrame."""
    img = static_stack()
    feats = []
    for _, r in gdf_ll.iterrows():
        g = ee.Geometry(json.loads(gpd.GeoSeries([r.geometry]).to_json())["features"][0]["geometry"])
        feats.append(ee.Feature(g.buffer(buffer_m), {"id": int(r["id"])}))
    fc = ee.FeatureCollection(feats)
    red = ee.Reducer.mean().combine(ee.Reducer.max(), sharedInputs=True)
    out = img.reduceRegions(fc, red, scale=scale).getInfo()
    return pd.DataFrame([f["properties"] for f in out["features"]])

if __name__ == "__main__":
    seg = gpd.read_file("data/processed/segments_crop.geojson")
    seg["id"] = seg["seg_id"]
    df = extract(seg)
    df = df.rename(columns={"id": "seg_id"})
    df.to_csv("data/processed/segments_static.csv", index=False)
    print(df.head()); print(len(df), "rows")