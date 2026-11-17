#!/usr/bin/env python3
"""Derive the Week 6 examples from the same prepared assets used by Fractal."""

import argparse
import csv
from datetime import datetime, timedelta
import gzip
from hashlib import sha256
from io import StringIO
import json
from pathlib import Path
import struct

WEEK = Path(__file__).resolve().parents[1]
ATLAS = WEEK.parent / "week12"
DATA = ATLAS / "atlas/data"
EVENTS = ATLAS / "data/spectral"
OUTPUT = WEEK / "data/processed"
BASE, TARGET = 2021, 2025
EVENT_MONTH, EVENT_ID = "2023-09", "2023-09-4"
EXAMPLE_COMPLEX = "611"


def read(path):
    return json.loads(path.read_bytes())


def profile(starts):
    cells = [value for day in starts for value in day]
    total = sum(cells)
    return [v / total for v in cells] if total else None


def round_float(value):
    return round(value, 6) if isinstance(value, float) else value


def cross_year_tables(tables):
    flow_file = DATA / "flows.json"
    flows, annual = read(flow_file), read(DATA / "annual-od.json")
    manifest_path = DATA / "raeb/manifest.json"
    manifest = read(manifest_path)
    if annual["source"]["manifest_sha256"] != sha256(manifest_path.read_bytes()).hexdigest():
        raise ValueError("El promedio anual y el manifiesto OD no corresponden")
    if manifest["flows_sha256"] != sha256(flow_file.read_bytes()).hexdigest():
        raise ValueError("Los perfiles y tramos no corresponden al manifiesto OD")
    a, b = (annual["years"][str(year)] for year in (BASE, TARGET))
    nodes = flows["nodes"]
    names = {n["id"]: n["name"] for n in nodes}
    id_index = {n["id"]: i for i, n in enumerate(nodes)}

    links = []
    for i, link in enumerate(flows["links"]):
        if link["kind"] != "rail":
            continue
        ca, cb = (sum(year["loads"][2 * i:2 * i + 2]) for year in (a, b))
        links.append((i, link["stop_a"], link["stop_b"], link["a"], link["b"],
                      names[link["a"]], names[link["b"]], "|".join(link["routes"]), ca, cb, cb - ca))
    tables["atlas_rail_annual.csv"] = (
        "link_id stop_a stop_b complex_a complex_b name_a name_b gtfs_routes daily_trips_2021 daily_trips_2025 delta_trips_per_day",
        links,
    )

    profiles = {}
    scatter = []
    for i, node in enumerate(nodes):
        pa, pb = (profile(flows["starts"][str(year)][i]) for year in (BASE, TARGET))
        if pa is None or pb is None:
            continue
        profiles[node["id"]] = (pa, pb)
        peak = max(range(168), key=pb.__getitem__)
        tv = 50 * sum(abs(vb - va) for va, vb in zip(pa, pb))
        scatter.append((node["id"], node["name"], node["borough"], a["starts"][i], b["starts"][i],
                        b["incoming"][i], 100 * b["starts"][i] / a["starts"][i], tv,
                        peak // 24 + 1, peak % 24, 100 * pb[peak]))
    tables["atlas_complex_annual.csv"] = (
        "complex_id name borough daily_departures_2021 daily_departures_2025 daily_arrivals_2025 volume_2025_vs_2021_pct tv_pp peak_weekday_2025_iso peak_hour_2025 peak_share_2025_pct",
        scatter,
    )

    def system_profile(year):
        return profile([[sum(station[d][h] for station in flows["starts"][str(year)])
                         for h in range(24)] for d in range(7)])

    clock = [(scope, i // 24 + 1, i % 24, 100 * va, 100 * vb, 100 * (vb - va))
             for scope, (pa, pb) in [("system", tuple(system_profile(y) for y in (BASE, TARGET))),
                                      (EXAMPLE_COMPLEX, profiles[EXAMPLE_COMPLEX])]
             for i, (va, vb) in enumerate(zip(pa, pb))]
    tables["atlas_weekly_clock.csv"] = ("scope weekday_iso hour week_share_2021_pct week_share_2025_pct delta_week_share_pp", clock)

    matrices = []
    for year, record in ((BASE, a), (TARGET, b)):
        gz = (DATA / f"raeb/{year}/annual.f32.gz").read_bytes()
        if sha256(gz).hexdigest() != record["frame_sha256"]:
            raise ValueError(f"Matriz anual OD distinta: {year}")
        matrices.append(struct.unpack(f"<{len(nodes) ** 2}f", gzip.decompress(gz)))
    origin_index = id_index[EXAMPLE_COMPLEX]
    origin_offset = origin_index * len(nodes)
    destinations = [(EXAMPLE_COMPLEX, nodes[j]["id"], nodes[j]["name"], nodes[j]["borough"],
                     a_value, b_value, b_value - a_value)
                    for j, (a_value, b_value) in enumerate(zip(
                        matrices[0][origin_offset:origin_offset + len(nodes)],
                        matrices[1][origin_offset:origin_offset + len(nodes)]
                    )) if a_value > 0 or b_value > 0]
    tables["atlas_origin_destinations.csv"] = (
        "origin_id destination_id destination borough daily_trips_2021 daily_trips_2025 delta_trips_per_day", destinations,
    )
    return names


def event_tables(tables, names):
    index = read(EVENTS / "index.json")
    if index["meta"]["graph_sha256"] != sha256((DATA / "network_current.json").read_bytes()).hexdigest():
        raise ValueError("Eventos debe usar la topología declarada en el índice")
    month_rows = []
    for year in index["meta"]["years"]:
        for month in range(1, 13):
            key = f"{year}-{month:02d}"
            episodes = index["months"].get(key, [])
            month_rows.append((key, len(episodes), max((e["strength"] for e in episodes), default=None)))
    tables["atlas_events_monthly.csv"] = ("month displayed_episodes max_spectral_strength", month_rows)

    event = read(EVENTS / f"{EVENT_MONTH}.json")[EVENT_ID]
    episode = next(row for row in index["months"][EVENT_MONTH] if row["id"] == EVENT_ID)
    if len(event["stations"]) != episode["complexes"]:
        raise ValueError("Los complejos del episodio difieren del índice")
    start = datetime.fromisoformat(index["meta"]["origin"]) + timedelta(hours=event["start"])
    window_start, window_end = event["window"]
    if start + timedelta(hours=window_start) != datetime.fromisoformat(episode["start"]):
        raise ValueError("El inicio de la ventana del episodio difiere del índice")
    details, absolute_changes = [], []
    for i, (obs, typical) in enumerate(zip(event["observed"], event["typical"])):
        timestamp = (start + timedelta(hours=i)).isoformat(timespec="hours")
        changes = []
        for station in event["stations"]:
            seen, usual = station["observed"][i], station["typical"][i]
            delta = seen - usual if seen is not None and usual is not None else None
            relative = 100 * delta / usual if delta is not None and usual > 0 else None
            changes.append(delta)
            details.append((EVENT_ID, timestamp, station["id"], names[station["id"]], seen, usual, delta, relative))
        absolute_changes.append(sum(abs(d) for d in changes if d is not None))
    map_hour = max(range(window_start, window_end), key=absolute_changes.__getitem__)
    series = [(EVENT_ID, (start + timedelta(hours=i)).isoformat(timespec="hours"),
               int(window_start <= i < window_end), int(i == map_hour), obs, typical,
               obs - typical if obs is not None and typical is not None else None, absolute_changes[i])
              for i, (obs, typical) in enumerate(zip(event["observed"], event["typical"]))]
    tables["atlas_event_series.csv"] = (
        "episode_id local_hour inside_episode map_opening_hour observed_entries typical_entries net_delta_entries sum_abs_delta_entries",
        series,
    )
    tables["atlas_event_complexes.csv"] = (
        "episode_id local_hour complex_id name observed_entries typical_entries delta_entries delta_pct",
        details,
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Compare with delivered CSV files")
    args = parser.parse_args()
    tables = {}
    names = cross_year_tables(tables)
    event_tables(tables, names)
    for name, (fields, rows) in tables.items():
        out = StringIO(newline="")
        writer = csv.writer(out, lineterminator="\n")
        writer.writerow(fields.split())
        writer.writerows(tuple(map(round_float, row)) for row in rows)
        content = out.getvalue().encode()
        path = OUTPUT / name
        if args.check:
            if path.read_bytes() != content:
                raise ValueError(f"No coincide: {path}")
        else:
            path.write_bytes(content)
        print(f"{name}: {len(rows)} filas")


if __name__ == "__main__":
    main()
