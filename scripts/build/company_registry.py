"""Build the issuer registry from the current public topic files."""
from collections import defaultdict
import csv
import json
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[2]
WEB=ROOT/"v2"
roles=defaultdict(set)
issuer={}


def add(topic,code,name,source=None):
    if not code or not name:
        return
    if not "." in code:
        code=code+(".SH" if len(code)==6 and code.startswith("6") else ".SZ" if len(code)==6 and code[0] in "03"
                   else ".BJ" if len(code)==6 else ".HK" if code.isdigit() else ".US")
    number, market=code.upper().split(".")
    if market=="HK":
        number=number.zfill(5)
    ticker=f"{number}.{market}"
    roles[ticker].add(topic)
    primary={"SH":f"https://www.sse.com.cn/assortment/stock/list/info/announcement/index.shtml?productId={number}",
             "SZ":f"https://www.cninfo.com.cn/new/disclosure/stock?stockCode={number}",
             "BJ":"https://www.bse.cn/disclosure/announcement.html",
             "HK":"https://www.hkexnews.hk/", "US":f"https://www.sec.gov/edgar/search/#/q={number}"}.get(market,source)
    issuer.setdefault(ticker,{"ticker":ticker,"name":name,"market":market,"disclosure_url":primary})


for p in WEB.glob("*/working-capital.json"):
    for item in json.loads(p.read_text())["companies"]:
        add(p.parent.name,item["code"],item["name"])
for p in WEB.glob("*/overseas.json"):
    for code,name in json.loads(p.read_text())["companies"].items():
        add(p.parent.name,code,name)
for item in json.loads((WEB/"insulin/data.json").read_text())["companies"].values():
    add("insulin",item["ticker"],item["name"])
for item in json.loads((WEB/"api/research.json").read_text())["companies"]:
    add("api",item["ticker"],item["name"])
bios=json.loads(re.search(r'<script id="snapshot" type="application/json">(.*?)</script>',
                         (WEB/"biosimilars/index.html").read_text(),re.S)[1])
for item in bios["companies"]:
    match=re.search(r"([0-9A-Z]+\.(?:SH|SZ|HK|US))",item["region"])
    if match:
        add("biosimilars",match[1],item["name"],item.get("source"))
# Listed entities cited by the site outside the historical issuer tables.
EXTRA={
 "medical-devices":{"688271.SH":"联影医疗","300760.SZ":"迈瑞医疗","300633.SZ":"开立医疗",
                   "GEHC.US":"GE HealthCare","PHG.US":"飞利浦"},
 "biosimilars":{"AMGN.US":"Amgen","ABBV.US":"AbbVie","JNJ.US":"Johnson & Johnson","PFE.US":"Pfizer",
                "MRK.US":"Merck & Co.","REGN.US":"Regeneron","BMY.US":"Bristol Myers Squibb",
                "BIIB.US":"Biogen","VTRS.US":"Viatris","NVS.US":"Novartis","GSK.US":"GSK",
                "SNY.US":"Sanofi","600276.SH":"恒瑞医药"},
 "insulin":{"NVO.US":"Novo Nordisk","LLY.US":"Eli Lilly","SNY.US":"Sanofi"},
}
for topic, entries in EXTRA.items():
    for code,name in entries.items():
        add(topic,code,name)
CIK={"SVA":1084201,"PHG":313216,"GEHC":1932393,"AMGN":318154,"ABBV":1551152,"JNJ":200406,
     "PFE":78003,"MRK":310158,"REGN":872589,"BMY":14272,"BIIB":875045,"VTRS":1792044,
     "NVS":1114448,"GSK":1131399,"SNY":1121404,"NVO":353278,"LLY":59478}
for key,row in issuer.items():
    row["topics"]=sorted(roles[key])
    if row["market"]=="US" and key.split(".")[0] in CIK:
        row["cik"]=CIK[key.split(".")[0]]
        row["disclosure_url"]=f'https://www.sec.gov/edgar/browse/?CIK={row["cik"]}'
out=ROOT/"config/company_registry.json"
out.write_text(json.dumps({"companies":[issuer[key] for key in sorted(issuer)]},ensure_ascii=False,indent=2)+"\n")
