#!/usr/bin/env python3
"""Recalcula cobertura y conservación desde los Parquet de registros completos."""
import calendar
import csv
import hashlib
import json
from pathlib import Path

import duckdb
P=Path(__file__).resolve().parents[1];D=P/'data/full_period'
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()
def main():
    m=json.loads((D/'acquisition.json').read_text());audit=json.loads((D/'build-audit.json').read_text())
    assert m['status']=='COMPLETE' and m['months_validated']==72
    assert set(m['months'])=={f'{y}-{n:02d}' for y in range(2019,2025) for n in range(1,13)}
    assert audit['acquisition_sha256']==sha(D/'acquisition.json')
    for name,entry in audit['artifacts'].items():assert sha(P/name)==entry['sha256'],name
    conversion=json.loads((D/'parquet-conversion.json').read_text())
    for month,entry in conversion.items():assert sha(P/'data/raw/full_period/parquet'/f'{month}.parquet')==entry['parquet_sha256'],month
    assert len(conversion)==72
    for source in m['sources'].values():
        for entry in [source['metadata'],*source['counts']]:assert sha(P/entry['file'])==entry['sha256']
    client=json.loads((P/'atlas/data/full_period.json').read_text())
    assert sha(P/'atlas/data/full_period.json')==audit['client_artifact']['sha256']
    assert len(client['meta']['months'])==72 and len(client['stations'])>=424
    assert client['meta']['months']==sorted(m['months'])
    assert len({s['id'] for s in client['stations']})==len(client['stations'])
    for station in client['stations']:
        assert len(station['entries'])==len(station['transfers'])==72
        assert all(v is None or v>=0 for v in station['entries'])
    con=duckdb.connect(config={'memory_limit':'4GB','threads':4,'preserve_insertion_order':False})
    directory=str(P/'data/raw/full_period/parquet').replace("'","''")
    con.execute(f"CREATE VIEW d AS SELECT * FROM read_parquet('{directory}/*.parquet')")
    columns={r[0] for r in con.execute('DESCRIBE d').fetchall()}
    assert set(m['source_fields'])<=columns and len(m['source_fields'])==12
    monthly=con.execute("""SELECT strftime(transit_timestamp,'%Y-%m') AS month,count(*),
        sum(ridership),sum(transfers),count(DISTINCT CAST(transit_timestamp AS DATE)),
        min(transit_timestamp),max(transit_timestamp) FROM d GROUP BY month ORDER BY month""").fetchall()
    for month,n,rides,transfers,days,first,last in monthly:
        expected=m['months'][month]['expected'];assert n==expected['rows']
        assert abs(rides-expected['ridership'])<1e-6 and abs(transfers-expected['transfers'])<1e-6
        year,mo=map(int,month.split('-'));assert days==calendar.monthrange(year,mo)[1],month
        assert str(first).startswith(month) and str(last).startswith(month)
    n=con.execute('SELECT count(*) FROM d').fetchone()[0];assert n==m['records_expected']==audit['rows']
    for i,(month,_,rides,transfers,days,_,_) in enumerate(monthly):
        assert client['meta']['calendar_days'][i]==days
        assert abs(sum(s['entries'][i] or 0 for s in client['stations'])-rides)<1e-6,month
        assert abs(sum(s['transfers'][i] or 0 for s in client['stations'])-transfers)<1e-6,month
    expected_totals=con.execute('SELECT sum(ridership),sum(transfers),count(*) FROM d').fetchone()
    for name in ['ridership_by_station_day.csv','ridership_by_station_month.csv','ridership_month_borough_payment_fare.csv','station_month_hourofweek.parquet','coverage_month_mode.csv']:
        p=str(D/'processed'/name).replace("'","''")
        reader=f"read_parquet('{p}')" if name.endswith('.parquet') else f"read_csv('{p}',header=true)"
        actual=con.execute(f'SELECT sum(ridership),sum(transfers),sum(source_rows) FROM {reader}').fetchone()
        assert all(abs(float(a)-float(b))<1e-6 for a,b in zip(actual,expected_totals)),name
    # The temporal expansion must reproduce the published fingerprint input.
    ids=[s['id'] for s in json.loads((P/'atlas/data/atlas.json').read_text())['stations']]
    con.execute('CREATE TEMP TABLE atlas_ids (id VARCHAR)')
    con.executemany('INSERT INTO atlas_ids VALUES (?)',[(sid,) for sid in ids])
    con.execute("""CREATE TEMP TABLE comparable AS SELECT station_complex_id,
        year(transit_timestamp) AS year,dayofweek(transit_timestamp) AS dow,
        hour(transit_timestamp) AS hour,sum(ridership) AS ridership
        FROM d WHERE year(transit_timestamp)>=2020 AND month(transit_timestamp) IN (1,2)
        AND transit_mode='subway'
        GROUP BY ALL HAVING sum(ridership)>0""")
    existing=str(P/'data/jan_feb_hourly_2020_2024.csv').replace("'","''")
    con.execute(f"""CREATE TEMP VIEW published AS SELECT CAST(station_complex_id AS VARCHAR) AS station_complex_id,
        CAST(year AS BIGINT) AS year,CAST(dow AS BIGINT) AS dow,CAST(hour AS BIGINT) AS hour,
        CAST(ridership AS DOUBLE) AS ridership FROM read_csv('{existing}',header=true)""")
    differences=con.execute("""SELECT count(*) FROM (
        (SELECT * FROM comparable EXCEPT ALL SELECT * FROM published)
        UNION ALL (SELECT * FROM published EXCEPT ALL SELECT * FROM comparable))""").fetchone()[0]
    assert differences==0,f'Cambios frente al insumo de la huella publicada: {differences}'
    comparable_rows=con.execute('SELECT count(*) FROM comparable').fetchone()[0]
    universe_rows=con.execute('SELECT count(*) FROM comparable WHERE station_complex_id IN (SELECT id FROM atlas_ids)').fetchone()[0]
    excluded=con.execute('SELECT * FROM comparable WHERE station_complex_id NOT IN (SELECT id FROM atlas_ids)').fetchall()
    result={'result':'PASS','months':72,'calendar_dates':sum(r[4] for r in monthly),'records':n,
        'years':[2019,2020,2021,2022,2023,2024],'original_fields':12,'published_fingerprint_rows_reconciled':comparable_rows,
        'atlas_universe_hour_groups':universe_rows,
        'published_input_excluded_groups':[dict(zip(['station_complex_id','year','dow','hour','ridership'],r)) for r in excluded],
        'checks':['all 72 official monthly row counts and sums','all calendar dates represented',
            'original columns retained','client monthly sums and coverage','published Jan-Feb fingerprint input reproduced exactly','source/data hashes','daily/monthly/fare/hour cubes conserve source totals'],
        'ui_scope':'This validates the complete data layer; the existing Atlas fingerprint still uses Jan-Feb 2020–2024.'}
    (D/'validation.json').write_text(json.dumps(result,indent=2)+'\n');con.close();print(json.dumps(result,indent=2))
if __name__=='__main__':main()
