#!/usr/bin/env python3
"""Incorpora el OD validado de 2025 al Atlas usando los caminos GTFS ya preparados."""
import argparse
from datetime import datetime, timezone
import gzip
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory

import duckdb
import numpy as np

from prepare_annual_od import prepare_annual_od
from prepare_raeb import P, prepare_year, sha, through_incidence, write_json

YEAR = 2025
EXTERNAL_IDS = {"501", "502"}
DATA = P / "atlas/data"
LIVE = P.parents[1] / "atlas/data"


def monthly_files(source, report):
    months = {f"{YEAR}-{month:02d}" for month in range(1, 13)}
    if report["status"] != "PASS" or set(report["months"]) != months:
        raise ValueError("2025 requiere los doce meses con validación PASS.")
    files = []
    for month, entry in sorted(report["months"].items()):
        path = source / entry["parquet_file"]
        if sha(path) != entry["parquet_sha256"]:
            raise ValueError(f"{month}: el Parquet difiere del informe de validación.")
        files.append(path)
    return files


def outside_network(con, files):
    rows = con.execute("""
        SELECT p.month, p.origin_station_complex_id, p.destination_station_complex_id,
               count(*) AS rows
        FROM read_parquet(?) p
        LEFT JOIN nodes o ON o.id = p.origin_station_complex_id
        LEFT JOIN nodes d ON d.id = p.destination_station_complex_id
        WHERE o.i IS NULL OR d.i IS NULL
        GROUP BY ALL ORDER BY ALL
    """, [[str(file) for file in files]]).fetchall()
    known = {row[0] for row in con.execute("SELECT id FROM nodes").fetchall()}
    external = {station for _, origin, destination, _ in rows for station in (origin, destination)} - known
    if external != EXTERNAL_IDS or sum(row[3] for row in rows) != 4:
        raise ValueError(f"Cambió la cobertura ajena a la red: {rows}")
    return [dict(month=month, origin=origin, destination=destination, rows=count)
            for month, origin, destination, count in rows]


def publish(staged_files, stage):
    for target in (DATA, LIVE):
        for file in staged_files:
            destination = target / file.relative_to(stage)
            destination.parent.mkdir(parents=True, exist_ok=True)
            temporary = destination.with_suffix(destination.suffix + ".tmp")
            temporary.unlink(missing_ok=True)
            os.link(file, temporary)
            temporary.replace(destination)


def main(source):
    report_path = source / "data/od_2025_2026/validation.json"
    report = json.loads(report_path.read_bytes())
    acquisition = report_path.with_name("acquisition.json")
    if sha(acquisition) != report["acquisition_sha256"]:
        raise ValueError("El manifiesto de adquisición difiere de la validación de 2025.")
    files = monthly_files(source, report)
    flows_path = DATA / "flows.json"
    manifest_path = DATA / "raeb/manifest.json"
    network_path = DATA / "raeb/network.json.gz"
    manifest = json.loads(manifest_path.read_bytes())
    if not (manifest["status"] == "PASS" and sha(flows_path) == manifest["flows_sha256"]
            and sha(network_path) == manifest["network_sha256"]):
        raise ValueError("La red y los flujos anteriores deben coincidir con su manifiesto.")
    flows = json.loads(flows_path.read_bytes())
    meta = flows["meta"]
    nodes, links = flows["nodes"], flows["links"]
    paths = json.loads(gzip.decompress(network_path.read_bytes()))["paths"]
    if len(paths) != len(nodes) ** 2:
        raise ValueError("El catálogo y los caminos tienen tamaños distintos.")
    pair = np.repeat(np.arange(len(paths), dtype=np.int32), [len(path) for path in paths])
    arc = np.fromiter((i for path in paths for i in path), dtype=np.int32)
    through_pair, through_complex = through_incidence(nodes, links, paths)

    with TemporaryDirectory(prefix=".od-2025-", dir=DATA.parent) as folder:
        stage = Path(folder)
        con = duckdb.connect(config={"memory_limit": "3GB", "threads": 4, "preserve_insertion_order": False})
        con.execute("SET temp_directory = ?", [str(stage / "duckdb_tmp")])
        con.execute("CREATE TABLE nodes (id VARCHAR, i INTEGER)")
        con.executemany("INSERT INTO nodes VALUES (?, ?)", [(s["id"], i) for i,s in enumerate(nodes)])
        excluded = outside_network(con, files)
        print("Cobertura fuera de la red: 4 filas de Staten Island Railway.", flush=True)
        result = prepare_year(con, YEAR, files, nodes, links, paths, pair, arc, through_pair,
                              through_complex, stage / "raeb", network_only=True)
        con.close()
        balance = result["balance"]
        if balance["unassignable"] or len(result["assets"]) != 168:
            raise ValueError(f"Balance o cobertura temporal incorrectos: {balance}")

        year_key = str(YEAR)
        for field in ("starts", "incoming", "through", "flows"):
            flows[field][year_key] = result[field]
        meta["years"] = sorted(set(meta["years"]) | {YEAR})
        meta["source"] = "MTA OD estimates 2021–2025; all 60 validated monthly partitions."
        meta["months_present"][year_key] = list(range(1, 13))
        meta["balance_weekly_trips"][year_key] = balance
        meta["validation_2025"] = {"file": str(report_path.relative_to(source)), "sha256": sha(report_path),
                                   "rows": report["records"], "outside_network": excluded}
        meta["source_files"].update({month: {"parquet_sha256": entry["parquet_sha256"], "rows": entry["rows"]}
                                     for month,entry in report["months"].items()})
        meta["built_at_utc"] = datetime.now(timezone.utc).isoformat()
        manifest["assets"].update(result["assets"])
        manifest["frames"] = len(manifest["assets"])
        manifest["metadata"] = meta

        write_json(stage / "flows.json", flows)
        manifest["flows_sha256"] = sha(stage / "flows.json")
        write_json(stage / "raeb/manifest.json", manifest)
        for key in manifest["assets"]:
            if key.startswith(f"{YEAR}/"):
                continue
            original = DATA / "raeb" / f"{key}.f32.gz"
            previous = stage / "raeb" / f"{key}.f32.gz"
            previous.parent.mkdir(parents=True, exist_ok=True)
            os.link(original, previous)
        prepare_annual_od(stage)
        prepared = sorted((stage / "raeb" / year_key).glob("*.f32.gz"))
        publish([*prepared, stage / "annual-od.json", stage / "flows.json", stage / "raeb/manifest.json"], stage)
    print(f"PASS: 2025 incorporado. {manifest['frames']} matrices horarias y {len(meta['years'])} resúmenes anuales.", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-package", type=Path, default=P)
    main(parser.parse_args().source_package)
