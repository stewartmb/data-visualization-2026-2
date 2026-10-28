#!/usr/bin/env python3
"""Descarga COMPLETA y reproducible del dataset MTA Subway Hourly Ridership
(Open NY, id wujg-7c2s) usando la API Socrata (SODA), un dia a la vez.

Por que por dias y no en un solo archivo:
  - el export oficial (rows.csv) pesa varios GB en un solo stream; si se corta
    hay que empezar de cero;
  - aqui cada dia se guarda como una parte independiente (CSV gzip), asi la
    descarga se puede interrumpir y retomar: las partes ya completas se saltan;
  - dentro de cada dia se pagina con $limit/$offset y orden estable, por lo que
    el resultado es determinista.

Uso basico (todo el periodo 2020-2024):
    export SOCRATA_APP_TOKEN=xxxx          # recomendado; sin token la API limita
    python3 scripts/acquisition/download_full.py

Opciones utiles:
    --desde 2020-01-01 --hasta 2020-03-01   # rango [desde, hasta)
    --workers 4                             # dias en paralelo (con token)
    --merge                                 # al final une todo en un solo CSV
    --salida data/raw                       # carpeta destino

Salida:
    data/raw/parts/YYYY-MM-DD.csv.gz        una parte por dia
    data/raw/mta_subway_hourly_full.csv     (solo con --merge)
    data/raw/mta_subway_hourly_full.manifest.json  resumen y huellas SHA-256

Solo usa la libreria estandar de Python (>= 3.9).
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

DATASET_ID = "wujg-7c2s"
RESOURCE_URL = f"https://data.ny.gov/resource/{DATASET_ID}.csv"
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
]
# Orden estable: con el mismo filtro siempre devuelve las filas en el mismo orden.
ORDER = "transit_timestamp,station_complex_id,transit_mode,payment_method,fare_class_category"
PAGE = 100_000          # filas por peticion (un dia tiene ~60-70 mil)
FECHA_INI = date(2020, 1, 1)
FECHA_FIN = date(2025, 1, 1)   # exclusivo


# --------------------------------------------------------------------------- red
def token() -> str:
    """Token desde SOCRATA_APP_TOKEN o desde un archivo .env en el cwd."""
    t = os.environ.get("SOCRATA_APP_TOKEN", "").strip()
    if t:
        return t
    env = Path(".env")
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.startswith("SOCRATA_APP_TOKEN="):
                return line.split("=", 1)[1].strip().strip("'\"")
    return ""


def headers() -> dict[str, str]:
    h = {"User-Agent": "data-visualization-2026-2/full-download"}
    t = token()
    if t:
        h["X-App-Token"] = t
    return h


def get(url: str, timeout: int, reintentos: int = 6) -> str:
    espera = 3.0
    for intento in range(1, reintentos + 1):
        try:
            req = urllib.request.Request(url, headers=headers())
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read().decode("utf-8-sig")
        except urllib.error.HTTPError as exc:
            # 4xx que no sea 429 no se arregla reintentando
            if exc.code not in (429, 500, 502, 503, 504) or intento == reintentos:
                raise
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError):
            if intento == reintentos:
                raise
        time.sleep(espera)
        espera = min(espera * 2, 60)
    raise RuntimeError("inalcanzable")


# ----------------------------------------------------------------------- un dia
def filas_del_dia(d: date, timeout: int) -> list[list[str]]:
    ini = f"{d:%Y-%m-%d}T00:00:00"
    fin = f"{d + timedelta(days=1):%Y-%m-%d}T00:00:00"
    where = f"transit_timestamp >= '{ini}' AND transit_timestamp < '{fin}'"
    filas: list[list[str]] = []
    offset = 0
    while True:
        params = {
            "$select": ",".join(FIELDS),
            "$where": where,
            "$order": ORDER,
            "$limit": str(PAGE),
            "$offset": str(offset),
        }
        texto = get(RESOURCE_URL + "?" + urllib.parse.urlencode(params), timeout)
        lector = csv.reader(io.StringIO(texto))
        cab = next(lector, None)
        if cab is None:
            break
        if [c.strip() for c in cab] != FIELDS:
            raise RuntimeError(f"{d}: encabezado inesperado {cab}")
        pagina = list(lector)
        filas.extend(pagina)
        if len(pagina) < PAGE:
            break
        offset += PAGE
    return filas


def descargar_dia(d: date, carpeta: Path, timeout: int) -> tuple[date, int, bool]:
    """Devuelve (dia, filas, descargado_ahora)."""
    destino = carpeta / f"{d:%Y-%m-%d}.csv.gz"
    if destino.exists():
        with gzip.open(destino, "rt", encoding="utf-8", newline="") as fh:
            n = sum(1 for _ in fh) - 1
        return d, n, False
    filas = filas_del_dia(d, timeout)
    parcial = destino.with_suffix(".gz.partial")
    with gzip.open(parcial, "wt", encoding="utf-8", newline="", compresslevel=6) as fh:
        w = csv.writer(fh)
        w.writerow(FIELDS)
        w.writerows(filas)
    parcial.replace(destino)        # atomico: nunca queda una parte a medias
    return d, len(filas), True


# ----------------------------------------------------------------------- merge
def unir(carpeta_parts: Path, salida: Path, dias: list[date]) -> tuple[int, str]:
    sha = hashlib.sha256()
    total = 0
    with salida.open("w", encoding="utf-8", newline="") as out:
        out.write(",".join(FIELDS) + "\n")
        sha.update((",".join(FIELDS) + "\n").encode())
        for d in dias:
            with gzip.open(carpeta_parts / f"{d:%Y-%m-%d}.csv.gz", "rt", encoding="utf-8", newline="") as fh:
                next(fh)  # cabecera
                for linea in fh:
                    out.write(linea)
                    sha.update(linea.encode())
                    total += 1
    return total, sha.hexdigest()


# ------------------------------------------------------------------------ main
def rango(desde: date, hasta: date) -> list[date]:
    out, cur = [], desde
    while cur < hasta:
        out.append(cur)
        cur += timedelta(days=1)
    return out


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--desde", type=date.fromisoformat, default=FECHA_INI)
    p.add_argument("--hasta", type=date.fromisoformat, default=FECHA_FIN, help="exclusivo")
    p.add_argument("--salida", type=Path, default=Path("data/raw"))
    p.add_argument("--workers", type=int, default=2)
    p.add_argument("--timeout", type=int, default=300)
    p.add_argument("--merge", action="store_true", help="unir todas las partes en un CSV")
    a = p.parse_args()

    if not token():
        print("AVISO: sin SOCRATA_APP_TOKEN la API limita las peticiones; usa --workers 1.", file=sys.stderr)

    parts = a.salida / "parts"
    parts.mkdir(parents=True, exist_ok=True)
    dias = rango(a.desde, a.hasta)
    print(f"{len(dias)} dias  [{dias[0]} .. {dias[-1]}]  ->  {parts}", flush=True)

    t0 = time.time()
    conteo: dict[str, int] = {}
    errores: list[str] = []
    hechos = 0
    with ThreadPoolExecutor(max_workers=max(1, a.workers)) as ex:
        futs = {ex.submit(descargar_dia, d, parts, a.timeout): d for d in dias}
        for f in as_completed(futs):
            d = futs[f]
            try:
                _, n, nuevo = f.result()
                conteo[d.isoformat()] = n
                hechos += 1
                if nuevo or hechos % 50 == 0:
                    print(f"[{hechos}/{len(dias)}] {d}  {n:>7,} filas  {'nuevo' if nuevo else 'ya estaba'}  ({time.time()-t0:,.0f}s)", flush=True)
            except Exception as exc:
                errores.append(f"{d}: {exc}")
                print(f"ERROR {d}: {exc}", file=sys.stderr, flush=True)

    if errores:
        print(f"\n{len(errores)} dias fallaron; vuelve a correr el script y se reintentan solo esos:", file=sys.stderr)
        for e in errores:
            print("  " + e, file=sys.stderr)
        raise SystemExit(1)

    total = sum(conteo.values())
    manifiesto = {
        "dataset_id": DATASET_ID,
        "source_page": SOURCE_PAGE,
        "api_endpoint": RESOURCE_URL,
        "fields": FIELDS,
        "order": ORDER,
        "page_size": PAGE,
        "desde": a.desde.isoformat(),
        "hasta_exclusivo": a.hasta.isoformat(),
        "dias": len(dias),
        "filas_totales": total,
        "filas_por_dia": conteo,
        "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
    }
    print(f"\nListo: {len(dias)} dias, {total:,} filas en {parts}")

    if a.merge:
        salida = a.salida / "mta_subway_hourly_full.csv"
        print(f"Uniendo en {salida} ...", flush=True)
        n, sha = unir(parts, salida, dias)
        manifiesto.update({"merged_csv": str(salida), "merged_rows": n, "merged_sha256": sha})
        print(f"CSV unido: {n:,} filas  SHA-256 {sha}")

    man = a.salida / "mta_subway_hourly_full.manifest.json"
    man.write_text(json.dumps(manifiesto, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Manifiesto: {man}")


if __name__ == "__main__":
    main()
