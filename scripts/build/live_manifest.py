"""Generate expected online JSON digests and browser anchors from the published commit."""
from hashlib import sha256
import json
from pathlib import Path
import subprocess
import sys

site=Path(sys.argv[1])
output=Path(sys.argv[2])
files=["update-center/status.json","biosimilars/data/medicare.json","medical-insurance/trends.json",
       "vaccines/center-updates.json","blood-products/center-updates.json"]
files.extend(str(x.relative_to(site/"v2")) for x in (site/"v2").glob("*/public-data/*.json"))
hashes={f"v2/{x}":sha256((site/"v2"/x).read_bytes()).hexdigest() for x in files if (site/"v2"/x).exists()}

def rows(path):
    file=site/"v2"/path
    return json.loads(file.read_text())["records"] if file.exists() else []

finance=[r for r in rows("pharmacy/public-data/financials.standard.json") if r["ticker"]=="603939.SH"]
cms=[r["item"]["period"] for r in rows("biosimilars/public-data/cms.partb-values.json")
     if r.get("period_meta",{}).get("kind")=="cumulative"]
monthly={}
for topic,feed in {"api":"api","medical-devices":"devices","vaccines":"vax"}.items():
    values=rows(f"{topic}/public-data/{feed}.trade-monthly.json")
    if values:
        monthly[topic]={k:values[-1][k] for k in ("period","product","flow")}
agency=rows("vaccines/public-data/vax.agency-coverage.json")
known=subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip()
data={"commit":known,"hashes":hashes,"finance":{k:finance[-1][k] for k in ("ticker","period")} if finance else None,
      "cms":max(cms,default=None),"monthly":monthly,
      "agency":{"period":agency[-1]["period"],"total":agency[-1]["registered_agencies"]} if agency else None}
output.write_text(json.dumps(data,indent=2)+"\n")
