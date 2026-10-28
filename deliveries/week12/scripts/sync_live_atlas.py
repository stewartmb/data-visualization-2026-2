#!/usr/bin/env python3
"""Publica LOCALMENTE la aplicación de Semana 12 en atlas/ raíz. No hace push."""
import hashlib
import json
import os
import shutil
from pathlib import Path

P=Path(__file__).resolve().parents[1];REPO=P.parents[1]
def main():
    if (P/'atlas/data/full_period.json').exists():
        report=json.loads((P/'data/full_period/validation.json').read_text())
        if report['result']!='PASS':raise SystemExit('Validar el período completo antes de sincronizar.')
    source=P/'atlas';target=REPO/'atlas';files={}
    if not (P/'data/context/validation.json').exists():raise SystemExit('Validar enriquecimientos antes de sincronizar.')
    for p in source.rglob('*'):
        if not p.is_file() or '__pycache__' in p.parts:continue
        rel=p.relative_to(source);dest=target/rel;dest.parent.mkdir(parents=True,exist_ok=True)
        if not dest.exists() or not os.path.samefile(p,dest):shutil.copyfile(p,dest)
        digest=hashlib.sha256(p.read_bytes()).hexdigest()
        if hashlib.sha256(dest.read_bytes()).hexdigest()!=digest:raise ValueError(f'Copia diferente: {rel}')
        files[str(rel)]=digest
    (P/'live-atlas-sync.json').write_text(json.dumps({'meaning':'Byte-identical application files; local sync only, no remote deployment.',
        'source':'deliveries/week12/atlas','destination':'atlas','sha256':files},indent=2)+'\n')
    print(f'PASS: {len(files)} application files synchronized from Week 12 to the local live Atlas.')
if __name__=='__main__':main()
