#!/usr/bin/env python3
"""
Construye data/app.json, el unico archivo de datos que consume el prototipo.

Entradas (salidas de los scripts de la semana 6, en deliveries/week06/data/processed/):
    stations_coords.csv                       id, nombre, borough, modo, lat, lon
    ridership_by_station_day.csv              id, dia, ridership, transfers
    prepandemia_station_hourofweek.csv        id, dow, hora, ridership   (ene-feb 2020)
    ridership_by_station_hourofweek_year.csv  id, year, dow, hora, ridership

Salida:
    data/app.json   (~1.6 MB)

Uso:
    python3 build_app_json.py <carpeta_entradas> <ruta_salida>
"""

import csv, json, sys, math
from collections import defaultdict

ENT = sys.argv[1] if len(sys.argv) > 1 else "."
SAL = sys.argv[2] if len(sys.argv) > 2 else "app.json"

PRE_DIAS = 60      # 1 ene - 29 feb 2020 (2020 es bisiesto)
DIAS_2024 = 366    # 2024 es bisiesto


def leer(nombre):
    with open(f"{ENT}/{nombre}", newline="", encoding="utf-8") as f:
        yield from csv.DictReader(f)


# ---------------------------------------------------------------- estaciones
est = {}
for r in leer("stations_coords.csv"):
    try:
        lat, lon = float(r["latitude"]), float(r["longitude"])
    except ValueError:
        continue
    if not (39 < lat < 42 and -75 < lon < -72):      # descarta coordenadas invalidas
        continue
    est[r["station_complex_id"]] = {
        "id":  r["station_complex_id"],
        "n":   r["station_complex"],
        "b":   r["borough"],
        "lat": round(lat, 5),
        "lon": round(lon, 5),
    }

# ------------------------------------------------- totales diarios y mensuales
pre_tot   = defaultdict(int)   # ene-feb 2020 por estacion
tot_2024  = defaultdict(int)   # anio 2024 por estacion
mes_est   = defaultdict(int)   # (estacion, mes) -> entradas
mes_sis   = defaultdict(int)   # mes -> entradas del sistema

for r in leer("ridership_by_station_day.csv"):
    sid, dia = r["station_complex_id"], r["dia"]
    try:
        v = int(float(r["ridership"]))
    except (ValueError, TypeError):
        continue
    mes = dia[:7]
    mes_sis[mes] += v
    if sid not in est:
        continue
    mes_est[(sid, mes)] += v
    if mes in ("2020-01", "2020-02"):
        pre_tot[sid] += v
    elif dia[:4] == "2024":
        tot_2024[sid] += v

meses = sorted(mes_sis)
serie = [{"m": m, "v": mes_sis[m]} for m in meses]
base  = mes_sis["2020-01"]

# ------------------------------------------------------------------- perfiles
# 168 valores por estacion: dow*24 + hora, normalizados por el total de la estacion.
def perfil_vacio():
    return [0] * 168

pre_perf = defaultdict(perfil_vacio)
for r in leer("prepandemia_station_hourofweek.csv"):
    sid = r["station_complex_id"]
    if sid in est:
        pre_perf[sid][int(r["dow"]) * 24 + int(r["hora"])] += int(float(r["ridership"]))

cur_perf = defaultdict(perfil_vacio)
for r in leer("ridership_by_station_hourofweek_year.csv"):
    if r["year"] != "2024":
        continue
    sid = r["station_complex_id"]
    if sid in est:
        cur_perf[sid][int(r["dow"]) * 24 + int(r["hora"])] += int(float(r["ridership"]))


def normalizar(v):
    s = sum(v)
    return [round(x / s, 6) for x in v] if s else None


def pico_valle(perfil):
    """Razon pico/valle del dia laborable promedio.

    Pico: maximo entre las 5 y las 11 h.  Valle: minimo entre las 10 y las 14 h.
    Devuelve None si el pico cae en el borde de la ventana, porque ahi el
    maximo real puede estar fuera y la razon no seria confiable.
    """
    lab = [sum(perfil[d * 24 + h] for d in range(1, 6)) for h in range(24)]  # lun-vie
    vent = lab[5:12]
    pico = max(vent)
    if pico == 0:
        return None
    if vent.index(pico) in (0, len(vent) - 1):
        return None
    valle = min(lab[10:15])
    if valle <= 0:
        return None
    # 4 decimales: con 3 una estacion (Bay Pkwy, 4.1453 -> 4.1445) queda empatada
    # y el conteo de aplanamientos baja de 372 a 371.
    return round(pico / valle, 4)


# --------------------------------------------------------------- ensamblado
estaciones = []
for sid, e in est.items():
    pre, cur = pre_perf.get(sid), cur_perf.get(sid)
    if not pre or not cur or not pre_tot.get(sid) or not tot_2024.get(sid):
        continue
    npre, ncur = normalizar(pre), normalizar(cur)
    if npre is None or ncur is None:
        continue

    e = dict(e)
    e["rec"] = round((tot_2024[sid] / DIAS_2024) / (pre_tot[sid] / PRE_DIAS), 4)
    e["d24"] = round(tot_2024[sid] / DIAS_2024)
    e["pvA"] = pico_valle(pre)
    e["pvB"] = pico_valle(cur)
    e["pre"] = npre
    e["cur"] = ncur
    # serie mensual de la estacion, en centenas de entradas (ahorra ~40 % de bytes)
    e["ms"]  = [round(mes_est.get((sid, m), 0) / 100) for m in meses]
    estaciones.append(e)

estaciones.sort(key=lambda x: -x["d24"])
recs = sorted(e["rec"] for e in estaciones)


def pct(p):
    return round(recs[min(len(recs) - 1, int(p * len(recs)))], 4)


app = {
    "meta": {
        "n":      len(estaciones),
        "recMin": recs[0],
        "recP10": pct(.10),
        "recMed": pct(.50),
        "recP90": pct(.90),
        "recMax": recs[-1],
        "mesIni": meses[0],
        "mesFin": meses[-1],
        "base":   base,
        "meses":  meses,
        "msEsc":  100,          # factor de escala de e.ms
    },
    "serie": serie,
    "estaciones": estaciones,
}

with open(SAL, "w", encoding="utf-8") as f:
    json.dump(app, f, separators=(",", ":"), ensure_ascii=False)

con_pv = sum(1 for e in estaciones if e["pvA"] and e["pvB"])
aplano = sum(1 for e in estaciones if e["pvA"] and e["pvB"] and e["pvB"] < e["pvA"])
print(f"{len(estaciones)} estaciones · {len(meses)} meses")
print(f"recuperacion  p10 {pct(.10):.3f}  mediana {pct(.50):.3f}  p90 {pct(.90):.3f}")
print(f"pico/valle valido en {con_pv} estaciones; aplanaron {aplano}")
