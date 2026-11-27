"""Fetch standardized A-share filing fields and compatible SEC XBRL facts."""
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
import json
from pathlib import Path

from research.financial_periods import extended, index, quarter_end, quarterly
from research.checks import unit
from updaters.http import HTTP, SourceUnavailable

ROOT = Path(__file__).resolve().parents[2]
EAST = "https://datacenter-web.eastmoney.com/api/data/v1/get"
SEC = "https://data.sec.gov/api/xbrl/companyfacts/"
CONTACT = "HealthcareDataLibrary wizardzxx-tech/chart wizardzxx@qq.com"
TABLES = {
 "RPT_F10_FINANCE_GBALANCE": ("ACCOUNTS_RECE","NOTE_RECE","NOTE_ACCOUNTS_RECE","FINANCE_RECE","INVENTORY",
                             "ACCOUNTS_PAYABLE","NOTE_PAYABLE","NOTE_ACCOUNTS_PAYABLE"),
 "RPT_F10_FINANCE_GINCOME": ("OPERATE_INCOME","OPERATE_COST","PARENT_NETPROFIT","SALE_EXPENSE",
                             "MANAGE_EXPENSE","RESEARCH_EXPENSE","FINANCE_EXPENSE"),
 "RPT_F10_FINANCE_GCASHFLOW": ("NETCASH_OPERATE","CONSTRUCT_LONG_ASSET"),
}


def a_share(company, http, start, end):
    ticker=company["ticker"]
    merged=defaultdict(dict)
    dates=defaultdict(dict)
    for report, columns in TABLES.items():
        params={"reportName":report,"columns":",".join(("SECUCODE","REPORT_DATE","NOTICE_DATE",*columns)),
                "filter":f'(SECUCODE="{ticker}")', "pageSize":100, "sortColumns":"REPORT_DATE",
                "sortTypes":"-1","pageNumber":1}
        if start >= "2024-01-01":
            params["filter"]+=f'(REPORT_DATE>=\'{start[:4]}-01-01\')'
        raw=json.loads(http.get(EAST,params=params))
        if not raw.get("success") or raw["result"]["pages"] != 1:
            raise ValueError(f"CN filing history truncated: {ticker} {report}")
        seen=set()
        for row in raw["result"]["data"]:
            period=row["REPORT_DATE"][:10]
            if row["SECUCODE"]!=ticker or period in seen:
                raise ValueError("CN statement issuer/period mismatch")
            seen.add(period)
            merged[period].update({field:row[field] for field in columns})
            if row.get("NOTICE_DATE"):
                dates[period][report] = row["NOTICE_DATE"][:10]
    results=[]
    for period, record in sorted(merged.items()):
        if not all(k in record for table in TABLES.values() for k in table):
            continue
        ar=extended(*(record[k] for k in ("ACCOUNTS_RECE","NOTE_RECE","NOTE_ACCOUNTS_RECE","FINANCE_RECE")))
        ap=extended(*(record[k] for k in ("ACCOUNTS_PAYABLE","NOTE_PAYABLE","NOTE_ACCOUNTS_PAYABLE")))
        results.append(dict(id=f"{ticker}/{period}",period=period,ticker=ticker,name=company["name"],
          market=company["market"],currency="CNY",source=company["disclosure_url"],
          filing={"announced":max(dates[period].values(),default=None),"statement_dates":dates[period],
                  "accounting":"中国企业会计准则","fiscal_year_end":"12-31",
                  "document_url":company.get("statement_sources",{}).get(period), "topics":company.get("topics",[])},
          basis="consolidated fiscal YTD and period-end balances",
          revenue=record["OPERATE_INCOME"],cost=record["OPERATE_COST"],net_profit=record["PARENT_NETPROFIT"],
          ar=ar,ap=ap,inventory=record["INVENTORY"],operating_cash_flow=record["NETCASH_OPERATE"],
          capex=record["CONSTRUCT_LONG_ASSET"],selling=record["SALE_EXPENSE"],admin=record["MANAGE_EXPENSE"],
          rd=record["RESEARCH_EXPENSE"],finance=record["FINANCE_EXPENSE"]))
    return [row for row in quarterly([r for r in results if r["period"]<=end]) if start<=row["period"]]


SEC_TAGS={
 "revenue": ("RevenueFromContractWithCustomerExcludingAssessedTax","Revenues","SalesRevenueNet"),
 "cost": ("CostOfRevenue","CostOfGoodsAndServicesSold"),
 "net_profit": ("NetIncomeLoss","ProfitLoss"),
 "ar": ("AccountsReceivableNetCurrent",),
 "ap": ("AccountsPayableCurrent",),
 "inventory": ("InventoryNet",),
 "operating_cash_flow": ("NetCashProvidedByUsedInOperatingActivities",),
 "capex": ("PaymentsToAcquirePropertyPlantAndEquipment",),
 "selling": ("SellingAndMarketingExpense",), "sga": ("SellingGeneralAndAdministrativeExpense",),
 "admin": (), "rd": ("ResearchAndDevelopmentExpense",), "finance": ("InterestExpense",),
}


def sec(company,http,start,end):
    ticker=company["ticker"]
    http.session.headers["User-Agent"]=CONTACT
    resp=json.loads(http.get(f'{SEC}CIK{int(company["cik"]):010}.json',limit=24_000_000))
    if int(resp["cik"])!=int(company["cik"]):
        raise ValueError(f"SEC identity mismatch for {ticker}")
    tax=resp["facts"].get("us-gaap",{})
    periods=defaultdict(dict)
    tags_used=defaultdict(dict)
    for field, tags in SEC_TAGS.items():
        for tag in tags:
            for item in tax.get(tag,{}).get("units",{}).get("USD",[]):
                end_day=item["end"]
                if item["form"] not in ("10-Q","10-K","10-Q/A","10-K/A") or end_day>end:
                    continue
                # Cross-quarter comparisons use calendar-aligned U.S. issuers.
                # Off-calendar issuers and foreign IFRS forms require a mapping.
                if end_day[5:] not in ("03-31","06-30","09-30","12-31"):
                    continue
                if field not in ("ar","ap","inventory") and item.get("start")!=end_day[:4]+"-01-01":
                    continue
                info=periods[end_day].get(field)
                if info is None or item["filed"] > info["filed"]:
                    periods[end_day][field]=item
                    tags_used[end_day][field]=tag
    rows=[]
    for period,fields in sorted(periods.items()):
        if "revenue" not in fields or "cost" not in fields:
            continue
        accn=fields["revenue"]["accn"]
        rows.append(dict(id=f"{ticker}/{period}",period=period,ticker=ticker,name=company["name"],market="US",
          currency="USD",source=f'https://www.sec.gov/Archives/edgar/data/{int(company["cik"])}/{accn.replace("-","")}/{accn}-index.htm',
          basis="consolidated fiscal YTD and period-end balances",
          filing={"announced":max(x["filed"] for x in fields.values()),"accounting":"US GAAP",
                  "fiscal_year_end":"12-31","accessions":{k:entry["accn"] for k,entry in fields.items()},
                  "tags":tags_used[period]},
          **{k:fields[k]["val"] if k in fields else None for k in SEC_TAGS}))
    return [r for r in quarterly(rows) if r["period"]>=start]


def migrate_legacy_sga(row):
    """Correct records produced when the sole SEC selling tag was combined SG&A."""
    if row["market"]!="US" or "sga" in row:
        return row
    values={**row,"sga":row["selling"],"selling":None}
    for name in ("quarter","ttm"):
        prior=row[name]
        expenses=prior["expenses"]
        values[name]={**prior,"sga":prior["selling"],"selling":None,
                     "expenses":{**expenses,"sga":expenses["selling"],"selling":None}}
    return values


def due_period(end, market):
    day = date.fromisoformat(end)
    current = index(day)
    for q in (current,current-1,current-2):
        stamp = quarter_end(q)
        # Reporting availability is observed separately from deadline coverage.
        lag = 120 if q%4==3 else 62 if q%4==1 else 45 if market=="US" else 31
        if stamp + timedelta(days=lag) <= day:
            return stamp.isoformat()
    raise ValueError("Unable to determine the latest due quarter")


def collect(spec,http,start,end):
    registry=json.loads((ROOT/"config/company_registry.json").read_text())["companies"]
    selected=[item for item in registry if item["market"] in ("SH","SZ","BJ") or item["ticker"] in spec["financial_sample"]]
    if spec.get("review_unit"):
        selected=[item for item in selected if item["ticker"]==spec["review_unit"]]
    results=[]
    checks=[]
    units={}
    lower=start if spec.get("backfill") else max(start,spec.get("incremental_start","2024-01-01"))
    def one(company):
        client=HTTP()
        identifier=company["ticker"]
        expected=due_period(end,company["market"])
        try:
            collector=sec if company.get("cik") and company["market"]=="US" else a_share
            rows=collector(company,client,lower,end)
            recent=max((row["period"] for row in rows),default=None)
            finding="records" if recent else "uncovered"
            if recent and recent < expected:
                finding="uncovered"
            missing=next(([f for f in ("revenue","cost","ar","inventory","ap","operating_cash_flow","capex")
                            if row[f] is None] for row in reversed(rows)),[])
            note="未提供结构化适用报表" if not recent else ("最近有数据的财期低于披露宽限期目标" if recent<expected else None)
            if missing:
                note=(note+"；" if note else "")+"缺项 "+", ".join(missing)
            quality=unit(identifier,"company",expected,finding,latest=expected if recent and recent>=expected else recent,
                        detail=note,count=len(rows))
            if recent:
                quality["observed_period"]=recent
            return rows,client.evidence,quality
        except (ValueError,SourceUnavailable,KeyError,TypeError,IndexError) as error:
            return [],client.evidence,unit(identifier,"company",expected,"failed",detail=error)
        finally:
            client.session.close()
    with ThreadPoolExecutor(max_workers=4) as pool:
        for rows, files, check in pool.map(one,selected):
            results.extend(rows); http.evidence.extend(files); checks.append(check)
            units.update({row["id"]:check["id"] for row in rows})
    return {"records":results,"checks":checks,"record_units":units}
