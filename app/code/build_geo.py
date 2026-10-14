#!/usr/bin/env python3
"""
Construye data/geo.json: contornos de los boroughs y trazado de las líneas del
metro, simplificados para el navegador.

Fuentes (ambas públicas, en GitHub):
    boroughs.geojson      dwillis/nyc-maps  (NYC Department of City Planning)
    gtfs_subway.zip       kjhealy/nycroutes (MTA GTFS estático: shapes.txt, routes.txt)

Uso:
    python3 build_geo.py <boroughs.geojson> <carpeta_gtfs> <salida.json>
"""

import csv, json, sys, os, math
from collections import defaultdict

BOROS, GTFS, SAL = sys.argv[1], sys.argv[2], sys.argv[3]
TOL_BORO = 0.0007      # ~70 m
TOL_LINEA = 0.0004     # ~40 m
AREA_MIN = 2e-5        # islas menores que esto (en grados²) se descartan


def dp(pts, tol):
    """Douglas–Peucker sobre una lista de (lon, lat)."""
    if len(pts) < 3:
        return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy)
    best, idx = 0.0, 0
    for i in range(1, len(pts) - 1):
        x, y = pts[i]
        d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / L if L else math.hypot(x - x1, y - y1)
        if d > best:
            best, idx = d, i
    if best > tol:
        return dp(pts[:idx + 1], tol)[:-1] + dp(pts[idx:], tol)
    return [pts[0], pts[-1]]


def area(ring):
    return abs(sum(ring[i][0] * ring[(i + 1) % len(ring)][1] - ring[(i + 1) % len(ring)][0] * ring[i][1]
                   for i in range(len(ring)))) / 2


def rnd(pts):
    return [[round(x, 5), round(y, 5)] for x, y in pts]


# ------------------------------------------------------------------ boroughs
src = json.load(open(BOROS, encoding="utf-8"))
boroughs = []
for f in src["features"]:
    nombre = f["properties"].get("BoroName") or f["properties"].get("boro_name") or f["properties"].get("name")
    g = f["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    out = []
    for poly in polys:
        ext = [tuple(p) for p in poly[0]]
        if area(ext) < AREA_MIN:
            continue
        out.append([rnd(dp(ext, TOL_BORO))])          # solo el anillo exterior; los huecos no importan a esta escala
    boroughs.append(dict(type="Feature", properties=dict(nombre=nombre),
                         geometry=dict(type="MultiPolygon", coordinates=out)))

# ------------------------------------------------------------------ líneas del metro
rutas = {}
with open(os.path.join(GTFS, "routes.txt"), newline="", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        rutas[r["route_id"]] = dict(nombre=r["route_short_name"], color="#" + (r["route_color"] or "888888"))

shapes = defaultdict(list)
with open(os.path.join(GTFS, "shapes.txt"), newline="", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        shapes[r["shape_id"]].append((int(r["shape_pt_sequence"]), float(r["shape_pt_lon"]), float(r["shape_pt_lat"])))

por_ruta = defaultdict(list)
for sid, pts in shapes.items():
    ruta = sid.split("..")[0].split(".")[0]
    if ruta not in rutas:
        continue
    pts.sort()
    por_ruta[ruta].append([(x, y) for _, x, y in pts])

# por ruta: las 3 trazas más largas (tronco + ramales principales), deduplicadas por puntos
lineas = []
for ruta, trazas in por_ruta.items():
    trazas.sort(key=len, reverse=True)
    vistos = set()
    for tr in trazas[:4]:
        simp = dp(tr, TOL_LINEA)
        clave = tuple(rnd(simp)[0] + rnd(simp)[-1])
        if clave in vistos:
            continue
        vistos.add(clave)
        lineas.append(dict(type="Feature",
                           properties=dict(ruta=ruta, color=rutas[ruta]["color"]),
                           geometry=dict(type="LineString", coordinates=rnd(simp))))

geo = dict(
    boroughs=dict(type="FeatureCollection", features=boroughs),
    lineas=dict(type="FeatureCollection", features=lineas),
    fuente=dict(boroughs="NYC Department of City Planning vía dwillis/nyc-maps",
                lineas="MTA GTFS estático vía kjhealy/nycroutes"),
)
with open(SAL, "w", encoding="utf-8") as f:
    json.dump(geo, f, separators=(",", ":"))

npts = sum(len(p[0]) for b in boroughs for p in b["geometry"]["coordinates"])
print(f"boroughs: {len(boroughs)} · {npts} vértices")
print(f"líneas: {len(lineas)} trazas de {len(por_ruta)} rutas · {sum(len(l['geometry']['coordinates']) for l in lineas)} vértices")
print(f"tamaño: {os.path.getsize(SAL)/1e3:.0f} KB")
