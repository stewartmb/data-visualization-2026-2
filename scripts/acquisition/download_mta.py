#!/usr/bin/env python3
"""Descarga una muestra reproducible o el archivo completo del dataset MTA."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

DATASET_ID = "wujg-7c2s"
OFFICIAL_RECORD_COUNT = 120_855_568
RESOURCE_URL = f"https://data.ny.gov/resource/{DATASET_ID}.csv"
FULL_EXPORT_URL = (
    f"https://data.ny.gov/api/views/{DATASET_ID}/rows.csv?accessType=DOWNLOAD"
)
SOURCE_PAGE = (
    "https://data.ny.gov/Transportation/"
    "MTA-Subway-Hourly-Ridership-2020-2024/wujg-7c2s/about_data"
)
FIELDS = [
    "transit_timestamp",
    "transit_mode",
    "station_complex_id",
    "station_complex",
    "borough",
    "payment_method",
    "fare_class_category",
    "ridership",
    "transfers",
    "latitude",
    "longitude",
    "georeference",
]

# Un estrato por ano y trimestre. Las horas elegidas cubren manana, mediodia,
# tarde punta y noche. 20 estratos x 500 filas = 10,000 registros.
QUARTER_ANCHORS = {
    1: (2, 15, 8),
    2: (5, 15, 12),
    3: (8, 15, 17),
    4: (11, 15, 22),
}
MODE_WEIGHTS = {
    "subway": 0.88,
    "staten_island_railway": 0.06,
    "tram": 0.06,
}


def request_headers() -> dict[str, str]:
    headers = {"User-Agent": "data-visualization-2026-2/1.0"}
    token = os.environ.get("SOCRATA_APP_TOKEN")
    if token:
        headers["X-App-Token"] = token
    return headers


def fetch_sample_stratum(year: int, quarter: int, mode: str, rows: int, timeout: int) -> list[dict[str, str]]:
    month, day, hour = QUARTER_ANCHORS[quarter]
    start = datetime(year, month, day, hour)
    # Una semana garantiza suficientes observaciones de los modos menos frecuentes
    # (SIR y tram) sin salir del trimestre seleccionado.
    end = start + timedelta(days=7)
    where = (
        f"transit_timestamp >= '{start:%Y-%m-%dT%H:%M:%S}' "
        f"AND transit_timestamp < '{end:%Y-%m-%dT%H:%M:%S}' "
        f"AND transit_mode = '{mode}'"
    )
    params = {
        "$select": ",".join(FIELDS),
        "$where": where,
        "$order": (
            "transit_timestamp,station_complex_id,payment_method,"
            "fare_class_category,transit_mode"
        ),
        "$limit": str(rows),
    }
    url = RESOURCE_URL + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers=request_headers())
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            text = response.read().decode("utf-8-sig")
    except (urllib.error.URLError, TimeoutError) as exc:
        raise RuntimeError(f"Fallo API para {year}-Q{quarter}-{mode}: {exc}") from exc
    records = list(csv.DictReader(text.splitlines()))
    if len(records) != rows:
        raise RuntimeError(
            f"El estrato {year}-Q{quarter}-{mode} devolvio {len(records)} filas; se esperaban {rows}."
        )
    return records


def write_manifest(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def sample_mode(args: argparse.Namespace) -> None:
    if args.sample_rows % 20 != 0:
        raise SystemExit("--sample-rows debe ser divisible entre 20")
    rows_per_stratum = args.sample_rows // 20
    output = args.output or Path("data/sample/mta_subway_hourly_2020_2024_sample.csv")
    output.parent.mkdir(parents=True, exist_ok=True)
    all_rows: list[dict[str, str]] = []
    for year in range(2020, 2025):
        for quarter in range(1, 5):
            allocations = {
                mode: round(rows_per_stratum * weight)
                for mode, weight in MODE_WEIGHTS.items()
            }
            allocations["subway"] += rows_per_stratum - sum(allocations.values())
            for mode, rows in allocations.items():
                print(f"Consultando {year}-Q{quarter}-{mode}...", flush=True)
                all_rows.extend(fetch_sample_stratum(year, quarter, mode, rows, args.timeout))

    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(all_rows)

    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    manifest = {
        "dataset_id": DATASET_ID,
        "dataset_name": "MTA Subway Hourly Ridership: 2020-2024",
        "official_record_count": OFFICIAL_RECORD_COUNT,
        "mode": "sample",
        "source_page": SOURCE_PAGE,
        "api_endpoint": RESOURCE_URL,
        "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
        "sampling_method": "20 deterministic year-quarter strata, allocated across all 3 transit modes",
        "rows": len(all_rows),
        "rows_per_stratum": rows_per_stratum,
        "sha256": digest,
        "output": str(output),
    }
    write_manifest(args.manifest, manifest)
    print(f"Muestra creada: {output} ({len(all_rows):,} filas)")
    print(f"SHA-256: {digest}")


def full_mode(args: argparse.Namespace) -> None:
    output = args.output or Path("data/raw/mta_subway_hourly_2020_2024_full.csv")
    output.parent.mkdir(parents=True, exist_ok=True)
    partial = output.with_suffix(output.suffix + ".partial")
    request = urllib.request.Request(FULL_EXPORT_URL, headers=request_headers())
    digest = hashlib.sha256()
    downloaded = 0
    try:
        with urllib.request.urlopen(request, timeout=args.timeout) as response, partial.open("wb") as handle:
            while chunk := response.read(1024 * 1024):
                if args.max_bytes and downloaded + len(chunk) > args.max_bytes:
                    chunk = chunk[: args.max_bytes - downloaded]
                if not chunk:
                    break
                handle.write(chunk)
                digest.update(chunk)
                downloaded += len(chunk)
                print(f"\rDescargado: {downloaded / (1024**2):,.1f} MiB", end="", flush=True)
                if args.max_bytes and downloaded >= args.max_bytes:
                    break
    except (urllib.error.URLError, TimeoutError) as exc:
        print(f"Error de descarga: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
    print()

    first_line = partial.open("r", encoding="utf-8-sig", errors="replace").readline()
    if "Transit Timestamp" not in first_line and "transit_timestamp" not in first_line:
        raise SystemExit("La respuesta no contiene el encabezado esperado del dataset.")

    complete = args.max_bytes is None
    if complete:
        partial.replace(output)
        final_path = output
    else:
        final_path = partial
    manifest = {
        "dataset_id": DATASET_ID,
        "official_record_count": OFFICIAL_RECORD_COUNT,
        "mode": "full" if complete else "full-partial-validation",
        "source_page": SOURCE_PAGE,
        "api_endpoint": FULL_EXPORT_URL,
        "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
        "bytes_downloaded": downloaded,
        "sha256": digest.hexdigest(),
        "output": str(final_path),
        "complete": complete,
    }
    write_manifest(args.manifest, manifest)
    print(f"Archivo: {final_path}")
    print(f"SHA-256: {digest.hexdigest()}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("sample", "full"), default="sample")
    parser.add_argument("--sample-rows", type=int, default=10_000)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--manifest", type=Path, default=Path("data/raw/source_manifest.json"))
    parser.add_argument("--timeout", type=int, default=180)
    parser.add_argument(
        "--max-bytes",
        type=int,
        help="Solo para validar el modo full sin descargar todo; conserva .partial.",
    )
    args = parser.parse_args()
    if args.mode == "sample":
        sample_mode(args)
    else:
        full_mode(args)


if __name__ == "__main__":
    main()
