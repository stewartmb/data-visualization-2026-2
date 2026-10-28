#!/usr/bin/env python3
"""Reproduce evidence for the six revised tasks from the validated client assets.

No raw download, imagined historical OD, capacity or observed routes. T6 is an
illustrative fixed-demand graph scenario; it is not an operational forecast.
"""
from pathlib import Path
import csv, gzip, hashlib, json, datetime
import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import shortest_path
P=Path(__file__).resolve().parents[1]; R=P.parents[1]; A=P/'atlas/data'; OUT=P/'data/analytical_tasks'

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def csvout(name,rows):
 rows=list(rows)
 with (OUT/name).open('w',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
 return len(rows)
def main():
 OUT.mkdir(exist_ok=True,parents=True)
 hist=json.loads((A/'historical_contrast.json').read_text());f=json.loads((A/'flows.json').read_text());manifest=json.loads((A/'raeb/manifest.json').read_text())
 assert hist['meta']['status']=='PASS' and manifest['status']=='PASS'
 nodes=f['nodes'];links=f['links'];n=len(nodes);assert n==424
 ids=[s['id'] for s in nodes];boroughs=sorted({s['borough'] for s in nodes});bi={s:i for i,s in enumerate(boroughs)}; membership=np.array([bi[s['borough']] for s in nodes]);M=np.eye(len(boroughs))[membership]
 with (P/'data/context/processed/station_nta2020.csv').open() as inp:ntas={r['station_complex_id']:r for r in csv.DictReader(inp)}
 groups=[('borough',b,[i for i,s in enumerate(nodes) if s['borough']==b]) for b in boroughs]
 for nta in sorted({r['nta2020'] for r in ntas.values()}):groups.append(('NTA2020',nta,[i for i,s in enumerate(nodes) if ntas.get(s['id'],{}).get('nta2020')==nta]))
 territorial=[];windows=[];system={};group_u={}
 for year in range(2019,2025):
  u=np.array([np.array(hist['profiles'][id][str(year)]['p'])*hist['profiles'][id][str(year)]['weekly'] for id in ids]);system[year]=float(u.sum());group_u[year]={}
  for level,name,ix in groups:
   v=u[ix].sum(axis=0);group_u[year][level,name]=v;peak=v.reshape(7,24)
   for day in range(7):
    sums=np.array([sum(peak[day,(h+k)%24] for k in range(3)) for h in range(24)]);best=float(sums.max())
    windows.append(dict(year=year,territory_level=level,territory=name,weekday_monday0=day,window_hours=3,start_hours_tied=';'.join(str(h) for h,x in enumerate(sums) if np.isclose(x,best,rtol=1e-10)),entries_per_representative_day=best,week_share_pct=100*best/v.sum() if v.sum() else ''))
 for year in range(2019,2025):
  for level,name,ix in groups:
   v=group_u[year][level,name];base=group_u[2019][level,name];total=float(v.sum());b=float(base.sum())
   territorial.append(dict(year=year,baseline=2019,territory_level=level,territory=name,complexes=len(ix),weekly_entries=total,volume_index_2019_100=100*total/b if b else '',delta_weekly_entries=total-b,system_share_pct=100*total/system[year],delta_system_share_pp=100*(total/system[year]-b/system[2019]),tv_vs2019_pp=50*float(np.abs(v/total-base/b).sum()) if total and b else ''))
 counts={'T1_territory.csv':csvout('T1_territory.csv',territorial),'T3_windows.csv':csvout('T3_windows.csv',windows)}
 relations=[];balances=[];Qs={};digest_inputs={}
 for year in range(2021,2025):
  Q=np.zeros((n,n),dtype=np.float64)
  for day in range(7):
   for hour in range(24):
    key=f'{year}/{day}-{hour:02d}';p=A/'raeb'/f'{key}.f32.gz';assert sha(p)==manifest['assets'][key]['sha256'],key
    q=np.frombuffer(gzip.decompress(p.read_bytes()),dtype='<f4').reshape(n,n).astype(np.float64);assert np.isfinite(q).all() and (q>=0).all();Q+=q
    B=M.T@q@M;O=B.sum(axis=1)-np.diag(B);D=B.sum(axis=0)-np.diag(B)
    assert np.isclose(O.sum(),D.sum(),rtol=1e-12)
    for i,b in enumerate(boroughs):balances.append(dict(year=year,weekday_monday0=day,hour_of_start=hour,borough=b,external_origins=float(O[i]),external_destinations=float(D[i]),internal=float(B[i,i]),external_balance=float((D[i]-O[i])/(D[i]+O[i])) if D[i]+O[i] else ''))
  Qs[year]=Q;B=M.T@Q@M
  assert np.isclose(B.sum(),Q.sum(),rtol=1e-12)
  for i,b in enumerate(boroughs):
   for j,c in enumerate(boroughs):relations.append(dict(year=year,origin_borough=b,destination_borough=c,weekly_estimated_od=float(B[i,j]),destination_share_pct=float(100*B[i,j]/B[i].sum()) if B[i].sum() else ''))
  print('OD frames read:',year,flush=True)
 counts['T2_territorial_od.csv']=csvout('T2_territorial_od.csv',relations);counts['T5_external_balance.csv']=csvout('T5_external_balance.csv',balances)
 loads=[];weekly={}
 for year in [2021,2024]:
  ar=np.asarray(f['flows'][str(year)],dtype=float);weekly[year]=ar.sum(axis=(0,1)).reshape(-1,2).sum(axis=1)
  for e,link in enumerate(links):loads.append(dict(year=year,link_id=e,origin=link['a'],destination=link['b'],kind=link['kind'],length_m=link['len'],weekly_assigned_traversals_both_directions=float(weekly[year][e]),monday08_start_cohort_traversals_both_directions=float(ar[0,8,2*e:2*e+2].sum())))
 counts['T4_corridor_loads.csv']=csvout('T4_corridor_loads.csv',loads)
 index={s:i for i,s in enumerate(ids)}
 def distances(removed=None):
  rr=[];cc=[];ww=[]
  for e,l in enumerate(links):
   if e==removed:continue
   a=index[l['a']];b=index[l['b']]
   for direction in [0,1]:
    if l['allowed'][direction]:rr.append(a if direction==0 else b);cc.append(b if direction==0 else a);ww.append(l['len'])
  return shortest_path(csr_matrix((ww,(rr,cc)),shape=(n,n)),directed=True,method='D')
 d0=distances();valid=np.isfinite(d0)&(~np.eye(n,dtype=bool));q=Qs[2024];denom=float(q[valid].sum());assert denom>0
 # Illustrative scenarios: 3 busiest inter-borough links and 3 busiest remaining links.
 rank=sorted([i for i,l in enumerate(links) if l['kind']=='rail'],key=lambda e:weekly[2024][e],reverse=True)
 cross=[e for e in rank if membership[index[links[e]['a']]]!=membership[index[links[e]['b']]]][:3]
 degree=np.zeros(n,dtype=int)
 for l in links:degree[index[l['a']]]+=1;degree[index[l['b']]]+=1
 leaf=next(e for e in rank if degree[index[links[e]['a']]]==1 or degree[index[links[e]['b']]]==1)
 chosen=cross+[e for e in rank if e not in cross and e!=leaf][:2]+[leaf];scenarios=[]
 for e in chosen:
  d=distances(e);lost=valid&~np.isfinite(d);connected=valid&np.isfinite(d);extra=d[connected]-d0[connected];assert (extra>=-1e-7).all()
  remaining=float(q[connected].sum());disconnected=float(q[lost].sum());link=links[e]
  affected=connected.copy();affected[connected]=extra>1e-6
  row=dict(year=2024,link_removed=e,origin=link['a'],destination=link['b'],removed_directions=';'.join(str(i) for i,b in enumerate(link['allowed']) if b),eligible_weekly_estimated_od=denom,disconnected_weekly_estimated_od=disconnected,disconnected_share_pct=100*disconnected/denom,additional_km_weighted_connected=float(np.sum(q[connected]*np.maximum(extra,0))/remaining/1000) if remaining else '',still_connected_weekly_estimated_od=remaining,detoured_weekly_estimated_od=float(q[affected].sum()))
  assert np.isclose(remaining+disconnected,denom);scenarios.append(row)
 counts['T6_reference_scenarios.csv']=csvout('T6_reference_scenarios.csv',scenarios)
 evidence={'status':'PASS','built_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Representative weeks; aggregate quantities before normalization. OD hour denotes starting cohort. Fixed-demand distance-only graph removal examples, not operational predictions.','source_sha256':{str(p.relative_to(P)):sha(p) for p in [A/'historical_contrast.json',A/'flows.json',A/'raeb/manifest.json']},'inputs':'All 672 dense float32 OD frames verified against the RAEB manifest; small float32 rounding retained.','checks':['territorial OD conservation','external origins equal external destinations across partition','no negative/non-finite OD','no shortened shortest distance after removing links','scenario connected + disconnected demand conservation'],'row_counts':counts,'scenarios':'Six illustrative link removals, not exhaustive ranking of network vulnerability.','artifacts':{name:sha(OUT/name) for name in counts},'ui_status':'Evidence/preparation only. Does not declare T1-T6 fully implemented in the interface.'}
 (OUT/'validation.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
 for name in counts:
  target=R/'deliveries/week06/data/processed'/name;target.parent.mkdir(exist_ok=True,parents=True)
  # Week 6 representative processed sample for each proposed analytic task.
  with (OUT/name).open() as inp:
   reader=csv.DictReader(inp);fields=reader.fieldnames;all_rows=list(reader)
  sample=[all_rows[i] for i in sorted(set(np.linspace(0,len(all_rows)-1,min(24,len(all_rows)),dtype=int)))]
  with target.open('w',newline='') as dest:
   writer=csv.DictWriter(dest,fieldnames=fields);writer.writeheader();writer.writerows(sample)
 (OUT/'summary.json').write_text(json.dumps({'territories_2024':[r for r in territorial if r['year']==2024 and r['territory_level']=='borough'],'od_relations':relations,'scenarios':scenarios},ensure_ascii=False,indent=2)+'\n')
 print('PASS:',counts,flush=True)
if __name__=='__main__':main()
