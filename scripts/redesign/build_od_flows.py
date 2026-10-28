#!/usr/bin/env python3
"""Flujos origen-destino sobre la red: atlas/data/flows.json

Toma la estimacion oficial de O-D de la MTA (data/raw/od/parquet/od_YYYY.parquet,
de scripts/acquisition/download_od.py), asigna cada par origen -> destino al
camino mas corto sobre la red de subway y acumula los viajes por tramo entre
estaciones adyacentes. Es la idea de "route-aware" de Zeng et al. (2019): los
flujos siguen la red, no lineas rectas.

Red: se construye desde atlas/data/lineas.geojson (trazado de cada ruta) y
los 424 complejos del atlas. Para cada ruta, los complejos que la sirven (o
que comparten tronco) se proyectan sobre el trazado y los consecutivos forman
un tramo; la geometria del tramo es el pedazo del trazado entre ambos.

Salida (flows.json):
  nodes   : [{id, lat, lon}]
  links   : [{a, b, len, coords:[[lon,lat],...]}]
  years   : [2021, 2022, 2023, 2024]
  hours   : flujo por tramo: flows[year][daytype][hour] = [viajes por tramo]
            (viajes promedio por dia de ese tipo, enero-febrero)
  origins : por complejo y anio, los principales destinos del pico de la manana
            laboral (06-10 h): {id: {year: [[dest, viajes], ...]}}
  manhattanShare : {id: {year: % de viajes AM laborables cuyo destino esta en Manhattan}}
"""
from __future__ import annotations

import heapq
import json
import math
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
ATLAS = ROOT / "atlas" / "data" / "atlas.json"
LINEAS = ROOT / "atlas" / "data" / "lineas.geojson"
OD_DIR = ROOT / "data" / "raw" / "od" / "parquet"
OUT = ROOT / "atlas" / "data" / "flows.json"
YEARS = [2021, 2022, 2023, 2024]
SNAP_M = 220.0          # distancia maxima estacion-trazado para considerarla sobre la ruta
WEEKDAYS = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"}
AM = range(6, 10)


# ------------------------------------------------------------------ geometria
def to_xy(lon: float, lat: float) -> tuple[float, float]:
    """Proyeccion equirectangular local en metros (suficiente para NYC)."""
    k = 111_320.0
    return (lon + 73.95) * k * math.cos(math.radians(40.73)), (lat - 40.73) * k


def project(p, a, b):
    """Proyeccion del punto p sobre el segmento ab: (t in [0,1], distancia)."""
    ax, ay = a; bx, by = b; px, py = p
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy
    t = 0.0 if l2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / l2))
    qx, qy = ax + t * dx, ay + t * dy
    return t, math.hypot(px - qx, py - qy)


def build_network(stations: list[dict], lineas: dict):
    xy = {s["id"]: to_xy(s["lon"], s["lat"]) for s in stations}
    color_of = {}
    for f in lineas["features"]:
        color_of[f["properties"]["ruta"]] = f["properties"]["color"]
    links: dict[tuple[str, str], dict] = {}
    for f in lineas["features"]:
        ruta, color = f["properties"]["ruta"], f["properties"]["color"]
        coords = f["geometry"]["coordinates"]
        pts = [to_xy(x, y) for x, y in coords]
        cum = [0.0]
        for i in range(1, len(pts)):
            cum.append(cum[-1] + math.dist(pts[i - 1], pts[i]))
        # complejos candidatos: sirven esta ruta o una ruta del mismo tronco (color)
        cand = [s for s in stations if ruta in s["routes"] or any(color_of.get(r) == color for r in s["routes"])]
        on_line = []
        for s in cand:
            best = None
            for i in range(1, len(pts)):
                t, d = project(xy[s["id"]], pts[i - 1], pts[i])
                if best is None or d < best[1]:
                    best = (cum[i - 1] + t * (cum[i] - cum[i - 1]), d, i - 1, t)
            if best and best[1] <= SNAP_M:
                on_line.append((best[0], s["id"], best[2], best[3]))
        on_line.sort()
        for (pa, ia, sa, ta), (pb, ib, sb, tb) in zip(on_line, on_line[1:]):
            if ia == ib:
                continue
            key = tuple(sorted((ia, ib)))
            if key in links:
                continue
            # geometria: desde la proyeccion de a hasta la de b sobre el trazado
            def interp(seg, t):
                x0, y0 = coords[seg]; x1, y1 = coords[seg + 1]
                return [round(x0 + t * (x1 - x0), 6), round(y0 + t * (y1 - y0), 6)]
            geom = [interp(sa, ta)] + [list(map(lambda v: round(v, 6), coords[i])) for i in range(sa + 1, sb + 1)] + [interp(sb, tb)]
            if key[0] != ia:
                geom = geom[::-1]
            links[key] = {"a": key[0], "b": key[1], "len": round(max(pb - pa, math.dist(xy[ia], xy[ib]))), "coords": geom, "route": ruta}
    connect_isolated(stations, xy, links)
    collapse_express(links)
    return links


def connect_isolated(stations, xy, links):
    """Complejos que no cayeron sobre ningun trazado (ramales sin geometria):
    se unen en linea recta a sus dos vecinos mas cercanos que compartan ruta."""
    for _ in range(3):
        touched = {k for l in links.values() for k in (l["a"], l["b"])}
        isolated = [s for s in stations if s["id"] not in touched]
        if not isolated:
            return
        for s in isolated:
            cand = [t for t in stations if t["id"] != s["id"] and set(t["routes"]) & set(s["routes"])]
            cand.sort(key=lambda t: math.dist(xy[s["id"]], xy[t["id"]]))
            anchored = sorted((t for t in cand if t["id"] in touched),
                              key=lambda t: (-len(set(t["routes"]) & set(s["routes"])), math.dist(xy[s["id"]], xy[t["id"]])))
            for t in (cand[:2] + anchored[:1]):
                key = tuple(sorted((s["id"], t["id"])))
                if key not in links:
                    a, b = (s, t) if key[0] == s["id"] else (t, s)
                    links[key] = {"a": key[0], "b": key[1], "len": round(math.dist(xy[s["id"]], xy[t["id"]])),
                                  "coords": [[a["lon"], a["lat"]], [b["lon"], b["lat"]]], "route": "recta"}


def collapse_express(links):
    """Un tramo expreso que salta paradas locales se elimina si existe una cadena
    de tramos locales entre sus extremos con casi la misma longitud: el flujo se
    dibuja sobre el corredor fisico, no dos veces (local y expreso superpuestos)."""
    import itertools
    changed = True
    while changed:
        changed = False
        adj: dict[str, list[tuple[str, float, tuple]]] = {}
        for k, l in links.items():
            adj.setdefault(l["a"], []).append((l["b"], l["len"], k))
            adj.setdefault(l["b"], []).append((l["a"], l["len"], k))
        for k, l in sorted(links.items(), key=lambda kv: -kv[1]["len"]):
            # camino mas corto a->b sin usar k, limitado a 1.2x la longitud del tramo
            dist = {l["a"]: 0.0}; pq = [(0.0, l["a"], 0)]
            found = None
            while pq:
                d, u, hops = heapq.heappop(pq)
                if u == l["b"]:
                    found = (d, hops); break
                if d > dist.get(u, math.inf) or d > 1.2 * l["len"]:
                    continue
                for v, w, kk in adj.get(u, []):
                    if kk == k:
                        continue
                    nd = d + w
                    if nd < dist.get(v, math.inf):
                        dist[v] = nd; heapq.heappush(pq, (nd, v, hops + 1))
            if found and found[1] >= 2:
                del links[k]; changed = True; break


def shortest_paths(ids: list[str], links: dict):
    idx = {s: i for i, s in enumerate(ids)}
    adj: dict[int, list[tuple[int, int, float]]] = {i: [] for i in range(len(ids))}
    link_list = list(links.values())
    for li, l in enumerate(link_list):
        a, b, w = idx[l["a"]], idx[l["b"]], max(l["len"], 50.0)
        adj[a].append((b, li, w)); adj[b].append((a, li, w))
    paths: dict[tuple[int, int], list[int]] = {}
    unreachable = 0
    for s in range(len(ids)):
        dist = [math.inf] * len(ids); prev: list[tuple[int, int] | None] = [None] * len(ids)
        dist[s] = 0; pq = [(0.0, s)]
        while pq:
            d, u = heapq.heappop(pq)
            if d > dist[u]:
                continue
            for v, li, w in adj[u]:
                nd = d + w + 150.0   # 150 m de penalizacion por parada (desempate)
                if nd < dist[v]:
                    dist[v] = nd; prev[v] = (u, li); heapq.heappush(pq, (nd, v))
        for t in range(len(ids)):
            if t == s:
                continue
            if prev[t] is None:
                unreachable += 1; continue
            path, cur = [], t
            while cur != s:
                u, li = prev[cur]; path.append(li); cur = u
            paths[(s, t)] = path
    return link_list, paths, unreachable


# ----------------------------------------------------------------------- main
def main() -> None:
    import duckdb
    import calendar as cal

    duckdb.sql("SET memory_limit='1500MB'"); duckdb.sql("SET threads=2")
    atlas = json.load(open(ATLAS, encoding="utf-8"))
    stations = atlas["stations"]
    ids = [s["id"] for s in stations]
    idx = {s: i for i, s in enumerate(ids)}
    by_id = {s["id"]: s for s in stations}
    lineas = json.load(open(LINEAS, encoding="utf-8"))

    links = build_network(stations, lineas)
    link_list, paths, unreachable = shortest_paths(ids, links)
    print(f"red: {len(ids)} complejos, {len(link_list)} tramos, {len(paths):,} caminos, {unreachable} pares sin camino")
    isolated = [s for s in ids if not any(l["a"] == s or l["b"] == s for l in link_list)]
    if isolated:
        print("  complejos sin tramo:", ", ".join(f"{s} {by_id[s]['name']}" for s in isolated))

    # Incidencia par -> tramos DIRIGIDOS: id dirigido = 2*tramo + (0 si se recorre a->b, 1 si b->a).
    # Se reconstruye la direccion recorriendo el camino desde el origen.
    pair_idx, dlink_idx = [], []
    pair_of = {}
    for (s, t), p in paths.items():
        pid = len(pair_of); pair_of[(s, t)] = pid
        cur = ids[s]
        for li in reversed(p):          # p viene del destino al origen
            l = link_list[li]
            if l["a"] == cur:
                dlink_idx.append(2 * li); cur = l["b"]
            else:
                dlink_idx.append(2 * li + 1); cur = l["a"]
            pair_idx.append(pid)
        assert cur == ids[t]
    pair_idx = np.array(pair_idx); dlink_idx = np.array(dlink_idx)
    ND = 2 * len(link_list)
    DOW = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    flows, starts, origins, mshare, balance, coverage, unmapped = {}, {}, {s: {} for s in ids}, {s: {} for s in ids}, {}, {}, {}
    manhattan = np.array([by_id[s]["borough"] == "Manhattan" for s in ids])
    for y in YEARS:
        pq = OD_DIR / f"od_{y}.parquet"
        if not pq.exists():
            print(f"falta {pq}; corre scripts/acquisition/download_od.py --parquet", file=sys.stderr)
            raise SystemExit(1)
        months = sorted(int(m) for (m,) in duckdb.sql(f"SELECT DISTINCT month FROM '{pq}'").fetchall())
        coverage[str(y)] = months
        # n[y,m,d]: ocurrencias de cada dia de la semana en cada mes presente; q = promedio ponderado por n.
        n_rows = []
        for m in months:
            for d in range(7):
                n = sum(1 for day in range(1, cal.monthrange(y, m)[1] + 1) if cal.weekday(y, m, day) == d)
                n_rows.append((m, DOW[d], n))
        duckdb.sql("CREATE OR REPLACE TABLE n_md (month INTEGER, day_of_week VARCHAR, n DOUBLE)")
        duckdb.executemany("INSERT INTO n_md VALUES (?, ?, ?)", n_rows)
        # Todo el trabajo pesado en DuckDB con enteros (ids de nodo y dia de la semana como indices):
        # evita millones de cadenas en Python y mantiene la memoria acotada (~1.5 GB).
        duckdb.sql("CREATE OR REPLACE TABLE nodes (id VARCHAR, i INTEGER)")
        duckdb.executemany("INSERT INTO nodes VALUES (?, ?)", [(s, i) for i, s in enumerate(ids)])
        dow_case = "CASE day_of_week " + " ".join(f"WHEN '{d}' THEN {i}" for i, d in enumerate(DOW)) + " END"
        rows = duckdb.sql(f"""
            WITH den AS (SELECT day_of_week, sum(n) AS den FROM n_md GROUP BY 1),
            a AS (
              SELECT coalesce(no.i, -1) AS o, coalesce(nd.i, -1) AS j, {dow_case} AS dw, p.hour AS hr,
                     sum(n.n * p.ridership) / any_value(den.den) AS q
              FROM '{pq}' p
              JOIN n_md n USING (month, day_of_week) JOIN den USING (day_of_week)
              LEFT JOIN nodes no ON no.id = p.origin_id LEFT JOIN nodes nd ON nd.id = p.destination_id
              GROUP BY ALL
            )
            SELECT o, j, dw, hr, q FROM a
        """).fetchnumpy()
        o = rows["o"].astype(np.int32); dd = rows["j"].astype(np.int32); dw = rows["dw"].astype(np.int32)
        hr = rows["hr"].astype(np.int32); q = rows["q"].astype(np.float64); del rows
        # universo real del OD frente a la red
        ids_od = {v for (v,) in duckdb.sql(f"SELECT DISTINCT origin_id FROM '{pq}' UNION SELECT DISTINCT destination_id FROM '{pq}'").fetchall()}
        unmapped[str(y)] = {"ids": sorted(ids_od - set(ids)), "weight": round(float(q[(o < 0) | (dd < 0)].sum()), 1)}
        mapped = (o >= 0) & (dd >= 0)
        same = mapped & (o == dd)
        pair_mat = np.full((len(ids), len(ids)), -1, dtype=np.int64)
        for (a, b), v in pair_of.items():
            pair_mat[a, b] = v
        pid = np.full(len(q), -1)
        pm = mapped & ~same
        pid[pm] = pair_mat[o[pm], dd[pm]]
        assigned = pid >= 0
        unassignable = pm & ~assigned
        balance[str(y)] = {"input": round(float(q.sum()), 1), "assigned": round(float(q[assigned].sum()), 1),
                           "same_origin_destination": round(float(q[same].sum()), 1), "unassignable": round(float(q[unassignable].sum()), 1),
                           "unmapped": round(float(q[~mapped].sum()), 1)}
        assert abs(balance[str(y)]["input"] - sum(v for k, v in balance[str(y)].items() if k != "input")) < 1e-3
        # viajes iniciados por origen, dia y hora (incluye origen = destino y no asignables)
        U = np.zeros((len(ids), 7, 24))
        np.add.at(U, (o[mapped], dw[mapped], hr[mapped]), q[mapped])
        starts[str(y)] = [[[round(float(U[i, d, h]), 1) for h in range(24)] for d in range(7)] for i in range(len(ids))]
        # carga de tramos dirigidos por dia y hora
        F = np.zeros((len(pair_of), 7, 24))
        np.add.at(F, (pid[assigned], dw[assigned], hr[assigned]), q[assigned])
        flows[str(y)] = []
        for d in range(7):
            flows[str(y)].append([])
            for h in range(24):
                lf = np.bincount(dlink_idx, weights=F[pair_idx, d, h], minlength=ND)
                flows[str(y)][d].append([int(round(v)) for v in lf])
        # destinos de la semana representativa por origen (para resaltar conexiones salientes)
        M = np.zeros((len(ids), len(ids)))
        np.add.at(M, (o[pm], dd[pm]), q[pm])
        for i, s in enumerate(ids):
            row = M[i]; tot = row.sum()
            if tot <= 0:
                continue
            top = np.argsort(row)[::-1][:40]
            origins[s][str(y)] = [[ids[j], round(float(row[j]), 1)] for j in top if row[j] > 0]
            mshare[s][str(y)] = round(100 * float(row[manhattan].sum() / tot), 1)
        b = balance[str(y)]
        print(f"{y}: meses {months}; semana representativa: {b['input']:,.0f} viajes = asignados {b['assigned']:,.0f} + mismo origen/destino {b['same_origin_destination']:,.0f} + no asignables {b['unassignable']:,.0f} + sin estacion {b['unmapped']:,.0f}")

    out = {
        "meta": {
            "source": "MTA Subway Origin-Destination Ridership Estimate (data.ny.gov): promedio estimado por mes, dia de la semana y hora de inicio",
            "method": "q[y,d,h,o,j] = promedio de los meses presentes ponderado por el numero de veces que ese dia de la semana ocurre en cada mes; cada par o->j se asigna al camino mas corto sobre la red de referencia (Dijkstra, 150 m de penalizacion por parada; expresos colapsados sobre el corredor local) y se suma por tramo DIRIGIDO; los viajes con origen = destino cuentan en el origen y no cargan tramos",
            "network": "trazado de rutas (atlas/data/lineas.geojson, GTFS MTA simplificado) + 424 complejos del catalogo actual; red constante para todos los anios",
            "years": YEARS, "links": len(link_list), "directed_links": ND, "snap_m": SNAP_M,
            "months_present": coverage, "balance_weekly_trips": balance, "unmapped_od_ids": unmapped,
            "unreachable_pairs": unreachable,
        },
        "nodes": [{"id": s["id"], "lat": s["lat"], "lon": s["lon"]} for s in stations],
        "links": [{"a": l["a"], "b": l["b"], "len": l["len"], "coords": l["coords"]} for l in link_list],
        "flows": flows, "starts": starts, "origins": origins, "manhattanShare": mshare,
    }
    OUT.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"-> {OUT}  {OUT.stat().st_size/1e6:.1f} MB")


if __name__ == "__main__":
    main()
