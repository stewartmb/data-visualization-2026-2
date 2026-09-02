#!/usr/bin/env python3
"""Evalua la calidad de una muestra MTA y escribe metricas auditables."""

from __future__ import annotations

import argparse
import csv
from collections import Counter
from datetime import datetime
from pathlib import Path

FIELDS = [
    "transit_timestamp", "transit_mode", "station_complex_id", "station_complex",
    "borough", "payment_method", "fare_class_category", "ridership", "transfers",
    "latitude", "longitude", "georeference",
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=Path("data/sample/mta_subway_hourly_2020_2024_sample.csv"))
    parser.add_argument("--output", type=Path, default=Path("docs/data_quality_metrics.csv"))
    args = parser.parse_args()
    nulls = Counter()
    domains = {name: Counter() for name in ("transit_mode", "borough", "payment_method", "fare_class_category")}
    keys = Counter()
    metrics = Counter()
    ridership_values: list[float] = []
    transfer_values: list[float] = []
    timestamps: list[datetime] = []

    with args.input.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != FIELDS:
            raise SystemExit(f"Esquema inesperado: {reader.fieldnames}")
        for row in reader:
            metrics["total_rows"] += 1
            for field in FIELDS:
                if row[field] == "":
                    nulls[field] += 1
            for field in domains:
                domains[field][row[field]] += 1
            try:
                ts = datetime.fromisoformat(row["transit_timestamp"].replace("Z", "+00:00"))
                timestamps.append(ts)
                if ts.year not in range(2020, 2025):
                    metrics["timestamps_outside_2020_2024"] += 1
                if ts.minute or ts.second or ts.microsecond:
                    metrics["timestamps_not_rounded_to_hour"] += 1
            except ValueError:
                metrics["invalid_timestamp_type"] += 1
                continue
            try:
                ridership = float(row["ridership"])
                transfers = float(row["transfers"])
                latitude = float(row["latitude"])
                longitude = float(row["longitude"])
            except ValueError:
                metrics["invalid_numeric_type"] += 1
                continue
            ridership_values.append(ridership)
            transfer_values.append(transfers)
            if ridership < 0: metrics["negative_ridership"] += 1
            if transfers < 0: metrics["negative_transfers"] += 1
            if transfers > ridership: metrics["transfers_gt_ridership"] += 1
            if ridership == 0: metrics["zero_ridership"] += 1
            if not (40.4 <= latitude <= 41.0 and -74.3 <= longitude <= -73.6):
                metrics["invalid_coordinates"] += 1
            key = (
                row["transit_timestamp"], row["transit_mode"], row["station_complex_id"],
                row["payment_method"], row["fare_class_category"],
            )
            keys[key] += 1

    metrics["duplicate_composite_key_rows"] = sum(value - 1 for value in keys.values() if value > 1)
    output_rows = []
    total = metrics["total_rows"]
    for name in [
        "total_rows", "duplicate_composite_key_rows", "timestamps_outside_2020_2024",
        "timestamps_not_rounded_to_hour", "invalid_timestamp_type", "invalid_numeric_type",
        "negative_ridership", "negative_transfers", "transfers_gt_ridership", "zero_ridership",
        "invalid_coordinates",
    ]:
        value = metrics[name]
        output_rows.append((name, value, value / total if total else 0, "sample"))
    for field in FIELDS:
        value = nulls[field]
        output_rows.append((f"missing_{field}", value, value / total if total else 0, "sample"))
    if timestamps:
        output_rows.extend([
            ("min_timestamp", min(timestamps).isoformat(), "", "sample"),
            ("max_timestamp", max(timestamps).isoformat(), "", "sample"),
        ])
    if ridership_values:
        output_rows.extend([
            ("min_ridership", min(ridership_values), "", "sample"),
            ("max_ridership", max(ridership_values), "", "sample"),
            ("min_transfers", min(transfer_values), "", "sample"),
            ("max_transfers", max(transfer_values), "", "sample"),
        ])
    for field, counts in domains.items():
        output_rows.append((f"domain_{field}", "; ".join(f"{k}={v}" for k, v in sorted(counts.items())), "", "sample"))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["metric", "value", "percentage_of_sample", "scope"])
        writer.writerows(output_rows)
    print(f"Metricas: {args.output} ({len(output_rows)} indicadores)")


if __name__ == "__main__":
    main()

