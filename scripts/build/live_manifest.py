"""Generate expected online JSON digests and browser anchors from the published commit."""
from hashlib import sha256
import json
from pathlib import Path
import subprocess
import sys

site=Path(sys.argv[1])
output=Path(sys.argv[2])
files=["update-center/status.json","biosimilars/data/medicare.json","medical-insurance/trends.json",
       "vaccines/center-updates.json","blood-products/center-updates.json",
       "update-center/financial-coverage.json","update-center/operating-review.json","update-center/operating-metrics.json"]
files.extend(str(x.relative_to(site/"v2")) for x in (site/"v2").glob("*/public-data/*.json"))
hashes={f"v2/{x}":sha256((site/"v2"/x).read_bytes()).hexdigest() for x in files if (site/"v2"/x).exists()}

def rows(path):
    file=site/"v2"/path
    return json.loads(file.read_text())["records"] if file.exists() else []

finance=[r for r in rows("pharmacy/public-data/financials.standard.json") if r["ticker"]=="603939.SH"]
cms=[r["item"]["period"] for r in rows("biosimilars/public-data/cms.partb-values.json")
     if r.get("period_meta",{}).get("kind")=="cumulative"]
monthly={}
fresh_trade={}
reference_trade={}
priority={"api":"30019010","medical-devices":"90221200","vaccines":"30024100"}
reference={"api":"3001901000","medical-devices":"3822190090","vaccines":"3002410090"}
for topic,feed in {"api":"api","medical-devices":"devices","vaccines":"vax"}.items():
    values=rows(f"{topic}/public-data/{feed}.trade-monthly.json")
    if values:
        latest=values[-1]
        series={r["period"]:r for r in values if r["product"]==latest["product"] and r["flow"]==latest["flow"]}
        y,m=map(int,latest["period"][:7].split("-"))
        def month(i):
            return f"{i//12:04d}-{i%12+1:02d}-01"
        n=y*12+m-1
        trail=[series.get(month(i)) for i in range(n-2,n+1)]
        prior=series.get(month(n-12))
        same=lambda r: r and r["code"]==latest["code"] and r["unit"]==latest["unit"]
        monthly[topic]={k:latest[k] for k in ("period","product","flow","amount","qty","asp")}
        monthly[topic]["rolling"]=sum(r["amount"] for r in trail) if all(same(r) for r in trail) else None
        monthly[topic]["growth"]=(latest["amount"]/prior["amount"]-1)*100 if same(prior) and prior["amount"]>0 else None
    picked=[r for r in rows(f"{topic}/public-data/{feed}.trade-summary.json")
            if r["product"]==priority[topic] and r["flow"]=="X"]
    if picked:
        fresh_trade[topic]={k:picked[-1][k] for k in ("period","product","flow","amount","qty","unit","asp")}
    series=[r for r in rows(f"{topic}/public-data/{feed}.trade-reference-history.json")
            if r["product"]==reference[topic] and r["flow"]=="X"]
    if series:
        reference_trade[topic]={k:series[-1][k] for k in ("period","product","amount")}
agency=rows("vaccines/public-data/vax.agency-coverage.json")
known=subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip()
item=next((r["item"] for r in rows("biosimilars/public-data/cms.partb-values.json")
           if r["item"]["period"]==max(cms,default=None) and r["item"]["code"]=="J0178"),None)
cms_full=next((r["item"] for r in rows("biosimilars/public-data/cms.partb-values.json")
               if r["item"]["period"]=="2025FY" and r["item"]["code"]=="J0178" and r.get("approved_revision")),None)
approved_op=rows("update-center/operating-metrics.json")
data={"commit":known,"hashes":hashes,
      "finance":{**{k:finance[-1][k] for k in ("ticker","period")},
                 "quarter_revenue":finance[-1]["quarter"]["revenue"]} if finance else None,
      "cms":max(cms,default=None),"cms_value":item,"cms_full_year":cms_full,"monthly":monthly,
      "fresh_trade":fresh_trade,"reference_trade":reference_trade,
      "operating":next((r for r in reversed(approved_op) if r["metric"]=="plasma_collection"),None),
      "agency":{"period":agency[-1]["period"],"total":agency[-1]["registered_agencies"]} if agency else None}
output.write_text(json.dumps(data,indent=2)+"\n")
