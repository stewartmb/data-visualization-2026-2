#!/usr/bin/env python3
"""Procesa los 72 meses completos sin filtrar IDs ni reducirlos a enero–febrero.

python scripts/build_full_period.py (desde cualquier carpeta; requiere DuckDB).
Los Parquet de registros completos quedan fuera de Git. Se entregan tablas
derivadas por día, mes, tarifa y hora de semana, con cobertura explícita.
"""
import csv
import argparse
import calendar
import hashlib
import json
import time
from pathlib import Path

import duckdb

P=Path(__file__).resolve().parents[1]
D=P/'data/full_period';RAW=P/'data/raw/full_period';PARQUET=RAW/'parquet';OUT=D/'processed'
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
    return h.hexdigest()
def dump(path,obj):path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
def sqlpath(path):return str(path).replace("'","''")

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--cache-only',action='store_true');args=parser.parse_args()
    manifest=json.loads((D/'acquisition.json').read_text())
    if not args.cache_only and (manifest['status']!='COMPLETE' or manifest['months_validated']!=72):
        raise SystemExit('Adquisición incompleta: ejecutar acquire_full_period.py hasta COMPLETE.')
    PARQUET.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
    state_path=D/'parquet-conversion.json';state=json.loads(state_path.read_text()) if state_path.exists() else {}
    con=duckdb.connect(config={'memory_limit':'4GB','threads':4,'preserve_insertion_order':False})
    con.execute(f"SET temp_directory='{sqlpath(RAW/'duckdb_tmp')}'")
    for month,entry in manifest['months'].items():
        source=P/entry['file'];dest=PARQUET/f'{month}.parquet';previous=state.get(month)
        if dest.exists() and previous and previous['source_sha256']==entry['sha256'] and sha(dest)==previous['parquet_sha256']:
            continue
        if sha(source)!=entry['sha256']:raise ValueError(f'Raw modificado: {source}')
        temp=dest.with_suffix('.parquet.partial')
        con.execute(f"""COPY (SELECT CAST(transit_timestamp AS TIMESTAMP) AS transit_timestamp,
            transit_mode,station_complex_id,station_complex,borough,payment_method,fare_class_category,
            CAST(ridership AS DOUBLE) AS ridership,CAST(transfers AS DOUBLE) AS transfers,
            CAST(latitude AS DOUBLE) AS latitude,CAST(longitude AS DOUBLE) AS longitude,georeference,
            '{entry['expected']['dataset']}' AS source_dataset
            FROM read_csv('{sqlpath(source)}',header=true,all_varchar=true,compression='gzip'))
            TO '{sqlpath(temp)}' (FORMAT PARQUET,COMPRESSION ZSTD,ROW_GROUP_SIZE 500000)""")
        n=con.execute(f"SELECT count(*) FROM read_parquet('{sqlpath(temp)}')").fetchone()[0]
        if n!=entry['rows']:raise ValueError(f'Conversión perdió filas: {month}')
        temp.replace(dest);state[month]={'source_sha256':entry['sha256'],'parquet_sha256':sha(dest),'rows':n}
        dump(state_path,state);print(f'{month}: {n:,} filas convertidas sin descartar columnas',flush=True)
    if args.cache_only:
        con.close();print(f'Cache parcial: {len(state)}/72 meses convertidos; no se declara completa la serie.',flush=True);return
    con.execute(f"CREATE VIEW d AS SELECT * FROM read_parquet('{sqlpath(PARQUET)}/*.parquet')")
    total=con.execute('SELECT count(*) FROM d').fetchone()[0]
    if total!=manifest['records_expected']:raise ValueError('El total convertido no coincide con la fuente')
    def export(name,sql):
        dest=OUT/name;fmt='PARQUET,COMPRESSION ZSTD' if dest.suffix=='.parquet' else 'CSV,HEADER'
        con.execute(f"COPY ({sql}) TO '{sqlpath(dest)}' (FORMAT {fmt})")
        print(f'{name}: {dest.stat().st_size:,} bytes',flush=True)
    export('coverage_month_mode.csv',"""SELECT year(transit_timestamp) AS year,
        strftime(transit_timestamp,'%Y-%m') AS month,transit_mode,count(*) AS source_rows,
        count(DISTINCT CAST(transit_timestamp AS DATE)) AS recorded_dates,
        count(DISTINCT station_complex_id) AS station_complexes,
        min(transit_timestamp) AS first_timestamp,max(transit_timestamp) AS last_timestamp,
        sum(ridership) AS ridership,sum(transfers) AS transfers
        FROM d GROUP BY ALL ORDER BY month,transit_mode""")
    export('ridership_by_station_day.csv',"""SELECT station_complex_id,
        strftime(transit_timestamp,'%Y-%m-%d') AS dia,sum(ridership) AS ridership,
        sum(transfers) AS transfers,count(*) AS source_rows
        FROM d GROUP BY ALL ORDER BY station_complex_id,dia""")
    export('ridership_by_station_month.csv',"""SELECT station_complex_id,
        strftime(transit_timestamp,'%Y-%m') AS month,transit_mode,
        sum(ridership) AS ridership,sum(transfers) AS transfers,count(*) AS source_rows,
        count(DISTINCT CAST(transit_timestamp AS DATE)) AS recorded_dates
        FROM d GROUP BY ALL ORDER BY station_complex_id,month,transit_mode""")
    export('ridership_month_borough_payment_fare.csv',"""SELECT strftime(transit_timestamp,'%Y-%m') AS month,
        transit_mode,borough,payment_method,fare_class_category,
        sum(ridership) AS ridership,sum(transfers) AS transfers,count(*) AS source_rows
        FROM d GROUP BY ALL ORDER BY month,transit_mode,borough,payment_method,fare_class_category""")
    export('station_month_hourofweek.parquet',"""SELECT station_complex_id,
        strftime(transit_timestamp,'%Y-%m') AS month,transit_mode,
        dayofweek(transit_timestamp) AS dow,hour(transit_timestamp) AS hour,
        sum(ridership) AS ridership,sum(transfers) AS transfers,count(*) AS source_rows,
        count(DISTINCT CAST(transit_timestamp AS DATE)) AS recorded_dates
        FROM d GROUP BY ALL ORDER BY station_complex_id,month,transit_mode,dow,hour""")
    export('complex_catalog.csv',"""SELECT station_complex_id,
        arg_max(station_complex,transit_timestamp) AS station_complex,
        arg_max(borough,transit_timestamp) AS borough,
        arg_max(transit_mode,transit_timestamp) AS latest_reported_mode,
        arg_max(latitude,transit_timestamp) AS latitude,arg_max(longitude,transit_timestamp) AS longitude,
        min(transit_timestamp) AS first_observed,max(transit_timestamp) AS last_observed,
        count(DISTINCT transit_mode) AS reported_modes
        FROM d GROUP BY ALL ORDER BY station_complex_id""")
    # Readable source sample for the professor; never labelled the full dataset.
    export('sample_original_12_fields.csv',"""SELECT transit_timestamp,transit_mode,
        station_complex_id,station_complex,borough,payment_method,fare_class_category,
        ridership,transfers,latitude,longitude,georeference
        FROM d WHERE CAST(transit_timestamp AS DATE) IN (DATE '2019-01-01',DATE '2024-12-31')
        QUALIFY row_number() OVER (PARTITION BY year(transit_timestamp) ORDER BY transit_timestamp,station_complex_id,transit_mode,payment_method,fare_class_category,ridership,transfers,latitude,longitude,georeference)<=1000
        ORDER BY transit_timestamp,station_complex_id,transit_mode,payment_method,fare_class_category,ridership,transfers,latitude,longitude,georeference""")
    years=[dict(zip(['year','rows','ridership','transfers','recorded_dates'],r)) for r in con.execute("""
        SELECT year(transit_timestamp) AS year,count(*),sum(ridership),sum(transfers),
        count(DISTINCT CAST(transit_timestamp AS DATE)) FROM d GROUP BY year ORDER BY year""").fetchall()]
    report={'status':'COMPLETE','period':'2019-01-01 through 2024-12-31','months':72,
        'rows':total,'original_fields_retained':manifest['source_fields'],'years':years,
        'no_station_id_filter':True,'no_month_filter':True,
        'raw_parquet_location':'data/raw/full_period/parquet (excluded from Git)',
        'acquisition_sha256':sha(D/'acquisition.json'),
        'artifacts':{str(p.relative_to(P)):{'sha256':sha(p),'bytes':p.stat().st_size} for p in sorted(OUT.iterdir()) if p.is_file()}}
    months=sorted(manifest['months']);values={};catalog={}
    with (OUT/'complex_catalog.csv').open() as f:
        catalog={r['station_complex_id']:r for r in csv.DictReader(f)}
    with (OUT/'ridership_by_station_month.csv').open() as f:
        for r in csv.DictReader(f):
            sid=r['station_complex_id'];i=months.index(r['month'])
            row=values.setdefault(sid,{'id':sid,'entries':[None]*72,'transfers':[None]*72})
            row['entries'][i]=(row['entries'][i] or 0)+float(r['ridership'])
            row['transfers'][i]=(row['transfers'][i] or 0)+float(r['transfers'])
    for sid,row in values.items():
        row.update(name=catalog[sid]['station_complex'],borough=catalog[sid]['borough'],mode=catalog[sid]['latest_reported_mode'])
    client={'meta':{'status':'COMPLETE','period':'January 2019–December 2024','months':months,
        'calendar_days':[calendar.monthrange(int(m[:4]),int(m[5:]))[1] for m in months],
        'source_records':total,'source_fields':12,'all_modes_complexes':len(values),
        'source_datasets':['t69i-h2me','wujg-7c2s'],
        'fingerprint_scope':'Existing fingerprint comparison remains January–February 2020–2024. Monthly context uses all 72 months.'},
        'stations':[values[sid] for sid in sorted(values)]}
    (P/'atlas/data/full_period.json').write_text(json.dumps(client,ensure_ascii=False,separators=(',',':')))
    report['client_artifact']={'file':'atlas/data/full_period.json','sha256':sha(P/'atlas/data/full_period.json')}
    dump(D/'build-audit.json',report);con.close();print(json.dumps(report,indent=2),flush=True)

if __name__=='__main__':main()
