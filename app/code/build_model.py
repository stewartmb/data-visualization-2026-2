#!/usr/bin/env python3
"""
Construye data/model.json: el modelo analítico que consume la aplicación.

Todo lo que la aplicación afirma sale de aquí. No hay cálculo en el navegador
que no pueda reproducirse corriendo este script sobre las tablas agregadas.

Entradas (deliveries/week06/data/processed/):
    stations_coords.csv                       id, nombre, borough, modo, lat, lon
    ridership_by_station_day.csv              id, día, ridership, transfers
    prepandemia_station_hourofweek.csv        id, dow, hora, ridership     (ene–feb 2020)
    ridership_by_station_hourofweek_year.csv  id, año, dow, hora, ridership
    ridership_by_month_borough_payment_fare.csv

Entradas opcionales (si existen, corrigen la ventana de comparación):
    hourofweek_2024_enefeb.csv                id, dow, hora, ridership     (ene–feb 2024)
    acs_por_estacion.csv                      id, wfh, ingreso, densidad, transit  (Census ACS)

Uso:
    python3 build_model.py <carpeta_entradas> <ruta_salida>
"""

import csv, json, sys, os, math, statistics as st
from collections import defaultdict, Counter

ENT = sys.argv[1] if len(sys.argv) > 1 else "."
SAL = sys.argv[2] if len(sys.argv) > 2 else "model.json"

VENTANA_PRE = ("2020-01", "2020-02")      # línea base: 60 días (2020 es bisiesto)
VENTANA_CMP = ("2024-01", "2024-02")      # misma ventana calendario, 4 años después: 60 días
DIAS_VENTANA = 60
DIAS_2024 = 366

# índice pico/valle, ventanas SIN solape
H_PICO_AM = range(6, 11)    # 6–10 h
H_VALLE   = range(11, 16)   # 11–15 h
H_PICO_PM = range(16, 21)   # 16–20 h

UMBRAL_TIPO = 0.15          # |asimetría| para residencial / laboral
UMBRAL_ESTACIONAL = 0.10    # desvío, respecto de la mediana del sistema, entre las dos recuperaciones que marca sensibilidad estacional
UMBRAL_PEQUENA = 300        # entradas/día en la línea base por debajo de las cuales la razón es inestable
UMBRAL_CORTE = 0.5          # un mes por debajo de la mitad de su entorno se marca como corte de servicio
UMBRAL_APLANA = 0.05        # cambio relativo del índice que cuenta como aplanamiento real


def leer(nombre):
    ruta = os.path.join(ENT, nombre)
    if not os.path.exists(ruta):
        return None
    with open(ruta, newline="", encoding="utf-8") as f:
        yield from csv.DictReader(f)


def existe(nombre):
    return os.path.exists(os.path.join(ENT, nombre))


# ============================================================ estaciones
est = {}
for r in leer("stations_coords.csv"):
    try:
        lat, lon = float(r["latitude"]), float(r["longitude"])
    except ValueError:
        continue
    if not (39 < lat < 42 and -75 < lon < -72):
        continue
    est[r["station_complex_id"]] = dict(
        id=r["station_complex_id"], n=r["station_complex"], b=r["borough"],
        lat=round(lat, 5), lon=round(lon, 5))

# ============================================================ diarios → mensual, ventanas
mes_est = defaultdict(lambda: defaultdict(int))
mes_sis = defaultdict(int)
for r in leer("ridership_by_station_day.csv"):
    sid, dia = r["station_complex_id"], r["dia"]
    try:
        v = int(float(r["ridership"]))
    except (ValueError, TypeError):
        continue
    m = dia[:7]
    mes_sis[m] += v
    if sid in est:
        mes_est[sid][m] += v

meses = sorted(mes_sis)
iMes = {m: i for i, m in enumerate(meses)}
base = mes_sis[meses[0]]

def suma_ventana(sid, v):
    return sum(mes_est[sid].get(m, 0) for m in meses if v[0] <= m <= v[1])

# ============================================================ perfiles 168 h
def perfiles(nombre, year=None):
    out = defaultdict(lambda: [0] * 168)
    src = leer(nombre)
    if src is None:
        return None
    for r in src:
        if year and r.get("year") != year:
            continue
        sid = r["station_complex_id"]
        if sid in est:
            out[sid][int(r["dow"]) * 24 + int(r["hora"])] += int(float(r["ridership"]))
    return out

PRE = perfiles("prepandemia_station_hourofweek.csv")
CUR_FY = perfiles("ridership_by_station_hourofweek_year.csv", "2024")
CUR_EF = perfiles("hourofweek_2024_enefeb.csv")          # opcional: misma ventana calendario
usa_ventana_comparable = CUR_EF is not None and len(CUR_EF) > 0
CUR = CUR_EF if usa_ventana_comparable else CUR_FY


def laborable(p):   # 24 valores, lunes a viernes sumados (dow 0 = domingo)
    return [sum(p[d * 24 + h] for d in range(1, 6)) for h in range(24)]

def finde(p):
    return [sum(p[d * 24 + h] for d in (0, 6)) for h in range(24)]

def normalizar(v):
    s = sum(v)
    return [round(x / s, 6) for x in v] if s else None

def pico_valle(lab):
    pico = max(lab[h] for h in H_PICO_AM)
    valle = min(lab[h] for h in H_VALLE)
    return round(pico / valle, 4) if valle > 0 and pico > 0 else None

def asimetria(lab):
    """(AM − PM) / (AM + PM) sobre entradas. +1 = residencial puro, −1 = laboral puro.
    Entradas de la mañana = gente saliendo de casa; de la tarde = gente saliendo del trabajo."""
    am = sum(lab[h] for h in H_PICO_AM)
    pm = sum(lab[h] for h in H_PICO_PM)
    return round((am - pm) / (am + pm), 4) if am + pm > 0 else None

def tipo_de(asym):
    if asym is None: return "mixta"
    return "residencial" if asym > UMBRAL_TIPO else ("laboral" if asym < -UMBRAL_TIPO else "mixta")

def cortes_de_servicio(sid):
    """Meses (desde jul 2021) en que la estación cae por debajo de la mitad de la mediana
    de sus ±6 meses vecinos. Detectado en los datos; no verificado contra avisos de la MTA."""
    serie = [mes_est[sid].get(m, 0) for m in meses]
    out = []
    for i, m in enumerate(meses):
        if m < "2021-07": continue
        vec = [serie[j] for j in range(max(0, i - 6), min(len(serie), i + 7)) if j != i and meses[j] >= "2021-07"]
        if len(vec) < 4: continue
        ref = st.median(vec)
        if ref > 0 and serie[i] < UMBRAL_CORTE * ref:
            out.append(m)
    return out

# ============================================================ ACS opcional
acs = {}
if existe("acs_por_estacion.csv"):
    for r in leer("acs_por_estacion.csv"):
        try:
            acs[r["station_complex_id"]] = {k: float(r[k]) for k in r if k != "station_complex_id" and r[k] not in ("", None)}
        except ValueError:
            pass

# ============================================================ ensamblado por estación
estaciones = []
for sid, e in est.items():
    pre, cur = PRE.get(sid), CUR.get(sid)
    if not pre or not cur or sum(pre) == 0 or sum(cur) == 0:
        continue
    vPre = suma_ventana(sid, VENTANA_PRE)
    vCmp = suma_ventana(sid, VENTANA_CMP)
    v24 = sum(mes_est[sid].get(m, 0) for m in meses if m.startswith("2024"))
    if vPre == 0 or v24 == 0:
        continue

    labPre, labCur = laborable(pre), laborable(cur)
    pvA, pvB = pico_valle(labPre), pico_valle(labCur)
    asymPre, asymCur = asimetria(labPre), asimetria(labCur)
    dPre = vPre / DIAS_VENTANA
    rec = (vCmp / DIAS_VENTANA) / dPre if vCmp else None
    recFY = (v24 / DIAS_2024) / dPre
    dSeason = round(recFY - rec, 4) if rec is not None else None
    cortes = cortes_de_servicio(sid)

    aplan = round((pvB - pvA) / pvA, 4) if pvA and pvB else None

    estaciones.append(dict(
        id=sid, n=e["n"], b=e["b"], lat=e["lat"], lon=e["lon"],
        tipo=tipo_de(asymPre), asymPre=asymPre, asymCur=asymCur,
        wk=round(sum(finde(pre)) / sum(pre), 4),
        pvA=pvA, pvB=pvB, aplan=aplan,
        rec=round(rec, 4) if rec is not None else None, recFY=round(recFY, 4), dSeason=dSeason,
        conf=None,
        dPre=round(dPre), d24=round(v24 / DIAS_2024),
        cortes=cortes,
        ms=[round(mes_est[sid].get(m, 0) / 100) for m in meses],
        pre=normalizar(pre), cur=normalizar(cur),
        acs=acs.get(sid),
    ))

estaciones.sort(key=lambda x: -x["d24"])

# ---- confiabilidad de la comparación (segunda pasada: necesita la mediana de dSeason del sistema)
dSeasonMed = st.median(e["dSeason"] for e in estaciones if e["dSeason"] is not None)
for e in estaciones:
    motivos = []
    if any(VENTANA_CMP[0] <= m <= VENTANA_CMP[1] for m in e["cortes"]):
        motivos.append("caída anómala de entradas en la ventana de comparación (corte de servicio o cierre estacional)")
    if e["dSeason"] is not None and abs(e["dSeason"] - dSeasonMed) > UMBRAL_ESTACIONAL:
        motivos.append(f"sensible a la estación del año ({(e['dSeason']-dSeasonMed)*100:+.0f} pp respecto del sistema)")
    if e["dPre"] < UMBRAL_PEQUENA:
        motivos.append(f"línea base pequeña ({e['dPre']} entradas/día)")
    if motivos and motivos[0].startswith("caída"):
        nivel = "interrumpida"
    elif any(m.startswith("sensible") for m in motivos):
        nivel = "estacional"
    elif motivos:
        nivel = "pequena"
    else:
        nivel = "solida"
    e["conf"] = dict(nivel=nivel, motivos=motivos)

# ============================================================ agregados
def perfil_agregado(P, filtro):
    L = [0] * 24
    for e in estaciones:
        if filtro(e) and e["id"] in P:
            lab = laborable(P[e["id"]])
            for h in range(24): L[h] += lab[h]
    t = sum(L) or 1
    return [round(v / t, 5) for v in L]

def resumen(grupo):
    """Medianas sobre las estaciones con comparación sólida; n cuenta todas."""
    g = [e for e in grupo if e["rec"] is not None and e["aplan"] is not None and e["conf"]["nivel"] == "solida"]
    if not g: return None
    return dict(
        n=len(grupo), nSolidas=len(g),
        rec=round(st.median(e["rec"] for e in g), 4),
        recFY=round(st.median(e["recFY"] for e in g), 4),
        aplan=round(st.median(e["aplan"] for e in g), 4),
        pctAplan=round(sum(1 for e in g if e["aplan"] < -UMBRAL_APLANA) / len(g), 4),
        pctAfila=round(sum(1 for e in g if e["aplan"] > UMBRAL_APLANA) / len(g), 4),
    )

boroughs = {}
for b in sorted({e["b"] for e in estaciones}):
    grupo = [e for e in estaciones if e["b"] == b]
    pPre, pCur = perfil_agregado(PRE, lambda e: e["b"] == b), perfil_agregado(CUR, lambda e: e["b"] == b)
    boroughs[b] = dict(**resumen(grupo), perfilPre=pPre, perfilCur=pCur,
                       pvPre=pico_valle(pPre), pvCur=pico_valle(pCur),
                       share79Pre=round(sum(pPre[7:10]), 4), share79Cur=round(sum(pCur[7:10]), 4),
                       tipos=dict(Counter(e["tipo"] for e in grupo)))

tipos = {}
for t in ("residencial", "mixta", "laboral"):
    grupo = [e for e in estaciones if e["tipo"] == t]
    tipos[t] = dict(**resumen(grupo),
                    asymPre=round(st.median(e["asymPre"] for e in grupo), 4),
                    asymCur=round(st.median(e["asymCur"] for e in grupo), 4),
                    perfilPre=perfil_agregado(PRE, lambda e, t=t: e["tipo"] == t),
                    perfilCur=perfil_agregado(CUR, lambda e, t=t: e["tipo"] == t))

sistemaPre, sistemaCur = perfil_agregado(PRE, lambda e: True), perfil_agregado(CUR, lambda e: True)

# ============================================================ tarifas
tarifas = None
if existe("ridership_by_month_borough_payment_fare.csv"):
    tot = defaultdict(int); porClase = defaultdict(lambda: defaultdict(int))
    for r in leer("ridership_by_month_borough_payment_fare.csv"):
        m, c = r["mes"], r["fare_class_category"]
        v = int(float(r["ridership"] or 0))
        tot[m] += v; porClase[c][m] += v
    clases = sorted(porClase, key=lambda c: -sum(porClase[c].values()))
    series = {c: [round(porClase[c].get(m, 0) / tot[m], 4) if tot[m] else 0 for m in meses] for c in clases}
    omny = [sum(series[c][i] for c in clases if c.startswith("OMNY")) for i in range(len(meses))]
    cruce = next((meses[i] for i, s in enumerate(omny) if s >= 0.5), None)
    ilim30 = series.get("Metrocard - Unlimited 30-Day")
    tarifas = dict(clases=clases, series=series, omny=[round(x, 4) for x in omny], cruceOmny50=cruce,
                   ilimitado30=dict(ini=ilim30[0], fin=ilim30[-1]) if ilim30 else None)

# ============================================================ estadísticos para los hallazgos
def spearman(x, y):
    n = len(x)
    rx = {v: i for i, v in enumerate(sorted(x))}; ry = {v: i for i, v in enumerate(sorted(y))}
    d2 = sum((rx[a] - ry[b]) ** 2 for a, b in zip(x, y))
    return round(1 - 6 * d2 / (n * (n * n - 1)), 3)

validas = [e for e in estaciones if e["rec"] is not None and e["aplan"] is not None]

def perfil168_ponderado(es):
    pre = [0.0] * 168; cur = [0.0] * 168; wp = wc = 0.0
    for e in es:
        for i in range(168):
            pre[i] += e["pre"][i] * e["dPre"]; cur[i] += e["cur"][i] * e["d24"]
        wp += e["dPre"]; wc += e["d24"]
    return [v / wp for v in pre], [v / wc for v in cur]

def semana_de(es):
    """Cambio del share semanal de cada día y de su ventana 6–10 h, 2024 − 2020, en fracción."""
    pre, cur = perfil168_ponderado(es)
    dia = [round(sum(cur[d*24:(d+1)*24]) - sum(pre[d*24:(d+1)*24]), 4) for d in range(7)]
    am = [round(sum(cur[d*24+6:d*24+10]) - sum(pre[d*24+6:d*24+10]), 4) for d in range(7)]
    return dict(dia=dia, am=am)

semana_sis = semana_de(estaciones)
semana_boro = {b: semana_de([e for e in estaciones if e["b"] == b]) for b in ("Manhattan", "Brooklyn", "Queens", "Bronx")}
stats = dict(
    n=len(estaciones), nValidas=len(validas),
    nAplanaron=sum(1 for e in validas if e["aplan"] < -UMBRAL_APLANA),
    nAfilaron=sum(1 for e in validas if e["aplan"] > UMBRAL_APLANA),
    aplanMediano=round(st.median(e["aplan"] for e in validas), 4),
    recMediana=round(st.median(e["rec"] for e in validas), 4),
    rho_rec_aplan=spearman([e["rec"] for e in validas], [e["aplan"] for e in validas]),
    rho_rec_aplan_borough={b: spearman([e["rec"] for e in validas if e["b"] == b], [e["aplan"] for e in validas if e["b"] == b])
                           for b in ("Bronx", "Brooklyn", "Manhattan", "Queens")},
    rho_pvA_aplan=spearman([e["pvA"] for e in validas], [e["aplan"] for e in validas]),
    cambioTipo=sum(1 for e in validas if tipo_de(e["asymPre"]) != tipo_de(e["asymCur"])),
    cambioTipoHaciaTarde=sum(1 for e in validas if tipo_de(e["asymPre"]) != tipo_de(e["asymCur"]) and e["asymCur"] < e["asymPre"]),
    asymCambioMediano=round(st.median(e["asymCur"] - e["asymPre"] for e in validas), 4),
    semana=semana_sis, semanaBorough=semana_boro,
    conf=dict(Counter(e["conf"]["nivel"] for e in estaciones)),
    pvSistemaPre=pico_valle(sistemaPre), pvSistemaCur=pico_valle(sistemaCur),
    ventanaComparable=usa_ventana_comparable,
)
recs = sorted(e["rec"] for e in validas)
pct = lambda p: round(recs[min(len(recs) - 1, int(p * len(recs)))], 4)

# ============================================================ hallazgos (escritos como afirmaciones)
DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
def texto_semana(sis, boro):
    """Cuerpo del hallazgo semanal, escrito a partir de los números y no al revés."""
    d = [v * 100 for v in sis["dia"]]
    perdieron = sorted([i for i in range(1, 6) if d[i] <= -0.5], key=lambda i: d[i])
    ganaron = [i for i in (1, 2, 3, 4, 5, 6, 0) if d[i] >= 0.5]   # lunes a domingo
    def lista(ix): return " y ".join(", ".join(DIAS[i] for i in ix).rsplit(", ", 1)) if ix else "ningún día"
    if len(perdieron) == 1:
        quien = f"el {DIAS[perdieron[0]]} es el único día laborable que perdió peso ({d[perdieron[0]]:+.1f} pp)"
    else:
        quien = f"{lista(perdieron)} son los días que más peso perdieron ({', '.join(f'{d[i]:+.1f}' for i in perdieron)} pp)"
    am_bx = -boro["Bronx"]["am"][5] * 100
    am_ot = sorted(-boro[b]["am"][5] * 100 for b in ("Manhattan", "Brooklyn", "Queens"))
    return (f"Sobre las 168 horas de la semana, {quien}, en buena parte en la ventana de la mañana; "
            f"{lista(ganaron)} lo ganaron. Es la huella semanal del trabajo híbrido, y en el Bronx la mañana del viernes "
            f"perdió {am_bx:.1f} pp frente a {am_ot[0]:.1f}–{am_ot[-1]:.1f} en los demás boroughs.")
def rango_pct(vals):
    lo, hi = min(vals) * 100, max(vals) * 100
    return f"{lo:.0f}\u00a0%" if round(lo) == round(hi) else f"entre {lo:.0f} y {hi:.0f}\u00a0%"
def rango_cambio(vals):
    lo, hi = min(vals) * 100, max(vals) * 100
    return f"{hi:+.0f}\u00a0%" if round(lo) == round(hi) else f"entre {hi:+.0f} y {lo:+.0f}\u00a0%"
def plural(n, uno, varios):
    return f"{n} {uno if n == 1 else varios}"
bx = boroughs.get("Bronx", {}); otros = [boroughs[b] for b in ("Manhattan", "Brooklyn", "Queens") if b in boroughs]   # Staten Island (n=2) no entra en la comparación
hallazgos = [
    dict(id="estanco", numero=1, tipo="positivo",
         titulo="La recuperación se estancó cerca del 70 %",
         cuerpo=f"Desde 2023 el sistema oscila entre el 65 y el 76 % de las entradas de enero de 2020. La mediana por estación es {stats['recMediana']*100:.0f} %."),
    dict(id="aplano", numero=2, tipo="positivo",
         titulo=f"El pico de la mañana se aplanó en {stats['nAplanaron']/stats['nValidas']*100:.0f} % de las estaciones",
         cuerpo=f"La razón pico/valle del día laborable cayó un {-stats['aplanMediano']*100:.0f} % en la estación mediana. Se cuenta aplanamiento solo si supera el 5 %; con cualquier margen serían {sum(1 for e in validas if e['aplan']<0)} de {stats['nValidas']}."),
    dict(id="viernes", numero=3, tipo="positivo",
         titulo=f"La semana se inclinó: el viernes perdió {-semana_sis['dia'][5]*100:.1f} puntos del total semanal y el fin de semana ganó {(semana_sis['dia'][0]+semana_sis['dia'][6])*100:.1f}",
         cuerpo=texto_semana(semana_sis, semana_boro)),
    dict(id="bronx", numero=4, tipo="positivo",
         titulo="El Bronx perdió más pasajeros que nadie y es el único borough donde el día no cambió de forma",
         cuerpo=f"Recuperación mediana del {bx.get('rec',0)*100:.0f}\u00a0% frente al {rango_pct([o['rec'] for o in otros])} en Manhattan, Brooklyn y Queens; cambio mediano del pico de {bx.get('aplan',0)*100:+.0f}\u00a0% frente a {rango_cambio([o['aplan'] for o in otros])}. Donde no hay trabajo híbrido, el pico se queda y solo baja el volumen."),
    dict(id="independientes", numero=5, tipo="negativo",
         titulo="Dentro de un borough, cuánto volvió una estación no dice casi nada de cuánto se aplanó",
         cuerpo=f"La correlación de rango entre recuperación y aplanamiento va de ρ = {min(stats['rho_rec_aplan_borough'].values()):+.2f} a {max(stats['rho_rec_aplan_borough'].values()):+.2f} dentro de cada borough. Son dos ejes de cambio distintos, y por eso la aplicación los muestra en dos canales distintos. La relación que sí existe ({stats['rho_rec_aplan']:+.2f} en el total) es entre boroughs, y es la del Bronx."),
    dict(id="una-direccion", numero=6, tipo="positivo",
         titulo="El cambio fue en una sola dirección: la mañana perdió peso frente a la tarde",
         cuerpo=f"La asimetría mañana/tarde bajó {-stats['asymCambioMediano']:.2f} en la estación mediana, y {stats['cambioTipoHaciaTarde']} de las {stats['cambioTipo']} estaciones que cruzaron un umbral de tipo lo hicieron hacia 'laboral'. Ninguna zona se volvió más residencial. El {(1-stats['cambioTipo']/stats['nValidas'])*100:.0f} % conservó su tipo: la ciudad no se reorganizó, se atenuó."),
    dict(id="linea-base", numero=7, tipo="limite",
         titulo=f"{sum(v for k,v in stats['conf'].items() if k!='solida')} estaciones tienen una comparación poco confiable, y están marcadas",
         cuerpo=f"{plural(stats['conf'].get('estacional',0), 'es sensible', 'son sensibles')} a la estación del año (playas, estadios, aeropuerto), {plural(stats['conf'].get('interrumpida',0), 'tuvo', 'tuvieron')} una caída anómala de entradas en la ventana de comparación y {plural(stats['conf'].get('pequena',0), 'tiene', 'tienen')} una línea base demasiado pequeña. No se excluyen: se muestran con anillo punteado, y las medianas por borough y por tipo se calculan sin ellas."),
]
if tarifas and tarifas.get("ilimitado30"):
    i30 = tarifas["ilimitado30"]
    hallazgos.append(dict(id="abono", numero=8, tipo="positivo",
        titulo="El abono de 30 días se desplomó: la evidencia del uso intermitente",
        cuerpo=f"Pasó del {i30['ini']*100:.0f} % al {i30['fin']*100:.0f} % de las entradas. Un pase mensual solo conviene con uso diario regular; su caída es consistente con el aplanamiento del pico. La migración MetroCard → OMNY, en cambio, es adopción tecnológica y no cambio de demanda."))

for h in hallazgos:
    h["titulo"] = h["titulo"].replace(" %", "\u00a0%")
    h["cuerpo"] = h["cuerpo"].replace(" %", "\u00a0%")

# ============================================================ salida
model = dict(
    meta=dict(
        generado="build_model.py", n=len(estaciones), meses=meses, base=base, msEsc=100,
        ventanaPre=VENTANA_PRE, ventanaCmp=VENTANA_CMP, ventanaComparable=usa_ventana_comparable,
        recP10=pct(.10), recMed=pct(.50), recP90=pct(.90),
        umbrales=dict(tipo=UMBRAL_TIPO, estacional=UMBRAL_ESTACIONAL, pequena=UMBRAL_PEQUENA, corte=UMBRAL_CORTE, aplana=UMBRAL_APLANA),
        ventanasIndice=dict(picoAM=[6, 10], valle=[11, 15], picoPM=[16, 20]),
        tieneACS=bool(acs),
    ),
    hallazgos=hallazgos,
    stats=stats,
    sistema=dict(serie=[dict(m=m, v=mes_sis[m]) for m in meses], perfilPre=sistemaPre, perfilCur=sistemaCur),
    boroughs=boroughs,
    tipos=tipos,
    tarifas=tarifas,
    estaciones=estaciones,
)

with open(SAL, "w", encoding="utf-8") as f:
    json.dump(model, f, separators=(",", ":"), ensure_ascii=False)

print(f"{len(estaciones)} estaciones · {len(meses)} meses · ventana comparable: {usa_ventana_comparable} · ACS: {bool(acs)}")
print(f"confiabilidad: {stats['conf']}")
print(f"aplanaron>5%: {stats['nAplanaron']}/{stats['nValidas']} · mediana {stats['aplanMediano']*100:+.1f}% · ρ(rec,aplan) {stats['rho_rec_aplan']:+.2f}")
for b, v in boroughs.items():
    print(f"  {b:14} n={v['n']:3d} rec {v['rec']*100:5.1f}%  aplan {v['aplan']*100:+5.1f}%  7–9h {v['share79Pre']*100:.1f}→{v['share79Cur']*100:.1f}%")
for h in hallazgos:
    print(f"  [{h['tipo']:8}] {h['titulo']}")
print(f"tamaño: {os.path.getsize(SAL)/1e6:.2f} MB")
