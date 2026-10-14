DATASET_ID = "wujg-7c2s"
RESOURCE_URL = f"https://data.ny.gov/resource/{DATASET_ID}.json"
YEARS = [2020, 2021, 2022, 2023, 2024]

WINDOWS = [(2, 15), (5, 15), (8, 15), (11, 15)]
WINDOW_DAYS = 7

SOCRATA_APP_TOKEN = ""
TIMEOUT = 120

import json, time, urllib.error, urllib.parse, urllib.request
from collections import defaultdict
from datetime import date, timedelta

print("Dataset:", DATASET_ID)
print("Token:", "si" if SOCRATA_APP_TOKEN else "no (limites publicos)")

def request_headers():
    h = {"User-Agent": "data-visualization-2026-2/1.0"}
    if SOCRATA_APP_TOKEN:
        h["X-App-Token"] = SOCRATA_APP_TOKEN
    return h

def fetch(params, timeout=TIMEOUT, retries=3):
    url = RESOURCE_URL + "?" + urllib.parse.urlencode(params)
    delay = 3.0
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers=request_headers())
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            if attempt == retries:
                print(f"      fallo: {exc}")
                return None
            time.sleep(delay)
            delay *= 2

def complexes_in_window(start, days=WINDOW_DAYS):
    end = start + timedelta(days=days)
    params = {
        "$select": "station_complex_id, station_complex, borough, count(1) as n",
        "$where": (f"transit_timestamp >= '{start.isoformat()}T00:00:00' "
                   f"AND transit_timestamp < '{end.isoformat()}T00:00:00'"),
        "$group": "station_complex_id, station_complex, borough",
        "$limit": 50000,
    }
    return fetch(params)

print("Funciones cargadas.")

t0 = time.time()
prueba = complexes_in_window(date(2024, 5, 15), days=1)
if prueba is None:
    print("La API no respondio. Revisa la conexion o consigue un app token.")
else:
    print(f"OK: la API respondio en {time.time()-t0:.1f}s")
    print(f"   {len(prueba)} complejos en un solo dia (2024-05-15)")
    print("   ejemplo:", prueba[0])

rows = []
ids_by_year = {y: set() for y in YEARS}
names_by_id = defaultdict(set)
fallidas = []

for year in YEARS:
    print(f"{year}")
    for (m, d) in WINDOWS:
        start = date(year, m, d)
        print(f"   {start} +{WINDOW_DAYS}d ...", end=" ", flush=True)
        data = complexes_in_window(start)
        if data is None:
            fallidas.append(str(start))
            continue
        for r in data:
            cid = (r.get("station_complex_id") or "").strip()
            if not cid:
                continue
            name = (r.get("station_complex") or "").strip()
            ids_by_year[year].add(cid)
            names_by_id[cid].add(name)
            rows.append({
                "year": year,
                "ventana_inicio": start.isoformat(),
                "station_complex_id": cid,
                "station_complex": name,
                "borough": r.get("borough", ""),
                "n_registros_ventana": r.get("n", ""),
            })
        print(f"{len(data)} complejos")
    print(f"   -> {len(ids_by_year[year])} complejos distintos en {year}")
    print()

if fallidas:
    print("VENTANAS QUE FALLARON:", ", ".join(fallidas))
    print("Vuelve a correr esta celda; los resultados se acumulan.")
else:
    print(f"Todas las ventanas respondieron. {len(rows)} filas recolectadas.")

all_ids = set().union(*ids_by_year.values())
stable = set.intersection(*ids_by_year.values())
unstable = sorted(all_ids - stable)
renamed = sorted(cid for cid, n in names_by_id.items() if len(n) > 1)
cobertura = 100.0 * len(stable) / len(all_ids) if all_ids else 0.0

if cobertura >= 98:
    veredicto = ("Los identificadores son estables. El analisis puede usar el "
                 "conjunto completo de complejos.")
elif cobertura >= 90:
    veredicto = ("Los identificadores son mayormente estables. Se recomienda "
                 "restringir el analisis comparativo a los complejos presentes en "
                 "los cinco anos y documentar las exclusiones.")
else:
    veredicto = ("Los identificadores NO son suficientemente estables. Hay que "
                 "replantear la unidad de analisis o acotar el periodo.")

print(f"Complejos distintos en total : {len(all_ids)}")
print(f"Presentes en los 5 anos      : {len(stable)}  ({cobertura:.1f} %)")
print(f"Presentes solo en algunos    : {len(unstable)}")
print(f"Ids que cambiaron de nombre  : {len(renamed)}")
print()
print(veredicto)

if unstable:
    print("COMPLEJOS QUE NO APARECEN EN TODOS LOS ANOS")
    for cid in unstable[:30]:
        years = ",".join(str(y) for y in YEARS if cid in ids_by_year[y])
        nombre = sorted(names_by_id[cid])[0] if names_by_id[cid] else ""
        print(f"  {cid:>6}  {nombre[:45]:<45} {years}")
    if len(unstable) > 30:
        print(f"  ... y {len(unstable)-30} mas")
else:
    print("Todos los complejos aparecen en los cinco anos.")

print()
if renamed:
    print("IDS QUE CAMBIARON DE NOMBRE")
    for cid in renamed[:25]:
        print(f"  {cid:>6}  {' / '.join(sorted(names_by_id[cid]))}")
    if len(renamed) > 25:
        print(f"  ... y {len(renamed)-25} mas")
else:
    print("Ningun id cambio de nombre.")

import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(7, 3.5))
counts = [len(ids_by_year[y]) for y in YEARS]
ax.plot(YEARS, counts, marker="o", color="#1B4F8C", linewidth=2)
ax.axhline(len(stable), color="#E07A16", linestyle="--", linewidth=1.5,
           label=f"presentes en los 5 anos ({len(stable)})")
ax.set_xticks(YEARS)
ax.set_ylabel("complejos distintos")
ax.set_title("Complejos de estacion por ano")
ax.legend(fontsize=9)
ax.spines[["top", "right"]].set_visible(False)
plt.tight_layout()
plt.savefig("station_ids_by_year.png", dpi=150)
plt.show()

import csv

with open("station_ids_by_year.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.DictWriter(fh, fieldnames=["year", "ventana_inicio", "station_complex_id",
                                       "station_complex", "borough", "n_registros_ventana"])
    w.writeheader()
    w.writerows(sorted(rows, key=lambda r: (r["station_complex_id"], r["year"], r["ventana_inicio"])))

vent = ", ".join(f"{m:02d}-{d:02d}" for m, d in WINDOWS)
L = ["# Estabilidad de `station_complex_id` (2020-2024)", "",
     f"Dataset `{DATASET_ID}`, consultado via la API de Socrata.", "",
     "## Metodo", "",
     "Agrupar sobre un ano completo excede el tiempo de respuesta de la API. En su lugar se",
     f"consultaron {len(WINDOWS)} ventanas de {WINDOW_DAYS} dias por ano ({vent}), y se considera que un",
     "complejo esta presente en un ano si aparece en al menos una de sus ventanas.", "",
     "## Complejos distintos por ano", "", "| Ano | Complejos |", "|---|---|"]
for y in YEARS:
    L.append(f"| {y} | {len(ids_by_year[y])} |")
L += ["", "## Resultado", "",
      f"- Complejos distintos en todo el periodo: **{len(all_ids)}**",
      f"- Presentes en los cinco anos: **{len(stable)}** ({cobertura:.1f} %)",
      f"- Presentes solo en algunos anos: **{len(unstable)}**",
      f"- Ids que cambiaron de nombre: **{len(renamed)}**", "",
      f"**Veredicto.** {veredicto}", ""]

if unstable:
    L += ["## Complejos no presentes en todos los anos", "",
          "| id | nombre | anos en que aparece |", "|---|---|---|"]
    for cid in unstable[:60]:
        years = ",".join(str(y) for y in YEARS if cid in ids_by_year[y])
        nombre = sorted(names_by_id[cid])[0] if names_by_id[cid] else ""
        L.append(f"| `{cid}` | {nombre} | {years} |")
    if len(unstable) > 60:
        L.append(f"| ... | _{len(unstable)-60} mas, ver el CSV_ | |")
    L.append("")

if renamed:
    L += ["## Ids que cambiaron de nombre", "", "| id | nombres observados |", "|---|---|"]
    for cid in renamed[:40]:
        L.append(f"| `{cid}` | {' / '.join(sorted(names_by_id[cid]))} |")
    if len(renamed) > 40:
        L.append(f"| ... | _{len(renamed)-40} mas_ |")
    L.append("")

with open("stable_station_ids.txt", "w", encoding="utf-8") as fh:
    fh.write("\n".join(sorted(stable)))

open("station_id_stability.md", "w", encoding="utf-8").write("\n".join(L))
print("Generados:")
print("  station_ids_by_year.csv")
print("  station_id_stability.md")
print("  stable_station_ids.txt")
print("  station_ids_by_year.png")