import os, ee, pandas as pd, geopandas as gpd
from dotenv import load_dotenv
load_dotenv()
ee.Initialize(project=os.environ["GEE_PROJECT"])

# 1. Road and 1 km zone around it
seg = gpd.read_file("data/processed/segments_crop.geojson")
coords = [c for g in seg.geometry for c in g.coords]
road = ee.Geometry.LineString([[x, y] for x, y in coords])
aoi = road.buffer(1000)

# 2. Slope from the DEM
slope = ee.Terrain.slope(ee.Image("USGS/SRTMGL1_003"))

# 3. NDVI helper
def ndvi_med(start, end):
    return (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(aoi).filterDate(start, end)
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
            .map(lambda i: i.normalizedDifference(["B8", "B4"])).median())

# 4. Loop over years
rows = []
for y in range(2018, 2025):
    pre  = ndvi_med(f"{y}-03-01", f"{y}-05-31")   # before monsoon
    post = ndvi_med(f"{y}-10-01", f"{y}-12-15")   # after monsoon
    m = post.subtract(pre).lt(-0.25).And(slope.gt(20)).And(pre.gt(0.3)).selfMask()
    m = m.updateMask(m.connectedPixelCount(100, True).gt(5))
    pts = m.reduceToVectors(geometry=aoi, scale=30, geometryType="centroid",
                            maxPixels=1e9, bestEffort=True)
    try:
        fc = pts.limit(200).getInfo()
    except Exception as e:
        print(y, "failed:", e); continue
    for f in fc["features"]:
        lon, lat = f["geometry"]["coordinates"]
        rows.append({"lat": lat, "lon": lon, "date": "", "source": "sentinel2_proxy",
                     "notes": f"NDVI drop {y} on slope>20; proxy label"})
    print(y, len(fc["features"]))

# 5. Remove duplicates and save
df = pd.DataFrame(rows)
df["k"] = df.lat.round(3).astype(str) + df.lon.round(3).astype(str)
df = df.drop_duplicates("k").drop(columns="k")
df.to_csv("data/processed/scar_candidates.csv", index=False)
print(len(df), "unique candidates")

# 6. KML for Google Earth
with open("data/processed/scar_candidates.kml", "w") as f:
    f.write('<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>')
    for i, r in df.iterrows():
        f.write(f"<Placemark><name>{i}</name><Point><coordinates>{r.lon},{r.lat}</coordinates></Point></Placemark>")
    f.write("</Document></kml>")