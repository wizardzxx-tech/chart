"""Track separately identified monthly customs source series."""
from collections import defaultdict
from datetime import date,timedelta
from decimal import Decimal
from hashlib import sha256
import json
from pathlib import Path
import re
from urllib.parse import urlencode
from urllib.robotparser import RobotFileParser

from bs4 import BeautifulSoup

from research.checks import unit
from research.trade_units import metric
from updaters.comtrade import periods
from updaters.http import SourceUnavailable
from updaters.trade_values import period_start,products_for

BASE="https://comtradeapi.un.org/public/v1"
QUOTES="https://www.gtradedata.com"
ROOT=Path(__file__).resolve().parents[2]
UNITS={"千克":"kg","公斤":"kg","台":"台","个":"个","套":"套","件":"件","只":"只","支":"支"}


def record(code,flow,period,source,series,amount,qty,quantity_unit,quality,asp,version):
    return {"id":f"{series}/{code}/{period}/{flow}","period":period,"source":source,
        "basis":"China national single month USD, provider series preserved","period_kind":"single_month",
        "product":code,"code":code,"flow":flow,"series":series,"amount":amount,"qty":qty,
        "unit":quantity_unit,"quality":quality,"asp":asp,"version":version}


def quote_rows(body,code,url):
    soup=BeautifulSoup(body,"html.parser")
    parsed=[]
    for mode,flow,title in [("export","X","出口"),("import","M","进口")]:
        panel=soup.select_one("#hscode-panel-"+mode)
        if not panel:
            continue
        heading=panel.select_one(".gtd-hs-detail-eyebrow")
        subtitle=panel.select_one(".gtd-hs-report-subtitle")
        if not heading or not subtitle:
            if f"暂无{title}记录" in panel.get_text(" ",strip=True):
                continue
            raise ValueError("公开摘要的结构已变化")
        stamp=re.fullmatch(rf"中国{title}\s*·\s*(20\d\d)年(\d{{1,2}})月",heading.get_text(" ",strip=True))
        if not stamp or not re.search(rf"\bHS Code {code}\b",subtitle.get_text(" ",strip=True)):
            raise ValueError("来源未明确标明全国单月、税号及方向")
        if panel.get("data-hs-combined")!="0":
            raise ValueError("合并报告不能作为单月数据")
        period=date(int(stamp[1]),int(stamp[2]),1).isoformat()
        fields={el.dt.get_text(strip=True):el.dd for el in panel.select(".gtd-hs-metrics > div")}
        def value(label):
            field=fields.get(title+label)
            if not field or not field.small:
                return None,None
            raw="".join(field.find_all(string=True,recursive=False)).strip().replace(",","")
            return (Decimal(raw) if re.fullmatch(r"\d+(?:\.\d+)?",raw) else None),field.small.get_text(strip=True)
        amount,currency=value("金额")
        qty,reported=value("数量")
        if amount is None or currency!="美元":
            raise ValueError("金额缺失或非美元")
        quantity_unit=UNITS.get(reported)
        if not quantity_unit:
            qty=None
        # The published HS8 includes parts and configurations not verified as
        # device counts. Preserve the reported amount and source separately.
        unresolved=code in ("90181210","90181291")
        parsed.append(record(code,flow,period,url,"customs-summary",float(amount),
           float(qty) if qty is not None and not unresolved else None,
           quantity_unit if not unresolved else None,
           "原摘要申报单位；整机和零件未拆" if unresolved else "第三方公开摘要",
           float(amount/qty) if qty and not unresolved else None,sha256(body).hexdigest()))
    if not parsed:
        raise ValueError("公开报价页未发现合格的月报")
    return parsed


def collect_quotes(spec,http,start,end):
    due=(date.fromisoformat(end).replace(day=1)-timedelta(days=1)).replace(day=1).isoformat()
    robot=RobotFileParser()
    robot.parse(http.get(QUOTES+"/robots.txt").decode("utf-8").splitlines())
    rows,checks,mapping=[],[],{}
    for code in spec["products"]:
        if spec.get("review_unit") not in (None,code):
            continue
        url=f"{QUOTES}/report/{code}.html"
        try:
            if not robot.can_fetch(http.session.headers["User-Agent"],url):
                raise SourceUnavailable("Provider robots instructions disallow this report")
            parsed=quote_rows(http.get(url),code,url)
            for item in parsed:
                if item["period"]>end:
                    raise ValueError("来源包含未来统计期")
                if item["period"]>=start:
                    rows.append(item)
                    mapping[item["id"]]=code
            latest=max(r["period"] for r in parsed)
            status="records" if any(start<=r["period"]<=end for r in parsed) else "no_new"
            checks.append(unit(code,"HS8 public summary",due,status,latest=latest,count=len(parsed)))
            if len(parsed)<2:
                missing=({"X","M"}-{p["flow"] for p in parsed}).pop()
                checks.append(unit(f"{code}/{missing}","flow",due,"uncovered",detail="未披露该方向的独立全国月报"))
        except (SourceUnavailable,ValueError,KeyError,TypeError,ArithmeticError) as error:
            checks.append(unit(code,"HS8 public summary",due,"failed",detail=error))
    return {"records":rows,"checks":checks,"record_units":mapping}


def collect_standard(spec,http,start,end):
    last=(date.fromisoformat(end).replace(day=1)-timedelta(days=1)).isoformat() if not spec.get("backfill") else end
    wanted=periods(start,last,"M")
    checks,rows,mapping=[],[],{}
    catalog=f"{BASE}/getDa/C/M/HS"
    published={}
    for offset in range(0,len(wanted),12):
        window=wanted[offset:offset+12]
        try:
            payload=json.loads(http.get(catalog,params={"reporterCode":156,"period":",".join(window)}))
            if payload.get("count")!=len(payload["data"]) or payload.get("error"):
                raise ValueError("官方发布目录结构不完整")
            known={str(r["period"]):r for r in payload["data"] if r.get("reporterCode")==156
                   and r.get("isOriginalClassification") and r.get("freqCode")=="M" and str(r["period"]) in window}
            checks.append(unit(f"directory/{window[0]}","HS6 catalog",period_start(window[-1]),
               "records" if known else "unpublished",latest=period_start(max(known)) if known else None,count=len(known)))
            published.update(known)
        except (SourceUnavailable,ValueError,KeyError,TypeError) as error:
            checks.append(unit(f"directory/{window[0]}","HS6 catalog",period_start(window[-1]),"failed",detail=error))
    # Backfill explicitly requested windows. Normal runs retain every previously
    # published observation and prioritize the last three official releases.
    targets=sorted(published,reverse=True)
    if not spec.get("backfill"):
        targets=targets[:3]
    products={p["code"]:p for p in products_for(spec["topic"])}
    configured=spec["products"]
    for period in targets:
        identifier="hs6/"+period
        if spec.get("review_unit") not in (None,identifier):
            continue
        params={"reporterCode":156,"period":period,"cmdCode":",".join(configured),
                "partnerCode":0,"flowCode":"X,M","maxRecords":500}
        url=f"{BASE}/preview/C/M/HS?"+urlencode(params)
        stamp=period_start(period)
        try:
            raw=http.get(url)
            payload=json.loads(raw)
            if payload.get("count")!=len(payload["data"]) or payload.get("error"):
                raise ValueError("HS6 原表不完整")
            observed=set()
            candidates=[]
            for item in payload["data"]:
                code=item["cmdCode"]
                flow=item["flowCode"]
                scope=(item["reporterCode"],str(item["period"]),item["partnerCode"],item["partner2Code"],
                       item["customsCode"],item["motCode"],str(item["mosCode"]))
                if (scope!=(156,period,0,0,"C00",0,"0") or not item["isOriginalClassification"]
                        or code not in configured or flow not in ("X","M") or (code,flow) in observed):
                    raise ValueError("HS6 全国合计、编码、运输方式或报告期与请求不符")
                observed.add((code,flow))
                amount=item["primaryValue"]
                if not isinstance(amount,(int,float)) or amount<0:
                    raise ValueError("HS6 美元金额缺失")
                declared="unit" if products.get(code,{}).get("basis")=="unit" or code=="902212" else "kg"
                qty,quality,_=metric(item,declared)
                candidates.append(record(code,flow,stamp,url,"comtrade-standard-hs6",amount,qty,
                     "number" if declared=="unit" else "kg",quality,
                     amount/qty if qty and quality in ("原表","申报") else None,sha256(raw).hexdigest()))
            checks.append(unit(identifier,"HS6 world",stamp,"records" if candidates else "uncovered",
               latest=stamp if candidates else None,count=len(candidates)))
            for code in configured:
                for flow in ("X","M"):
                    if (code,flow) not in observed:
                        checks.append(unit(f"{code}/{period}/{flow}","HS6 / flow",stamp,"uncovered",
                                           detail="全国合计原表查无该编码与方向"))
            rows.extend(candidates)
            mapping.update({row["id"]:identifier for row in candidates})
        except (SourceUnavailable,ValueError,KeyError,TypeError) as error:
            checks.append(unit(identifier,"HS6 world",stamp,"failed",detail=error))
    return {"records":rows,"checks":checks,"record_units":mapping}


def archive_rows(body,code,url):
    soup=BeautifulSoup(body,"html.parser")
    heading=soup.select_one("h1")
    label=heading.get_text(" ",strip=True) if heading else ""
    if not label.startswith(code+" "):
        raise ValueError("归类通税号与请求不符")
    product_label=label[len(code):].strip()
    title=next((h for h in soup.select("h2") if h.get_text(strip=True)=="近 12 个月进出口趋势"),None)
    if not title:
        raise ValueError("公开历史月表不可用")
    group=title.find_parent("div",class_="divide-y")
    parsed=[]
    for block in group.select("details"):
        label=block.find("h3")
        flow={"出口":"X","进口":"M"}.get(label.get_text(strip=True) if label else "")
        if not flow:
            continue
        cols=[th.get_text(strip=True) for th in block.select("th")]
        if cols[:2]!=["月份","金额(万美元)"]:
            raise ValueError("公开金额单位与规则不符")
        for row in block.select("tbody tr"):
            period,amount,*_=[x.get_text(strip=True) for x in row.select("td")]
            match=re.fullmatch(r"(20\d\d)年(\d{1,2})月",period)
            money=re.fullmatch(r"([\d,.]+)(万|亿)?",amount)
            if not match or not money:
                raise ValueError("不能确认公开月表的统计期或金额")
            number=Decimal(money[1].replace(",",""))*{"万":10000,"亿":100000000,None:10000}[money[2]]
            stamp=date(int(match[1]),int(match[2]),1).isoformat()
            item=record(code,flow,stamp,url,"hs-reference-archive",float(number),None,None,
                        "公开表四舍五入展示；无申报数量",None,sha256(body).hexdigest())
            parsed.append({**item,"product_label":product_label})
    if not parsed or len({r["id"] for r in parsed})!=len(parsed):
        raise ValueError("历史金额记录缺失或重复")
    return parsed


def collect_archive(spec,http,start,end):
    base="https://hsguilei.com"
    robot=RobotFileParser()
    robot.parse(http.get(base+"/robots.txt").decode("utf-8").splitlines())
    topic=spec["topic"]
    feed={"api":"api","medical-devices":"devices","vaccines":"vax"}[topic]
    annual=ROOT/"v2"/topic/"public-data"/f"{feed}.trade-values.json"
    comparable={}
    if annual.exists():
        for row in json.loads(annual.read_text())["records"]:
            if len(row["code"])==8 and row.get("amount") is not None:
                comparable[row["code"],row["period"][:4],row["flow"]]=row["amount"]
    rows,checks,mapping=[],[],{}
    for code in spec["products"]:
        if spec.get("review_unit") not in (None,code):
            continue
        url=base+"/hs/"+code
        try:
            if not robot.can_fetch(http.session.headers["User-Agent"],url):
                raise SourceUnavailable("Provider robots instructions disallow this report")
            found=archive_rows(http.get(url),code,url)
            parts=defaultdict(float)
            for row in found:
                parts[row["period"][:4],row["flow"]]+=row["amount"]
            for (year,flow),amount in parts.items():
                cap=comparable.get((code[:8],year,flow))
                if cap is not None and amount>cap+max(10000,cap*.01):
                    raise ValueError(f"{year} {flow} 已展示的 HS10 月份金额合计超过已核对的 HS8 全年值")
            selected=[x for x in found if start<=x["period"]<=end]
            last=max((x["period"] for x in selected),default=None)
            checks.append(unit(code,"HS10 public history",last or end,"records" if selected else "no_new",
                               count=len(selected),latest=last))
            rows.extend(selected)
            mapping.update({x["id"]:code for x in selected})
        except (ValueError,SourceUnavailable,TypeError,KeyError,ArithmeticError) as error:
            checks.append(unit(code,"HS10 public history",end,"failed",detail=error))
    return {"records":rows,"checks":checks,"record_units":mapping}


def collect(spec,http,start,end):
    if not spec.get("backfill"):
        start=max(start,spec["incremental_start"])
    collectors={"public_summary":collect_quotes,"standard":collect_standard,"public_history":collect_archive}
    return collectors[spec["upstream"]](spec,http,start,end)
