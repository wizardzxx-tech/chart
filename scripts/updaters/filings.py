"""Check active issuer announcements across mainland, HKEX and SEC listings."""
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import re
from urllib.parse import quote

from updaters.http import HTTP, SourceUnavailable

ROOT=Path(__file__).resolve().parents[2]
EAST = "https://np-anotice-stock.eastmoney.com/api/security/ann"
SEC = "https://data.sec.gov/submissions/"


def china(company,http,lower,end):
    code=company["ticker"].split(".")[0]
    kind="H" if company["market"]=="HK" else "A"
    body=http.get(EAST,params={"sr":"-1","page_size":30,"page_index":1,"ann_type":kind,
                              "stock_list":code,"f_node":"0","s_node":"0"})
    listing=json.loads(body).get("data")
    if not listing or not isinstance(listing.get("list"),list):
        raise ValueError("Issuer announcements not returned")
    output=[]
    for item in listing["list"]:
        stamp=item["notice_date"][:10]
        label=item["title"].split(":",1)[-1].strip()
        if not lower<=stamp<=end or not re.search(r"季度报告|半年度报告|年度报告|經營|经营数据|中期報告|中期业绩|年報|股權激勵|股权激励",label):
            continue
        if re.search(r"摘要|英文|说明会|预告|快报|预约",label):
            continue
        key=item["art_code"]
        if not re.fullmatch(r"AN\d+",key):
            raise ValueError("Unexpected issuer notice ID")
        output.append((stamp,label,f"https://pdf.dfcfw.com/pdf/H2_{key}_1.pdf"))
    return output


def usa(company,http,lower,end):
    cik=int(company["cik"])
    http.session.headers["User-Agent"]="HealthcareDataLibrary wizardzxx-tech/chart wizardzxx@qq.com"
    raw=json.loads(http.get(f"{SEC}CIK{cik:010}.json"))
    if int(raw["cik"])!=cik:
        raise ValueError("SEC issuer identity mismatch")
    recent=raw["filings"]["recent"]
    output=[]
    for form,stamp,acc,doc in zip(*(recent[key] for key in ("form","filingDate","accessionNumber","primaryDocument")),strict=True):
        if lower<=stamp<=end and form in ("10-K","10-Q","20-F","6-K","10-K/A","10-Q/A","20-F/A"):
            output.append((stamp,form,f'https://www.sec.gov/Archives/edgar/data/{cik}/{acc.replace("-","")}/{quote(doc)}'))
    return output


def collect(spec,http,start,end):
    companies=json.loads((ROOT/"config/company_registry.json").read_text())["companies"]
    lower=max(start,spec["review_since"])
    notices=[]
    failures=[]
    def lookup(company):
        client=HTTP()
        try:
            source=usa if company["market"]=="US" and "cik" in company else china
            return company,source(company,client,lower,end),client.evidence,None
        except (SourceUnavailable,ValueError,KeyError,TypeError) as error:
            return company,[],client.evidence,f"{company['ticker']}: {type(error).__name__}"
        finally:
            client.session.close()
    with ThreadPoolExecutor(max_workers=3) as pool:
        for company,items,files,failure in pool.map(lookup,companies):
            http.evidence.extend(files)
            if failure:failures.append(failure)
            for stamp,title,url in items:
                notices.append({"url":url,"title":company["ticker"]+" · "+title,"published":stamp,"period":stamp,
                                "indicators":"/".join(company["topics"])+" · 报表及经营披露"})
    if len(failures)==len(companies):
        raise SourceUnavailable("No issuer announcements were reachable")
    return {"notices":notices,"warnings":failures}
