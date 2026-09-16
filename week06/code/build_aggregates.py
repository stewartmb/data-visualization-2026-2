DATASET_ID = "wujg-7c2s"
RESOURCE_URL = f"https://data.ny.gov/resource/{DATASET_ID}.json"

SOCRATA_APP_TOKEN = ""
TIMEOUT = 150
PAGE = 50000
WINDOW_DAYS = 7

import json, os, time, urllib.parse, urllib.request
from collections import defaultdict
from datetime import date, timedelta

YEARS = [2020, 2021, 2022, 2023, 2024]

def year_windows(years=YEARS, days=WINDOW_DAYS):
    out = []
    for y in years:
        cur, fin = date(y, 1, 1), date(y + 1, 1, 1)
        while cur < fin:
            nxt = min(cur + timedelta(days=days), fin)
            out.append((y, cur, nxt))
            cur = nxt
    return out

def month_range():
    return [(y, m) for y in YEARS for m in range(1, 13)]

WINDOWS = year_windows()
MONTHS = month_range()
print(f"{len(WINDOWS)} ventanas de {WINDOW_DAYS} dias  |  {len(MONTHS)} meses")
print("Token:", "si" if SOCRATA_APP_TOKEN else "NO - consiguelo antes de seguir")

def request_headers():
    h = {"User-Agent": "data-visualization-2026-2/1.0"}
    if SOCRATA_APP_TOKEN:
        h["X-App-Token"] = SOCRATA_APP_TOKEN
    return h

def fetch(params, timeout=TIMEOUT, retries=3, quiet=False):
    url = RESOURCE_URL + "?" + urllib.parse.urlencode(params)
    delay = 4.0
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers=request_headers())
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            if attempt == retries:
                if not quiet:
                    print(f"      fallo: {exc}")
                return None
            time.sleep(delay)
            delay *= 2

def query_range(select, group, ini, fin, order=None):
    out, offset = [], 0
    while True:
        params = {
            "$select": select,
            "$group": group,
            "$where": (f"transit_timestamp >= '{ini.isoformat()}T00:00:00' "
                       f"AND transit_timestamp < '{fin.isoformat()}T00:00:00'"),
            "$limit": PAGE,
            "$offset": offset,
        }
        if order:
            params["$order"] = order
        page = fetch(params, quiet=(offset > 0))
        if page is None:
            return None
        out.extend(page)
        if len(page) < PAGE:
            return out
        offset += PAGE

def query_window(select, group, ini, fin, order=None):
    r = query_range(select, group, ini, fin, order)
    if r is not None:
        return r
    print("      ventana lenta, reintentando dia por dia ...", end=" ", flush=True)
    out, cur = [], ini
    while cur < fin:
        d = query_range(select, group, cur, cur + timedelta(days=1), order)
        if d is None:
            return None
        out.extend(d)
        cur += timedelta(days=1)
    print("ok")
    return out

def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0

print("Funciones cargadas.")

SEL_A = ("station_complex_id, date_trunc_ymd(transit_timestamp) AS dia, "
         "sum(ridership) AS ridership, sum(transfers) AS transfers")
GRP_A = "station_complex_id, date_trunc_ymd(transit_timestamp)"

SEL_B = ("station_complex_id, date_extract_dow(transit_timestamp) AS dow, "
         "date_extract_hh(transit_timestamp) AS hora, sum(ridership) AS ridership")
GRP_B = ("station_complex_id, date_extract_dow(transit_timestamp), "
         "date_extract_hh(transit_timestamp)")
ORD_B = "station_complex_id"

SEL_C = "borough, payment_method, fare_class_category, sum(ridership) AS ridership"
GRP_C = "borough, payment_method, fare_class_category"

ini, fin = date(2024, 5, 13), date(2024, 5, 13) + timedelta(days=WINDOW_DAYS)
est = {}

for nombre, sel, grp, i, f, orden, n in [
        ("A  estacion x dia        ", SEL_A, GRP_A, ini, fin, None, len(WINDOWS)),
        ("B  estacion x dow x hora ", SEL_B, GRP_B, ini, fin, ORD_B, len(WINDOWS)),
        ("C  borough x pago x tarifa", SEL_C, GRP_C, date(2024, 5, 1), date(2024, 6, 1), None, len(MONTHS))]:
    t0 = time.time()
    r = query_range(sel, grp, i, f, orden)
    dt = time.time() - t0
    if r is None:
        print(f"{nombre}  FALLO tras {dt:.0f}s")
    else:
        est[nombre] = dt * n / 60
        print(f"{nombre}  {dt:>6.1f}s   {len(r):>6} filas   ->  {dt*n/60:>5.1f} min para las {n}")

if est:
    print(f"\nTotal estimado: {sum(est.values()):.0f} minutos")

A = {}
A_done = set()

t0 = time.time()
for k, (y, ini, fin) in enumerate(WINDOWS, 1):
    if ini in A_done:
        continue
    data = query_window(SEL_A, GRP_A, ini, fin)
    if data is None:
        print(f"  {ini} FALLO definitivo")
        continue
    for r in data:
        cid = r.get("station_complex_id")
        dia = (r.get("dia") or "")[:10]
        if not cid or not dia:
            continue
        acc = A.setdefault((cid, dia), [0.0, 0.0])
        acc[0] += num(r.get("ridership"))
        acc[1] += num(r.get("transfers"))
    A_done.add(ini)
    if k % 10 == 0 or k == len(WINDOWS):
        print(f"  {k}/{len(WINDOWS)}  {ini}  acumulado {len(A):,} filas  "
              f"({time.time()-t0:.0f}s)")

print(f"\nPasada A: {len(A_done)}/{len(WINDOWS)} ventanas, {len(A):,} filas")

B = {}
B_done = set()

t0 = time.time()
for k, (y, ini, fin) in enumerate(WINDOWS, 1):
    if ini in B_done:
        continue
    data = query_window(SEL_B, GRP_B, ini, fin, ORD_B)
    if data is None:
        print(f"  {ini} FALLO definitivo")
        continue
    for r in data:
        cid = r.get("station_complex_id")
        if not cid:
            continue
        key = (cid, y, int(num(r.get("dow"))), int(num(r.get("hora"))))
        B[key] = B.get(key, 0.0) + num(r.get("ridership"))
    B_done.add(ini)
    if k % 10 == 0 or k == len(WINDOWS):
        print(f"  {k}/{len(WINDOWS)}  {ini}  acumulado {len(B):,} filas  "
              f"({time.time()-t0:.0f}s)")

print(f"\nPasada B: {len(B_done)}/{len(WINDOWS)} ventanas, {len(B):,} filas")

C = {}
C_done = set()

t0 = time.time()
for k, (y, m) in enumerate(MONTHS, 1):
    if (y, m) in C_done:
        continue
    ini = date(y, m, 1)
    fin = date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)
    data = query_range(SEL_C, GRP_C, ini, fin)
    if data is None:
        print(f"  {y}-{m:02d} FALLO")
        continue
    mes = f"{y}-{m:02d}"
    for r in data:
        key = (mes, r.get("borough", ""), r.get("payment_method", ""),
               r.get("fare_class_category", ""))
        C[key] = C.get(key, 0.0) + num(r.get("ridership"))
    C_done.add((y, m))
    if k % 12 == 0 or k == len(MONTHS):
        print(f"  {k}/{len(MONTHS)}  {mes}  acumulado {len(C):,} filas  "
              f"({time.time()-t0:.0f}s)")

print(f"\nPasada C: {len(C_done)}/{len(MONTHS)} meses, {len(C):,} filas")

import matplotlib.pyplot as plt

por_dow = defaultdict(float)
for (cid, y, dow, hora), v in B.items():
    por_dow[dow] += v

print("Ridership total por valor de dow:")
for d in sorted(por_dow):
    print(f"   dow={d}  {por_dow[d]:>16,.0f}")
finde = sorted(por_dow, key=lambda d: por_dow[d])[:2]
lab = [d for d in por_dow if d not in finde]
print(f"\nDias mas bajos: dow={finde[0]} y dow={finde[1]} -> sabado y domingo")

perfil_lab, perfil_fin = defaultdict(float), defaultdict(float)
for (cid, y, dow, hora), v in B.items():
    (perfil_fin if dow in finde else perfil_lab)[hora] += v

fig, ax = plt.subplots(figsize=(9, 3.6))
hrs = list(range(24))
ax.plot(hrs, [perfil_lab[h]/max(len(lab), 1) for h in hrs], marker="o", ms=3,
        color="#1B4F8C", lw=2, label="dia laborable (promedio)")
ax.plot(hrs, [perfil_fin[h]/max(len(finde), 1) for h in hrs], marker="o", ms=3,
        color="#E07A16", lw=2, label="fin de semana (promedio)")
ax.set_xticks(range(0, 24, 2))
ax.set_xlabel("hora del dia")
ax.set_ylabel("ridership")
ax.set_title("Forma del dia - sistema completo, 2020-2024")
ax.legend(fontsize=9)
ax.spines[["top", "right"]].set_visible(False)
plt.tight_layout()
plt.savefig("forma_del_dia.png", dpi=150)
plt.show()

import csv

with open("ridership_by_station_day.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["station_complex_id", "dia", "ridership", "transfers"])
    for (cid, dia), (r, t) in sorted(A.items()):
        w.writerow([cid, dia, int(r), int(t)])

with open("ridership_by_station_hourofweek_year.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["station_complex_id", "year", "dow", "hora", "ridership"])
    for (cid, y, dow, hora), v in sorted(B.items()):
        w.writerow([cid, y, dow, hora, int(v)])

with open("ridership_by_month_borough_payment_fare.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["mes", "borough", "payment_method", "fare_class_category", "ridership"])
    for (mes, b, p, f), v in sorted(C.items()):
        w.writerow([mes, b, p, f, int(v)])

for f in ["ridership_by_station_day.csv",
          "ridership_by_station_hourofweek_year.csv",
          "ridership_by_month_borough_payment_fare.csv"]:
    print(f"{f:<48} {os.path.getsize(f)/1e6:>7.1f} MB")

perfiles = {}
for (cid, y, dow, hora), v in B.items():
    perfiles.setdefault((cid, y), {})[(dow, hora)] = v

incompletos = 0
with open("station_profiles_normalized.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["station_complex_id", "year", "dow", "hora", "share", "total_anual"])
    for (cid, y), celdas in sorted(perfiles.items()):
        total = sum(celdas.values())
        if total <= 0:
            continue
        if len(celdas) < 168:
            incompletos += 1
        for dow in range(7):
            for hora in range(24):
                w.writerow([cid, y, dow, hora,
                            f"{celdas.get((dow, hora), 0.0)/total:.8f}", int(total)])

print(f"station_profiles_normalized.csv  {os.path.getsize('station_profiles_normalized.csv')/1e6:.1f} MB")
print(f"perfiles (estacion, ano): {len(perfiles):,}   esperado: 428 x 5 = 2140")
print(f"perfiles con menos de 168 celdas con datos: {incompletos}")