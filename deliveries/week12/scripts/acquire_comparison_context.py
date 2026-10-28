#!/usr/bin/env python3
"""Archive source evidence for the 181 St (1) comparison warning.

This is a documented service event, not an outlier-detection threshold. Raw
pages stay in ignored data/raw; the small provenance record is shareable.
"""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'mta_closure': 'https://apps.cio.ny.gov/apps/mediacontact/public/view.cfm?parm=05263848-E4F1-92EC-B38BB3829F9FE33D',
    'reopening_report': 'https://patch.com/new-york/washington-heights-inwood/wash-heights-181st-street-1-station-reopens-new-elevators',
}

def main():
    raw = ROOT / 'data/raw/comparison_context'
    raw.mkdir(parents=True, exist_ok=True)
    records = []
    for key, url in SOURCES.items():
        record = {'source': key, 'url': url, 'query': 'HTTP GET, public article, no analytical filters', 'retrieved_at_utc': datetime.now(timezone.utc).isoformat()}
        try:
            with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0 (research provenance archive)'}), timeout=25) as response:
                body = response.read()
                record.update(status=response.status, resolved_url=response.url, sha256=hashlib.sha256(body).hexdigest(), bytes=len(body))
            path = raw / (key + '.html')
            path.write_bytes(body)
            record['raw_file'] = str(path.relative_to(ROOT))
        except Exception as error:
            record.update(status='unavailable', error=str(error))
        records.append(record)
    output = ROOT / 'data/comparison_context/provenance.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'station_complex_id': '301', 'affected_comparison_year': 2021, 'sources': records}, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(records, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
