#!/usr/bin/env python3
"""Fetch the author/institutional PDFs used in the October 2026 review.

Public readability is not a redistribution licence. Copies stay local by default;
source URLs and SHA-256 remain available to reproduce the academic review.
"""
from pathlib import Path
import concurrent.futures, datetime, hashlib, json, subprocess, urllib.request

ROOT=Path(__file__).resolve().parents[1]
PAPERS=ROOT/'papers'
SOURCES={
 'zeng_2019_raeb.pdf':('https://zeng-wei.com/publication/papers/2019_RAEB.pdf','Route-Aware Edge Bundling for Visualizing Origin-Destination Trails in Urban Traffic','10.1111/cgf.13712'),
 'hurter_2012_kdeeb.pdf':('https://webspace.science.uu.nl/~telea001/uploads/PAPERS/EuroVis12/kdeeb.pdf','Graph Bundling by Kernel Density Estimation','10.1111/j.1467-8659.2012.03079.x'),
 'brehmer_munzner_2013_tasks.pdf':('https://www.cs.ubc.ca/labs/imager/tr/2013/MultiLevelTaskTypology/brehmer_infovis13-corrections.pdf','A Multi-Level Typology of Abstract Visualization Tasks','10.1109/TVCG.2013.124'),
 'gleicher_2011_visual_comparison.pdf':('https://graphics.cs.wisc.edu/Papers/2011/GAWJHR11/paper.pdf','Visual Comparison for Information Visualization','10.1177/1473871611416549'),
 'shneiderman_1996_eyes.pdf':('https://www.cs.umd.edu/users/ben/papers/Shneiderman1996eyes.pdf','The Eyes Have It: A Task by Data Type Taxonomy for Information Visualizations','10.1109/VL.1996.545307'),
 'van_wijk_1999_calendar.pdf':('https://vanwijk.win.tue.nl/clv.pdf','Cluster and Calendar Based Visualization of Time Series Data','10.1109/INFVIS.1999.801851'),
 'hochheiser_2004_timesearcher.pdf':('https://www.cs.umd.edu/users/ben/papers/Hochheiser2004Dynamic.pdf','Dynamic Query Tools for Time Series Data Sets: Timebox Widgets for Interactive Exploration','10.1057/palgrave.ivs.9500061'),
 'haroz_2016_connected_scatterplot.pdf':('https://media.eagereyes.org/papers/2016/Haroz-TVCG-2016.pdf','The Connected Scatterplot for Presenting Paired Time Series','10.1109/TVCG.2015.2502587'),
}
def fetch(item):
 name,(url,title,doi)=item
 req=urllib.request.Request(url,headers={'User-Agent':'UTEC-Atlas-literature-review/1.0'})
 with urllib.request.urlopen(req,timeout=60) as r:
  data=r.read();resolved=r.url
 if not data.startswith(b'%PDF-'):raise ValueError(f'{name}: response is not a PDF')
 dest=PAPERS/name;tmp=dest.with_suffix('.pdf.partial');tmp.write_bytes(data)
 info=subprocess.run(['pdfinfo',str(tmp)],check=True,text=True,capture_output=True).stdout
 pages=int(next(line.split(':',1)[1].strip() for line in info.splitlines() if line.startswith('Pages:')))
 tmp.replace(dest)
 return name,{'source_url':url,'resolved_url':resolved,'title':title,'doi':doi,'retrieved_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'bytes':len(data),'pages':pages,'sha256':hashlib.sha256(data).hexdigest(),'redistribution':'Author/institutional copy; no open redistribution licence asserted. Local consultation copy.'}
def main():
 PAPERS.mkdir(parents=True,exist_ok=True);manifest=PAPERS/'sources.json';entries=json.loads(manifest.read_text()) if manifest.exists() else {}
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  jobs={pool.submit(fetch,item):item[0] for item in SOURCES.items()}
  errors=[]
  for job in concurrent.futures.as_completed(jobs):
   try:
    name,item=job.result();entries[name]=item
    manifest.write_text(json.dumps(entries,ensure_ascii=False,indent=2)+'\n')
    print(f'{name}: {item["pages"]} pages, {item["bytes"]} bytes',flush=True)
   except Exception as exc:
    errors.append(jobs[job]);print(f'FAILED {jobs[job]}: {exc}',flush=True)
 if errors:raise SystemExit('Failed PDFs: '+', '.join(errors))
if __name__=='__main__':main()
