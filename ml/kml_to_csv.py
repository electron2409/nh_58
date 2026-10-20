import sys, zipfile
import xml.etree.ElementTree as ET
import pandas as pd

path = "data/raw/my_marked.kml"
if path.lower().endswith(".kmz"):
    z = zipfile.ZipFile(path)
    name = [n for n in z.namelist() if n.lower().endswith(".kml")][0]
    xml = z.read(name)
else:
    xml = open(path, "rb").read()

rows = []
for el in ET.fromstring(xml).iter():
    if el.tag.endswith("Placemark"):
        for c in el.iter():
            if c.tag.endswith("coordinates") and c.text and c.text.strip():
                parts = c.text.strip().split()[0].split(",")
                lon, lat = float(parts[0]), float(parts[1])
                if 30.0 <= lat <= 30.25 and 78.2 <= lon <= 78.7:
                    rows.append({"lat": lat, "lon": lon, "date": "",
                                 "source": "manual_google_earth",
                                 "notes": "visually marked scar near NH-58"})
df = pd.DataFrame(rows)
df.to_csv("data/raw/my_marked.csv", index=False)
print(len(df), "points saved")