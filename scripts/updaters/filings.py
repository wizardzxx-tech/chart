"""Check active issuer announcements across mainland, HKEX and SEC listings."""
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
import json
from pathlib import Path
import re
from urllib.parse import quote

from updaters.http import HTTP, SourceUnavailable
from research.checks import unit

ROOT=Path(__file__).resolve().parents[2]
EAST = "https://np-anotice-stock.eastmoney.com/api/security/ann"
SEC = "https://data.sec.gov/submissions/"


def china(company,http,lower,end):
    code=company["ticker"].split(".")[0]
    kind="H" if company["market"]=="HK" else "A"
    papers=[]
    seen=set()
    pages=0
    page_size=50
    last_date="9999-12-31"
    for page in range(1,26):
        body=http.get(EAST,params={"sr":"-1","page_size":page_size,"page_index":page,"ann_type":kind,
                                  "stock_list":code,"f_node":"0","s_node":"0"})
        listing=json.loads(body).get("data")
        if not listing or not isinstance(listing.get("list"),list) or not isinstance(listing.get("total_hits"),int):
            raise ValueError("Issuer announcement count not returned")
        rows=listing["list"]
        pages+=1
        if not rows and page*page_size<listing["total_hits"]:
            raise ValueError("Missing announcement page")
        for item in rows:
            stamp=item["notice_date"][:10]
            if stamp>last_date or item["art_code"] in seen:
                raise ValueError("Issuer announcement pagination is not stable")
            seen.add(item["art_code"]); last_date=stamp
        papers.extend(rows)
        if last_date<lower or page*page_size>=listing["total_hits"]:
            break
        if len(rows)<page_size:
            raise ValueError("Announcement page truncated")
    else:
        raise ValueError("Announcement page budget exhausted before the requested cutoff")
    output=[]
    for item in papers:
        stamp=item["notice_date"][:10]
        label=item["title"].split(":",1)[-1].strip()
        if not lower<=stamp<=end or not re.search(r"季度报告|半年度报告|年度报告|年度業績|中期業績|經營|经营数据|中期報告|中期业绩|年報|股權激勵|股权激励",label):
            continue
        if re.search(r"摘要|英文|说明会|预告|快报|预约",label):
            continue
        key=item["art_code"]
        if not re.fullmatch(r"AN\d+",key):
            raise ValueError("Unexpected issuer notice ID")
        output.append((stamp,label,f"https://pdf.dfcfw.com/pdf/H2_{key}_1.pdf"))
    return output,pages


def usa(company,http,lower,end):
    cik=int(company["cik"])
    http.session.headers["User-Agent"]="HealthcareDataLibrary wizardzxx-tech/chart wizardzxx@qq.com"
    raw=json.loads(http.get(f"{SEC}CIK{cik:010}.json"))
    if int(raw["cik"])!=cik:
        raise ValueError("SEC issuer identity mismatch")
    groups=[raw["filings"]["recent"]]
    for item in raw["filings"].get("files",[]):
        if item["filingFrom"]<=end and item["filingTo"]>=lower:
            groups.append(json.loads(http.get(SEC+quote(item["name"]))))
    output=[]
    seen=set()
    for recent in groups:
        for form,stamp,acc,doc in zip(*(recent[key] for key in ("form","filingDate","accessionNumber","primaryDocument")),strict=True):
            if lower<=stamp<=end and acc not in seen and form in ("10-K","10-Q","20-F","6-K","10-K/A","10-Q/A","20-F/A"):
                seen.add(acc)
                output.append((stamp,form,f'https://www.sec.gov/Archives/edgar/data/{cik}/{acc.replace("-","")}/{quote(doc)}'))
    return output,len(groups)


def collect(spec,http,start,end):
    companies=json.loads((ROOT/"config/company_registry.json").read_text())["companies"]
    if spec.get("review_unit"):
        companies=[item for item in companies if item["ticker"]==spec["review_unit"]]
    notices=[]
    checks=[]
    def lookup(company):
        identifier = company["ticker"]
        status = spec.get("previous_checks",{}).get(identifier,{})
        lower=max(start,spec["review_since"])
        if not spec.get("backfill") and status.get("last_ok"):
            rewind=(date.fromisoformat(status["last_ok"][:10])-timedelta(days=21)).isoformat()
            lower=max(lower, min(end,rewind))
        client=HTTP()
        try:
            source=usa if company["market"]=="US" and "cik" in company else china
            items,pages=source(company,client,lower,end)
            check=unit(identifier,"issuer",end,"records" if items else "no_new",count=len(items))
            check.update(window_start=lower,pages=pages)
            return company,items,client.evidence,check
        except (SourceUnavailable,ValueError,KeyError,TypeError,IndexError) as error:
            return company,[],client.evidence,unit(identifier,"issuer",end,"failed",detail=error)
        finally:
            client.session.close()
    with ThreadPoolExecutor(max_workers=3) as pool:
        for company,items,files,check in pool.map(lookup,companies):
            http.evidence.extend(files)
            checks.append(check)
            for stamp,title,url in items:
                notices.append({"url":url,"title":company["ticker"]+" · "+title,"published":stamp,"period":stamp,
                                "indicators":"/".join(company["topics"])+" · 报表及经营披露"})
    return {"notices":notices,"checks":checks}
