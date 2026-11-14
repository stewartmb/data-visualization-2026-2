#!/usr/bin/env python3
"""Descarga las particiones OD oficiales; validación posterior.

El alcance original es 2021–2024. --2025 completa el OD de 2025.
Reanuda meses ya descargados por SHA-256. Los originales quedan fuera de Git.
"""
import argparse
import csv
import fcntl
import gzip
import hashlib
import json
import os
import shutil
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
EXTENSION_SOURCES = {2025:'y2qv-fytt'}
HOURS_PER_BLOCK = 2
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

def scope(extension):
    if extension:
        return EXTENSION_SOURCES, RAW.with_name('od_2025_2026'), OUT.with_name('od_2025_2026')
    return SOURCES, RAW, OUT

def published_month_counts(columns, year):
    stats = {c['fieldName']: c.get('cachedContents', {}) for c in columns}
    years, months = stats['year'], stats['month']
    counts = {int(entry['item']): int(entry['count']) for entry in months.get('top', [])}
    if (
        not counts or any(not 1 <= month <= 12 or count <= 0 for month, count in counts.items())
        or str(year) != years.get('smallest') or str(year) != years.get('largest')
        or sum(counts.values()) != int(years.get('count', 0))
        or sum(counts.values()) != int(months.get('count', 0))
    ):
        raise ValueError(f'No se pudo determinar la cobertura mensual de {year} en Open NY')
    return counts

def receive_csv(url, path, progress):
    with urlopen(Request(url,headers=headers()),timeout=600) as response,path.open('wb') as output:
        first=response.read(1024*1024)
        target=output if first.startswith(b'\x1f\x8b') else gzip.GzipFile(fileobj=output,mode='wb',mtime=0)
        size=len(first)
        try:
            target.write(first)
            for chunk in iter(lambda:response.read(1024*1024),b''):
                target.write(chunk)
                size+=len(chunk)
                progress(size)
        finally:
            if target is not output: target.close()

def download_month_blocks(dest, fields, year, month, dataset, expected_rows, retries, progress):
    block_dir=dest.parent/'blocks'/f'{year}-{month:02d}'
    block_dir.mkdir(parents=True,exist_ok=True)
    endpoint=f'https://data.ny.gov/resource/{dataset}.csv'
    year_col,month_col,hour_col=(fields.index(c) for c in ('year','month','hour_of_day'))
    entries=[]
    for first in range(0,24,HOURS_PER_BLOCK):
        last=first+HOURS_PER_BLOCK-1
        name=f'{first:02d}-{last:02d}'
        path=block_dir/f'{name}.csv.gz'
        index=block_dir/f'{name}.json'
        tmp=path.with_suffix('.gz.partial')
        query={'$select':','.join(fields),'$where':f'year = {year} AND month = {month} AND hour_of_day between {first} and {last}','$limit':ROW_LIMIT}
        url=endpoint+'?'+urlencode(query)
        if path.exists() and index.exists():
            entry=json.loads(index.read_text())
            if entry['url']==url and entry['official_month_rows']==expected_rows and sha(path)==entry['sha256']:
                entries.append(entry)
                continue
        for attempt in range(1,retries+1):
            progress(0,url,True,attempt,name,len(entries))
            print(f'{year}-{month:02d} · horas {name}: intento {attempt}',flush=True)
            try:
                receive_csv(url,tmp,lambda size:progress(size,url,False,attempt,name,len(entries)))
                rows=0
                with gzip.open(tmp,'rt',encoding='utf-8-sig',newline='') as stream:
                    reader=csv.reader(stream,strict=True)
                    if next(reader)!=fields: raise ValueError('Encabezado incompleto')
                    for row in reader:
                        if (len(row)!=len(fields) or row[year_col]!=str(year) or row[month_col]!=str(month)
                                or not first<=int(row[hour_col])<=last):
                            raise ValueError(f'Fila fuera del bloque {name}')
                        rows+=1
                if not 0<rows<ROW_LIMIT: raise ValueError(f'Recuento inesperado en el bloque {name}: {rows}')
                entry={'url':url,'rows':rows,'official_month_rows':expected_rows,
                       'sha256':sha(tmp),'retrieved_at_utc':now(),'file':str(path.relative_to(P))}
                tmp.replace(path)
                save(index,entry)
                entries.append(entry)
                break
            except Exception as error:
                print(f'{year}-{month:02d} · horas {name}: {error}',flush=True)
                if attempt==retries: raise
                time.sleep(min(120,5*2**(attempt-1)))
    rows=sum(entry['rows'] for entry in entries)
    if rows!=expected_rows:
        # A valid gzip can still contain a truncated query result.
        for index in block_dir.glob('*.json'): index.unlink()
        raise ValueError(f'El portal publicó {expected_rows:,} filas. Los bloques recibieron {rows:,}.')
    tmp=dest.with_suffix('.gz.partial')
    with gzip.open(tmp,'wb',compresslevel=3) as output:
        for i,entry in enumerate(entries):
            with gzip.open(P/entry['file'],'rb') as stream:
                if i: stream.readline()
                shutil.copyfileobj(stream,output,1024*1024)
    tmp.replace(dest)
    return entries

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--workers',type=int,default=4)
    ap.add_argument('--retries',type=int,default=6)
    ap.add_argument('--extension','--2025',action='store_true',help='Completar los doce meses de 2025')
    ap.add_argument('--plan',action='store_true',help='Consultar fuentes y cobertura sin descargar archivos')
    args=ap.parse_args()
    if args.retries < 1: ap.error('--retries debe ser positivo')
    sources, raw, out = scope(args.extension)
    index=out/'acquisition.json'
    previous={}
    if not args.plan:
        raw.mkdir(parents=True,exist_ok=True); out.mkdir(parents=True,exist_ok=True)
        lock_file=(raw/'download.lock').open('a')
        try: fcntl.flock(lock_file,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError: raise SystemExit('Ya hay un proceso OD para este período.')
        previous=json.loads(index.read_text()) if index.exists() else {}
    state={'schema_version':1,'status':'FETCHING_METADATA','pid':os.getpid(),
        'started_at_utc':now(),'years':list(sources),'months_expected':0,
        'months_downloaded':0,'validation_status':'PENDING',
        'scope':'All published origin-destination pairs and all original fields; no station filter; no sampling.',
        'semantic_note':'MTA estimates of average ridership by month, weekday and hour; timestamps are representative, not individual trip dates.',
        'sources':{},'months':{},'active':{},'errors':{}}
    mutex=threading.Lock(); last_write={}
    def persist():
        state['updated_at_utc']=now();state['months_downloaded']=len(state['months']);save(index,state)
    fields={}; partitions={}
    for year,dataset in sources.items():
        url=f'https://data.ny.gov/api/views/{dataset}.json'
        dest=out/f'metadata_{dataset}.json'
        for attempt in range(args.retries):
            try:
                with urlopen(Request(url,headers=headers()),timeout=180) as r:
                    payload=r.read()
                    if r.headers.get('Content-Encoding')=='gzip': payload=gzip.decompress(payload)
                meta=json.loads(payload);break
            except Exception as e:
                print(f'Metadatos {year}: intento {attempt+1}: {e}',flush=True)
                if attempt+1==args.retries: raise
                time.sleep(min(60,5*2**attempt))
        cols=[c for c in meta['columns'] if not c['fieldName'].startswith(':')]
        fields[year]=[c['fieldName'] for c in cols]
        required={'year','month','day_of_week','hour_of_day','origin_station_complex_id',
            'destination_station_complex_id','estimated_average_ridership'}
        if not required<=set(fields[year]): raise ValueError(f'Esquema OD inesperado: {dataset}')
        months = published_month_counts(cols, year) if args.extension else dict.fromkeys(range(1,13))
        if set(months)!=set(range(1,13)):
            raise ValueError(f'La fuente para {year} debe cubrir enero–diciembre.')
        partitions.update({(year, month): count for month, count in months.items()})
        print(f'{year}: fuente oficial {dataset}, {len(cols)} campos, {len(months)} meses.',flush=True)
        if args.plan:
            if args.extension:
                print(f'{year}: meses {", ".join(f"{month:02d}" for month in sorted(months))}, {sum(months.values()):,} filas publicadas.',flush=True)
            continue
        dest.write_bytes(payload)
        state['sources'][str(year)]={'dataset':dataset,'name':meta['name'],
            'landing':f'https://data.ny.gov/d/{dataset}','metadata_url':url,
            'metadata_file':str(dest.relative_to(P)),'metadata_sha256':sha(dest),
            'retrieved_at_utc':now(),'fields':fields[year]}
        save(out/f'dictionary_{year}.json',{'source':url,'fields':[
            {'field':c['fieldName'],'type':c.get('dataTypeName'),'definition':c.get('description','')} for c in cols]})
    if args.plan:
        return
    state['months_expected']=len(partitions)
    state['partitions']={f'{y}-{m:02d}':count for (y,m),count in sorted(partitions.items())}
    prior_months=previous.get('months',{})
    def reusable(year, month):
        key=f'{year}-{month:02d}'
        prior=prior_months.get(key)
        if (prior and (raw/f'{key}.csv.gz').exists()
                and prior.get('dataset')==sources[year] and prior.get('fields')==fields[year]
                and prior.get('official_rows')==partitions[(year,month)]):
            return prior
        return None
    for year,month in partitions:
        prior=reusable(year,month)
        if prior: state['months'][f'{year}-{month:02d}']=prior
    state['status']='DOWNLOADING';persist()
    def progress(key, size, url, force=False, attempt=1, block=None, blocks_done=None):
        t=time.monotonic()
        with mutex:
            state['months'].pop(key,None)
            state['active'][key]={'bytes_received':size,'url':url,'attempt':attempt,'updated_at_utc':now()}
            if block is not None:
                state['active'][key].update(block=block,blocks_done=blocks_done,blocks_total=24//HOURS_PER_BLOCK)
            if force or t-last_write.get(key,0)>15:
                last_write[key]=t;persist()
    def download(year,month):
        key=f'{year}-{month:02d}';dest=raw/f'{key}.csv.gz'
        prior=reusable(year,month)
        if prior and dest.exists() and sha(dest)==prior.get('sha256'):
            return key,prior
        params={'$select':','.join(fields[year]),'$where':f'year = {year} AND month = {month}','$limit':ROW_LIMIT}
        url=f'https://data.ny.gov/resource/{sources[year]}.csv?'+urlencode(params)
        tmp=dest.with_suffix('.gz.partial')
        def manifest():
            return {'file':str(dest.relative_to(P)),'dataset':sources[year],'year':year,'month':month,
                    'retrieved_at_utc':now(),'sha256':sha(dest),'bytes':dest.stat().st_size,'fields':fields[year],
                    'validation_status':'PENDING','request_row_limit':ROW_LIMIT,'official_rows':partitions[(year,month)]}
        if args.extension:
            blocks=download_month_blocks(dest,fields[year],year,month,sources[year],partitions[(year,month)],
                                         args.retries,lambda *values:progress(key,*values))
            return key,{**manifest(),'blocks':blocks}
        for attempt in range(1,args.retries+1):
            size=0;progress(key,size,url,True,attempt)
            print(f'{key}: descargando, intento {attempt}',flush=True)
            try:
                receive_csv(url,tmp,lambda size:progress(key,size,url,attempt=attempt))
                with gzip.open(tmp,'rt',encoding='utf-8-sig',newline='') as f:
                    if next(csv.reader(f))!=fields[year]: raise ValueError('Encabezado incompleto o respuesta inválida')
                tmp.replace(dest)
                return key,{**manifest(),'url':url}
            except Exception as e:
                print(f'{key}: intento {attempt} falló: {type(e).__name__}: {e}',flush=True)
                if attempt==args.retries: raise
                time.sleep(min(120,5*2**(attempt-1)))
    try:
        with ThreadPoolExecutor(max_workers=max(1,min(6,args.workers))) as pool:
            jobs={pool.submit(download,y,m):f'{y}-{m:02d}' for y,m in sorted(partitions)}
            for future in as_completed(jobs):
                key=jobs[future]
                try:
                    key,entry=future.result()
                    with mutex:
                        state['months'][key]=entry;state['active'].pop(key,None);persist()
                    print(f'{key}: archivo recibido y registrado. Validación pendiente.',flush=True)
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
