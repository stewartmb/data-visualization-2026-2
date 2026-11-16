#!/usr/bin/env python3
"""Aggregate validated MTA OD estimates by month, origin, weekday and hour."""
import gzip
import hashlib
import json
from pathlib import Path

import duckdb
import numpy as np

WEEK = Path(__file__).resolve().parents[1]
ROOT = WEEK.parents[1]
OUTPUT = WEEK / 'atlas/data/monthly-od'
DAYS = ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
YEARS = tuple(range(2021, 2026))


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def main():
    manifest_paths = [WEEK / 'data' / folder / 'validation.json'
                      for folder in ('od_2021_2024', 'od_2025_2026')]
    validated = {}
    for path in manifest_paths:
        report = json.loads(path.read_text())
        if report['status'] != 'PASS':
            raise ValueError(f'Adquisición sin validar: {path}')
        validated.update(report['months'])

    catalog = json.loads((WEEK / 'atlas/data/stations.json').read_text())
    ids = [station['id'] for station in catalog['stations']]
    con = duckdb.connect(config={'threads': 4, 'memory_limit': '512MB'})
    con.execute('CREATE TABLE nodes (id INTEGER PRIMARY KEY, idx INTEGER)')
    con.executemany('INSERT INTO nodes VALUES (?, ?)', [(int(id), i) for i, id in enumerate(ids)])
    con.execute('CREATE TABLE weekdays (name VARCHAR PRIMARY KEY, idx INTEGER)')
    con.executemany('INSERT INTO weekdays VALUES (?, ?)', list(zip(DAYS, range(7))))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    summary, previous = {}, None
    for year in YEARS:
        for month in range(1, 13):
            key = f'{year}-{month:02d}'
            source = validated[key]
            path = WEEK / source['parquet_file']
            if digest(path) != source['parquet_sha256']:
                raise ValueError(f'SHA-256 distinto al validado: {path}')
            rows = con.execute("""
                SELECT o.idx AS origin, w.idx * 24 + p.hour_of_day AS slot,
                       SUM(p.estimated_average_ridership)::DOUBLE AS starts
                FROM read_parquet(?) p
                JOIN nodes o ON o.id = p.origin_station_complex_id
                JOIN nodes d ON d.id = p.destination_station_complex_id
                JOIN weekdays w ON w.name = p.day_of_week
                GROUP BY 1, 2
                """, [str(path)]).fetchnumpy()
            totals = np.zeros((len(ids), 168), dtype='<f4')
            totals[rows['origin'], rows['slot']] = rows['starts']
            if not np.isfinite(totals).all() or (totals < 0).any() or not totals.any():
                raise ValueError(f'Totales OD fuera de rango: {key}')
            file = OUTPUT / f'{key}.f32.gz'
            file.write_bytes(gzip.compress(totals.tobytes(), compresslevel=6, mtime=0))
            month_meta = {'source_sha256': source['parquet_sha256'], 'sha256': digest(file)}
            if previous is not None:
                common = (totals.any(axis=1) & previous.any(axis=1))
                a = previous[common].sum(axis=0, dtype=np.float64)
                b = totals[common].sum(axis=0, dtype=np.float64)
                delta = b - a
                peak = int(np.argmax(np.abs(delta)))
                month_meta.update(peak=peak, delta=round(float(delta[peak]), 2),
                                  comparable_origins=int(common.sum()))
            summary[key] = month_meta
            previous = totals
        print(f'{year}: 12 meses OD agregados y validados.', flush=True)

    index = {'years': YEARS, 'stations': ids, 'slots': 168,
             'months': summary, 'encoding': 'float32 little-endian, station × weekday (Monday first) × hour; gzip',
             'measure': 'Estimated average trips starting at an origin toward modeled subway complexes',
             'sources': {str(path.relative_to(WEEK)): digest(path) for path in manifest_paths}}
    (OUTPUT / 'index.json').write_text(json.dumps(index, separators=(',', ':'))+'\n')
    mirror = ROOT / 'atlas/data/monthly-od'
    mirror.mkdir(parents=True, exist_ok=True)
    for path in OUTPUT.iterdir():
        (mirror / path.name).write_bytes(path.read_bytes())


if __name__ == '__main__':
    main()
