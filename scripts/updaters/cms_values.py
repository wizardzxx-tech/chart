"""Extract CMS public-use file values for existing study cohorts."""
import csv
from datetime import date
from hashlib import sha256
import io
import json
from pathlib import Path
import re
import tempfile

from biosimilars.build_medicare import load_annual, load_payments, load_quarterly, read_value
from research.insulin_classification import classify
from updaters.http import SourceUnavailable
from updaters.cms import asp_editions, puf_editions
from research.checks import unit

ROOT = Path(__file__).resolve().parents[2]


def part_d(raw):
    columns = csv.DictReader(io.StringIO(raw.decode("utf-8-sig")))
    years=sorted({column[-4:] for column in columns.fieldnames if re.fullmatch(r"Tot_Spndng_20\d\d",column)})
    if len(years)!=5:
        raise ValueError("CMS Part D annual column grain changed")
    seen=set()
    out=[]
    for row in columns:
        if row["Mftr_Name"]!="Overall":
            continue
        molecule=classify(row["Gnrc_Name"])
        if not molecule:
            continue
        brand=row["Brnd_Name"]; generic=row["Gnrc_Name"]
        if (brand,generic) in seen:
            raise ValueError("Duplicate CMS drug/product combination")
        seen.add((brand,generic))
        for year in years:
            fields=[row[f"Tot_{suffix}_{year}"] for suffix in ("Spndng","Clms","Benes","Dsg_Unts")]
            if any(fields):
                values=[read_value(field) for field in fields]
                out.append({"year":year,"molecule":molecule,"brand":brand,"generic":generic,
                            "spending":values[0],"claims":values[1],"beneficiaries":values[2],"doses":values[3]})
    return out


def quarter_labels(filename):
    with filename.open(encoding="utf-8-sig",newline="") as handle:
        labels={r["Year"].strip() for r in csv.DictReader(handle)}
    metadata={}
    for label in sorted(labels):
        year=re.search(r"20\d{2}",label)
        quarter=re.search(r"(?:quarter|q)\s*([1-4])",label,re.I)
        if quarter is None:
            quarter=re.search(r"([1-4])(?:st|nd|rd|th)\s*quarter",label,re.I)
        if not year:
            raise ValueError("Unexpected CMS reporting-period label: "+label)
        cumulative=re.fullmatch(r"(20\d{2}) \(Q1-Q([2-4])\)",label)
        if cumulative:
            q=int(cumulative[2])
            suffix="FY" if q==4 else f"YTDQ{q}"
            metadata[label]={"id":f"{cumulative[1]}{suffix}",
                "label":f"{cumulative[1]} 全年" if q==4 else f"{cumulative[1]} Q1–Q{q} 累计",
                "start":f"{cumulative[1]}-01-01","observed":f"{cumulative[1]}-{(q-1)*3+1:02d}-01",
                "kind":"full" if q==4 else "cumulative"}
        elif quarter:
            q=int(quarter[1])
            if re.search(r"YTD|cumulative|(?:[1-4]|Q[1-4])\s*[-–]\s*(?:[1-4]|Q[1-4])",label,re.I):
                raise ValueError("A cumulative window requires a separate CMS comparison basis: "+label)
            iso=f"{year[0]}-{(q-1)*3+1:02d}-01"
            metadata[label]={"id":f"{year[0]}Q{q}","label":f"{year[0]} Q{q}","start":iso,"kind":"quarter"}
        elif re.fullmatch(r"20\d{2}(?:\s*(?:FY|Full Year))?",label,re.I) or re.fullmatch(r"(?:FY|Full Year)\s*20\d{2}",label,re.I):
            metadata[label]={"id":year[0]+"FY","label":year[0]+" 全年","start":year[0]+"-01-01","kind":"full"}
        else:
            raise ValueError("Unrecognized CMS reporting-period label: "+label)
    return metadata


def extract_b(root,edition,filename,model):
    kind=edition["kind"]
    codes={p["code"]:g["unit"] for g in model["groups"] for p in g["products"]}
    if kind=="annual":
        return load_annual(root/filename,codes),{}
    if kind=="quarterly":
        config=quarter_labels(root/filename)
        return load_quarterly(root/filename,codes,config),{x["id"]:x for x in config.values()}
    quarter=kind.removeprefix("asp-")
    return load_payments(root,{quarter:{"url":edition["file"]}},codes),{}


def editions_for(http,keys,start,end):
    requests=[]
    checks=[]
    for key in keys:
        try:
            versions=asp_editions(http) if key=="asp" else puf_editions(http,key)
            if not versions:
                raise ValueError("未发现具备官方文件地址的版本")
            visible=[x for x in versions if x["period"]<=end]
            selected=[x for x in visible if x["period"]>=start][-5 if key=="asp" else -1:]
            if not selected:
                checks.append(unit(key,"file",end,"unpublished",detail="该范围尚无已发布版本"))
            requests.extend(selected)
        except (SourceUnavailable,ValueError,KeyError) as error:
            checks.append(unit(key,"file",end,"failed",detail=error))
    return requests,checks


def collect(spec,http,start,end):
    keys=("partd",) if spec.get("part_d") else ("annual","quarterly","asp")
    start= start if spec.get("backfill") else max(start,spec.get("incremental_start","2020-01-01"))
    requests,checks=editions_for(http,keys,start,end)
    if spec.get("review_unit"):
        requests=[x for x in requests if x["kind"]==spec["review_unit"]]
    model=json.loads((ROOT/"scripts/biosimilars/medicare-map.json").read_text())
    results=[]
    units={}
    with tempfile.TemporaryDirectory() as directory:
        root=Path(directory)
        for edition in requests:
            kind=edition["kind"]
            url=edition["file"]
            try:
                raw=http.get(url,limit=32_000_000)
                if kind=="partd":
                    rows=[{**row,"id":f"{row['year']}/{row['brand']}/{row['generic']}",
                        "period":row["year"]+"-01-01","source":url,"basis":"annual drug gross spending (USD)"}
                        for row in part_d(raw) if start[:4]<=row["year"]<=end[:4]]
                else:
                    filename=kind+(".zip" if kind.startswith("asp-") else ".csv")
                    (root/filename).write_bytes(raw)
                    values,labels=extract_b(root,edition,filename,model)
                    rows=[]
                    for item in values:
                        label=item["period"]
                        meta=labels.get(label,{})
                        quarter=re.search(r"Q([1-4])$",label)
                        month=(int(quarter[1])-1)*3+1 if quarter else 1
                        period=meta.get("observed",f"{label[:4]}-{month:02d}-01") if meta.get("kind")!="full" else meta["start"]
                        if start[:4]<=label[:4]<=end[:4]:
                            row={"id":f"{kind}/{label}/{item['code']}","period":period,"source":url,
                                 "basis":"CMS distinct metrics per original file","kind":kind,"item":item}
                            if label in labels: row["period_meta"]=labels[label]
                            rows.append(row)
                if not rows:
                    raise ValueError("官方文件未包含可用研究样本")
                checks.append(unit(kind,"file",edition["period"],"records",latest=edition["period"],count=len(rows)))
                checks[-1].update(source=url,version=edition.get("modified"),sha256=sha256(raw).hexdigest())
                results.extend(rows)
                units.update({row["id"]:kind for row in rows})
            except (SourceUnavailable,ValueError,AssertionError,IndexError,KeyError,OSError,StopIteration) as error:
                checks.append(unit(kind,"file",edition["period"],"failed",detail=error))
                checks[-1]["source"]=url
    return {"records":results,"checks":checks,"record_units":units}
