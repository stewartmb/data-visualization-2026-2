#!/usr/bin/env python3
"""Genera el PDF del reporte desde su Markdown; requiere pandoc y XeLaTeX."""
import shutil
import subprocess
from pathlib import Path

P=Path(__file__).resolve().parents[1]
def main():
    for tool in ['pandoc','xelatex']:
        if not shutil.which(tool):raise SystemExit(f'Falta {tool}; ver README de Semana 12.')
    temp=P/'RefinedDraftReport.generated.pdf'
    subprocess.run(['pandoc','RefinedDraftReport.md','--pdf-engine=xelatex','-V','mainfont=Arial',
        '-V','monofont=Menlo','-V','fontsize=10pt','-V','geometry:margin=18mm','-V','colorlinks=true',
        '-V','lang=es','-o',str(temp)],cwd=P,check=True)
    temp.replace(P/'RefinedDraftReport.pdf')
    print('Reporte PDF actualizado desde su fuente Markdown.')
if __name__=='__main__':main()
