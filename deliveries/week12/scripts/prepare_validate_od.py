#!/usr/bin/env python3
"""Ejecutar DESPUÉS de la descarga OD: tipado, Parquet y controles oficiales.

No modifica la app. No interpreta sumas de promedios como viajes mensuales.
"""
import argparse
import csv
import fcntl
import gzip
import json
import math
import time
from urllib.request import Request, urlopen
from urllib.parse import urlencode

import duckdb
from acquire_od import P, scope, published_month_counts, now, sha, save, headers

def quoted(path): return str(path).replace("'","''")
def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--extension','--2025',action='store_true',help='Validar los doce meses de 2025')
    args=ap.parse_args()
    sources, raw_dir, out=scope(args.extension)
    acquisition=out/'acquisition.json'
    if not acquisition.is_file():
        raise SystemExit('Primero ejecutar acquire_od.py para el mismo período.')
    lock_file=(raw_dir/'download.lock').open('a')
    try: fcntl.flock(lock_file,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except BlockingIOError: raise SystemExit('Ya hay un proceso OD para este período.')
    m=json.loads(acquisition.read_text())
    expected_months={f'{year}-{month:02d}' for year in sources for month in range(1,13)}
    month_count=len(expected_months)
    if m['status']!='DOWNLOADED_UNVERIFIED' or set(m['months'])!=expected_months or m['errors']:
        raise SystemExit('Primero completar la descarga del período con acquire_od.py.')
    parquet=raw_dir/'parquet';parquet.mkdir(exist_ok=True)
    controls=out/'controls'
    if not args.extension: controls.mkdir(exist_ok=True)
    official={}
    if args.extension:
        for year,source in m['sources'].items():
            metadata=P/source['metadata_file']
            checksum=sha(metadata)
            assert checksum==source['metadata_sha256'], f'Metadatos modificados: {year}'
            counts=published_month_counts(json.loads(metadata.read_bytes())['columns'],int(year))
            official[int(year)]=(source['metadata_url'],metadata,checksum,counts)
        published={f'{y}-{month:02d}':count for y,(_,_,_,counts) in official.items() for month,count in counts.items()}
        assert published==m['partitions'], 'La cobertura no coincide con los metadatos oficiales'
    con=duckdb.connect(config={'memory_limit':'4GB','threads':4,'preserve_insertion_order':False})
    con.execute(f"SET temp_directory='{quoted(raw_dir/'duckdb_tmp')}'")
    report={'status':'VALIDATING','acquisition_sha256':sha(acquisition),'months':{},
        'meaning':'Checksums of estimated averages are controls, not monthly trip totals.'}
    report['started_at_utc']=now()
    save(out/'validation.json',report)
    coverage=[]
    for key,entry in sorted(m['months'].items()):
        raw=P/entry['file'];assert sha(raw)==entry['sha256'],f'Original modificado: {key}'
        with gzip.open(raw,'rt',encoding='utf-8-sig',newline='') as f:
            assert next(csv.reader(f))==entry['fields'],f'Campos perdidos: {key}'
        if args.extension:
            url,control_path,control_sha,counts=official[entry['year']]
            expected={'rows':counts[entry['month']]}
            assert expected['rows']==entry['official_rows'], f'Control de descarga distinto: {key}'
        else:
            params={'$select':'count(*) as rows,sum(estimated_average_ridership) as sum_average',
                '$where':f"year = {entry['year']} AND month = {entry['month']}"}
            url=f"https://data.ny.gov/resource/{entry['dataset']}.json?"+urlencode(params)
            control_path=controls/f'{key}.json'
            if not control_path.exists():
                for attempt in range(4):
                    try:
                        with urlopen(Request(url,headers=headers()),timeout=300) as r:
                            payload=r.read()
                            if r.headers.get('Content-Encoding')=='gzip': payload=gzip.decompress(payload)
                        json.loads(payload);control_path.write_bytes(payload);break
                    except Exception:
                        if attempt==3: raise
                        time.sleep(5*2**attempt)
            expected=json.loads(control_path.read_text())[0]
            control_sha=sha(control_path)
        floats={'estimated_average_ridership','origin_latitude','origin_longitude','destination_latitude','destination_longitude'}
        integers={'year','month','hour_of_day'}
        select=[]
        for field in entry['fields']:
            assert field.replace('_','').isalnum()
            typ='DOUBLE' if field in floats else 'INTEGER' if field in integers else 'TIMESTAMP' if field=='timestamp' else 'VARCHAR'
            select.append(f'CAST("{field}" AS {typ}) AS "{field}"')
        dest=parquet/f'{key}.parquet';tmp=dest.with_suffix('.parquet.partial')
        con.execute(f"COPY (SELECT {','.join(select)} FROM read_csv('{quoted(raw)}',header=true,all_varchar=true,compression='gzip')) TO '{quoted(tmp)}' (FORMAT PARQUET,COMPRESSION ZSTD)")
        row=con.execute(f"""SELECT count(*),sum(estimated_average_ridership),
            count(*) FILTER (WHERE year!={entry['year']} OR month!={entry['month']} OR year IS NULL OR month IS NULL),
            count(*) FILTER (WHERE estimated_average_ridership IS NULL OR estimated_average_ridership<0),
            count(DISTINCT origin_station_complex_id),count(DISTINCT destination_station_complex_id)
            FROM read_parquet('{quoted(tmp)}')""").fetchone()
        n,total,bad_date,bad_value,origins,destinations=row
        if args.extension and (n!=int(expected['rows']) or bad_date or bad_value):
            report.update(status='FAIL',failed_month=key,found_rows=n,expected_rows=expected['rows'])
            save(out/'validation.json',report)
            m['status']='DOWNLOAD_FAILED'
            m['months'].pop(key)
            m['months_downloaded']=len(m['months'])
            m['errors'][key]='El archivo no superó los controles de cobertura o valores.'
            save(acquisition,m)
            raise SystemExit(f'{key}: volver a ejecutar la adquisición para reemplazar el archivo.')
        assert n==int(expected['rows']) and n>0,f'Número de registros no coincide: {key}'
        assert not bad_date and not bad_value,f'Valores inválidos: {key}'
        if 'sum_average' in expected:
            assert math.isclose(total,float(expected['sum_average']),rel_tol=1e-8,abs_tol=.01),f'Control de promedios no coincide: {key}'
        assert set(entry['fields'])=={r[0] for r in con.execute(f"DESCRIBE SELECT * FROM read_parquet('{quoted(tmp)}')").fetchall()}
        tmp.replace(dest)
        report['months'][key]={'rows':n,'original_fields':len(entry['fields']),
            'parquet_file':str(dest.relative_to(P)),'parquet_sha256':sha(dest),
            'official_control_url':url,'official_control_file':str(control_path.relative_to(P)),
            'official_control_sha256':control_sha,'checked_at_utc':now()}
        coverage.append([entry['year'],entry['month'],n,total,origins,destinations])
        save(out/'validation.json',report);print(f'{key}: PASS, {n:,} registros',flush=True)
    with (out/'coverage_month.csv').open('w',newline='') as f:
        w=csv.writer(f,lineterminator="\n");w.writerow(['year','month','source_rows','sum_estimated_averages_control_only','origins','destinations']);w.writerows(coverage)
    report.update(status='PASS',months_validated=month_count,records=sum(r[2] for r in coverage),finished_at_utc=now())
    save(out/'validation.json',report);con.close();print(json.dumps({'status':'PASS','months':month_count,'records':report['records']}))
if __name__=='__main__': main()
