#!/usr/bin/env python3
"""Public API snapshots, resumable weekly queries. No credentials needed.

Run from repository root: python3 scripts/redesign/acquire_context.py
Raw query responses remain in ignored work/; committed outputs are small aggregates.
"""
from pathlib import Path
from datetime import date, timedelta, datetime, timezone
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict
import json, csv, hashlib, time

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data'
CACHE = ROOT / 'data/raw/atlas-cache'
OUT.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(parents=True, exist_ok=True)

def fetch(url, path):
    if path.exists():
        return json.loads(path.read_text())
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={'User-Agent': 'UTEC-Rhythm-Atlas/1.0'}), timeout=90) as r:
                payload = r.read()
            result = json.loads(payload)
            path.write_bytes(payload)
            return result
        except Exception:
            if attempt == 2: raise
            time.sleep(1 + 2 * attempt)

sources = [
    ('station_catalog.json', 'https://data.ny.gov/resource/5f5g-n3cz.json?$limit=5000'),
    ('boroughs_raw.json', 'https://data.cityofnewyork.us/resource/gthc-hcne.json?$limit=10'),
]
for name, url in sources:
    result = fetch(url, OUT / name)
    print(name, len(result), flush=True)

jobs=[]
for year in range(2020, 2025):
    start, end = date(year,1,1), date(year,3,1)
    while start < end:
        stop = min(start + timedelta(days=7), end)
        params = {
            '$select': 'station_complex_id,date_extract_dow(transit_timestamp) as dow,date_extract_hh(transit_timestamp) as hour,sum(ridership) as n',
            '$where': f"transit_mode='subway' AND transit_timestamp >= '{start}T00:00:00' AND transit_timestamp < '{stop}T00:00:00'",
            '$group': 'station_complex_id,date_extract_dow(transit_timestamp),date_extract_hh(transit_timestamp)',
            '$order': 'station_complex_id,dow,hour', '$limit': '100000'
        }
        url = 'https://data.ny.gov/resource/wujg-7c2s.json?' + urlencode(params)
        jobs.append((year,start,stop,url))
        start=stop

def query(job):
    year,start,stop,url=job
    data=fetch(url,CACHE/f'{start}_{stop}.json')
    print(f'{start}–{stop}: {len(data)} groups',flush=True)
    return job,data

counts=defaultdict(float)
query_log=[]
with ThreadPoolExecutor(max_workers=3) as pool:
    for (year,start,stop,url),rows in pool.map(query,jobs):
        for r in rows:
            counts[(r['station_complex_id'],year,int(r['dow']),int(r['hour']))]+=float(r['n'])
        cached=CACHE/f'{start}_{stop}.json'
        query_log.append({'start':str(start),'end_exclusive':str(stop),'url':url,'groups':len(rows),
            'retrieved_at_utc':datetime.fromtimestamp(cached.stat().st_mtime,timezone.utc).isoformat()})

with (OUT/'jan_feb_hourly_2020_2024.csv').open('w',newline='') as f:
    writer=csv.writer(f,lineterminator='\n')
    writer.writerow(['station_complex_id','year','dow','hour','ridership'])
    for (sid,y,d,h),n in sorted(counts.items(),key=lambda x:(x[0][1],int(x[0][0]),x[0][2],x[0][3])):
        writer.writerow([sid,y,d,h,int(n)])

manifest={'retrieved_at_utc':max(q['retrieved_at_utc'] for q in query_log),
    'assembled_at_utc':datetime.now(timezone.utc).isoformat(),
    'hourly_source':'https://data.ny.gov/d/wujg-7c2s', 'queries':query_log,
    'context_sources':[{'file':n,'url':u,'retrieved_at_utc':datetime.fromtimestamp((OUT/n).stat().st_mtime,timezone.utc).isoformat()} for n,u in sources],
    'files':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in OUT.iterdir() if p.is_file() and p.name!='sources.json'}}
(OUT/'sources.json').write_text(json.dumps(manifest,indent=2))
print('DONE',len(counts),'aggregates',flush=True)
