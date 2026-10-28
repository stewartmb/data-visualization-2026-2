#!/usr/bin/env python3
"""Independent invariants against the published aggregate CSV; no network or packages."""
from pathlib import Path
from collections import defaultdict, Counter
from datetime import date, timedelta
import json, csv, math, hashlib

ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'atlas/data/atlas.json').read_text())
audit=json.loads((ROOT/'redesign/data-audit.json').read_text())
sources=json.loads((ROOT/'data/sources.json').read_text())
stations=data['stations']
assert len(stations)==424 and len({s['id'] for s in stations})==424
assert all(s['contextMatched'] for s in stations)
assert len(data['meta']['months'])==48
assert len(sources['queries'])==45
assert len(data['events'])==3
assert all(e['url'].startswith(('https://www.mta.info/','https://new.mta.info/')) for e in data['events'])
assert all(set(e.get('ids',[]))<=set(s['id'] for s in stations) for e in data['events'])
for name,meta in sources['files'].items():
    p=ROOT/'data'/name
    assert p.exists(),name
    assert hashlib.sha256(p.read_bytes()).hexdigest()==meta['sha256'],name
assert set(audit['artifact_hashes'])=={'atlas.json','boroughs.geojson'}
for name,digest in audit['artifact_hashes'].items():
    assert hashlib.sha256((ROOT/'atlas/data'/name).read_bytes()).hexdigest()==digest,name

raw=defaultdict(lambda:[0.0]*168)
with (ROOT/'data/year_hourly_2020_2024.csv').open() as f:
    for r in csv.DictReader(f):
        key=(r['station_complex_id'],int(r['year']))
        raw[key][((int(r['dow'])+6)%7)*24+int(r['hour'])]+=float(r['ridership'])

checked=0
for y in range(2021,2025):
    days=Counter();d=date(y,1,1)
    while d<date(y+1,1,1):
        days[d.weekday()]+=1;d+=timedelta(days=1)
    assert [days[i] for i in range(7)]==data['meta']['exposures'][str(y)]
    system_raw=[0.0]*168
    for s in stations:
        r=raw[s['id'],y]
        week=[v/days[i//24] for i,v in enumerate(r)]
        total=sum(week);p=s['profiles'][str(y)]
        assert p is not None and len(p['p'])==168
        assert all(math.isfinite(v) and v>=0 for v in p['p'])
        assert abs(sum(p['p'])-1)<1e-6
        assert max(abs(p['p'][i]-week[i]/total) for i in range(168))<=5.01e-9
        assert abs(p['daily']-total/7)<.00006
        assert abs(p['actualDaily']-sum(r)/sum(days.values()))<.00006
        work=sum(week[:120]);am=100*sum(week[d*24+h] for d in range(5) for h in range(6,10))/work
        assert abs(p['am']-am)<.00006
        assert abs(p['weekend']-100*sum(week[120:])/total)<.00006
        assert p['observedCells']==sum(v>0 for v in r)
        assert len(s['series'])==48 and all(v>=0 for v in s['series'])
        for i,v in enumerate(r):system_raw[i]+=v
        checked+=168
    system_week=[v/days[i//24] for i,v in enumerate(system_raw)]
    assert abs(data['system'][str(y)]['daily']-sum(system_week)/7)<.00006

for s in stations:
    a,b=s['profiles']['2021'],s['profiles']['2024']
    tv=50*sum(abs(x-y) for x,y in zip(a['p'],b['p']))
    assert 0<=tv<=100 and abs(s['change']-tv)<.00006
    assert abs(s['recovery']-100*b['daily']/a['daily'])<.001
    assert abs(s['deltaAM']-(b['am']-a['am']))<.00011

report={'result':'PASS','station_profiles':424*4,'normalized_cells_checked':checked,
    'source_hashes_checked':len(sources['files']),'query_windows':45,
    'median_tv_pp':audit['median_change_tv'],'calendar_adjustment':'verified against dates and raw aggregates'}
print(json.dumps(report,indent=2))
