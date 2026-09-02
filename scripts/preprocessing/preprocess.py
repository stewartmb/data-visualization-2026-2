#!/usr/bin/env python3
"""Enriquece la muestra MTA y genera un resumen listo para visualizar."""

from __future__ import annotations

import argparse
import csv
from collections import defaultdict
from datetime import datetime
from pathlib import Path

WEEKDAYS_ES = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]
CORE_FIELDS = [
    "transit_timestamp", "transit_mode", "station_complex_id", "station_complex",
    "borough", "payment_method", "fare_class_category", "ridership", "transfers",
    "latitude", "longitude", "georeference",
]
DERIVED_FIELDS = [
    "year", "quarter", "month", "date", "hour", "weekday_number", "weekday_name_es",
    "is_weekend", "transfer_share", "quality_negative_ridership",
    "quality_negative_transfers", "quality_transfers_gt_ridership",
    "quality_invalid_coordinates",
]


def parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def as_float(value: str) -> float:
    return float(value) if value not in ("", None) else 0.0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=Path("data/sample/mta_subway_hourly_2020_2024_sample.csv"))
    parser.add_argument("--output", type=Path, default=Path("data/processed/mta_subway_hourly_2020_2024_processed_sample.csv"))
    parser.add_argument("--summary", type=Path, default=Path("data/processed/ridership_summary.csv"))
    args = parser.parse_args()
    if not args.input.exists():
        raise SystemExit(f"No existe: {args.input}")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    summary = defaultdict(lambda: {"records": 0, "ridership": 0.0, "transfers": 0.0, "stations": set()})

    with args.input.open(encoding="utf-8-sig", newline="") as source, args.output.open("w", encoding="utf-8", newline="") as target:
        reader = csv.DictReader(source)
        if reader.fieldnames != CORE_FIELDS:
            raise SystemExit(f"Esquema inesperado: {reader.fieldnames}")
        writer = csv.DictWriter(target, fieldnames=CORE_FIELDS + DERIVED_FIELDS)
        writer.writeheader()
        count = 0
        for row in reader:
            ts = parse_timestamp(row["transit_timestamp"])
            ridership = as_float(row["ridership"])
            transfers = as_float(row["transfers"])
            latitude = as_float(row["latitude"])
            longitude = as_float(row["longitude"])
            quarter = (ts.month - 1) // 3 + 1
            invalid_coordinates = not (40.4 <= latitude <= 41.0 and -74.3 <= longitude <= -73.6)
            enriched = dict(row)
            enriched.update({
                "year": ts.year,
                "quarter": quarter,
                "month": ts.month,
                "date": ts.date().isoformat(),
                "hour": ts.hour,
                "weekday_number": ts.weekday() + 1,
                "weekday_name_es": WEEKDAYS_ES[ts.weekday()],
                "is_weekend": "Y" if ts.weekday() >= 5 else "N",
                "transfer_share": round(transfers / ridership, 6) if ridership > 0 else "",
                "quality_negative_ridership": "Y" if ridership < 0 else "N",
                "quality_negative_transfers": "Y" if transfers < 0 else "N",
                "quality_transfers_gt_ridership": "Y" if transfers > ridership else "N",
                "quality_invalid_coordinates": "Y" if invalid_coordinates else "N",
            })
            writer.writerow(enriched)
            key = (ts.year, quarter, ts.month, ts.hour, row["transit_mode"], row["borough"], row["payment_method"])
            bucket = summary[key]
            bucket["records"] += 1
            bucket["ridership"] += ridership
            bucket["transfers"] += transfers
            bucket["stations"].add(row["station_complex_id"])
            count += 1

    summary_fields = [
        "year", "quarter", "month", "hour", "transit_mode", "borough", "payment_method",
        "records", "station_complexes", "ridership", "transfers", "transfer_share",
    ]
    with args.summary.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=summary_fields)
        writer.writeheader()
        for key in sorted(summary):
            year, quarter, month, hour, mode, borough, payment = key
            bucket = summary[key]
            writer.writerow({
                "year": year, "quarter": quarter, "month": month, "hour": hour,
                "transit_mode": mode, "borough": borough, "payment_method": payment,
                "records": bucket["records"], "station_complexes": len(bucket["stations"]),
                "ridership": round(bucket["ridership"], 3),
                "transfers": round(bucket["transfers"], 3),
                "transfer_share": round(bucket["transfers"] / bucket["ridership"], 6) if bucket["ridership"] else "",
            })
    print(f"Procesado: {args.output} ({count:,} filas)")
    print(f"Resumen: {args.summary} ({len(summary):,} filas)")


if __name__ == "__main__":
    main()

