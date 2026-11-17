#!/usr/bin/env python3
"""Verify or acquire the PDFs cited in the current Fractal review.

Public readability is not a redistribution licence. Copies stay local by default;
source URLs and SHA-256 remain available to reproduce the academic review.
"""
from pathlib import Path
import argparse, concurrent.futures, datetime, hashlib, json, subprocess, urllib.request

ROOT=Path(__file__).resolve().parents[1]
PAPERS=ROOT/'papers'
SOURCES={
 'zeng_2019_raeb.pdf':('https://zeng-wei.com/publication/papers/2019_RAEB.pdf','Route-Aware Edge Bundling for Visualizing Origin-Destination Trails in Urban Traffic','10.1111/cgf.13712'),
 'hurter_2012_kdeeb.pdf':('https://webspace.science.uu.nl/~telea001/uploads/PAPERS/EuroVis12/kdeeb.pdf','Graph Bundling by Kernel Density Estimation','10.1111/j.1467-8659.2012.03079.x'),
 'valdrighi_2026_manywaves.pdf':('https://files.visualdslab.com/files/papers/2026-ManyWaves-CGF.pdf','ManyWaves: A Visual Analytics Approach for Exploring Multivariate Spatiotemporal Data Based on the Graph Wavelet Transform','10.1111/cgf.70653'),
 'dhont_2020_circular_heatmaps.pdf':('https://project.inria.fr/aaltd20/files/2020/08/AALTD_20_paper_DhontVisual.pdf','Visual Analytics for Extracting Trends from Spatio-temporal Data','10.1007/978-3-030-65742-0_9'),
 'fredriksson_2025_travel_demand_tv.pdf':('https://link.springer.com/content/pdf/10.1007/s42421-025-00141-5.pdf','A Fully Neural Network-Based Travel Demand and Scheduling Model, Covering Activities, Destinations, and Modes of Transportation','10.1007/s42421-025-00141-5'),
}
def inspect_pdf(path):
 data=path.read_bytes()
 if not data.startswith(b'%PDF-'):raise ValueError(f'{path.name}: response is not a PDF')
 info=subprocess.run(['pdfinfo',str(path)],check=True,text=True,capture_output=True).stdout
 pages=int(next(line.split(':',1)[1].strip() for line in info.splitlines() if line.startswith('Pages:')))
 return {'bytes':len(data),'pages':pages,'sha256':hashlib.sha256(data).hexdigest()}

def fetch(item,previous,offline):
 name,(url,title,doi)=item
 dest=PAPERS/name
 if dest.is_file():
  details=inspect_pdf(dest)
  if previous and details['sha256']==previous.get('sha256'):return name,previous
  if offline:raise ValueError(f'{name}: SHA-256 differs or no provenance recorded')
 elif offline:raise FileNotFoundError(dest)
 req=urllib.request.Request(url,headers={'User-Agent':'UTEC-Atlas-literature-review/1.0'})
 with urllib.request.urlopen(req,timeout=60) as r:
  data=r.read();resolved=r.url
 tmp=dest.with_suffix('.pdf.partial')
 try:
  tmp.write_bytes(data)
  details=inspect_pdf(tmp)
  tmp.replace(dest)
 finally:
  tmp.unlink(missing_ok=True)
 return name,{'source_url':url,'resolved_url':resolved,'title':title,'doi':doi,'retrieved_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),**details,'redistribution':'Consultation copy. Check the licence of the specific version before redistribution.'}

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--offline',action='store_true',help='Validate local PDFs against recorded SHA-256')
 args=parser.parse_args()
 PAPERS.mkdir(parents=True,exist_ok=True);manifest=PAPERS/'sources.json';entries=json.loads(manifest.read_text()) if manifest.exists() else {}
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  jobs={pool.submit(fetch,item,entries.get(item[0]),args.offline):item[0] for item in SOURCES.items()}
  errors=[]
  for job in concurrent.futures.as_completed(jobs):
   try:
    name,item=job.result();entries[name]=item
    print(f'{name}: {item["pages"]} pages, {item["bytes"]} bytes',flush=True)
   except Exception as exc:
    errors.append(jobs[job]);print(f'FAILED {jobs[job]}: {exc}',flush=True)
 if not args.offline:manifest.write_text(json.dumps(entries,ensure_ascii=False,indent=2)+'\n')
 if errors:raise SystemExit('Failed PDFs: '+', '.join(errors))
if __name__=='__main__':main()
