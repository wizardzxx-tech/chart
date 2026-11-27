"""Collect and validate actual annual and monthly Comtrade quantities and values."""
from collections import defaultdict
from hashlib import sha256
import json
from pathlib import Path
from urllib.parse import urlencode

from research.trade_units import metric, quantity_quality
from updaters.comtrade import periods
from updaters.http import SourceUnavailable

ROOT=Path(__file__).resolve().parents[2]
PREVIEW="https://comtradeapi.un.org/public/v1/previewTariffline/C/{frequency}/HS"


def normalize(payload, period, code, flow, basis):
    rows=payload["data"]
    if payload.get("error") or payload["count"]!=len(rows) or len(rows)>=500:
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
    topic=spec["topic"]
    frequency=spec.get("upstream_frequency","A")
    start=max(start,spec.get("incremental_start","2024-01-01"))
    wanted=periods(start,end,frequency)
    rows=[]
    errors=[]
    available=spec.get("availability_source")
    if available and wanted:
        payload=json.loads(http.get(available,params={"reporterCode":156,"period":",".join(wanted)}))
        if payload.get("error") or payload["count"]!=len(payload["data"]):
            raise ValueError("Cannot verify availability for the requested scope")
        eligible={str(row["period"]):row for row in payload["data"] if row.get("isOriginalClassification")}
        wanted=[p for p in wanted if p in eligible]
    else:
        eligible={}
    for product in products_for(topic):
        if product["code"] not in spec["products"]:
            continue
        for period in wanted:
            year=period[:4]
            original=product.get("history",{}).get(year,product["code"])
            if len(original)!=8:
                continue
            for flow in spec.get("flows",["X","M"]):
                params={"reporterCode":156,"period":period,"cmdCode":original,"flowCode":flow,"maxRecords":500}
                url=PREVIEW.format(frequency=frequency)+"?"+urlencode(params)
                try:
                    body=http.get(url)
                    result=normalize(json.loads(body),period,original,flow,product["basis"])
                except (ValueError, SourceUnavailable) as error:
                    errors.append(f"{original}/{period}/{flow}: {error}")
                    continue
                if not result:
                    continue
                source_info=eligible.get(period,{})
                if frequency=="A":
                    stamp=year+"-01-01"
                else:
                    stamp=f"{year}-{period[4:6]}-01"
                rows.append({"id":f"{original}/{period}/{flow}", "period":stamp,
                      "year":int(year),"flow":flow,"code":original,"product":product["code"],
                      "url":url,"source":url,"unit":"kg" if product["basis"]=="kg" else "number",
                      "basis":"annual tariff-line" if frequency=="A" else "monthly tariff-line",
                      "method":"UN Comtrade 官方公开预览","amount":result["world"][0],
                      "qty":result["world"][1],
                      "provenance":{"sha256":sha256(body).hexdigest(),"revision":source_info.get("lastReleased"),
                                    "checksum":source_info.get("datasetChecksum")}, **result})
    if not rows and errors:
        raise SourceUnavailable("; ".join(errors)[:300])
    # The API puts request timing and formatting in the JSON envelope.
    # Record its hash in HTTP receipts while comparing substantive statistics.
    return {"records":rows,"warnings":errors}
