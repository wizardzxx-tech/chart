"""Validate the approved Phase 2 examples against the exact public originals."""
from hashlib import sha256
import json
from pathlib import Path
import sys

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from research import lot, nhsa
from updaters.http import HTTP, SourceUnavailable
from bs4 import BeautifulSoup
from research.lot_parser import parse_tables

ROOT=Path(__file__).resolve().parents[2]
checked=set()
for path in sorted((ROOT/"logs/reviewed").glob("*.json")):
    r=json.loads(path.read_text())
    expected=r["candidate"]
    url=expected.get("image",expected["source"])
    key=(r["dataset_id"],url)
    if key in checked:
        continue
    http=HTTP()
    try:
        data=http.get(url)
    except SourceUnavailable as error:
        print(f"UNAVAILABLE {key[0]} {error}",flush=True)
        continue
    finally:
        http.session.close()
    approved=expected.get("image_sha256") or expected["sha256"]
    if sha256(data).hexdigest()!=approved:
        raise ValueError(f"Original file changed: {url}")
    if "image" in expected:
        found=nhsa.extract_image(data)
        nhsa.validate(found,r["comparison_base"])
        if any(expected[k]!=value for k,value in found.items()):
            raise ValueError("NHSA OCR differs from the approved artifact")
    else:
        html=BeautifulSoup(data,"html.parser")
        report=lot.summarize(parse_tables(html),(expected["start"],expected["period"]),"center")
        kind=key[0].split(".")[0]
        total=sum(x["batches"] for x in report["rows"] if x["kind"]==kind)
        if (total,report["audited_batches"])!=(expected["total"],expected["audited_batches"]):
            raise ValueError("NIFDC replay differs from the approved aggregate")
    checked.add(key)
    print(f"PASS {key[0]} {expected['period']}",flush=True)
if not checked:
    raise SystemExit("No approved original was replayed")
