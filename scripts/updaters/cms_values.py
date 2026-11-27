"""Extract CMS public-use file values for existing study cohorts."""
import csv
from datetime import date
import io
import json
from pathlib import Path
import re
import tempfile

from biosimilars.build_medicare import load_annual, load_payments, load_quarterly, read_value
from research.insulin_classification import classify
from updaters.http import SourceUnavailable

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


def extract_b(root, kind, filename, snapshot, model):
    codes={p["code"]:g["unit"] for g in model["groups"] for p in g["products"]}
    if kind=="annual":
        return load_annual(root/filename,codes)
    if kind=="quarterly":
        return load_quarterly(root/filename,codes,model["quarterLabels"])
    if kind.startswith("asp-"):
        quarter=kind.removeprefix("asp-")
        return load_payments(root,{quarter:snapshot["paymentPeriods"][quarter]},codes)
    raise ValueError(f"Unknown CMS data kind {kind}")


def collect(spec,http,start,end):
    if spec.get("part_d"):
        address=spec["source_url"]
        raw=http.get(address,limit=18_000_000)
        rows=part_d(raw)
        return {"records":[{**row,"id":f"{row['year']}/{row['brand']}/{row['generic']}",
                   "period":row["year"]+"-01-01","source":address,"basis":"annual drug gross spending (USD)"}
                   for row in rows if start<=row["year"]+"-01-01"<=end]}
    snapshot=json.loads((ROOT/"v2/biosimilars/data/medicare.json").read_text())
    model=json.loads((ROOT/"scripts/biosimilars/medicare-map.json").read_text())
    urls={k:snapshot["sources"][k]["file"] for k in ("annual","quarterly")}
    # Refresh the pinned price releases as well as charges/utilization.
    quarters=[q for q in snapshot["paymentPeriods"] if start[:4]<=q[:4]<=end[:4]]
    for q in sorted(quarters)[-4:]:
        urls[f"asp-{q}"]=snapshot["paymentPeriods"][q]["url"]
    problems=[]
    result=[]
    with tempfile.TemporaryDirectory() as directory:
        root=Path(directory)
        for kind,url in urls.items():
            try:
                raw=http.get(url,limit=25_000_000)
                filename=kind+(".zip" if kind.startswith("asp-") else ".csv")
                (root/filename).write_bytes(raw)
                rows=extract_b(root,kind,filename,snapshot,model)
                for item in rows:
                    label=item["period"]
                    month=1 if "Q" not in label else (int(label.split("Q")[1])-1)*3+1
                    period=f"{label[:4]}-{month:02d}-01"
                    if start<=period<=end:
                        result.append({"id":f"{kind}/{label}/{item['code']}","period":period,"source":url,
                                       "basis":"CMS distinct metrics per original file","kind":kind,"item":item})
            except (SourceUnavailable,ValueError,AssertionError,IndexError,KeyError) as error:
                problems.append(f"{kind}: {type(error).__name__}")
    if not result and problems:
        raise SourceUnavailable("; ".join(problems))
    return {"records":result,"warnings":problems}
