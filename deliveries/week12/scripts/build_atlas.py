#!/usr/bin/env python3
"""Build the rhythm atlas with only Python's standard library; all paths repo-relative."""
import csv, json, math, calendar, hashlib
from collections import defaultdict, Counter
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT/'data'
OLD = ROOT/'data/processed'
OUT = ROOT/'atlas/data'
OUT.mkdir(parents=True,exist_ok=True)
YEARS = list(range(2021,2025))   # 2021 = año base (primer año con estimación origen-destino)
BASE, END = 2021, 2024
SRC_CSV = 'year_hourly_2020_2024.csv'   # año completo, todos los meses

def read(path):
    with path.open(newline='',encoding='utf-8') as f:
        yield from csv.DictReader(f)

stations = {r['station_complex_id']:r for r in read(OLD/'stations_coords.csv') if r['transit_mode']=='subway'}
catalog = {str(int(float(r['complex_id']))):r for r in json.loads((SRC/'station_catalog.json').read_text())}
values = defaultdict(lambda:[0.0]*168)
observed = defaultdict(set)
for r in read(SRC/SRC_CSV):
    sid,y = r['station_complex_id'],int(r['year'])
    if y not in YEARS: continue
    # API: Sunday=0; display: Monday=0.
    i = ((int(r['dow'])+6)%7)*24 + int(r['hour'])
    values[sid,y][i] += float(r['ridership'])
    observed[sid,y].add(i)

exposures={}
for y in YEARS:
    c=Counter()
    d=date(y,1,1)
    while d<date(y+1,1,1):   # exposicion de calendario: dias de cada tipo en el año completo
        c[d.weekday()]+=1
        d+=timedelta(days=1)
    exposures[y]=[c[i] for i in range(7)]

def summarize(v,y):
    daily = [n/exposures[y][i//24] for i,n in enumerate(v)]
    total = sum(daily)
    if total<=0: return None
    p=[n/total for n in daily]
    work=sum(p[:120])
    am=sum(p[d*24+h] for d in range(5) for h in range(6,10))/work*100 if work else 0
    pm=sum(p[d*24+h] for d in range(5) for h in range(16,20))/work*100 if work else 0
    return {'p':[round(x,8) for x in p],'am':round(am,4),'pm':round(pm,4),
            'weekend':round(sum(p[120:])*100,4),'daily':round(total/7,4),
            'actualDaily':round(sum(v)/sum(exposures[y]),4),
            'observedCells':sum(x>0 for x in v),'weekly':round(total,4)}

months=[f'{y}-{m:02}' for y in YEARS for m in range(1,13)]
monthly=defaultdict(float)
for r in read(OLD/'station_monthly_entries.csv'):
    sid=r['station_complex_id']
    if sid in stations:
        monthly[sid,r['month']]+=float(r['ridership'])

output=[];excluded=[]
for sid,r in stations.items():
    pp={str(y):summarize(values[sid,y],y) for y in YEARS}
    if not pp[str(BASE)] or not pp[str(END)]:
        excluded.append({'id':sid,'reason':'No positive baseline or endpoint profile'})
        continue
    a,b=pp[str(BASE)],pp[str(END)]
    ctx=catalog.get(sid)
    output.append({'id':sid,'name':r['station_complex'],'borough':r['borough'],
        'lat':float(r['latitude']),'lon':float(r['longitude']),
        'routes':ctx.get('daytime_routes','').split() if ctx else [],
        'cbd':ctx.get('cbd')=='TRUE' if ctx else None,
        'contextMatched':bool(ctx),'profiles':pp,
        'series':[round(monthly[sid,m]/calendar.monthrange(int(m[:4]),int(m[5:]))[1],2) for m in months],
        'change':round(50*sum(abs(x-z) for x,z in zip(a['p'],b['p'])),4),
        'deltaAM':round(b['am']-a['am'],4), 'deltaWeekend':round(b['weekend']-a['weekend'],4),
        'recovery':round(b['daily']/a['daily']*100,4)})

output.sort(key=lambda s:int(s['id']))
system={}
for y in YEARS:
    vs=[0.0]*168
    for s in output:
        for i,n in enumerate(values[s['id'],y]):vs[i]+=n
    system[str(y)]=summarize(vs,y)

# Ramer–Douglas–Peucker simplification in geographic coordinates, for display only.
def simplify(points,eps=.00012):
    if len(points)<=2:return points
    a,b=points[0],points[-1];dx,dy=b[0]-a[0],b[1]-a[1]
    def dist(p):
        if not dx and not dy:return math.hypot(p[0]-a[0],p[1]-a[1])
        t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)))
        return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
    idx=max(range(1,len(points)-1),key=lambda i:dist(points[i]))
    if dist(points[idx])<=eps:return [a,b]
    return simplify(points[:idx+1],eps)[:-1]+simplify(points[idx:],eps)

features=[]
for r in json.loads((SRC/'boroughs_raw.json').read_text()):
    polys=[]
    for poly in r['the_geom']['coordinates']:
        rings=[]
        for ring in poly:
            new=simplify(ring)
            if len(new)>=4:rings.append([[round(x,5),round(y,5)] for x,y in new])
        if rings:polys.append(rings)
    features.append({'type':'Feature','properties':{'name':r['boroname']},'geometry':{'type':'MultiPolygon','coordinates':polys}})

source_manifest=json.loads((SRC/'sources.json').read_text())
app={'meta':{'title':'La forma del día · Atlas de ritmos','years':YEARS,'months':months,
    'days':['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'],
    'comparison':'Año completo (todos los meses) de 2021 a 2024; perfiles ajustados por número de lunes, martes, etc. del año; base 2021.',
    'retrieved':source_manifest['retrieved_at_utc'],'scope':'subway; complejos con perfiles positivos en ambos extremos',
    'exposures':exposures,'excluded':excluded,'schemaVersion':1},'system':system,'stations':output,
    'events':json.loads((SRC/'context_events.json').read_text())}
(OUT/'atlas.json').write_text(json.dumps(app,ensure_ascii=False,separators=(',',':')))
(OUT/'boroughs.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':')))

def quantile(vals,p):
    vals=sorted(vals);return vals[round((len(vals)-1)*p)]

report={'stations_input_subway':len(stations),'stations_included':len(output),'excluded':excluded,
    'catalog_join_matches':sum(s['contextMatched'] for s in output),
    'catalog_unmatched_ids':[s['id'] for s in output if not s['contextMatched']],
    'scope_by_borough':dict(Counter(s['borough'] for s in output)),
    'calendar_day_counts':exposures,'system_metrics':{y:{k:v for k,v in p.items() if k!='p'} for y,p in system.items()},
    'median_change_tv':quantile([s['change'] for s in output],.5),
    'top_change':[{'id':s['id'],'name':s['name'],'change':s['change'],'deltaAM':s['deltaAM']} for s in sorted(output,key=lambda s:-s['change'])[:10]],
    'stations_lower_am_share':sum(s['deltaAM']<0 for s in output),
    'stations_higher_weekend_share':sum(s['deltaWeekend']>0 for s in output),
    'cells_not_observed':{str(y):sum(168-s['profiles'][str(y)]['observedCells'] for s in output if s['profiles'][str(y)]) for y in YEARS},
    'source_hashes':source_manifest['files'],
    'artifact_scope':'Only atlas.json and boroughs.geojson are produced here; enriched and full-period files have independent audits.',
    'artifact_hashes':{name:hashlib.sha256((OUT/name).read_bytes()).hexdigest() for name in ['atlas.json','boroughs.geojson']}}
(ROOT/'redesign').mkdir(exist_ok=True)
(ROOT/'redesign/data-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in report.items() if k not in ['source_hashes','artifact_hashes','system_metrics','top_change']},ensure_ascii=False,indent=2))
