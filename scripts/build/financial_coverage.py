"""Publish a field and evidence matrix while preserving native reporting periods."""
import csv
from datetime import date
import json
from pathlib import Path
import re

FIELDS={"revenue":"营业收入","cost":"营业成本","net_profit":"归母净利润","ar":"贸易应收",
        "ap":"贸易应付","inventory":"存货","operating_cash_flow":"经营现金流","capex":"资本开支",
        "selling":"单列销售费用","admin":"管理费用","rd":"研发费用","finance":"财务费用或利息费用",
        "sga":"销售及管理费用合计"}
A={"SH","SZ","BJ"}
HTML_SOURCE_FIELDS={"revenue":"当年累计收入","cost":"当年累计营业成本",
                    "ar":"贸易应收","ap":"贸易应付","inventory":"存货"}


def csv_rows(path):
    with path.open(encoding="utf-8-sig",newline="") as stream:
        return list(csv.DictReader(stream))


def quarter_day(value):
    year,q=value.split("Q")
    return year+("-03-31","-06-30","-09-30","-12-31")[int(q)-1]


def source_records(repo):
    found={}
    for path in sorted((repo/"v2").glob("*/working-capital-inputs.csv")):
        for row in csv_rows(path):
            key=(row.get("代码"),row.get("季度"))
            source=row.get("定期报告","")
            if not key[1] or not re.fullmatch(r"20\d\dQ[1-4]",key[1]) or not source.startswith("https://"):
                continue
            pages={"balance":row.get("已定位合并资产负债表 PDF 页"),
                   "income":row.get("已定位合并利润表 PDF 页")}
            found[key[0],quarter_day(key[1])]={"document":source.split("#")[0],"pages":pages,
                        "announced":row.get("报表公告日期") or None}
    return found


def build(repo, site):
    tickers=json.loads((repo/"config/company_registry.json").read_text())["companies"]
    coverage={t["ticker"]:{"name":t["name"],"market":t["market"],"records":[]} for t in tickers}
    lookup=source_records(repo)
    path=site/"v2/pharmacy/public-data/financials.standard.json"
    items=json.loads(path.read_text())["records"] if path.exists() else []
    for item in items:
        company=coverage[item["ticker"]]
        meta=item.get("filing",{})
        issuer=lookup.get((item["ticker"].split(".")[0],item["period"]),{}) if item["market"] in A else {}
        original=issuer.get("document") or meta.get("document_url") or (item["source"] if item["market"]=="US" else None)
        provenance="quarterly_us" if item["market"]=="US" else "quarterly_cn"
        applicable=[k for k in FIELDS if k!="sga" or item["market"]=="US"]
        present=[k for k in applicable if item.get(k) is not None]
        company["records"].append({"period":item["period"],"currency":item["currency"],"mode":provenance,
            "announced":issuer.get("announced") or meta.get("announced"),"source":original,
            "locator":item["source"],"fields":present,"eligible":applicable,
            "pages":issuer.get("pages",{}),"tags":meta.get("tags",{}),
            "versions":meta.get("accessions") or meta.get("statement_dates",{})})
    for p in (site/"v2").glob("*/overseas-inputs.csv"):
        for row in csv_rows(p):
            ticker=row["代码"]+(".HK" if row["代码"].isdigit() else ".US")
            if ticker not in coverage:
                continue
            date.fromisoformat(row["期末"])
            source=row.get("来源") or None
            markers=[field for field,label in HTML_SOURCE_FIELDS.items() if row.get(label,"").strip()]
            company=coverage[ticker]
            new={"period":row["期末"],"currency":row["原币"],"mode":"native_verified_history",
                 "source":source if source and source.startswith("https://") else None,
                 "fields":markers,"eligible":list(FIELDS),"pages":{},"tags":{},"versions":{}}
            if new not in company["records"]:
                company["records"].append(new)
    for company in coverage.values():
        company["records"].sort(key=lambda x:x["period"])
    output=site/"v2/update-center/financial-coverage.json"
    output.write_text(json.dumps({"fields":FIELDS,"companies":coverage},ensure_ascii=False,separators=(",",":"))+"\n")
