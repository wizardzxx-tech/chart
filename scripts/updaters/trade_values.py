"""Collect and validate actual annual and monthly Comtrade quantities and values."""
from collections import defaultdict
from datetime import date,timedelta
from hashlib import sha256
import json
import os
from pathlib import Path
from urllib.parse import urlencode

from research.checks import GOOD,unit
from research.trade_units import metric, quantity_quality
from updaters.comtrade import periods
from updaters.http import SourceUnavailable

ROOT=Path(__file__).resolve().parents[2]
PREVIEW="https://comtradeapi.un.org/public/v1/previewTariffline/C/{frequency}/HS"


def normalize(payload, period, code, flow, basis, cap=500):
    rows=payload["data"]
    if payload.get("error") or payload["count"]!=len(rows) or len(rows)>=cap:
        raise ValueError("UN Comtrade preview is truncated or failed")
    if not rows:
        return None
    buckets=defaultdict(dict)
    for row in rows:
        if (str(row["period"]),str(row["cmdCode"]),row["flowCode"],row["reporterCode"])!=(period,code,flow,156):
            raise ValueError("Returned period, reporter, product or flow changed")
        if (row["customsCode"],row["motCode"]) not in (("C00",0),("-1",-1)):
            continue
        second=row.get("partner2Code")
        if second not in (-1,0):
            continue
        amount=row["primaryValue"]
        if not isinstance(amount,(int,float)) or amount<0 or row.get("fobvalue" if flow=="X" else "cifvalue") not in (None,amount):
            raise ValueError("USD trade value does not match the nominal trade basis")
        row={"qtyUnitCode":None,"altQtyUnitCode":None,**row}
        quantity,flag,_=metric(row,basis)
        partner=row["partnerCode"]
        # Prefer the published aggregate for the second-partner dimension.
        key=(-1 if second==-1 else 0,row["customsCode"],row["motCode"])
        value=(amount,quantity,flag)
        if key in buckets[partner] and buckets[partner][key]!=value:
            raise ValueError("Conflicting rows at the customs partner grain")
        buckets[partner][key]=value
    aggregates={partner:matches[sorted(matches)[0]] for partner,matches in buckets.items()}
    if not aggregates:
        raise ValueError("No eligible total across customs and transport modes")
    world=aggregates.pop(0,None)
    partners=[[partner,*data] for partner,data in sorted(aggregates.items(),key=lambda x:-x[1][0])]
    partner_total=sum(row[1] for row in partners)
    if world and partners and abs(world[0]-partner_total)>max(100,world[0]*.01):
        raise ValueError("Partner USD values differ from Comtrade world total by more than 1%")
    if world:
        money, quantity, quality=world
        via="全球原表"
        fraction=1 if quantity else 0
    else:
        if not partner_total:
            raise ValueError("Cannot reconstruct world total")
        money=partner_total
        fraction=sum(row[1] for row in partners if row[2] is not None)/money
        quantity=sum(row[2] or 0 for row in partners) if fraction>=.995 else None
        quality=quantity_quality([(r[1],r[2],r[3]) for r in partners],quantity)
        via="逐伙伴合计"
    return {"world":[money,quantity,quality,via,round(fraction,5)],"partners":partners,
            "asp":money/quantity if quantity else None}


def products_for(topic):
    folder=ROOT/"v2"/topic
    master=json.loads((folder/"customs-trade.json").read_text())
    if "parts" not in master:
        return master["products"]
    return [p for f in master["parts"] for p in json.loads((folder/f).read_text())]


def collect(spec,http,start,end):
    frequency=spec.get("upstream_frequency","A")
    if not spec.get("backfill"):
        start=max(start,spec["incremental_start"])
    if frequency=="M" and not spec.get("backfill"):
        end=(date.fromisoformat(end).replace(day=1)-timedelta(days=1)).isoformat()
    wanted=periods(start,end,frequency)
    eligible={}
    checks=[]
    available=set()
    for offset in range(0,len(wanted),12):
        window=wanted[offset:offset+12]
        identifier=f"availability/{window[0]}–{window[-1]}"
        try:
            payload=json.loads(http.get(spec["availability_source"],
                params={"reporterCode":156,"period":",".join(window)}))
            if payload.get("error") or payload["count"]!=len(payload["data"]):
                raise ValueError("Cannot verify availability for the requested scope")
            releases={}
            for row in payload["data"]:
                if row.get("isOriginalClassification") and row["freqCode"]==frequency:
                    if row["reporterCode"]!=156 or str(row["period"]) not in window or row["totalRecords"]<1:
                        raise ValueError("Availability catalog has an inconsistent scope")
                    releases[str(row["period"])]=row
            eligible.update(releases)
            available.update(window)
        except (SourceUnavailable,ValueError,KeyError,TypeError) as error:
            checks.append(unit(identifier,"catalog",period_start(window[-1]),"failed",detail=error))
    previous=spec.get("previous_checks",{})
    published=sorted(eligible,reverse=True)
    if frequency=="M" and not spec.get("backfill"):
        known={key.split("/")[-2] for key in previous if key.count("/")==2}
        known=known.intersection(eligible)
        newest=published[:3]
        backlog=[period for period in published[3:] if period not in known]
        # Widen the window one month per run while revisiting every unfinished
        # check and any edition whose official digest or release has changed.
        published=sorted(set(newest)|known|set(backlog[:1] if known else []),reverse=True)
    rows=[]
    units={}
    exhausted=False
    subscription=os.environ.get("COMTRADE_API_KEY")
    for product in products_for(spec["topic"]):
        code=product["code"]
        if spec.get("products") and code not in spec["products"]:
            continue
        for flow in spec.get("flows",["X","M"]):
            check_id=f"{code}/{frequency}/{flow}"
            if product.get("mappingOnly") or not code.isdigit() or len(code) not in (6,8):
                checks.append(unit(check_id,"HS / flow",end,"uncovered",attempted=False,
                                   detail="缺少可单独查询且匹配本品类的申报编码"))
                continue
            if wanted and wanted[-1] not in eligible and not spec.get("review_unit"):
                last=wanted[-1]
                queried=last in available
                checks.append(unit(f"{code}/{last}/{flow}","HS / flow",period_start(last),
                    "unpublished" if queried else "uncovered",attempted=queried,
                    detail=("官方可用性目录尚无该期中国原始 HS 数据" if queried else
                            "官方可用性查询失败，本编码与方向的最新期无法确认")))
            for period in published:
                identifier=f"{code}/{period}/{flow}"
                if spec.get("review_unit") not in (None,identifier):
                    continue
                stamp=period_start(period)
                original=product.get("history",{}).get(period[:4],code)
                api="previewTariffline" if len(original)==8 else "preview"
                params={"reporterCode":156,"period":period,"cmdCode":original,"flowCode":flow,"maxRecords":500}
                url=PREVIEW.replace("previewTariffline",api).format(frequency=frequency)+"?"+urlencode(params)
                info=eligible[period]
                past=previous.get(identifier,{})
                if (not spec.get("backfill") and past.get("status") in GOOD and past.get("last_ok")
                        and past.get("version")==info.get("lastReleased")
                        and past.get("dataset_checksum") is not None
                        and past["dataset_checksum"]==info.get("datasetChecksum")):
                    checks.append({**past,"status":"unchanged","attempted":False,
                                   "detail":"官方版本与校验值未变，沿用上次通过校验的记录"})
                    continue
                if exhausted:
                    checks.append(unit(identifier,"HS / flow",stamp,"failed",attempted=False,detail="本次 Comtrade 配额已用尽，延后重试"))
                    continue
                limit=500
                request_url=url
                headers=None
                if subscription:
                    limit=2500
                    request_url=(url.replace("/public/v1/previewTariffline/","/data/v1/getTariffline/")
                                    .replace("/public/v1/preview/","/data/v1/get/")
                                    .replace("maxRecords=500",f"maxRecords={limit}"))
                    headers={"Ocp-Apim-Subscription-Key":subscription}
                try:
                    body=http.get(request_url,headers=headers)
                    result=normalize(json.loads(body),period,original,flow,product["basis"],limit)
                    if result is None:
                        checks.append(unit(identifier,"HS / flow",stamp,"uncovered",detail="官方已发布该期，但查询无此编码记录"))
                        continue
                    if frequency=="M":
                        result.pop("partners")
                        if product.get("holdUnitValue") or result["world"][2] not in ("原表","申报"):
                            result["asp"]=None
                    rows.append({"id":f"{original}/{period}/{flow}","period":stamp,
                        "year":int(period[:4]),"flow":flow,"code":original,"product":code,"url":url,"source":url,
                        "unit":"kg" if product["basis"]=="kg" else "number",
                        "basis":"annual tariff-line" if frequency=="A" else "monthly original HS",
                        "method":"UN Comtrade 官方公开预览","amount":result["world"][0],"qty":result["world"][1],
                        "provenance":{"sha256":sha256(body).hexdigest(),"revision":info.get("lastReleased"),
                                      "checksum":info.get("datasetChecksum")},**result})
                    units[rows[-1]["id"]]=identifier
                    checks.append(unit(identifier,"HS / flow",stamp,"records",latest=stamp,count=1))
                    checks[-1].update(version=info.get("lastReleased"),source=url,dataset_checksum=info.get("datasetChecksum"))
                except (ValueError, SourceUnavailable, KeyError, TypeError) as error:
                    exhausted=str(error).startswith("HTTP 429")
                    checks.append(unit(identifier,"HS / flow",stamp,"failed",detail=error))
                    checks[-1]["source"]=url
    if frequency=="M" and published and wanted and wanted[-1]!=published[0]:
        checks.append(unit("latest-release","report",period_start(wanted[-1]),"uncovered",
            latest=period_start(published[0]),detail="最近应查月份的官方数据尚未核实；保留较早已取得的月份"))
    return {"records":rows,"checks":checks,"record_units":units}


def period_start(value):
    return f"{value[:4]}-{value[4:] or '01'}-01"
