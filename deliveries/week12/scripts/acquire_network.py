#!/usr/bin/env python3
"""Obtiene solo el snapshot GTFS de referencia, sin requerir datos de afluencia.

El servidor MTA distribuye un archivo cambiante. Se exige el SHA-256 del snapshot
documentado para no sustituirlo silenciosamente por una red de otra fecha.
"""
import argparse
import hashlib
import json
import time
import zipfile
from pathlib import Path
from urllib.request import Request, urlopen

P = Path(__file__).resolve().parents[1]


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def validate(path, expected):
    if digest(path) != expected:
        raise ValueError('El archivo no coincide con el snapshot de referencia. '
                         'El feed oficial puede haber cambiado; solicita el ZIP '
                         'documentado al equipo. No se reemplazará la red.')
    with zipfile.ZipFile(path) as archive:
        required = {'stops.txt', 'trips.txt', 'stop_times.txt', 'shapes.txt',
                    'routes.txt', 'transfers.txt', 'calendar.txt', 'feed_info.txt'}
        if not required <= set(archive.namelist()):
            raise ValueError('Faltan tablas GTFS requeridas.')
        if archive.testzip() is not None:
            raise ValueError('El ZIP tiene un archivo corrupto.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true',
                        help='Solo comprobar el archivo local; no descargar.')
    args = parser.parse_args()
    source = json.loads((P / 'data/network_reference/source.json').read_text())
    dest = P / source['file']
    if dest.exists():
        validate(dest, source['sha256'])
        print(f'PASS: snapshot local intacto, {dest.stat().st_size:,} bytes.')
        return
    if args.offline:
        raise SystemExit(f'Falta el archivo local: {dest}')
    dest.parent.mkdir(parents=True, exist_ok=True)
    partial = dest.with_suffix('.zip.partial')
    for attempt in range(4):
        try:
            request = Request(source['url'], headers={'User-Agent': 'UTEC-Fractal-Network/1.0'})
            with urlopen(request, timeout=90) as response, partial.open('wb') as handle:
                for block in iter(lambda: response.read(1024 * 1024), b''):
                    handle.write(block)
            break
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)
    validate(partial, source['sha256'])
    partial.replace(dest)
    print(f'PASS: snapshot oficial recibido, {dest.stat().st_size:,} bytes.')


if __name__ == '__main__':
    main()
