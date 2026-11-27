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
from collections import Counter
from tempfile import TemporaryDirectory

from updaters.cms import puf_editions
from updaters.cms_values import extract_b

results=[]
seen=set()


def replay(label, run):
    try:
        detail=run()
        result={"source":label,"status":"passed","detail":detail}
    except SourceUnavailable as error:
        result={"source":label,"status":"skipped","detail":str(error)}
    except (ValueError, KeyError, AssertionError, OSError) as error:
        result={"source":label,"status":"failed","detail":str(error)}
    results.append(result)
    print(result["status"].upper(),label,result["detail"],flush=True)


def approved_receipt(r,url):
    expected=r["candidate"]
    http=HTTP()
    try:
        if r["dataset_id"]=="operating.metrics":
            from updaters.operating_metrics import extract
            original=expected["records"][0]
            body=http.get(url,limit=24_000_000)
            if sha256(body).hexdigest()!=original["pdf_sha256"]:
                raise ValueError("Operating PDF original changed")
            return expected["period"]
        if r.get("receipt_version")==2 and "approved_revision" not in expected and "id" in expected:
            originals=[item for item in r["files"] if item["url"]==url]
            if not originals:
                raise SourceUnavailable("Receipt requires the authenticated official source to replay")
            if sha256(http.get(url,limit=32_000_000)).hexdigest()!=originals[0]["sha256"]:
                raise ValueError("Structured official original has changed")
            from data_update import load_registry
            from validators.data import validate_records
            spec=next(x for x in load_registry() if x["dataset_id"]==r["dataset_id"])
            validate_records(spec,[expected],[],expected["period"])
            return expected["period"]
        data=http.get(url)
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
            kind=r["dataset_id"].split(".")[0]
            total=sum(x["batches"] for x in report["rows"] if x["kind"]==kind)
            if (total,report["audited_batches"])!=(expected["total"],expected["audited_batches"]):
                raise ValueError("NIFDC replay differs from the approved aggregate")
        return expected["period"]
    finally:
        http.session.close()


def cms_release_switch():
    prior=json.loads((ROOT/"v2/biosimilars/data/medicare.json").read_text())["sources"]["quarterly"]["file"]
    model=json.loads((ROOT/"scripts/biosimilars/medicare-map.json").read_text())
    http=HTTP()
    try:
        editions=puf_editions(http,"quarterly")
        latest=max(editions,key=lambda row:row["period"])
        periods=[]
        for url in (prior,latest["file"]):
            with TemporaryDirectory() as directory:
                path=Path(directory)/"source.csv"
                path.write_bytes(http.get(url))
                values,labels=extract_b(path.parent,{"kind":"quarterly"},path.name,model)
                if len({(r["code"],r["period"]) for r in values})!=len(values):
                    raise ValueError("Repeated CMS codes within period")
                periods.append(set(labels))
        if latest["file"]==prior or not periods[1]-periods[0]:
            raise SourceUnavailable("Official catalog has no newer accessible quarterly release")
        return " / ".join(sorted(periods[1]-periods[0]))
    finally:
        http.session.close()


for path in sorted((ROOT/"logs/reviewed").glob("*.json")):
    r=json.loads(path.read_text())
    expected=r["candidate"]
    url=expected.get("image",expected["source"])
    key=(r["dataset_id"],url)
    if key in seen:
        continue
    seen.add(key)
    replay("/".join((key[0],expected["period"])),lambda:approved_receipt(r,url))

replay("CMS Part B official release switch",cms_release_switch)
counts={key:sum(x["status"]==key for x in results) for key in ("passed","failed","skipped")}
print(json.dumps({"counts":counts,"results":results},ensure_ascii=False),flush=True)
if __import__("os").environ.get("GITHUB_STEP_SUMMARY"):
    import os
    with open(os.environ["GITHUB_STEP_SUMMARY"],"a",encoding="utf-8") as out:
        out.write(f"\n原件回放：通过 {counts['passed']} · 失败 {counts['failed']} · 跳过 {counts['skipped']}\n")
if counts["failed"] or not counts["passed"]:
    sys.exit(1)
