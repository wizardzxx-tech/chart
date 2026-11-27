"""Find issuer PDF evidence and stage definitions with exact page coordinates."""
from datetime import date,timedelta
from decimal import Decimal
from hashlib import sha256
import json
import os
from pathlib import Path
import re
import subprocess
from tempfile import TemporaryDirectory

from research.checks import unit
from updaters.filings import china
from updaters.http import SourceUnavailable

ROOT=Path(__file__).resolve().parents[2]
SCHEMA=ROOT/"config/operating_metrics.json"
TARGET="v2/update-center/operating-metrics.json"


def schema():
    return json.loads(SCHEMA.read_text())


def period_of(title):
    match=re.search(r"(20\d{2})\s*年\s*(半年度|年度|第?[一三]季度)(?:主要经营数据|报告)",title)
    if not match:
        return None,None
    field={"半年度":("06-30","half"),"年度":("12-31","annual"),"第一季度":("03-31","quarter"),
           "一季度":("03-31","quarter"),"第三季度":("09-30","quarter"),"三季度":("09-30","quarter")}[match[2]]
    return match[1]+"-"+field[0],field[1]


def pages(raw):
    if not raw.startswith(b"%PDF"):
        raise ValueError("公告链接未返回 PDF")
    with TemporaryDirectory() as base:
        file=Path(base)/"source.pdf"
        file.write_bytes(raw)
        converter=os.environ.get("PDFTOTEXT","pdftotext")
        try:
            result=subprocess.run([converter,"-layout",str(file),"-"],check=True,capture_output=True,
                                  timeout=35).stdout.decode("utf-8")
        except (FileNotFoundError,subprocess.SubprocessError,UnicodeError) as error:
            raise ValueError(f"PDF 文本提取失败 · {type(error).__name__}") from None
    return result.split("\f")


def extract(ticker,title,published,url,raw):
    config=schema()
    stamp,mode=period_of(title)
    if not stamp:
        return []
    output=[]
    found={}
    rules=config["issuers"].get(ticker,{})
    for page,text in enumerate(pages(raw),1):
        compact=" ".join(text.split())
        compact=re.sub(r"\s*([，,；;（(）)])\s*",r"\1 ",compact)
        compact=re.sub(r"(?<=\d), (?=\d{3}(?:[,\. ]|$))",",",compact)
        for metric,pattern in rules.items():
            topic,label,unit_name,declared,scope=config["metrics"][metric]
            if declared=="quarter" and mode!="quarter":
                continue
            for match in re.finditer(pattern,compact):
                value=Decimal(match[1].replace(",",""))*config["unit_scale"].get(metric,1)
                if value<0:
                    continue
                found.setdefault(metric,[]).append((value,page,match[0][:100]))
    digest=sha256(raw).hexdigest()
    for metric,observations in found.items():
        if len({x[0] for x in observations})!=1:
            continue
        value,page,text=observations[0]
        topic,label,unit_name,declared,scope=config["metrics"][metric]
        basis=mode if declared=="reported" else declared
        output.append({"id":f"{ticker}/{stamp}/{metric}/{basis}","period":stamp,"topic":topic,
            "ticker":ticker,"metric":metric,"label":label,"unit":unit_name,"period_kind":basis,"scope":scope,
            "value":float(value),"page":page,"excerpt":text,"source":url,
            "published":published,"pdf_sha256":digest,"extraction":"rule"})
    return sorted(output,key=lambda row:row["id"])


def collect(spec,http,start,end):
    policy=schema()
    registry=json.loads((ROOT/"config/company_registry.json").read_text())["companies"]
    notices=[]
    checks=[]
    seed=policy["seeds"]
    for company in [r for r in registry if r["ticker"] in policy["issuers"]]:
        ticker=company["ticker"]
        lower=max(start,(date.fromisoformat(end)-timedelta(days=55)).isoformat())
        candidates={(title,url):published for code,title,published,url in seed if code==ticker and published<=end}
        checked=True
        try:
            docs,_=china(company,http,lower,end)
            for published,title,url in docs:
                period,_=period_of(title)
                if period and "补充" not in title:
                    same=next((k for k in candidates if period_of(k[0])[0]==period),None)
                    if same and "更正" not in title and "修订" not in title:
                        continue
                    candidates[(title,url)]=published
        except (ValueError,SourceUnavailable,KeyError,TypeError):
            checked=False
        extracted=0
        failures=[]
        for (title,url),published in candidates.items():
            stamp,mode=period_of(title)
            if not stamp or stamp>end:
                continue
            try:
                raw=http.get(url,limit=24_000_000)
                trial=extract(ticker,title,published,url,raw)
                if not trial:
                    raise ValueError("现有规则无可确认字段")
                extracted+=len(trial)
                notices.append({"title":f"{ticker} · {title} · 经营指标","url":url,"period":stamp,
                    "published":published,"indicators":" / ".join(row["label"] for row in trial),
                    "dataset_checksum":sha256(raw).hexdigest(),"ticker":ticker,"document_title":title,
                    "candidates":trial,"review_type":"operating"})
            except (SourceUnavailable,ValueError,KeyError,TypeError) as error:
                failures.append(f"{title}: {error}")
                notices.append({"title":f"{ticker} · {title} · 经营指标待人工取值","url":url,"period":stamp,
                    "published":published,"indicators":"经营披露 · 定义与页码待核","ticker":ticker,
                    "document_title":title,"candidates":[],"review_type":"operating"})
        checks.append(unit(ticker,"issuer PDF",end,"records" if extracted else "failed" if failures or not checked else "no_new",
                           count=extracted,detail="；".join(failures) or ("公告分页未读取" if not checked else None)))
    return {"notices":notices,"checks":checks}
