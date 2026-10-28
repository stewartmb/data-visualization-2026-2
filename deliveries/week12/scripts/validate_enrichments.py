#!/usr/bin/env python3
"""Verificación independiente de fuentes, escalas y reconciliación. Sin red."""
import csv
import hashlib
import json
import math
from collections import Counter,defaultdict
from datetime import date,timedelta
from pathlib import Path

P=Path(__file__).resolve().parents[1]
C=P/'data/context';S=C/'sources';O=C/'processed'
def read(p):return json.loads(p.read_text())
def rows(p):
    with p.open() as f:return list(csv.DictReader(f))

def validate():
    manifest=read(C/'sources.json');atlas=read(P/'atlas/data/atlas.json');ids={s['id'] for s in atlas['stations']}
    for name,entry in manifest['source_files'].items():
        assert hashlib.sha256((S/name).read_bytes()).hexdigest()==entry['sha256'],name
    for name,entry in manifest['downloads'].items():
        path=P/entry['file']
        if path.exists():assert hashlib.sha256(path.read_bytes()).hexdigest()==entry['sha256'],name
        else:assert name=='gtfs_subway.zip','Only the bulky archive may be omitted from Git'
    audit=read(C/'build-audit.json')
    for name,entry in audit['artifacts'].items():assert hashlib.sha256((P/name).read_bytes()).hexdigest()==entry['sha256'],name
    ntas=rows(O/'station_nta2020.csv')
    assert len(ntas)==len(ids) and {r['station_complex_id'] for r in ntas}==ids
    assert all(r['nta2020'] and r['matches']=='1' and not r['boundary_matches'] for r in ntas)
    assert len({r['nta2020'] for r in ntas})==audit['occupied_ntas']
    transfers=rows(O/'free_transfers_janfeb_2020_2024.csv')
    fares=rows(O/'fare_borough_month_janfeb_2020_2024.csv')
    excluded_fares=rows(O/'fare_scope_exclusions.csv')
    assert len(transfers)==5*len(ids)
    assert len({(r['station_complex_id'],r['year']) for r in transfers})==len(transfers)
    by_station={s['id']:s for s in atlas['stations']}
    for year in range(2020,2025):
        days=Counter();d=date(year,1,1)
        while d<date(year,3,1):days[(d.weekday()+1)%7]+=1;d+=timedelta(days=1)
        raw={};full_total=0
        for r in read(S/f'transfers_{year}.json'):
            raw[r['station_complex_id'],int(r['dow'])]=r
            if r['station_complex_id'] in ids:full_total+=float(r['ridership'])
        for r in (r for r in transfers if int(r['year'])==year):
            sid=r['station_complex_id'];expected_n=0;expected_t=0
            for dow,count in days.items():
                source=raw.get((sid,dow),{})
                expected_n+=float(source.get('ridership',0))/count
                expected_t+=float(source.get('transfers',0))/count
            assert math.isclose(float(r['calendar_standardized_weekly_entries']),expected_n,abs_tol=1e-7)
            assert math.isclose(float(r['calendar_standardized_weekly_free_transfers']),expected_t,abs_tol=1e-7)
            assert 0<=expected_t<=expected_n
            assert math.isclose(expected_n,by_station[sid]['profiles'][str(year)]['weekly'],abs_tol=.0001),f'New download differs from existing Atlas: {sid}/{year}'
            if expected_n:assert math.isclose(float(r['free_transfer_share_pct']),100*expected_t/expected_n,abs_tol=1e-9)
            assert int(r['observed_days'])<=sum(days.values())
        fare_total=sum(int(r['ridership']) for r in fares if int(r['year'])==year)
        raw_fare_total=sum(float(r['ridership']) for r in read(S/f'fares_{year}.json'))
        excluded_total=sum(float(r['ridership']) for r in excluded_fares if int(r['year'])==year)
        assert fare_total+excluded_total==raw_fare_total,'Out-of-scope rows remain auditable'
        assert fare_total==full_total,f'Fare and entry totals disagree in {year}'
    assert len({(r['month'],r['borough'],r['payment_method'],r['fare_class_category']) for r in fares})==len(fares)
    assert all(r['month'][5:] in ['01','02'] and r['transit_mode']=='subway' for r in fares)
    volumes=rows(O/'nta_janfeb_entries.csv')
    for year in range(2020,2025):
        total=sum(float(r['weekly_entries']) for r in volumes if int(r['year'])==year)
        assert math.isclose(total,sum(s['profiles'][str(year)]['weekly'] for s in atlas['stations']),abs_tol=1e-6)
    graph=read(O/'network_current.json');assert {n['id'] for n in graph['nodes']}==ids
    assert not graph['meta']['historical_network'] and not graph['meta']['passenger_flows']
    assert graph['meta']['archive_sha256']==manifest['downloads']['gtfs_subway.zip']['sha256']
    edgekeys=set()
    for e in graph['service_edges']:
        assert e['source'] in ids and e['target'] in ids and e['source']!=e['target']
        key=(e['source'],e['target'],e['route_id'],e['direction_id']);assert key not in edgekeys;edgekeys.add(key)
        assert 'passengers' not in e and 'ridership' not in e
    for e in graph['declared_transfer_edges']:
        assert e['source'] in ids and e['target'] in ids and e['source']!=e['target']
        assert e.get('transfer_type')!='3'
    context=read(P/'atlas/data/enrichments.json')
    assert context['territories']==read_csv_coerced(ntas)
    result={'result':'PASS','complexes':len(ids),'nta_matches':len(ntas),'transfer_station_years':len(transfers),
        'fare_rows':len(fares),'service_edges':len(graph['service_edges']),
        'checks':['source SHA-256','unique territory per complex','calendar exposures','transfer subset',
            'entries reconcile with original Atlas','fare totals reconcile with source entries',
            'NTA totals conserve volume','graph endpoints, deduplication and restrictions']}
    (C/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False,indent=2))

def read_csv_coerced(rows):
    return [{**r,'matches':int(r['matches'])} for r in rows]

if __name__=='__main__':validate()
