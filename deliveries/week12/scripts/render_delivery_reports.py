#!/usr/bin/env python3
"""Render the revised deliverable reports; existing editable Markdown is canonical."""
from pathlib import Path
import concurrent.futures,subprocess,shutil
R=Path(__file__).resolve().parents[3]
REPORTS=[('week04/README.md','week04/DataPackage.pdf'),('week05/ProjectProposal.md','week05/ProjectProposal.pdf'),('week06/DataAnalysis.md','week06/DataAnalysis.pdf'),('week07/Delivery1Report.md','week07/Delivery1Report.pdf'),('week10/PrototypeReport.md','week10/PrototypeReport.pdf'),('week12/RefinedDraftReport.md','week12/RefinedDraftReport.pdf'),('week12/PeerCritiqueResponse.md','week12/PeerCritiqueResponse.pdf')]
def render(item):
 src,dest=item;src=R/'deliveries'/src;dest=R/'deliveries'/dest
 p=subprocess.run(['pandoc',str(src),'--pdf-engine=xelatex','-V','mainfont=Arial','-V','monofont=Menlo','-V','fontsize=10pt','-V','geometry:margin=18mm','-V','colorlinks=true','-V','lang=es','-o',str(dest)],text=True,capture_output=True)
 if p.returncode:raise RuntimeError(str(src)+': '+p.stderr[-1400:])
 return str(dest.relative_to(R))
def main():
 for cmd in ['pandoc','xelatex']:
  if not shutil.which(cmd):raise SystemExit('Install '+cmd+' to regenerate PDFs; prebuilt files are supplied.')
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  for path in pool.map(render,REPORTS):print('Rendered',path,flush=True)
if __name__=='__main__':main()
