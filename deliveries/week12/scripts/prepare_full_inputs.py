#!/usr/bin/env python3
"""Adapta la agregación completa al paquete del Atlas. No necesita DuckDB."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

P=Path(__file__).resolve().parents[1]
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--from-dir',type=Path,default=P/'data/processed/full')
    args=parser.parse_args();source=args.from_dir
    targets={'stations_coords.csv':P/'data/processed/stations_coords.csv',
        'station_monthly_entries.csv':P/'data/processed/station_monthly_entries.csv',
        'jan_feb_hourly_2020_2024.csv':P/'data/jan_feb_hourly_2020_2024.csv'}
    inputs={}
    for name,target in targets.items():
        origin=source/name
        if not origin.exists():raise FileNotFoundError(f'{origin}; ejecutar build_from_full.py primero')
        target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(origin,target)
        inputs[name]={'source':str(origin),'sha256':hashlib.sha256(origin.read_bytes()).hexdigest(),'operation':'exact byte copy'}
    (P/'data/processed/provenance.json').write_text(json.dumps(inputs,indent=2)+'\n')
    manifest=json.loads((P/'data/sources.json').read_text())
    name='jan_feb_hourly_2020_2024.csv';p=P/'data'/name
    manifest['files'][name]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size}
    manifest['full_local_reproduction']=inputs
    (P/'data/sources.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('Atlas inputs prepared. Run build_atlas.py and validate_atlas.py.')
if __name__=='__main__':main()
