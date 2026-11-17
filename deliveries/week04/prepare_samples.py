#!/usr/bin/env python3
"""Rebuild the Week 4 CSV package from the same inputs used by the Atlas."""

import argparse
import csv
from collections import Counter
from hashlib import file_digest, sha256
from io import StringIO
import json
from pathlib import Path

import duckdb


WEEK = Path(__file__).resolve().parent
UPSTREAM = WEEK.parent / "week12"
MONTHS = tuple(f"{year}-{month:02d}" for year in range(2021, 2026) for month in range(1, 13))
SAMPLE_ROWS = 24


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha(path):
    with path.open("rb") as handle:
        return file_digest(handle, "sha256").hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def csv_text(fields, rows):
    output = StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(fields)
    writer.writerows(rows)
    return output.getvalue()


def monthly_sample(con, parquet, expected, expected_hash, columns):
    actual_hash = sha(parquet)
    require(expected_hash is None or actual_hash == expected_hash, f"SHA distinto: {parquet}")
    count = con.execute("SELECT num_rows FROM parquet_file_metadata(?)", [str(parquet)]).fetchone()[0]
    require(count == expected, f"Conteo distinto: {parquet}")
    # One physical row from the midpoint of each equally sized interval.
    # This is repeatable for the documented Parquet bytes and covers its full extent.
    offsets = [(2 * index + 1) * count // (2 * SAMPLE_ROWS) for index in range(SAMPLE_ROWS)]
    marks = ", ".join("?" for _ in offsets)
    cursor = con.execute(
        f"""SELECT * FROM read_parquet(?, file_row_number=true)
            WHERE file_row_number IN ({marks}) ORDER BY file_row_number""",
        [str(parquet), *offsets],
    )
    require([item[0] for item in cursor.description] == [*columns, "file_row_number"],
            f"Esquema distinto: {parquet}")
    rows = [row[:-1] for row in cursor.fetchall()]
    require(len(rows) == SAMPLE_ROWS, f"Muestra incompleta: {parquet}")
    return rows, actual_hash


def origin_record(acquisition, parquet, rows, parquet_hash):
    requests = [acquisition] if "url" in acquisition else acquisition["blocks"]
    return {
        "requests": [{key: request[key] for key in ("url", "retrieved_at_utc", "sha256")}
                     for request in requests],
        "retrieved_at_utc": acquisition["retrieved_at_utc"],
        "raw_sha256": acquisition["sha256"],
        "parquet": str(parquet.relative_to(UPSTREAM)),
        "parquet_sha256": parquet_hash,
        "source_rows": rows,
    }


def build_demands(con, schemas, spectral, routing):
    entries = load(UPSTREAM / "data/full_period/acquisition_atlas.json")
    groups = {
        UPSTREAM / "data" / directory: years
        for directory, years in (("od_2021_2024", {"2021", "2022", "2023", "2024"}),
                                 ("od_2025_2026", {"2025"}))
    }
    require(entries["status"] == "COMPLETE" and set(entries["months"]) == set(MONTHS),
            "La adquisición de entradas debe cubrir los 60 meses")
    checks_by_month = {}
    for directory, years in groups.items():
        acquisition_path = directory / "acquisition.json"
        acquisition, validation = load(acquisition_path), load(directory / "validation.json")
        periods = {period for period in MONTHS if period[:4] in years}
        require(validation["status"] == "PASS" and set(acquisition["months"]) == set(validation["months"]) == periods,
                "La validación OD debe cubrir todos los meses de su adquisición")
        require(sha(acquisition_path) == validation["acquisition_sha256"], f"Adquisición OD distinta: {directory}")
        require(sum(record["rows"] for record in validation["months"].values()) == validation["records"],
                f"El total OD difiere de su informe: {directory}")
        checks_by_month.update({period: (acquisition["months"][period], validation["months"][period])
                                for period in periods})

    entry_rows, od_rows, entries_trace, od_trace = [], [], {}, {}
    for period in MONTHS:
        entry = entries["months"][period]
        path = UPSTREAM / f"data/raw/full_period/parquet/{period}.parquet"
        spectral_hash = spectral["meta"]["source_sha256"][path.name]
        count = entry["rows"]
        require(entry["validated"] and entry["expected"]["rows"] == count, f"Entradas sin validar: {period}")
        rows, digest = monthly_sample(con, path, count, spectral_hash, schemas["sample.csv"])
        require(all(row[0].strftime("%Y-%m") == period and row[-1] == entry["expected"]["dataset"] for row in rows),
                f"Entradas fuera del período o fuente: {period}")
        entry_rows.extend(rows)
        entries_trace[period] = origin_record(entry, path, count, digest)

        acquisition, checked = checks_by_month[period]
        path = UPSTREAM / checked["parquet_file"]
        count = checked["rows"]
        require(routing["metadata"]["source_files"][period] == {
            "rows": count, "parquet_sha256": checked["parquet_sha256"]
        }, f"El Atlas OD usa una versión distinta: {period}")
        rows, digest = monthly_sample(con, path, count, checked["parquet_sha256"], schemas["od_sample.csv"])
        require(all(f"{row[0]}-{row[1]:02d}" == period and 0 <= row[3] <= 23 for row in rows),
                f"OD fuera del período o con hora inválida: {period}")
        od_rows.extend(rows)
        od_trace[period] = origin_record(acquisition, path, count, digest)

    require(sum(item["source_rows"] for item in entries_trace.values()) == entries["records_validated"],
            "El total de entradas difiere de la adquisición")
    return entry_rows, od_rows, entries_trace, od_trace


def build_network(spectral, routing):
    data = UPSTREAM / "atlas/data"
    network_source = load(UPSTREAM / "data/network_reference/source.json")
    flows_path = data / "flows.json"
    spectral_path = data / "network_current.json"
    require(sha(flows_path) == routing["flows_sha256"], "flows.json difiere del manifiesto RAEB")
    require(sha(spectral_path) == spectral["meta"]["graph_sha256"] == network_source["graph_sha256"],
            "El grafo espectral difiere del que se usó en Eventos")
    flows, graph = load(flows_path), load(spectral_path)
    require(flows["meta"]["gtfs_sha256"] == graph["meta"]["archive_sha256"] == network_source["sha256"],
            "Los dos grafos deben provenir del mismo GTFS")
    complexes = {str(node["id"]) for node in flows["nodes"]}
    require(complexes == {str(node["id"]) for node in graph["nodes"]},
            "Los universos de complejos de ambos grafos difieren")

    stops = flows["meta"]["network"]["route_nodes"]
    rows = []
    for index, link in enumerate(flows["links"]):
        a, b = (str(link[key]) for key in ("a", "b"))
        stop_a, stop_b = (str(link[key]) for key in ("stop_a", "stop_b"))
        require(str(stops[stop_a]["complex"]) == a and str(stops[stop_b]["complex"]) == b,
                f"Extremo GTFS mal asociado: enlace {index}")
        cost = link["cost"] if isinstance(link["cost"], list) else [link["cost"]] * 2
        rows.append((index, a, b, stop_a, stop_b, link["kind"], "|".join(link["routes"]),
                     link["len"], *(int(flag) for flag in link["allowed"]), *cost,
                     json.dumps(link["coords"], separators=(",", ":"))))

    pairs = {
        tuple(sorted((edge["source"], edge["target"])))
        for key in ("service_edges", "declared_transfer_edges") for edge in graph[key]
        if edge["source"] != edge["target"]
    }
    require(len(pairs) == spectral["meta"]["links"], "Conteo de adyacencias espectrales distinto")
    station_rows = [(n["id"], n["name"], n["borough"], n["lat"], n["lon"])
                    for n in sorted(flows["nodes"], key=lambda n: int(n["id"]))]
    context = load(UPSTREAM / "data/sources.json")
    reference_sources = {}
    for source in context["context_sources"]:
        filename = source["file"]
        checksum = context["files"][filename]["sha256"]
        require(sha(UPSTREAM / "data" / filename) == checksum, f"Fuente territorial distinta: {filename}")
        reference_sources[filename] = {**source, "sha256": checksum}
    stats = {
        "gtfs": network_source,
        "complexes": len(complexes),
        "complexes_by_borough": dict(sorted(Counter(n["borough"] for n in flows["nodes"]).items())),
        "routing": {"parent_stops": len(stops), **dict(sorted(Counter(row[5] for row in rows).items())),
                    "flows_sha256": routing["flows_sha256"], "topology_sha256": routing["network_sha256"]},
        "events": {"unique_undirected_complex_edges": len(pairs), "graph_sha256": spectral["meta"]["graph_sha256"]},
        "reference_sources": reference_sources,
        "map_boundaries_sha256": sha(data / "boroughs.geojson"),
    }
    return rows, station_rows, stats


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Rebuild in memory and compare existing files")
    args = parser.parse_args()
    schemas = {}
    with (WEEK / "data_dictionary.csv").open(encoding="utf-8", newline="") as handle:
        for field in csv.DictReader(handle):
            schemas.setdefault(field["table"], []).append(field["field"])
    spectral = load(UPSTREAM / "data/spectral/index.json")
    routing = load(UPSTREAM / "atlas/data/raeb/manifest.json")
    require(set(routing["metadata"]["source_files"]) == set(MONTHS), "Cobertura OD del Atlas incompleta")
    require(set(spectral["meta"]["source_sha256"]) == {f"{month}.parquet" for month in MONTHS},
            "Cobertura de Eventos incompleta")
    network, stations, stats = build_network(spectral, routing)
    with duckdb.connect(config={"threads": "2", "preserve_insertion_order": "true"}) as con:
        entries, od, entries_trace, od_trace = build_demands(con, schemas, spectral, routing)
        ids = [str(station[0]) for station in stations]
        paths = [str(UPSTREAM / record["parquet"]) for record in od_trace.values()]
        excluded = con.execute(
            """SELECT year, month, origin_station_complex_id, destination_station_complex_id, count(*)
               FROM read_parquet(?)
               WHERE origin_station_complex_id IS NULL OR destination_station_complex_id IS NULL
                  OR origin_station_complex_id NOT IN (SELECT * FROM unnest(?))
                  OR destination_station_complex_id NOT IN (SELECT * FROM unnest(?))
               GROUP BY ALL ORDER BY ALL""",
            [paths, ids, ids],
        ).fetchall()
    stats["od_rows_outside_routing_network"] = [
        {"period": f"{year}-{month:02d}", "origin": origin, "destination": destination, "rows": count}
        for year, month, origin, destination, count in excluded
    ]

    tables = {"sample.csv": entries, "od_sample.csv": od, "network_sample.csv": network, "complexes.csv": stations}
    require(set(tables) == set(schemas), "El diccionario debe cubrir exactamente los CSV de datos")
    outputs = {}
    for name, rows in tables.items():
        require(all(len(row) == len(schemas[name]) for row in rows), f"Diccionario desalineado: {name}")
        outputs[name] = csv_text(schemas[name], rows)
    manifest = {
        "period": [MONTHS[0], MONTHS[-1]],
        "sample_rows_per_month_per_demand_source": SAMPLE_ROWS,
        "output_rows": {name: len(rows) for name, rows in tables.items()},
        "output_sha256": {name: sha256(content.encode()).hexdigest() for name, content in outputs.items()},
        "entries": entries_trace,
        "od": od_trace,
        "network": stats,
    }
    outputs["manifest.json"] = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    for name, content in outputs.items():
        path = WEEK / "data" / name
        if args.check:
            require(path.read_bytes() == content.encode(), f"No coincide: {path}")
        else:
            path.write_text(content, encoding="utf-8")
    print("PASS", manifest["output_rows"])


if __name__ == "__main__":
    main()
