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

    # incidencia par -> tramos
    pair_idx, link_idx = [], []
    pair_of = {}
    for (s, t), p in paths.items():
        pid = len(pair_of); pair_of[(s, t)] = pid
        pair_idx.extend([pid] * len(p)); link_idx.extend(p)
    pair_idx = np.array(pair_idx); link_idx = np.array(link_idx)

    flows: dict[str, dict[str, list[list[float]]]] = {}
    origins: dict[str, dict[str, list]] = {s: {} for s in ids}
    mshare: dict[str, dict[str, float]] = {s: {} for s in ids}
    manhattan = np.array([by_id[s]["borough"] == "Manhattan" for s in ids])
    for y in YEARS:
        pq = OD_DIR / f"od_{y}.parquet"
        if not pq.exists():
            print(f"falta {pq}; corre scripts/acquisition/download_od.py --parquet", file=sys.stderr)
            raise SystemExit(1)
        # promedio por dia de cada tipo (laborable / fin de semana), ene-feb
        rows = duckdb.sql(f"""
            WITH d AS (
              SELECT origin_id, destination_id, hour,
                     CASE WHEN day_of_week IN ('Saturday','Sunday') THEN 1 ELSE 0 END AS we,
                     month, day_of_week, ridership
              FROM '{pq}'
            ), per_day AS (
              SELECT origin_id, destination_id, hour, we, month, day_of_week, sum(ridership) AS r FROM d GROUP BY ALL
            )
            SELECT origin_id, destination_id, hour, we, avg(r) AS r FROM per_day GROUP BY ALL
        """).fetchnumpy()
        o = np.array([idx.get(v, -1) for v in rows["origin_id"]])
        dd = np.array([idx.get(v, -1) for v in rows["destination_id"]])
        ok = (o >= 0) & (dd >= 0) & (o != dd)
        o, dd, hr, we, r = o[ok], dd[ok], rows["hour"][ok].astype(int), rows["we"][ok].astype(int), rows["r"][ok].astype(float)
        pid = np.array([pair_of.get((a, b), -1) for a, b in zip(o, dd)])
        ok = pid >= 0
        o, dd, hr, we, r, pid = o[ok], dd[ok], hr[ok], we[ok], r[ok], pid[ok]
        # matriz par x (daytype, hour)
        F = np.zeros((len(pair_of), 2, 24))
        np.add.at(F, (pid, we, hr), r)
        flows[str(y)] = {}
        for di, dname in enumerate(("weekday", "weekend")):
            flows[str(y)][dname] = []
            for h in range(24):
                lf = np.bincount(link_idx, weights=F[pair_idx, di, h], minlength=len(link_list))
                flows[str(y)][dname].append([round(float(v), 1) for v in lf])
        # destinos AM laborables por origen
        am = (we == 0) & np.isin(hr, list(AM))
        M = np.zeros((len(ids), len(ids)))
        np.add.at(M, (o[am], dd[am]), r[am])
        for i, s in enumerate(ids):
            row = M[i]; tot = row.sum()
            if tot <= 0:
                continue
            top = np.argsort(row)[::-1][:40]
            origins[s][str(y)] = [[ids[j], round(float(row[j]), 1)] for j in top if row[j] > 0]
            mshare[s][str(y)] = round(100 * float(row[manhattan].sum() / tot), 1)
        print(f"{y}: {ok.sum():,} celdas O-D, {r.sum():,.0f} viajes/dia-tipo asignados a la red")

    out = {
        "meta": {
            "source": "MTA Subway Origin-Destination Ridership Estimate (data.ny.gov), enero-febrero, estimacion por encadenamiento de viajes",
            "method": "cada par origen-destino se asigna al camino mas corto sobre la red (Dijkstra, 150 m de penalizacion por parada; tramos expresos colapsados sobre el corredor local) y se suma por tramo; viajes promedio por dia laborable / de fin de semana, por hora de entrada",
            "years": YEARS, "links": len(link_list), "snap_m": SNAP_M,
        },
        "nodes": [{"id": s["id"], "lat": s["lat"], "lon": s["lon"]} for s in stations],
        "links": [{"a": l["a"], "b": l["b"], "len": l["len"], "coords": l["coords"]} for l in link_list],
        "flows": flows, "origins": origins, "manhattanShare": mshare,
    }
    OUT.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"-> {OUT}  {OUT.stat().st_size/1e6:.1f} MB")


if __name__ == "__main__":
    main()
