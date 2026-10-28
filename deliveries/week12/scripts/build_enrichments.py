#!/usr/bin/env python3
"""Transforma snapshots oficiales en tablas auditables y contexto del cliente.

python3 deliveries/week12/scripts/build_enrichments.py
Sin red ni dependencias externas. El grafo expresa servicios programados actuales.
"""
import calendar
import csv
import hashlib
import json
import math
from collections import Counter,defaultdict
from datetime import date,timedelta
from pathlib import Path

PACKAGE=Path(__file__).resolve().parents[1]
CONTEXT=PACKAGE/'data/context'
SOURCE=CONTEXT/'sources'
OUT=CONTEXT/'processed'

def read(name):return json.loads((SOURCE/name).read_text())
def dump(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def csvout(name,rows,fields):
    with (OUT/name).open('w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=fields,lineterminator='\n');w.writeheader();w.writerows(rows)

def inside_ring(x,y,ring):
    inside=False
    for (x1,y1),(x2,y2) in zip(ring,ring[1:]+ring[:1]):
        # A boundary point is not silently assigned to an arbitrary neighbour.
        cross=(x-x1)*(y2-y1)-(y-y1)*(x2-x1)
        if abs(cross)<1e-13 and min(x1,x2)<=x<=max(x1,x2) and min(y1,y2)<=y<=max(y1,y2):return None
        if (y1>y)!=(y2>y) and x<(x2-x1)*(y-y1)/(y2-y1)+x1:inside=not inside
    return inside

def station_territories(stations,zones):
    result=[]
    for s in stations:
        matches=[];boundaries=[]
        for zone in zones:
            geometry=zone['the_geom']
            polygons=geometry['coordinates'] if geometry['type']=='MultiPolygon' else [geometry['coordinates']]
            for poly in polygons:
                outer=inside_ring(s['lon'],s['lat'],poly[0])
                holes=[inside_ring(s['lon'],s['lat'],h) for h in poly[1:]]
                if outer is None or (outer and None in holes):boundaries.append(zone['nta2020']);break
                if outer and not any(holes):matches.append(zone);break
        zone=matches[0] if len(matches)==1 and not boundaries else None
        result.append({'station_complex_id':s['id'],'name':s['name'],'borough':s['borough'],
            'nta2020':zone['nta2020'] if zone else None,'ntaname':zone['ntaname'] if zone else None,
            'matches':len(matches),'boundary_matches':';'.join(boundaries)})
    return result

def exposures(year):
    counts=Counter();d=date(year,1,1)
    while d<date(year,3,1):counts[(d.weekday()+1)%7]+=1;d+=timedelta(days=1)
    return counts

def transfer_rows(station_ids):
    out=[];excluded=Counter()
    for year in range(2020,2025):
        days=exposures(year);groups=defaultdict(dict)
        for r in read(f'transfers_{year}.json'):
            sid=r['station_complex_id'];dow=int(r['dow'])
            if sid not in station_ids:excluded[year]+=1;continue
            if dow in groups[sid]:raise ValueError(f'Duplicado {sid}/{year}/{dow}')
            n=float(r['ridership']);t=float(r['transfers']);observed=int(r['observed_days'])
            if not (0<=t<=n and 0<=observed<=days[dow]):raise ValueError(f'Conteos inválidos: {r}')
            groups[sid][dow]=(n,t,observed)
        for sid in sorted(station_ids,key=int):
            vals=groups.get(sid,{})
            n=sum(v[0] for v in vals.values());t=sum(v[1] for v in vals.values())
            wn=sum(v[0]/days[d] for d,v in vals.items());wt=sum(v[1]/days[d] for d,v in vals.items())
            out.append({'station_complex_id':sid,'year':year,'ridership':int(n),'free_transfers':int(t),
                'calendar_standardized_weekly_entries':wn,'calendar_standardized_weekly_free_transfers':wt,
                'free_transfer_share_pct':100*wt/wn if wn else None,
                'observed_days':sum(v[2] for v in vals.values()),'calendar_days':sum(days.values()),
                'observed_weekdays':len(vals),'period':'January-February'})
    return out,dict(excluded)

def fare_rows():
    out=[];keys=set();excluded=[]
    for year in range(2020,2025):
        for r in read(f'fares_{year}.json'):
            key=(r['month'][:7],r['borough'],r['payment_method'],r['fare_class_category'])
            if key in keys:raise ValueError(f'Tarifa duplicada {key}')
            keys.add(key);n=int(float(r['ridership']))
            if n<0:raise ValueError(f'Tarifa negativa {key}')
            if key[1] not in ['Manhattan','Brooklyn','Queens','Bronx']:
                excluded.append({'year':year,'month':key[0],'borough':key[1],'payment_method':key[2],'fare_class_category':key[3],'ridership':n,'reason':'Outside four-borough Atlas scope; source transit_mode is subway. See scope_exclusions source query.'});continue
            # Preserve the product and payment system. No demographic inference.
            out.append({'year':year,'month':key[0],'borough':key[1],'payment_method':key[2],
                'fare_class_category':key[3],'ridership':n,'transit_mode':'subway'})
    return out,excluded

def network(stations,catalog,gtfs):
    stops={s['stop_id']:s for s in gtfs['stops']};ids={s['id'] for s in stations}
    mapping={}
    for r in catalog:
        sid=str(int(float(r['complex_id'])))
        for stop in r.get('gtfs_stop_ids','').split(';'):
            stop=stop.strip()
            if stop in mapping and mapping[stop]!=sid:raise ValueError(f'Mapeo GTFS ambiguo: {stop}')
            mapping[stop]=sid
    def complex_id(stop):
        seen=set()
        while stop not in mapping and stop in stops and stop not in seen:
            seen.add(stop);stop=stops[stop].get('parent_station','')
        return mapping.get(stop)
    # Collapse platforms into complexes before building directed edges. Unknown
    # or excluded intermediate stops break a sequence; never invent a shortcut.
    edges=defaultdict(set);unknown=set();outside=set();represented=set()
    for pattern in gtfs['patterns']:
        seq=[]
        for stop in pattern['stops']:
            sid=complex_id(stop)
            if sid is None:unknown.add(stop)
            elif sid not in ids:outside.add(sid)
            else:represented.add(sid)
            seq.append(sid if sid in ids else None)
        for a,b in zip(seq,seq[1:]):
            if a and b and a!=b:edges[a,b,pattern['route_id'],pattern['direction_id']].update(pattern['service_ids'])
    transfers={}
    for r in gtfs['transfers']:
        a,b=complex_id(r['from_stop_id']),complex_id(r['to_stop_id'])
        if a not in ids or b not in ids or a==b or r.get('transfer_type')=='3':continue
        restrictions={k:v for k,v in r.items() if v and k not in ['from_stop_id','to_stop_id']}
        key=(a,b,json.dumps(restrictions,sort_keys=True))
        transfers[key]={'source':a,'target':b,'from_stop_id':r['from_stop_id'],'to_stop_id':r['to_stop_id'],**restrictions}
    service=[{'source':a,'target':b,'route_id':r,'direction_id':d,'service_ids':sorted(services)}
        for (a,b,r,d),services in sorted(edges.items())]
    return {'meta':{'meaning':'Directed consecutive stops of scheduled services in the downloaded GTFS snapshot; express links can skip intermediate stations.',
        'historical_network':False,'passenger_flows':False,'archive_sha256':gtfs['archive_sha256'],
        'calendar':gtfs['calendar'],'feed_info':gtfs['feed_info'],
        'unmapped_gtfs_stop_ids':sorted(unknown),'outside_atlas_complex_ids':sorted(outside),
        'atlas_complexes_not_in_feed':sorted(ids-represented)},
        'nodes':[{'id':s['id'],'name':s['name'],'borough':s['borough'],'lat':s['lat'],'lon':s['lon'],'in_feed':s['id'] in represented} for s in stations],
        'service_edges':service,'declared_transfer_edges':list(transfers.values())}

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    manifest=json.loads((CONTEXT/'sources.json').read_text())
    for name,entry in manifest['source_files'].items():
        if hashlib.sha256((SOURCE/name).read_bytes()).hexdigest()!=entry['sha256']:raise ValueError(f'Fuente modificada: {name}')
    atlas=json.loads((PACKAGE/'atlas/data/atlas.json').read_text());stations=atlas['stations'];ids={s['id'] for s in stations}
    territories=station_territories(stations,read('nta2020.json'))
    transfers,excluded=transfer_rows(ids);fares,excluded_fares=fare_rows()
    graph=network(stations,json.loads((PACKAGE/'data/station_catalog.json').read_text()),read('gtfs_patterns.json'))
    csvout('station_nta2020.csv',territories,list(territories[0]))
    csvout('free_transfers_janfeb_2020_2024.csv',transfers,list(transfers[0]))
    csvout('fare_borough_month_janfeb_2020_2024.csv',fares,list(fares[0]))
    csvout('fare_scope_exclusions.csv',excluded_fares,['year','month','borough','payment_method','fare_class_category','ridership','reason'])
    dump(OUT/'network_current.json',graph)
    zones=defaultdict(lambda:{'weekly_entries':0,'station_count':0})
    for r in territories:
        if not r['nta2020']:continue
        s=next(s for s in stations if s['id']==r['station_complex_id'])
        for y,p in s['profiles'].items():
            if p:zones[r['nta2020'],int(y)]['weekly_entries']+=p['weekly'];zones[r['nta2020'],int(y)]['station_count']+=1
    volumes=[{'nta2020':n,'year':y,**v,'comparable_daily_entries':v['weekly_entries']/7} for (n,y),v in sorted(zones.items())]
    csvout('nta_janfeb_entries.csv',volumes,list(volumes[0]))
    context={'meta':{'period':'January-February 2020–2024','fare_scope':'Entire borough, subway only; observed totals, not calendar-standardized.',
        'territory_scope':'Location of the complex centroid in NTA2020; not rider residence or station catchment.',
        'transfer_scope':'Free transfers recorded on subway entry; included within ridership, not all line changes.',
        'source_manifest':'enrichment_sources.json'},
        'territories':territories,'transfers':transfers,'fares':fares}
    dump(PACKAGE/'atlas/data/enrichments.json',context)
    dump(PACKAGE/'atlas/data/enrichment_sources.json',manifest)
    dump(PACKAGE/'atlas/data/network_current.json',graph)
    audit={'stations':len(stations),'nta_unique_matches':sum(r['matches']==1 and not r['boundary_matches'] for r in territories),
        'unmatched_territories':[r['station_complex_id'] for r in territories if not r['nta2020']],
        'occupied_ntas':len({r['nta2020'] for r in territories if r['nta2020']}),
        'transfer_rows':len(transfers),'excluded_transfer_source_groups':excluded,'fare_rows':len(fares),'excluded_fare_rows':excluded_fares,
        'graph_nodes':len(graph['nodes']),'graph_service_edges':len(graph['service_edges']),
        'graph_declared_transfer_edges':len(graph['declared_transfer_edges']),
        'graph_unmatched_stops':graph['meta']['unmapped_gtfs_stop_ids'],
        'graph_atlas_complexes_not_in_feed':graph['meta']['atlas_complexes_not_in_feed'],
        'artifacts':{str(p.relative_to(PACKAGE)):{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size}
            for p in sorted([p for p in OUT.iterdir() if p.is_file()]+[PACKAGE/'atlas/data/enrichments.json',PACKAGE/'atlas/data/enrichment_sources.json',PACKAGE/'atlas/data/network_current.json'])}}
    dump(CONTEXT/'build-audit.json',audit)
    print(json.dumps(audit,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
