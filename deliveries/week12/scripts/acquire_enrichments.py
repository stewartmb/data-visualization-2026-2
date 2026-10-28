#!/usr/bin/env python3
"""Adquiere fuentes oficiales del enriquecimiento de Semana 12 (stdlib, Python >=3.9).

python3 deliveries/week12/scripts/acquire_enrichments.py [--refresh]
Las respuestas pequeñas quedan en data/context/sources; el ZIP GTFS en data/raw.
No interpreta conexiones como OD ni asigna tarifas de borough a estaciones.
"""
import argparse
from datetime import date
from collections import Counter
import csv
import hashlib
import io
import json
import time
import zipfile
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

PACKAGE=Path(__file__).resolve().parents[1]
CONTEXT=PACKAGE/'data/context'
SOURCES=CONTEXT/'sources'
RAW=PACKAGE/'data/raw/enrichments'
MANIFEST=CONTEXT/'sources.json'

def digest(data):return hashlib.sha256(data).hexdigest()
def dump(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def acquire(refresh=False,daily_csv=None):
    SOURCES.mkdir(parents=True,exist_ok=True);RAW.mkdir(parents=True,exist_ok=True)
    previous=json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {'downloads':{}}
    downloads={}
    checkpoint_lock=Lock()
    def fetch(name,url,raw=False):
        path=(RAW if raw else SOURCES)/name
        prior=previous.get('downloads',{}).get(name)
        if not refresh and path.exists() and prior and prior['url']==url:
            payload=path.read_bytes()
            if digest(payload)!=prior['sha256']:raise ValueError(f'Cache modificada: {path}')
            downloads[name]=prior
        else:
            for attempt in range(4):
                try:
                    with urlopen(Request(url,headers={'User-Agent':'UTEC-Fractal-Acquisition/1.0'}),timeout=45) as response:
                        payload=response.read();headers=dict(response.headers);resolved=response.url
                    break
                except Exception as error:
                    print(f"Reintento {attempt+1}: {name}: {type(error).__name__}",flush=True)
                    if attempt==3:raise
                    time.sleep(2**attempt)
            # Validate before replacing a previous successful snapshot.
            if name.endswith('.json'):json.loads(payload)
            else:
                with zipfile.ZipFile(io.BytesIO(payload)) as archive:
                    for required in ['stops.txt','trips.txt','stop_times.txt','routes.txt']:
                        if required not in archive.namelist():raise ValueError(f'GTFS sin {required}')
            path.write_bytes(payload)
            downloads[name]={'url':url,'resolved_url':resolved,'retrieved_at_utc':datetime.now(timezone.utc).isoformat(),
                'sha256':digest(payload),'bytes':len(payload),'file':str(path.relative_to(PACKAGE)),
                'etag':headers.get('ETag'),'last_modified':headers.get('Last-Modified')}
        with checkpoint_lock:dump(MANIFEST,{**previous,'downloads':{**previous.get('downloads',{}),**downloads},'acquisition_complete':False})
        print(f'{name}: {len(payload):,} bytes',flush=True)
        return payload
    def query(name,domain,dataset,params):
        url=f'https://{domain}/resource/{dataset}.json?'+urlencode(params)
        payload=fetch(name,url);rows=json.loads(payload)
        if not isinstance(rows,list) or len(rows)>=int(params['$limit']):
            raise ValueError(f'Respuesta incompleta o límite alcanzado: {name}')
        downloads[name].update(rows=len(rows),dataset=dataset,query=params)
        return rows

    for domain,dataset in [('data.ny.gov','wujg-7c2s'),('data.cityofnewyork.us','9nt8-h7nd')]:
        fetch(f'metadata_{dataset}.json',f'https://{domain}/api/views/{dataset}.json')
    local_inputs={}
    # Transfers already exist in the complete source. Re-extract the comparable
    # window locally instead of asking Socrata to scan 120 million rows again.
    candidate=daily_csv or PACKAGE/'data/processed/full/ridership_by_station_day.csv'
    if daily_csv and not candidate.exists():raise FileNotFoundError(candidate)
    if not candidate.exists():candidate=PACKAGE.parents[1]/'data/processed/full/ridership_by_station_day.csv'
    cached=all((SOURCES/f'transfers_{y}.json').exists() for y in range(2020,2025))
    if not refresh and cached and previous.get('local_inputs'):
        local_inputs=previous['local_inputs']
        for year in range(2020,2025):
            path=SOURCES/f'transfers_{year}.json'
            entry=previous['source_files'][path.name]
            if digest(path.read_bytes())!=entry['sha256']:raise ValueError(f'Fuente modificada: {path}')
    else:
        if not candidate.exists():raise FileNotFoundError('Primero ejecuta download_full.py y build_from_full.py; o indica --daily-csv con ridership_by_station_day.csv.')
        grouped=defaultdict(lambda:[0,0,0]);seen=set()
        with candidate.open(newline='') as handle:
            for row in csv.DictReader(handle):
                day=date.fromisoformat(row['dia'])
                if not (2020<=day.year<=2024 and day.month in [1,2]):continue
                key=(row['station_complex_id'],row['dia'])
                if key in seen:raise ValueError(f'Fecha/complejo duplicado: {key}')
                seen.add(key);k=(day.year,row['station_complex_id'],(day.weekday()+1)%7)
                n,t=float(row['ridership']),float(row['transfers'])
                if not 0<=t<=n:raise ValueError(f'Conteos inválidos: {key}')
                grouped[k][0]+=n;grouped[k][1]+=t;grouped[k][2]+=1
        for year in range(2020,2025):
            rows=[{'station_complex_id':sid,'dow':dow,'ridership':n,'transfers':t,'observed_days':days}
                for (y,sid,dow),(n,t,days) in sorted(grouped.items()) if y==year]
            dump(SOURCES/f'transfers_{year}.json',rows)
        local_inputs={'daily_entries_and_transfers':{'file':str(candidate.resolve()),'sha256':digest(candidate.read_bytes()),
            'source':'https://data.ny.gov/d/wujg-7c2s','extracted_at_utc':datetime.now(timezone.utc).isoformat(),
            'operation':'Jan-Feb 2020-2024, sum counts by complex/year/weekday, count unique recorded dates. Mode restricted later by the 424-complex Atlas universe.',
            'reproduction':'download_full.py -> build_from_full.py -> ridership_by_station_day.csv'}}
    def acquire_fares(year):
        combined=[]
        for month in [1,2]:
            stop=f'{year}-{month+1:02d}-01T00:00:00'
            where=f"transit_mode='subway' AND transit_timestamp >= '{year}-{month:02d}-01T00:00:00' AND transit_timestamp < '{stop}'"
            rows=query(f'fares_{year}_{month:02d}.json','data.ny.gov','wujg-7c2s',{
                '$select':'borough,payment_method,fare_class_category,sum(ridership) as ridership',
                '$where':where,'$group':'borough,payment_method,fare_class_category',
                '$order':'borough,payment_method,fare_class_category','$limit':'50000'})
            combined.extend({**r,'month':f'{year}-{month:02d}'} for r in rows)
        dump(SOURCES/f'fares_{year}.json',combined)
    with ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(acquire_fares,range(2020,2025)))
    # Audit mode/territory inconsistencies instead of silently trusting transit_mode.
    for year in range(2020,2025):
        fare_rows=json.loads((SOURCES/f'fares_{year}.json').read_text())
        if any(r['borough'] not in ['Manhattan','Brooklyn','Queens','Bronx'] for r in fare_rows):
            query(f'scope_exclusions_{year}.json','data.ny.gov','wujg-7c2s',{
                '$select':'station_complex_id,station_complex,borough,sum(ridership) as ridership',
                '$where':f"transit_mode='subway' AND transit_timestamp >= '{year}-01-01T00:00:00' AND transit_timestamp < '{year}-03-01T00:00:00' AND borough not in ('Manhattan','Brooklyn','Queens','Bronx')",
                '$group':'station_complex_id,station_complex,borough','$order':'station_complex_id,borough','$limit':'50000'})
    query('nta2020.json','data.cityofnewyork.us','9nt8-h7nd',{'$order':'nta2020','$limit':'5000'})
    payload=fetch('gtfs_subway.zip','https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip',raw=True)
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        def rows(name):
            if name not in archive.namelist():return []
            with archive.open(name) as handle:
                yield from csv.DictReader(io.TextIOWrapper(handle,encoding='utf-8-sig',newline=''))
        stops=list(rows('stops.txt'));trips={r['trip_id']:r for r in rows('trips.txt')}
        sequences=defaultdict(list)
        for r in rows('stop_times.txt'):
            sequences[r['trip_id']].append((int(r['stop_sequence']),r['stop_id']))
        patterns={}
        for trip_id,sequence in sequences.items():
            trip=trips[trip_id];sequence=tuple(s for _,s in sorted(sequence))
            key=(trip['route_id'],trip.get('direction_id',''),sequence)
            patterns.setdefault(key,set()).add(trip['service_id'])
        compact={'stops':stops,'routes':list(rows('routes.txt')),'transfers':list(rows('transfers.txt')),
            'calendar':list(rows('calendar.txt')),'calendar_dates':list(rows('calendar_dates.txt')),
            'feed_info':list(rows('feed_info.txt')),
            'patterns':[{'route_id':r,'direction_id':d,'stops':list(seq),'service_ids':sorted(services)}
                for (r,d,seq),services in sorted(patterns.items())],
            'archive_sha256':digest(payload),'definition':'Unique scheduled stop sequences; not passenger journeys or observed train movements.'}
        dump(SOURCES/'gtfs_patterns.json',compact)
    generated={p.name:{'sha256':digest(p.read_bytes()),'bytes':p.stat().st_size,'file':str(p.relative_to(PACKAGE))}
        for p in SOURCES.glob('*.json')}
    manifest={'schema_version':1,'acquisition_complete':True,'period':'Jan-Feb 2020–2024 for ridership; NTA2020 boundaries; GTFS snapshot acquired now',
        'downloads':downloads,'source_files':generated,'local_inputs':local_inputs,
        'gtfs_landing':'https://www.mta.info/developers',
        'reproduction':'Cached inputs reproduce this snapshot. --refresh obtains a new release; compare hashes and validation before replacing results.'}
    dump(MANIFEST,manifest)
    print(f'Fuentes verificables: {MANIFEST}',flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--refresh',action='store_true');parser.add_argument('--daily-csv',type=Path)
    args=parser.parse_args();acquire(args.refresh,args.daily_csv)
