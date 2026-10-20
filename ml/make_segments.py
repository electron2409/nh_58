import geopandas as gpd
from shapely.ops import linemerge, unary_union, substring

RAW = "data/raw/nh58.geojson"
UTM = 32644          # metric CRS for this area (UTM zone 44N)
SEG_M = 1000         # segment length in metres

gdf = gpd.read_file(RAW)
gdf = gdf[gdf.geometry.type.isin(["LineString", "MultiLineString"])].to_crs(UTM)

merged = linemerge(unary_union(gdf.geometry))
if merged.geom_type == "MultiLineString":
    parts = sorted(merged.geoms, key=lambda g: g.length, reverse=True)
    print(f"WARNING: road has {len(parts)} disconnected parts. "
          f"Lengths (km): {[round(p.length/1000,1) for p in parts]}")
    merged = parts[0]   # keep longest; fix gaps in QGIS if this is not the full road

# Make chainage start at Rishikesh (the western end)
if merged.coords[0][0] > merged.coords[-1][0]:
    merged = type(merged)(list(merged.coords)[::-1])

total = merged.length
print(f"Total length: {total/1000:.1f} km")

rows = []
d, i = 0.0, 0
while d < total:
    end = min(d + SEG_M, total)
    if end - d < 300 and rows:      # merge a tiny last piece into the previous one
        rows[-1]["geometry"] = substring(merged, d - SEG_M, end)
        break
    rows.append({
        "seg_id": i,
        "start_km": round(d / 1000, 1),
        "end_km": round(end / 1000, 1),
        "label": f"{d/1000:.0f}-{end/1000:.0f} km",
        "geometry": substring(merged, d, end),
    })
    d, i = end, i + 1

seg = gpd.GeoDataFrame(rows, crs=UTM)
seg_ll = seg.to_crs(4326)
c = seg.geometry.interpolate(0.5, normalized=True).to_crs(4326)
seg_ll["lon"], seg_ll["lat"] = c.x, c.y

seg_ll.to_file("data/processed/segments.geojson", driver="GeoJSON")
seg_ll.drop(columns="geometry").to_csv("data/processed/segments.csv", index=False)
print(seg_ll[["seg_id", "label", "lat", "lon"]].head())
print(f"{len(seg_ll)} segments saved")