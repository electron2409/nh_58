import geopandas as gpd

LAST = 69   # Devprayag, confirmed on geojson.io
gdf = gpd.read_file("data/processed/segments.geojson")
gdf = gdf[gdf.seg_id <= LAST]
gdf.to_file("data/processed/segments_crop.geojson", driver="GeoJSON")
gdf.drop(columns="geometry").to_csv("data/processed/segments_crop.csv", index=False)
print(len(gdf), "segments kept")   # expect 70