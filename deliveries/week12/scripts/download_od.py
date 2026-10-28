#!/usr/bin/env python3
"""Descarga reproducible del dataset MTA Subway Origin-Destination Ridership
Estimate (Open NY), un dataset por anio, usando la API Socrata (SODA).

Es la estimacion oficial de la MTA de pares origen -> destino (complejo a
complejo) por mes x dia de la semana x hora de entrada, promedio mensual.
Se calcula con encadenamiento de viajes sobre los toques individuales
(Barry et al., 2002), a los que no tenemos acceso; por eso se consume el
resultado y no se recalcula.

Por defecto baja solo enero y febrero (el periodo del atlas) de 2021 a 2024.
Cada parte es un (anio, mes, hora de entrada): ~0.5-1.2 M filas, gzip; si la
descarga se corta, las partes completas se saltan al volver a correr.

Uso:
    export SOCRATA_APP_TOKEN=xxxx            # o en .env
    python3 scripts/acquisition/download_od.py                 # ene-feb 2021-2024
    python3 scripts/acquisition/download_od.py --anios 2023 2024 --meses 1 2 3
    python3 scripts/acquisition/download_od.py --meses all     # todo el anio (pesado)
    python3 scripts/acquisition/download_od.py --parquet       # ademas, un Parquet por anio (requiere duckdb)

Salida:
    data/raw/od/parts/YYYY-MM-hHH.csv.gz
    data/raw/od/parquet/od_YYYY.parquet      (solo con --parquet)
    data/raw/od/od.manifest.json
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
from datetime import datetime, timezone
from pathlib import Path

DATASETS = {          # un dataset por anio en data.ny.gov
    2021: "rapa-97zv",
    2022: "nqnz-e9z9",
    2023: "uhf3-t34z",
    2024: "jsu2-fbtj",
    2025: "y2qv-fytt",
}
# Campos que esperamos (nombres de API). El script verifica contra el esquema
# real del dataset antes de bajar nada y, si difiere, lo imprime y se detiene.
FIELDS = [
    "year", "month", "day_of_week", "hour_of_day",
    "origin_station_complex_id", "origin_station_complex_name",
    "origin_latitude", "origin_longitude",
    "destination_station_complex_id", "destination_station_complex_name",
    "destination_latitude", "destination_longitude",
    "estimated_average_ridership",
]
ORDER = "day_of_week,origin_station_complex_id,destination_station_complex_id"
PAGE = 200_000


def token() -> str:
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
    h = {"User-Agent": "data-visualization-2026-2/od-download"}
    if token():
        h["X-App-Token"] = token()
    return h


def get(url: str, timeout: int, reintentos: int = 6) -> str:
    espera = 3.0
    for intento in range(1, reintentos + 1):
        try:
            req = urllib.request.Request(url, headers=headers())
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read().decode("utf-8-sig")
        except urllib.error.HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504) or intento == reintentos:
                raise
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError):
            if intento == reintentos:
                raise
        time.sleep(espera)
        espera = min(espera * 2, 60)
    raise RuntimeError("inalcanzable")


def esquema(ds: str, timeout: int) -> list[str]:
    meta = json.loads(get(f"https://data.ny.gov/api/views/{ds}.json", timeout))
    return [c["fieldName"] for c in meta["columns"] if not c["fieldName"].startswith(":")]


def filas_parte(ds: str, mes: int, hora: int, timeout: int) -> list[list[str]]:
    where = f"month = {mes} AND hour_of_day = {hora}"
    filas: list[list[str]] = []
    offset = 0
    while True:
        params = {"$select": ",".join(FIELDS), "$where": where, "$order": ORDER,
                  "$limit": str(PAGE), "$offset": str(offset)}
        texto = get(f"https://data.ny.gov/resource/{ds}.csv?" + urllib.parse.urlencode(params), timeout)
        lector = csv.reader(io.StringIO(texto))
        cab = next(lector, None)
        if cab is None:
            break
        if [c.strip() for c in cab] != FIELDS:
            raise RuntimeError(f"encabezado inesperado {cab}")
        pagina = list(lector)
        filas.extend(pagina)
        if len(pagina) < PAGE:
            break
        offset += PAGE
    return filas


def descargar_parte(anio: int, mes: int, hora: int, carpeta: Path, timeout: int) -> tuple[str, int, bool]:
    nombre = f"{anio}-{mes:02d}-h{hora:02d}"
    destino = carpeta / f"{nombre}.csv.gz"
    if destino.exists():
        with gzip.open(destino, "rt", encoding="utf-8", newline="") as fh:
            return nombre, sum(1 for _ in fh) - 1, False
    filas = filas_parte(DATASETS[anio], mes, hora, timeout)
    parcial = destino.with_suffix(".gz.partial")
    with gzip.open(parcial, "wt", encoding="utf-8", newline="", compresslevel=6) as fh:
        w = csv.writer(fh)
        w.writerow(FIELDS)
        w.writerows(filas)
    parcial.replace(destino)
    return nombre, len(filas), True


def a_parquet(parts: Path, salida: Path, anios: list[int]) -> None:
    import duckdb  # opcional
    salida.mkdir(parents=True, exist_ok=True)
    for y in anios:
        patron = str(parts / f"{y}-*.csv.gz")
        out = salida / f"od_{y}.parquet"
        duckdb.sql(f"""
            COPY (
              SELECT CAST(year AS SMALLINT) AS year, CAST(month AS TINYINT) AS month,
                     day_of_week, CAST(hour_of_day AS TINYINT) AS hour,
                     CAST(origin_station_complex_id AS VARCHAR) AS origin_id,
                     origin_station_complex_name AS origin_name,
                     CAST(origin_latitude AS DOUBLE) AS origin_lat, CAST(origin_longitude AS DOUBLE) AS origin_lon,
                     CAST(destination_station_complex_id AS VARCHAR) AS destination_id,
                     destination_station_complex_name AS destination_name,
                     CAST(destination_latitude AS DOUBLE) AS destination_lat, CAST(destination_longitude AS DOUBLE) AS destination_lon,
                     CAST(estimated_average_ridership AS DOUBLE) AS ridership
              FROM read_csv('{patron}', header=true, all_varchar=true)
            ) TO '{out}' (FORMAT PARQUET, COMPRESSION ZSTD)
        """)
        n = duckdb.sql(f"SELECT count(*) FROM '{out}'").fetchone()[0]
        print(f"  {out}  {n:,} filas")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--anios", type=int, nargs="+", default=[2021, 2022, 2023, 2024], choices=sorted(DATASETS))
    p.add_argument("--meses", nargs="+", default=["1", "2"], help="numeros de mes, o 'all'")
    p.add_argument("--salida", type=Path, default=Path("data/raw/od"))
    p.add_argument("--workers", type=int, default=3)
    p.add_argument("--timeout", type=int, default=300)
    p.add_argument("--parquet", action="store_true", help="convertir a un Parquet por anio (pip install duckdb)")
    a = p.parse_args()
    meses = list(range(1, 13)) if a.meses == ["all"] else [int(m) for m in a.meses]

    if not token():
        print("AVISO: sin SOCRATA_APP_TOKEN la API limita las peticiones; usa --workers 1.", file=sys.stderr)

    # Verificar el esquema real antes de bajar nada
    for y in a.anios:
        reales = esquema(DATASETS[y], a.timeout)
        faltan = [f for f in FIELDS if f not in reales]
        if faltan:
            print(f"{y} ({DATASETS[y]}): faltan campos {faltan}.\nCampos reales: {reales}", file=sys.stderr)
            raise SystemExit(2)

    parts = a.salida / "parts"
    parts.mkdir(parents=True, exist_ok=True)
    tareas = [(y, m, h) for y in a.anios for m in meses for h in range(24)]
    print(f"{len(tareas)} partes (anio x mes x hora)  ->  {parts}", flush=True)

    t0 = time.time()
    conteo: dict[str, int] = {}
    errores: list[str] = []
    with ThreadPoolExecutor(max_workers=max(1, a.workers)) as ex:
        futs = {ex.submit(descargar_parte, y, m, h, parts, a.timeout): (y, m, h) for y, m, h in tareas}
        for i, f in enumerate(as_completed(futs), 1):
            try:
                nombre, n, nuevo = f.result()
                conteo[nombre] = n
                print(f"[{i}/{len(tareas)}] {nombre}  {n:>9,} filas  {'nuevo' if nuevo else 'ya estaba'}  ({time.time()-t0:,.0f}s)", flush=True)
            except Exception as exc:
                errores.append(f"{futs[f]}: {exc}")
                print(f"ERROR {futs[f]}: {exc}", file=sys.stderr, flush=True)
    if errores:
        print(f"\n{len(errores)} partes fallaron; vuelve a correr y se reintentan solo esas.", file=sys.stderr)
        raise SystemExit(1)

    total = sum(conteo.values())
    sha = hashlib.sha256()
    for nombre in sorted(conteo):
        sha.update((parts / f"{nombre}.csv.gz").read_bytes())
    man = {
        "datasets": {str(y): DATASETS[y] for y in a.anios},
        "fields": FIELDS, "order": ORDER, "page_size": PAGE,
        "anios": a.anios, "meses": meses, "partes": len(conteo), "filas_totales": total,
        "filas_por_parte": dict(sorted(conteo.items())), "parts_sha256": sha.hexdigest(),
        "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
        "metodo_fuente": "Estimacion de la MTA por encadenamiento de viajes (destino = siguiente toque de la misma tarjeta; ~80 % enlazado, resto imputado); promedio mensual por par y hora de entrada.",
    }
    print(f"\nListo: {len(conteo)} partes, {total:,} filas")
    if a.parquet:
        print("Convirtiendo a Parquet ...", flush=True)
        a_parquet(parts, a.salida / "parquet", a.anios)
    (a.salida / "od.manifest.json").write_text(json.dumps(man, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Manifiesto: {a.salida / 'od.manifest.json'}")


if __name__ == "__main__":
    main()
