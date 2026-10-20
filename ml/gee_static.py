import os, ee
from dotenv import load_dotenv
load_dotenv()
ee.Initialize(project=os.environ["GEE_PROJECT"])

# Rough AOI covering Rishikesh -> Devprayag. We refine it later from the road.
AOI = ee.Geometry.Rectangle([78.20, 30.00, 78.70, 30.25])

def static_stack(aoi=AOI):
    dem = ee.Image("USGS/SRTMGL1_003").clip(aoi)
    slope = ee.Terrain.slope(dem).rename("slope")
    aspect = ee.Terrain.aspect(dem).rename("aspect")
    curv = dem.convolve(ee.Kernel.laplacian8()).rename("curvature")
    elev = dem.rename("elevation")

    s2 = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
          .filterBounds(aoi).filterDate("2022-11-01", "2023-03-31")
          .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20)))
    ndvi = s2.map(lambda i: i.normalizedDifference(["B8", "B4"])).median().rename("ndvi_base")

    return elev.addBands([slope, aspect, curv, ndvi]).clip(aoi)

if __name__ == "__main__":
    img = static_stack()
    pt = ee.Geometry.Point([78.27, 30.09])   # near Rishikesh
    print(img.reduceRegion(ee.Reducer.first(), pt, 30).getInfo())