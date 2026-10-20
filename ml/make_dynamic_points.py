import re, numpy as np, pandas as pd
from sklearn.cluster import DBSCAN
rng = np.random.default_rng(42)

df = pd.read_csv("data/raw/glc.csv")
df.columns = [re.sub(r"\W+", "_", c.strip().lower()) for c in df.columns]

ID, DATE, LAT, LON, ACC = ("event_id", "event_date", "latitude", "longitude", "location_accuracy")

ev = pd.DataFrame({
    "event_id": df[ID].astype(str),
    "date": pd.to_datetime(df[DATE], errors="coerce", format="mixed").dt.normalize(),
    "lat": pd.to_numeric(df[LAT], errors="coerce"),
    "lon": pd.to_numeric(df[LON], errors="coerce"),
    "acc": df[ACC].astype(str).str.lower().str.strip()})

box = ev.lat.between(29.8, 31.2) & ev.lon.between(77.6, 80.2)
dated = ev.date.notna()
inrange = (ev.date >= "2007-01-01") & (ev.date <= "2015-12-31")
acc_ok = ev.acc.str.contains(r"exact|\b1\s*km|\b5\s*km", regex=True)

print("rows total:", len(ev))
print("inside lat/lon box:", int(box.sum()))
print("accuracy values inside box:", ev[box].acc.value_counts().to_dict())
print("and with a parsable date:", int((box & dated).sum()))
print("and dated 2007-2015:", int((box & dated & inrange).sum()))
print("and accuracy exact/1km/5km:", int((box & dated & inrange & acc_ok).sum()))

ev = ev[box & dated & inrange & acc_ok].reset_index(drop=True)
print(len(ev), "usable dated events")
if len(ev) == 0:
    raise SystemExit("Still 0. Send me the lines printed above.")

# group events from the same storm so they stay in one CV fold (heuristic)
xy = np.c_[(ev.date - pd.Timestamp("2000-01-01")).dt.days * 20.0,
           ev.lon * 96.0, ev.lat * 111.0]
ev["storm_id"] = DBSCAN(eps=60, min_samples=1).fit_predict(xy)

# controls: same place, same season, other years, >=30 days from any event within 25 km
K, ctrl = 3, []
for _, r in ev.iterrows():
    got = tries = 0
    while got < K and tries < 300:
        tries += 1
        yr = int(rng.integers(2007, 2016))
        d = pd.Timestamp(year=yr, month=r.date.month, day=min(r.date.day, 28)) \
            + pd.Timedelta(days=int(rng.integers(-45, 46)))
        if not (pd.Timestamp("2007-01-01") <= d <= pd.Timestamp("2015-12-31")):
            continue
        near = ev[(abs((ev.date - d).dt.days) <= 30) &
                  (np.hypot((ev.lat - r.lat) * 111, (ev.lon - r.lon) * 96) <= 25)]
        if len(near):
            continue
        ctrl.append(dict(event_id=f"ctrl_of_{r.event_id}", date=d, lat=r.lat,
                         lon=r.lon, label=0, storm_id=r.storm_id))
        got += 1

pts = pd.concat([ev.assign(label=1), pd.DataFrame(ctrl)], ignore_index=True)
pts["sample_id"] = ["S%04d" % i for i in range(len(pts))]
pts["obs_date"] = pts.date.dt.strftime("%Y-%m-%d")
pts["obs_ymd"] = pts.date.dt.strftime("%Y%m%d").astype(int)
pts[["sample_id", "event_id", "label", "obs_date", "obs_ymd", "storm_id", "lat", "lon"]] \
    .to_csv("data/processed/dyn_points.csv", index=False)
print("label counts:", pts.label.value_counts().to_dict())
print("saved data/processed/dyn_points.csv")