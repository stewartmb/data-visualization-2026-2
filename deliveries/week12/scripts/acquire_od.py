#!/usr/bin/env python3
"""Descarga TODAS las particiones OD oficiales 2021–2024; validación posterior.

API pública Socrata, 48 meses, todos los campos y todos los pares publicados.
Reanuda meses ya descargados por SHA-256. Los originales quedan fuera de Git.
"""
import argparse
import csv
import fcntl
import gzip
import hashlib
import json
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

P = Path(__file__).resolve().parents[1]
RAW = P / 'data/raw/od_2021_2024'
OUT = P / 'data/od_2021_2024'
SOURCES = {2021:'rapa-97zv', 2022:'nqnz-e9z9', 2023:'uhf3-t34z', 2024:'jsu2-fbtj'}
# Larger than the possible monthly OD x weekday x hour cube. A later independent
# count query detects any server-side truncation; EOF is not called validation.
ROW_LIMIT = 100_000_000

def now(): return datetime.now(timezone.utc).isoformat()
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
    return h.hexdigest()
def save(path, obj):
    tmp=path.with_suffix('.writing')
    tmp.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
    tmp.replace(path)
def headers():
    h={'User-Agent':'UTEC-Fractal-OD-Acquisition/1.0','Accept-Encoding':'gzip'}
    token=os.environ.get('SOCRATA_APP_TOKEN','').strip()
    if token: h['X-App-Token']=token
    return h

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--workers',type=int,default=4)
    ap.add_argument('--retries',type=int,default=6)
    args=ap.parse_args()
    RAW.mkdir(parents=True,exist_ok=True); OUT.mkdir(parents=True,exist_ok=True)
    lock_file=(RAW/'download.lock').open('a')
    try: fcntl.flock(lock_file,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except BlockingIOError: raise SystemExit('Ya hay un descargador OD ejecutándose.')
    index=OUT/'acquisition.json'
    previous=json.loads(index.read_text()) if index.exists() else {}
    state={'schema_version':1,'status':'FETCHING_METADATA','pid':os.getpid(),
        'started_at_utc':now(),'years':list(SOURCES),'months_expected':48,
        'months_downloaded':0,'validation_status':'PENDING',
        'scope':'All published origin-destination pairs and all original fields; no station filter; no sampling.',
        'semantic_note':'MTA estimates of average ridership by month, weekday and hour; timestamps are representative, not individual trip dates.',
        'sources':{},'months':{},'active':{},'errors':{}}
    mutex=threading.Lock(); last_write={}
    def persist():
        state['updated_at_utc']=now();state['months_downloaded']=len(state['months']);save(index,state)
    persist()
    fields={}
    for year,dataset in SOURCES.items():
        url=f'https://data.ny.gov/api/views/{dataset}.json'
        dest=OUT/f'metadata_{dataset}.json'
        for attempt in range(args.retries):
            try:
                with urlopen(Request(url,headers=headers()),timeout=180) as r:
                    payload=r.read()
                    if r.headers.get('Content-Encoding')=='gzip': payload=gzip.decompress(payload)
                meta=json.loads(payload);dest.write_bytes(payload);break
            except Exception as e:
                print(f'Metadatos {year}: intento {attempt+1}: {e}',flush=True)
                if attempt+1==args.retries: raise
                time.sleep(min(60,5*2**attempt))
        cols=[c for c in meta['columns'] if not c['fieldName'].startswith(':')]
        fields[year]=[c['fieldName'] for c in cols]
        required={'year','month','day_of_week','hour_of_day','origin_station_complex_id',
            'destination_station_complex_id','estimated_average_ridership'}
        if not required<=set(fields[year]): raise ValueError(f'Esquema OD inesperado: {dataset}')
        state['sources'][str(year)]={'dataset':dataset,'name':meta['name'],
            'landing':f'https://data.ny.gov/d/{dataset}','metadata_url':url,
            'metadata_file':str(dest.relative_to(P)),'metadata_sha256':sha(dest),
            'retrieved_at_utc':now(),'fields':fields[year]}
        save(OUT/f'dictionary_{year}.json',{'source':url,'fields':[
            {'field':c['fieldName'],'type':c.get('dataTypeName'),'definition':c.get('description','')} for c in cols]})
        persist();print(f'{year}: fuente oficial {dataset}, {len(cols)} campos.',flush=True)
    state['status']='DOWNLOADING';persist()
    def progress(key, size, url, force=False, attempt=1):
        t=time.monotonic()
        with mutex:
            state['active'][key]={'bytes_received':size,'url':url,'attempt':attempt,'updated_at_utc':now()}
            if force or t-last_write.get(key,0)>15:
                last_write[key]=t;persist()
    def download(year,month):
        key=f'{year}-{month:02d}';dest=RAW/f'{key}.csv.gz'
        prior=previous.get('months',{}).get(key)
        if prior and dest.exists() and sha(dest)==prior.get('sha256'):
            return key,prior
        params={'$select':','.join(fields[year]),'$where':f'year = {year} AND month = {month}','$limit':ROW_LIMIT}
        url=f'https://data.ny.gov/resource/{SOURCES[year]}.csv?'+urlencode(params)
        tmp=dest.with_suffix('.gz.partial')
        for attempt in range(1,args.retries+1):
            size=0;progress(key,size,url,True,attempt)
            print(f'{key}: descargando, intento {attempt}',flush=True)
            try:
                with urlopen(Request(url,headers=headers()),timeout=600) as r,tmp.open('wb') as f:
                    first=r.read(1024*1024);compressed=first.startswith(b'\x1f\x8b')
                    target=f if compressed else gzip.GzipFile(fileobj=f,mode='wb',mtime=0)
                    try:
                        target.write(first);size+=len(first)
                        for block in iter(lambda:r.read(1024*1024),b''):
                            target.write(block);size+=len(block);progress(key,size,url,attempt=attempt)
                    finally:
                        if target is not f: target.close()
                with gzip.open(tmp,'rt',encoding='utf-8-sig',newline='') as f:
                    if next(csv.reader(f))!=fields[year]: raise ValueError('Encabezado incompleto o respuesta inválida')
                tmp.replace(dest)
                return key,{'file':str(dest.relative_to(P)),'dataset':SOURCES[year],
                    'year':year,'month':month,'url':url,'retrieved_at_utc':now(),
                    'sha256':sha(dest),'bytes':dest.stat().st_size,'fields':fields[year],
                    'validation_status':'PENDING','request_row_limit':ROW_LIMIT}
            except Exception as e:
                print(f'{key}: intento {attempt} falló: {type(e).__name__}: {e}',flush=True)
                if attempt==args.retries: raise
                time.sleep(min(120,5*2**(attempt-1)))
    try:
        with ThreadPoolExecutor(max_workers=max(1,min(6,args.workers))) as pool:
            jobs={pool.submit(download,y,m):f'{y}-{m:02d}' for y in SOURCES for m in range(1,13)}
            for future in as_completed(jobs):
                key=jobs[future]
                try:
                    key,entry=future.result()
                    with mutex:
                        state['months'][key]=entry;state['active'].pop(key,None);persist()
                    print(f'{key}: archivo recibido; {len(state["months"])}/48 meses. Validación pendiente.',flush=True)
                except Exception as e:
                    with mutex:
                        state['errors'][key]=str(e);state['active'].pop(key,None);persist()
                    print(f'ERROR {key}: {e}',flush=True)
        state['status']='DOWNLOAD_FAILED' if state['errors'] else 'DOWNLOADED_UNVERIFIED'
        persist();print(state['status'],flush=True)
    except BaseException as e:
        state['status']='INTERRUPTED';state['last_error']=str(e);persist();raise
    if state['errors']: raise SystemExit('Reejecutar el mismo comando para reanudar meses fallidos.')

if __name__=='__main__': main()
