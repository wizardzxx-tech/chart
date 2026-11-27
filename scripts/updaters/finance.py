"""Fetch standardized A-share filing fields and compatible SEC XBRL facts."""
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path

from research.financial_periods import extended, quarterly
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
    results=[]
    for period, record in sorted(merged.items()):
        if not all(k in record for table in TABLES.values() for k in table):
            continue
        ar=extended(*(record[k] for k in ("ACCOUNTS_RECE","NOTE_RECE","NOTE_ACCOUNTS_RECE","FINANCE_RECE")))
        ap=extended(*(record[k] for k in ("ACCOUNTS_PAYABLE","NOTE_PAYABLE","NOTE_ACCOUNTS_PAYABLE")))
        results.append(dict(id=f"{ticker}/{period}",period=period,ticker=ticker,name=company["name"],
          market=company["market"],currency="CNY",source=company["disclosure_url"],
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
 "selling": ("SellingGeneralAndAdministrativeExpense",),
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
    sources={}
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
                if tag in SEC_TAGS["revenue"] and end_day not in sources:
                    sources[end_day]=item["accn"]
    rows=[]
    for period,fields in sorted(periods.items()):
        if "revenue" not in fields or "cost" not in fields:
            continue
        accn=fields["revenue"]["accn"]
        rows.append(dict(id=f"{ticker}/{period}",period=period,ticker=ticker,name=company["name"],market="US",
          currency="USD",source=f'https://www.sec.gov/Archives/edgar/data/{int(company["cik"])}/{accn.replace("-","")}/{accn}-index.htm',
          basis="consolidated fiscal YTD and period-end balances",
          **{k:fields[k]["val"] if k in fields else None for k in SEC_TAGS}))
    return [r for r in quarterly(rows) if r["period"]>=start]


def collect(spec,http,start,end):
    registry=json.loads((ROOT/"config/company_registry.json").read_text())["companies"]
    selected=[item for item in registry if item["ticker"] in spec["financial_sample"]]
    results=[]
    problems=[]
    def one(company):
        client=HTTP()
        try:
            collector=sec if company.get("cik") and company["market"]=="US" else a_share
            return collector(company,client,max(start,spec.get("incremental_start","2024-01-01")),end),client.evidence,None
        except (ValueError,SourceUnavailable,KeyError,TypeError) as error:
            return [],client.evidence,f"{company['ticker']}: {type(error).__name__}"
        finally:
            client.session.close()
    with ThreadPoolExecutor(max_workers=3) as pool:
        for rows, files, failure in pool.map(one,selected):
            results.extend(rows)
            http.evidence.extend(files)
            if failure: problems.append(failure)
    if not results and problems:
        raise SourceUnavailable("; ".join(problems))
    return {"records":results,"warnings":problems}
