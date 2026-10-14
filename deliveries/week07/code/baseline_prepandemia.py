DATASET_ID = "wujg-7c2s"
RESOURCE_URL = f"https://data.ny.gov/resource/{DATASET_ID}.json"
SOCRATA_APP_TOKEN = ""
TIMEOUT = 150
PAGE = 50000

import json, os, time, urllib.parse, urllib.request
from collections import defaultdict
from datetime import date, timedelta

def request_headers():
    h = {"User-Agent": "data-visualization-2026-2/1.0"}
    if SOCRATA_APP_TOKEN:
        h["X-App-Token"] = SOCRATA_APP_TOKEN
    return h

def fetch(params, timeout=TIMEOUT, retries=3):
    url = RESOURCE_URL + "?" + urllib.parse.urlencode(params)
    delay = 4.0
    for a in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers=request_headers())
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            if a == retries:
                print(f"   fallo: {exc}")
                return None
            time.sleep(delay); delay *= 2

def query_range(select, group, ini, fin, order=None):
    out, off = [], 0
    while True:
        p = {"$select": select, "$group": group,
             "$where": (f"transit_timestamp >= '{ini.isoformat()}T00:00:00' "
                        f"AND transit_timestamp < '{fin.isoformat()}T00:00:00'"),
             "$limit": PAGE, "$offset": off}
        if order: p["$order"] = order
        page = fetch(p)
        if page is None: return None
        out.extend(page)
        if len(page) < PAGE: return out
        off += PAGE

def num(x):
    try: return float(x)
    except: return 0.0

VENT, cur, FIN = [], date(2020,1,1), date(2020,3,1)
while cur < FIN:
    nxt = min(cur + timedelta(days=7), FIN)
    VENT.append((cur, nxt)); cur = nxt
print(f"{len(VENT)} ventanas: {VENT[0][0]} .. {VENT[-1][1]}")

SEL = ("station_complex_id, date_extract_dow(transit_timestamp) AS dow, "
       "date_extract_hh(transit_timestamp) AS hora, sum(ridership) AS ridership")
GRP = ("station_complex_id, date_extract_dow(transit_timestamp), "
       "date_extract_hh(transit_timestamp)")

PRE = {}
t0 = time.time()
for ini, fin in VENT:
    print(f"  {ini} ...", end=" ", flush=True)
    d = query_range(SEL, GRP, ini, fin, "station_complex_id")
    if d is None:
        print("FALLO"); continue
    for r in d:
        cid = r.get("station_complex_id")
        if not cid: continue
        k = (cid, int(num(r.get("dow"))), int(num(r.get("hora"))))
        PRE[k] = PRE.get(k, 0.0) + num(r.get("ridership"))
    print(f"{len(d)} filas")

print(f"\nPerfil prepandemia: {len(PRE):,} celdas en {time.time()-t0:.0f}s")

import csv

def perfil_sistema(d):
    p = defaultdict(float)
    for (cid, dow, h), v in d.items():
        if 1 <= dow <= 5: p[h] += v
    t = sum(p.values())
    return [100*p[h]/t for h in range(24)]

pre = perfil_sistema(PRE)
pico_am = max(range(5,11), key=lambda h: pre[h])
pico_pm = max(range(14,21), key=lambda h: pre[h])
valle   = min(range(10,15), key=lambda h: pre[h])
print("LINEA BASE PREPANDEMIA (ene-feb 2020, dia laborable)")
print(f"  pico AM {pico_am}h = {pre[pico_am]:.2f}%   pico PM {pico_pm}h = {pre[pico_pm]:.2f}%   valle {valle}h = {pre[valle]:.2f}%")
print(f"  razon AM/PM = {pre[pico_am]/pre[pico_pm]:.3f}")
print(f"  razon pico/valle = {pre[pico_am]/pre[valle]:.2f}")

fin_sem = sum(v for (c,d,h),v in PRE.items() if d in (0,6))
print(f"  fin de semana = {100*fin_sem/sum(PRE.values()):.1f}% del ridership semanal")

with open("prepandemia_station_hourofweek.csv","w",newline="",encoding="utf-8") as fh:
    w = csv.writer(fh); w.writerow(["station_complex_id","dow","hora","ridership"])
    for (cid,dow,h),v in sorted(PRE.items()): w.writerow([cid,dow,h,int(v)])

por_est = defaultdict(dict)
for (cid,dow,h),v in PRE.items(): por_est[cid][(dow,h)] = v
with open("prepandemia_profiles_normalized.csv","w",newline="",encoding="utf-8") as fh:
    w = csv.writer(fh); w.writerow(["station_complex_id","dow","hora","share","total_prepandemia"])
    for cid, celdas in sorted(por_est.items()):
        t = sum(celdas.values())
        if t <= 0: continue
        for dow in range(7):
            for h in range(24):
                w.writerow([cid,dow,h,f"{celdas.get((dow,h),0.0)/t:.8f}",int(t)])

for f in ["prepandemia_station_hourofweek.csv","prepandemia_profiles_normalized.csv"]:
    print(f"\n{f}  {os.path.getsize(f)/1e6:.2f} MB")

COORD = query_range(
    "station_complex_id, station_complex, borough, transit_mode, "
    "avg(latitude) AS lat, avg(longitude) AS lon, sum(ridership) AS ridership_semana",
    "station_complex_id, station_complex, borough, transit_mode",
    date(2024, 5, 13), date(2024, 5, 20))

if COORD is None:
    print("La consulta de coordenadas fallo.")
else:
    print(f"{len(COORD)} complejos")
    malas = [r for r in COORD
             if not (40.4 <= num(r.get("lat")) <= 41.0 and -74.3 <= num(r.get("lon")) <= -73.6)]
    print(f"coordenadas fuera del rango de NY: {len(malas)}")

    with open("stations_coords.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["station_complex_id","station_complex","borough","transit_mode",
                    "latitude","longitude"])
        for r in sorted(COORD, key=lambda x: x["station_complex_id"]):
            w.writerow([r["station_complex_id"], r.get("station_complex",""),
                        r.get("borough",""), r.get("transit_mode",""),
                        f'{num(r.get("lat")):.6f}', f'{num(r.get("lon")):.6f}'])

    print(f"stations_coords.csv  {os.path.getsize('stations_coords.csv')/1e3:.0f} KB")
    por_b = defaultdict(int)
    for r in COORD: por_b[r.get("borough","")] += 1
    print("\ncomplejos por borough:")
    for b, n in sorted(por_b.items(), key=lambda kv: -kv[1]):
        print(f"   {b:<16}{n:>4}")