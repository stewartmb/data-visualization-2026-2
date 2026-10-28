#!/usr/bin/env python3
"""Prepare 2019–2024 hourly-entry profiles only for right-column contrasts.

Uses the validated full-period acquisition, never OD extrapolation. Reproduce:
  acquire_full_period.py -> build_full_period.py -> validate_full_period.py
  prepare_historical_contrast.py [--source-package PATH]
"""
import argparse
import calendar
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-package', type=Path, default=ROOT)
    args = parser.parse_args()
    source = args.source_package.resolve() / 'data/full_period'
    validation_file, audit_file = source/'validation.json', source/'build-audit.json'
    validation, audit = json.loads(validation_file.read_text()), json.loads(audit_file.read_text())
    assert validation['result'] == 'PASS' and validation['months'] == 72
    cube = source/'processed/station_month_hourofweek.parquet'
    cube_sha = digest(cube)
    assert cube_sha == audit['artifacts']['data/full_period/processed/station_month_hourofweek.parquet']['sha256']
    atlas = json.loads((ROOT/'atlas/data/atlas.json').read_text())
    ids = {str(s['id']) for s in atlas['stations']}
    connection = duckdb.connect(config={'threads':2, 'memory_limit':'512MB'})
    rows = connection.execute('''SELECT station_complex_id, CAST(substr(month,1,4) AS INTEGER) AS year,
        ((dow+6)%7)::INTEGER AS monday_day, hour::INTEGER, sum(ridership)::DOUBLE
        FROM read_parquet(?) WHERE transit_mode='subway' GROUP BY ALL ORDER BY 2,1,3,4''', [str(cube)]).fetchall()
    weeks = {id:{str(y):[0.0]*168 for y in range(2019,2025)} for id in ids}
    exposures = {y:[sum(calendar.weekday(y,m,d)==dow for m in range(1,13) for d in range(1,calendar.monthrange(y,m)[1]+1)) for dow in range(7)] for y in range(2019,2025)}
    totals = {str(y):{'source_subway':0.0,'mapped':0.0,'unmapped':0.0} for y in range(2019,2025)}
    for id, year, day, hour, value in rows:
        assert math.isfinite(value) and value >= 0
        totals[str(year)]['source_subway'] += value
        totals[str(year)]['mapped' if id in ids else 'unmapped'] += value
        if id in ids: weeks[id][str(year)][day*24+hour] += value/exposures[year][day]
    profiles = {}
    for id, years in weeks.items():
        profiles[id] = {}
        for year, u in years.items():
            weekly = sum(u)
            if weekly <= 0:
                profiles[id][year] = None
                continue
            p = [v/weekly for v in u]
            work = sum(p[:120])
            profile = {'p':p,'weekly':weekly,'daily':weekly/7,
                'am':100*sum(p[d*24+h] for d in range(5) for h in range(6,10))/work if work else 0,
                'pm':100*sum(p[d*24+h] for d in range(5) for h in range(16,20))/work if work else 0,
                'weekend':100*sum(p[120:]),'observedCells':sum(v>0 for v in u)}
            assert abs(sum(p)-1)<1e-12
            profiles[id][year] = profile
    for year, total in totals.items():
        assert math.isclose(total['source_subway'],total['mapped']+total['unmapped'],rel_tol=1e-12)
        expected = next(e['ridership'] for e in audit['years'] if str(e['year'])==year)
        # The validated full acquisition includes SIR; compare subway totals
        # against its cube directly instead of silently treating SIR as subway.
        assert total['source_subway'] <= expected+1e-6
    meta = {'status':'PASS','years':list(range(2019,2025)),'months_present':{str(y):list(range(1,13)) for y in range(2019,2025)},
        'measure':'MTA hourly subway ridership estimate (entries), not OD',
        'sources':['https://data.ny.gov/d/t69i-h2me','https://data.ny.gov/d/wujg-7c2s'],
        'source_records':validation['records'],'validation_sha256':digest(validation_file),'audit_sha256':digest(audit_file),'hour_cube_sha256':cube_sha,
        'method':'Sum all 12 monthly hourly-entry cubes by year/complex/weekday/hour; divide by annual occurrences of that weekday; normalize the 168-cell representative week. Source dow Sunday=0 is converted to Monday=0.',
        'sparse_assumption':'Absent cells inside the validated complete annual acquisition contribute zero; missing years or months are rejected.',
        'exposures':exposures,'totals':totals,'scope':'424 complexes shared with the map; unavailable profiles remain null. Other source complexes are accounted separately.',
        'usage':'Right-column historical comparison only. Both compared years must come from this hourly-entry source whenever the base is 2019 or 2020. The OD map is unchanged.',
        'built_at_utc':datetime.now(timezone.utc).isoformat()}
    result = {'meta':meta,'profiles':profiles}
    for target in [ROOT/'atlas/data/historical_contrast.json',ROOT.parents[1]/'atlas/data/historical_contrast.json']:
        target.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n')
    for year in ['2019','2020']:
        values = sorted([(100*years['2024']['weekly']/years[year]['weekly'],id) for id,years in profiles.items() if years[year] and years['2024']],reverse=True)
        print(year,'comparable',len(values),'top indices',values[:5])
    print('PASS: full 2019–2024 hourly-entry profiles, Monday-first convention and source balance; map/OD files not modified.')

if __name__ == '__main__':
    main()
