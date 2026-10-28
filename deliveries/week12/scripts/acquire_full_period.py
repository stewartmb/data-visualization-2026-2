#!/usr/bin/env python3
"""Descarga oficial COMPLETA 2019–2024, en 72 respuestas mensuales verificadas.

Conserva los 12 campos originales y todos los modos. Sin muestras ni filtro
de estaciones. Python + DuckDB. Cada mes se valida contra count y sum oficiales
antes de marcarlo completo. Descargas comprimidas y reanudables fuera de Git.
"""
import argparse
import csv
import gzip
import hashlib
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor,as_completed
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request,urlopen

import duckdb

P=Path(__file__).resolve().parents[1]
OUT=P/'data/full_period'
RAW=P/'data/raw/full_period'
INDEX=OUT/'acquisition.json'
FIELDS=['transit_timestamp','transit_mode','station_complex_id','station_complex','borough',
        'payment_method','fare_class_category','ridership','transfers','latitude','longitude','georeference']
DATASETS={str(y):('t69i-h2me' if y==2019 else 'wujg-7c2s',y,y+1) for y in range(2019,2025)}

def now():return datetime.now(timezone.utc).isoformat()
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
    return h.hexdigest()
def write(path,obj):
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix('.writing');tmp.write_text(json.dumps(obj,indent=2,ensure_ascii=False)+'\n');tmp.replace(path)
def headers():
    h={'User-Agent':'UTEC-Fractal-FullPeriod/1.0','Accept-Encoding':'gzip'}
    token=os.environ.get('SOCRATA_APP_TOKEN','').strip()
    if token:h['X-App-Token']=token
    return h
def json_snapshot(name,url,refresh):
    path=OUT/name
    if not path.exists() or refresh:
        with urlopen(Request(url,headers=headers()),timeout=180) as response:
            payload=response.read()
            if response.headers.get('Content-Encoding')=='gzip':payload=gzip.decompress(payload)
        json.loads(payload);path.write_bytes(payload)
    return json.loads(path.read_text()),{'url':url,'file':str(path.relative_to(P)),
        'sha256':sha(path),'retrieved_at_utc':datetime.fromtimestamp(path.stat().st_mtime,timezone.utc).isoformat()}

def expectations(refresh=False):
    expected={};sources={}
    for dataset in sorted({config[0] for config in DATASETS.values()}):
        meta,meta_source=json_snapshot(f'metadata_{dataset}.json',f'https://data.ny.gov/api/views/{dataset}.json',refresh)
        actual={c['fieldName'] for c in meta['columns'] if not c['fieldName'].startswith(':')}
        if actual!=set(FIELDS):raise ValueError(f'Esquema oficial cambió: {dataset}: {actual}')
        sources[dataset]={'metadata':meta_source,'counts':[],'landing':f'https://data.ny.gov/d/{dataset}'}
    def get_year(job):
        label,(dataset,start,stop)=job
        params={'$select':'date_extract_y(transit_timestamp) as year,date_extract_m(transit_timestamp) as month,count(*) as rows,sum(ridership) as ridership,sum(transfers) as transfers',
            '$where':f"transit_timestamp >= '{start}-01-01T00:00:00' AND transit_timestamp < '{stop}-01-01T00:00:00'",
            '$group':'date_extract_y(transit_timestamp),date_extract_m(transit_timestamp)','$order':'year,month','$limit':'1000'}
        url=f'https://data.ny.gov/resource/{dataset}.json?'+urlencode(params)
        rows,source=json_snapshot(f'expected_months_{label}.json',url,refresh)
        print(f'Control oficial {label}: {len(rows)} meses',flush=True)
        return dataset,rows,source
    with ThreadPoolExecutor(max_workers=3) as pool:
        for dataset,rows,source in pool.map(get_year,DATASETS.items()):
            sources[dataset]['counts'].append(source)
            for r in rows:
                key=f"{int(r['year'])}-{int(r['month']):02d}"
                if key in expected:raise ValueError(f'Mes duplicado: {key}')
                expected[key]={'dataset':dataset,'rows':int(r['rows']),'ridership':float(r['ridership']),'transfers':float(r['transfers'])}
    if set(expected)!={f'{y}-{m:02d}' for y in range(2019,2025) for m in range(1,13)}:raise ValueError('Faltan meses en el control oficial')
    return expected,sources

def validate_month(path,month,expected):
    with gzip.open(path,'rt',encoding='utf-8-sig',newline='') as f:
        if next(csv.reader(f))!=FIELDS:raise ValueError(f'Encabezado incompleto: {month}')
    con=duckdb.connect(config={'memory_limit':'1GB','threads':2,'preserve_insertion_order':False})
    file=str(path).replace("'","''")
    try:
        row=con.execute(f"""SELECT count(*) AS rows,
            sum(try_cast(ridership AS DOUBLE)),sum(try_cast(transfers AS DOUBLE)),
            min(transit_timestamp),max(transit_timestamp),count(DISTINCT left(transit_timestamp,10)),
            count(DISTINCT station_complex_id),
            count(*) FILTER (WHERE try_cast(ridership AS DOUBLE) IS NULL OR try_cast(transfers AS DOUBLE) IS NULL),
            count(*) FILTER (WHERE try_cast(transfers AS DOUBLE)>try_cast(ridership AS DOUBLE) OR try_cast(transfers AS DOUBLE)<0)
            FROM read_csv('{file}',header=true,all_varchar=true,compression='gzip')""").fetchone()
    finally:con.close()
    n,entries,transfers,first,last,days,complexes,missing,bad=row
    if n!=expected['rows'] or abs(entries-expected['ridership'])>.000001 or abs(transfers-expected['transfers'])>.000001:
        raise ValueError(f'{month}: descarga no coincide con control oficial: {row[:3]} vs {expected}')
    if missing or not first.startswith(month) or not last.startswith(month):raise ValueError(f'{month}: fechas/conteos inválidos')
    return {'rows':n,'ridership':entries,'transfers':transfers,'first_timestamp':first,'last_timestamp':last,
        'recorded_dates':days,'complexes_all_modes':complexes,'rows_with_transfer_count_anomaly':bad}

def download_month(month,expected,previous,refresh):
    path=RAW/f'{month}.csv.gz';prior=previous.get(month)
    if not refresh and path.exists() and prior and prior.get('expected')==expected and sha(path)==prior['sha256']:
        return month,prior,False
    year,m=map(int,month.split('-'));stop=f'{year+1}-01' if m==12 else f'{year}-{m+1:02d}'
    params={'$select':','.join(FIELDS),'$where':f"transit_timestamp >= '{month}-01T00:00:00' AND transit_timestamp < '{stop}-01T00:00:00'",
        '$limit':str(expected['rows']+1)}
    # One response per month: no offsets, sampling, or ordering assumptions.
    url=f"https://data.ny.gov/resource/{expected['dataset']}.csv?"+urlencode(params)
    temp=path.with_suffix('.gz.partial')
    for attempt in range(4):
        try:
            with urlopen(Request(url,headers=headers()),timeout=240) as response,temp.open('wb') as f:
                first=response.read(1024*1024);is_gzip=first.startswith(b'\x1f\x8b')
                target=f if is_gzip else gzip.GzipFile(fileobj=f,mode='wb',mtime=0)
                try:
                    target.write(first)
                    for block in iter(lambda:response.read(1024*1024),b''):target.write(block)
                finally:
                    if target is not f:target.close()
            checks=validate_month(temp,month,expected)
            temp.replace(path)
            result={'file':str(path.relative_to(P)),'url':url,'expected':expected,**checks,
                'sha256':sha(path),'bytes':path.stat().st_size,'retrieved_at_utc':now(),'validated':True}
            return month,result,True
        except Exception as error:
            print(f'{month}: intento {attempt+1}: {type(error).__name__}: {error}',flush=True)
            if attempt==3:raise
            time.sleep(min(30,2**attempt))

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workers',type=int,default=2)
    parser.add_argument('--month',help='Prueba un mes YYYY-MM; no se declarará completa la serie')
    parser.add_argument('--refresh',action='store_true')
    args=parser.parse_args();OUT.mkdir(parents=True,exist_ok=True);RAW.mkdir(parents=True,exist_ok=True)
    expected,sources=expectations(args.refresh)
    prior=json.loads(INDEX.read_text()) if INDEX.exists() else {}
    completed=prior.get('months',{});errors={}
    jobs=[args.month] if args.month else sorted(expected)
    if any(m not in expected for m in jobs):raise ValueError('Mes fuera de 2019–2024')
    def save():
        valid={m:v for m,v in completed.items() if v.get('expected')==expected.get(m) and (P/v['file']).exists()}
        write(INDEX,{'schema_version':1,'period_start':'2019-01-01','period_end_exclusive':'2025-01-01',
            'status':'COMPLETE' if len(valid)==72 else 'PARTIAL','months_expected':72,'months_validated':len(valid),
            'records_expected':sum(v['rows'] for v in expected.values()),'records_validated':sum(v['rows'] for v in valid.values()),
            'source_fields':FIELDS,'scope':'All rows and modes; no fixed station list; no sample.',
            'sources':sources,'months':dict(sorted(valid.items())),'errors':errors,'updated_at_utc':now()})
    save();start=time.monotonic()
    with ThreadPoolExecutor(max_workers=max(1,min(6,args.workers))) as pool:
        futures={pool.submit(download_month,m,expected[m],completed,args.refresh):m for m in jobs}
        for future in as_completed(futures):
            month=futures[future]
            try:
                _,entry,new=future.result();completed[month]=entry
                print(f'{month}: {entry["rows"]:,} filas verificadas; {len(completed)}/72 meses; {time.monotonic()-start:.0f} s',flush=True)
            except Exception as error:errors[month]=str(error);print(f'ERROR {month}: {error}',flush=True)
            save()
    save()
    if errors:raise SystemExit('Hay meses incompletos. Reejecutar el mismo comando para reanudar.')
    print(json.loads(INDEX.read_text())['status'],flush=True)

if __name__=='__main__':main()
