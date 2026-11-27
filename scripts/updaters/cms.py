"""Discover CMS public-use files from the official U.S. Data.gov catalog."""
import re
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup


def collect(spec, http, start, end):
    base = spec["source_url"]
    title = spec["catalog_title"]
    catalog = BeautifulSoup(http.get(base, params={"q": title}), "html.parser")
    editions = {}
    for node in catalog.select('h2 a[href^="/dataset/"]'):
        edition = node.get_text(" ", strip=True)
        if edition.startswith(title + " : "):
            editions[urljoin(base, node["href"])] = edition
    if not editions:
        raise ValueError("No official CMS quarterly edition was present in the government catalog")
    rows = []
    for page, edition in list(editions.items())[:12]:
        html = BeautifulSoup(http.get(page), "html.parser")
        for link in html.select("a[href]"):
            url = link["href"]
            parsed = urlsplit(url)
            if parsed.scheme != "https" or parsed.hostname != "data.cms.gov" or not parsed.path.lower().endswith(".csv"):
                continue
            version = re.search(r"/(20\d\d-\d\d)/", parsed.path)
            if not version:
                raise ValueError("CMS download lacks a recognizable release month")
            stamp = version[1] + "-01"
            if start[:7] <= stamp[:7] <= end[:7]:
                rows.append({"id": url, "period": stamp, "title": edition, "source": page,
                             "file": url, "edition": version[1], "basis": "CMS public-use file version month"})
    if not rows and start == "2018-01-01":
        raise ValueError("No official CMS quarterly CSV was present in the matched editions")
    return {"records": rows}


# Official catalog metadata provides edition dates independently of filenames.
CMS_CATALOG = "https://data.cms.gov/data.json"
ASP_INDEX = "https://www.cms.gov/medicare/payment/part-b-drugs/asp-pricing-files"
PRODUCTS = {"annual":"Medicare Part B Spending by Drug",
            "quarterly":"Medicare Quarterly Part B Spending by Drug",
            "partd":"Medicare Part D Spending by Drug"}


def from_catalog(payload, key):
    title = PRODUCTS[key]
    editions = []
    for item in payload["dataset"]:
        if not item.get("title","").startswith(title+" : "):
            continue
        for distribution in item.get("distribution", []):
            url=distribution.get("downloadURL","")
            span=(distribution.get("temporal") or [{}])[0]
            if (distribution.get("format")!="CSV" or urlsplit(url).hostname!="data.cms.gov"
                    or not urlsplit(url).path.endswith(".csv") or not span.get("endDate")):
                continue
            editions.append({"kind":key,"period":span["endDate"],"modified":distribution.get("modified",item.get("modified","")),
                             "file":url,"catalog":CMS_CATALOG})
    return sorted(editions,key=lambda x:(x["period"],x["modified"],x["file"]))


def data_gov_editions(http,key):
    from calendar import monthrange
    from datetime import date
    index = "https://catalog.data.gov/"
    title = PRODUCTS[key]
    root = BeautifulSoup(http.get(index, params={"q":title}),"html.parser")
    editions=[]
    for anchor in root.select('h2 a[href^="/dataset/"]'):
        label=anchor.get_text(" ",strip=True)
        if not label.startswith(title+" : "):
            continue
        start = date.fromisoformat(label.rsplit(" : ",1)[1])
        month = start.month+2 if key=="quarterly" else 12
        period = date(start.year,month,monthrange(start.year,month)[1]).isoformat()
        page=urljoin(index,anchor["href"])
        for link in BeautifulSoup(http.get(page),"html.parser").select('a[href]'):
            source=link["href"]
            if urlsplit(source).hostname=="data.cms.gov" and urlsplit(source).path.endswith(".csv"):
                editions.append({"kind":key,"period":period,"modified":"","file":source,"catalog":page})
    return sorted(editions,key=lambda x:(x["period"],x["modified"],x["file"]))


def puf_editions(http,key):
    import json
    from updaters.http import SourceUnavailable
    try:
        available=from_catalog(json.loads(http.get(CMS_CATALOG,limit=24_000_000)),key)
        if available:
            return available
    except (SourceUnavailable,ValueError,KeyError):
        pass
    return data_gov_editions(http,key)


def asp_editions(http):
    import calendar
    from datetime import date
    months={name.casefold():i for i,name in enumerate(calendar.month_name) if i}
    results={}
    soup=BeautifulSoup(http.get(ASP_INDEX),"html.parser")
    for a in soup.select('a[href]'):
        title=a.get_text(" ",strip=True)
        matched=re.match(r"^([A-Za-z]+) (20\d\d) (?:Medicare Part B Payment Limit Files?|ASP Pricing Files?)\b",title,re.I)
        url=urljoin(ASP_INDEX,a["href"])
        if not matched or not urlsplit(url).path.lower().endswith(".zip") or urlsplit(url).hostname!="www.cms.gov":
            continue
        month=months.get(matched[1].casefold())
        if month not in (1,4,7,10):
            continue
        context=a.parent.get_text(" ",strip=True)
        posted=re.search(r"\b(\d\d)/(\d\d)/(20\d\d)\b",context)
        modified=date(int(posted[3]),int(posted[1]),int(posted[2])).isoformat() if posted else ""
        quarter=f"{matched[2]}Q{(month-1)//3+1}"
        item={"kind":"asp-"+quarter,"period":f"{matched[2]}-{month:02d}-01","modified":modified,"file":url,
              "catalog":ASP_INDEX,"final":"final" in context.casefold()}
        previous=results.get(quarter)
        if previous is None or (item["final"],item["modified"])>(previous["final"],previous["modified"]):
            results[quarter]=item
    return sorted(results.values(),key=lambda x:x["period"])
