#!/usr/bin/env python3
"""Derive average daily OD matrices and map volumes from validated hourly files."""
import argparse
import calendar
import gzip
import hashlib
import json
from datetime import date, timedelta
from pathlib import Path

import numpy as np


def prepare_annual_od(data_dir, frame_dir=None):
    frame_dir = frame_dir or data_dir / "raeb"
    flows_path = data_dir / "flows.json"
    flows = json.loads(flows_path.read_bytes())
    manifest_path = data_dir / "raeb/manifest.json"
    manifest = json.loads(manifest_path.read_bytes())
    if manifest["status"] != "PASS":
        raise ValueError("La extracción OD debe estar validada.")
    n = len(flows["nodes"])
    summary = {"years": {}, "source": {"manifest_sha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest()}}
    peak = 0
    for year in flows["meta"]["years"]:
        year_key = str(year)
        if flows["meta"]["months_present"][year_key] != list(range(1, 13)):
            raise ValueError(f"{year} requiere doce meses para el resumen anual.")
        days = 365 + calendar.isleap(year)
        first = date(year, 1, 1)
        counts = np.bincount([(first + timedelta(days=i)).weekday() for i in range(days)], minlength=7)
        weights = counts / days
        matrix = np.zeros(n * n, dtype=np.float64)
        for day, weight in enumerate(weights):
            for hour in range(24):
                key = f"{year}/{day}-{hour:02d}"
                source = (frame_dir / f"{key}.f32.gz").read_bytes()
                if hashlib.sha256(source).hexdigest() != manifest["assets"][key]["sha256"]:
                    raise ValueError(f"El archivo OD {key} no coincide con el manifiesto.")
                counts_by_pair = np.frombuffer(gzip.decompress(source), dtype="<f4")
                matrix += weight * counts_by_pair.astype(np.float64)
        starts = np.asarray(flows["starts"][year_key]).sum(axis=2) @ weights
        incoming = weights @ np.asarray(flows["incoming"][year_key]).sum(axis=1)
        loads = weights @ np.asarray(flows["flows"][year_key]).sum(axis=1)
        peak = max(peak, *(loads[2*i] + loads[2*i+1] for i, link in enumerate(flows["links"]) if link["kind"] == "rail"))
        square = matrix.reshape(n, n)
        mapped_arrivals = square.sum(axis=0) - np.diag(square)
        if not np.allclose(mapped_arrivals, incoming, atol=0.2, rtol=1e-5):
            raise ValueError(f"Las llegadas agregadas de {year} no coinciden con la matriz.")
        filename = f"raeb/{year}/annual.f32.gz"
        binary = gzip.compress(matrix.astype("<f4").tobytes(), mtime=0)
        (data_dir / filename).write_bytes(binary)
        summary["years"][year_key] = {
            "day_counts": counts.tolist(),
            "frame_sha256": hashlib.sha256(binary).hexdigest(),
            "starts": starts.round(4).tolist(),
            "incoming": incoming.round(4).tolist(),
            "loads": loads.round(3).tolist(),
        }
        print(f"{year} · {days} días · {matrix.sum():,.1f} viajes OD mapeados por día", flush=True)
    summary["volume_limit"] = int(np.ceil(peak / 10_000) * 10_000)
    (data_dir / "annual-od.json").write_text(json.dumps(summary, separators=(",", ":"), allow_nan=False) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("data_dir", type=Path)
    prepare_annual_od(parser.parse_args().data_dir)
