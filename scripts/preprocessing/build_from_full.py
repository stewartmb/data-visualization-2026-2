#!/usr/bin/env python3
"""Reconstruye todas las tablas procesadas del proyecto a partir de la descarga
COMPLETA local (data/raw/parts/*.csv.gz, generada por download_full.py), con
DuckDB, sin pasar por la API.

Produce exactamente los mismos archivos y esquemas que antes se obtenian con
consultas agregadas a Socrata (week06/build_aggregates.py) y el insumo del atlas
(data/redesign/jan_feb_hourly_2020_2024.csv), mas uno opcional para build_model:

    stations_coords.csv                        id, nombre, borough, modo, lat, lon
    ridership_by_station_day.csv               id, dia, ridership, transfers
    ridership_by_station_hourofweek_year.csv   id, year, dow, hora, ridership
    prepandemia_station_hourofweek.csv         id, dow, hora, ridership   (ene-feb 2020)
    hourofweek_2024_enefeb.csv                 id, dow, hora, ridership   (ene-feb 2024)
    ridership_by_month_borough_payment_fare.csv
    station_profiles_normalized.csv            share por (id, year, dow, hora), grilla 168
    prepandemia_profiles_normalized.csv        share por (id, dow, hora), grilla 168
    station_ids_by_year.csv                    estaciones presentes en 4 ventanas/ano
    jan_feb_hourly_2020_2024.csv               id, year, dow, hour, ridership (ene-feb, 5 anos)

Convencion: dow con domingo = 0 (igual que date_extract_dow de Socrata).

Paso 1 (una sola vez, ~minutos): convierte las partes a Parquet, un archivo por mes
(data/raw/parquet/YYYY-MM.parquet); si se corta, al volver a correr sigue donde quedo.
Paso 2 (segundos): agrega desde el Parquet.

Uso:
    pip3 install duckdb
    python3 scripts/preprocessing/build_from_full.py                  # todo
    python3 scripts/preprocessing/build_from_full.py --solo-parquet   # solo paso 1
    python3 scripts/preprocessing/build_from_full.py --salida data/processed/full

Despues:
    python3 app/code/build_model.py data/processed/full app/data/model.json
    python3 scripts/redesign/build_atlas.py   (lee jan_feb_hourly_2020_2024.csv)
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
PARTS = ROOT / "data/raw/parts"
PARQUET = ROOT / "data/raw/parquet"          # un archivo por mes
SALIDA = ROOT / "data/processed/full"
ANCLAS = [(2, 15), (5, 15), (8, 15), (11, 15)]     # inicio de las 4 ventanas de 7 dias por ano
YEARS = list(range(2020, 2025))


def log(msg: str, t0: float) -> None:
    print(f"[{time.time() - t0:6.0f}s] {msg}", flush=True)


def a_parquet(con: duckdb.DuckDBPyConnection, t0: float, forzar: bool) -> None:
    """Convierte las partes diarias a un Parquet por mes (acota memoria; reanudable)."""
    PARQUET.mkdir(parents=True, exist_ok=True)
    archivos = sorted(PARTS.glob("*.csv.gz"))
    if not archivos:
        raise SystemExit(f"No hay partes en {PARTS}; corre primero download_full.py")
    meses = sorted({f.name[:7] for f in archivos})
    pendientes = [m for m in meses if forzar or not (PARQUET / f"{m}.parquet").exists()]
    log(f"{len(archivos)} partes, {len(meses)} meses; {len(pendientes)} por convertir a Parquet", t0)
    for m in pendientes:
        destino = PARQUET / f"{m}.parquet"
        tmp = destino.with_suffix(".parquet.partial")
        con.execute(f"""
            COPY (
                SELECT CAST(transit_timestamp AS TIMESTAMP)      AS ts,
                       station_complex_id,
                       transit_mode, station_complex, borough,
                       payment_method, fare_class_category,
                       CAST(ridership AS DOUBLE)                 AS ridership,
                       CAST(transfers AS DOUBLE)                 AS transfers,
                       CAST(latitude AS DOUBLE)                  AS latitude,
                       CAST(longitude AS DOUBLE)                 AS longitude
                FROM read_csv('{PARTS}/{m}-*.csv.gz', header=true, all_varchar=true, filename=false)
            ) TO '{tmp}' (FORMAT PARQUET, COMPRESSION ZSTD, ROW_GROUP_SIZE 500000)
        """)
        tmp.replace(destino)
        log(f"  {m}  ->  {destino.name}  {destino.stat().st_size / 2**20:,.0f} MiB", t0)
    n = con.execute(f"SELECT count(*) FROM '{PARQUET}/*.parquet'").fetchone()[0]
    log(f"Parquet listo: {len(meses)} meses, {n:,} filas", t0)


def exportar(con: duckdb.DuckDBPyConnection, nombre: str, sql: str, salida: Path, t0: float) -> None:
    destino = salida / nombre
    con.execute(f"COPY ({sql}) TO '{destino}' (FORMAT CSV, HEADER)")
    n = con.execute(f"SELECT count(*) FROM read_csv('{destino}', header=true)").fetchone()[0]
    log(f"{nombre:<45} {n:>9,} filas", t0)


def agregar(con: duckdb.DuckDBPyConnection, salida: Path, t0: float) -> None:
    salida.mkdir(parents=True, exist_ok=True)
    con.execute(f"CREATE OR REPLACE VIEW d AS SELECT * FROM '{PARQUET}/*.parquet'")
    # dow con domingo = 0, como Socrata.
    con.execute("""
        CREATE OR REPLACE VIEW h AS
        SELECT station_complex_id, year(ts) AS year, month(ts) AS month,
               dayofweek(ts) AS dow, hour(ts) AS hora, ridership
        FROM d
    """)

    exportar(con, "stations_coords.csv", """
        SELECT station_complex_id, station_complex, borough, transit_mode,
               printf('%.6f', latitude) AS latitude, printf('%.6f', longitude) AS longitude
        FROM (
            SELECT *, row_number() OVER (PARTITION BY station_complex_id ORDER BY n DESC, ult DESC) AS rn
            FROM (
                SELECT station_complex_id, station_complex, borough, transit_mode, latitude, longitude,
                       count(*) AS n, max(ts) AS ult
                FROM d GROUP BY ALL
            )
        ) WHERE rn = 1 ORDER BY station_complex_id
    """, salida, t0)

    exportar(con, "ridership_by_station_day.csv", """
        SELECT station_complex_id, strftime(ts, '%Y-%m-%d') AS dia,
               CAST(sum(ridership) AS BIGINT) AS ridership, CAST(sum(transfers) AS BIGINT) AS transfers
        FROM d GROUP BY ALL ORDER BY station_complex_id, dia
    """, salida, t0)

    exportar(con, "ridership_by_station_hourofweek_year.csv", """
        SELECT station_complex_id, year, dow, hora, CAST(sum(ridership) AS BIGINT) AS ridership
        FROM h GROUP BY ALL ORDER BY station_complex_id, year, dow, hora
    """, salida, t0)

    for nombre, anio in (("prepandemia_station_hourofweek.csv", 2020), ("hourofweek_2024_enefeb.csv", 2024)):
        exportar(con, nombre, f"""
            SELECT station_complex_id, dow, hora, CAST(sum(ridership) AS BIGINT) AS ridership
            FROM h WHERE year = {anio} AND month IN (1, 2)
            GROUP BY ALL ORDER BY station_complex_id, dow, hora
        """, salida, t0)

    exportar(con, "ridership_by_month_borough_payment_fare.csv", """
        SELECT strftime(ts, '%Y-%m') AS mes, borough, payment_method, fare_class_category,
               CAST(sum(ridership) AS BIGINT) AS ridership
        FROM d GROUP BY ALL ORDER BY mes, borough, payment_method, fare_class_category
    """, salida, t0)

    # Perfiles normalizados: grilla completa 7x24 por (estacion, ano); celdas sin datos = 0.
    exportar(con, "station_profiles_normalized.csv", """
        WITH tot AS (SELECT station_complex_id, year, sum(ridership) AS total FROM h GROUP BY ALL),
             cel AS (SELECT station_complex_id, year, dow, hora, sum(ridership) AS v FROM h GROUP BY ALL),
             grid AS (SELECT t.station_complex_id, t.year, g.dow, g.hora, t.total
                      FROM tot t CROSS JOIN (SELECT d.dow, h.hora FROM range(7) d(dow), range(24) h(hora)) g
                      WHERE t.total > 0)
        SELECT g.station_complex_id, g.year, g.dow, g.hora,
               printf('%.8f', coalesce(c.v, 0) / g.total) AS share, CAST(g.total AS BIGINT) AS total_anual
        FROM grid g LEFT JOIN cel c USING (station_complex_id, year, dow, hora)
        ORDER BY g.station_complex_id, g.year, g.dow, g.hora
    """, salida, t0)

    exportar(con, "prepandemia_profiles_normalized.csv", """
        WITH p AS (SELECT * FROM h WHERE year = 2020 AND month IN (1, 2)),
             tot AS (SELECT station_complex_id, sum(ridership) AS total FROM p GROUP BY ALL),
             cel AS (SELECT station_complex_id, dow, hora, sum(ridership) AS v FROM p GROUP BY ALL),
             grid AS (SELECT t.station_complex_id, g.dow, g.hora, t.total
                      FROM tot t CROSS JOIN (SELECT d.dow, h.hora FROM range(7) d(dow), range(24) h(hora)) g
                      WHERE t.total > 0)
        SELECT g.station_complex_id, g.dow, g.hora,
               printf('%.8f', coalesce(c.v, 0) / g.total) AS share, CAST(g.total AS BIGINT) AS total_prepandemia
        FROM grid g LEFT JOIN cel c USING (station_complex_id, dow, hora)
        ORDER BY g.station_complex_id, g.dow, g.hora
    """, salida, t0)

    ventanas = " UNION ALL ".join(
        f"SELECT {y} AS year, DATE '{y}-{m:02d}-{d:02d}' AS ini" for y in YEARS for m, d in ANCLAS
    )
    exportar(con, "station_ids_by_year.csv", f"""
        WITH v AS ({ventanas})
        SELECT v.year, strftime(v.ini, '%Y-%m-%d') AS ventana_inicio, d.station_complex_id,
               any_value(d.station_complex) AS station_complex, any_value(d.borough) AS borough,
               count(*) AS n_registros_ventana
        FROM d JOIN v ON d.ts >= v.ini AND d.ts < v.ini + INTERVAL 7 DAY
        GROUP BY ALL ORDER BY v.year, ventana_inicio, d.station_complex_id
    """, salida, t0)

    exportar(con, "jan_feb_hourly_2020_2024.csv", """
        SELECT station_complex_id, year, dow, hora AS hour, CAST(sum(ridership) AS BIGINT) AS ridership
        FROM h WHERE month IN (1, 2)
        GROUP BY ALL ORDER BY station_complex_id, year, dow, hour
    """, salida, t0)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--salida", type=Path, default=SALIDA)
    p.add_argument("--solo-parquet", action="store_true")
    p.add_argument("--rehacer-parquet", action="store_true")
    p.add_argument("--memoria", default="4GB", help="limite de memoria de DuckDB")
    p.add_argument("--hilos", type=int, default=4)
    a = p.parse_args()

    t0 = time.time()
    con = duckdb.connect()
    con.execute(f"SET memory_limit='{a.memoria}'; SET threads={a.hilos}; SET preserve_insertion_order=false;")
    con.execute(f"SET temp_directory='{ROOT / 'data/raw/duckdb_tmp'}'")
    a_parquet(con, t0, a.rehacer_parquet)
    if a.solo_parquet:
        return
    agregar(con, a.salida, t0)
    log(f"Listo: tablas en {a.salida}", t0)


if __name__ == "__main__":
    main()
