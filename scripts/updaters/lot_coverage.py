"""Verify the regional publication footprint without promoting partial totals."""
from collections import Counter
from datetime import date,timedelta
from urllib.parse import parse_qs,urljoin,urlsplit

from bs4 import BeautifulSoup

from research.lot import NATIONAL, classify, summarize
from research.lot_parser import interval,parse_tables
from research.vaccine_names import normalize
from research.checks import unit
from updaters.http import SourceUnavailable

AUTHORIZATION = "https://bio.nidc.org.cn/pqf/search.do?formAction=pqfJgtz"


def agencies(body):
    registry={}
    soup=BeautifulSoup(body,"html.parser")
    for history in soup.select('a[href*="pqfGsByJG"]'):
        td=history.find_parent("td")
        heading=td.find("strong")
        history_url=urljoin(NATIONAL,history["href"].replace("¶meter","&parameter"))
        code=parse_qs(urlsplit(history_url).query)["parameter1"][0]
        links={}
        for link in td.select('a[href*="listGsxq"]'):
            span=interval(link.get_text(" ",strip=True))
            if span:
                links[span]=urljoin(NATIONAL,link["href"].replace("¶meter","&parameter"))
        registry[code]={"name":normalize(heading.get_text(" ",strip=True)),
            "history":history_url,"links":links,"authorization_source":AUTHORIZATION}
    if len(registry)<20:
        raise ValueError("NIFDC registry did not expose expected issuing institutions")
    return registry


def collect(spec,http,start,end):
    catalog=agencies(http.get(NATIONAL))
    groups=[]
    checks=[]
    last=date.fromisoformat(end)
    last-=timedelta(days=(last.weekday()+1)%7)
    count= max(1,min(12,(last-date.fromisoformat(start)).days//7+1)) if spec.get("backfill") else 2
    for n in reversed(range(count)):
        stop=last-timedelta(days=n*7)
        begin=stop-timedelta(days=6)
        week=(begin.isoformat(),stop.isoformat())
        certificates={}
        checked_ids=[]
        issue={}
        for code,agency in catalog.items():
            inventory=agency["links"]
            links={span:url for span,url in inventory.items() if span[0]<=week[1] and span[1]>=week[0]}
            recorded=[]
            observations=Counter()
            missing_fields=Counter()
            for span,url in sorted(links.items()):
                try:
                    soup=BeautifulSoup(http.get(url),"html.parser")
                    table_rows=parse_tables(soup)
                    facts=summarize(table_rows,span,"national")
                    for row in table_rows:
                        cert=normalize(row["certificate"]).replace(" ","").replace("批簽","批签").removesuffix("号")
                        identity=tuple(normalize(row[key]) for key in ("product","batch","mah","outcome","issuer"))
                        conflict=certificates.get(cert)
                        if conflict is not None and conflict!=identity:
                            raise ValueError("Conflicting certificates between authorities")
                        certificates[cert]=identity
                        for key in ("issued","manufacturer"):
                            if not row.get(key): missing_fields[key]+=1
                    observations.update(facts["exclusions"])
                    observations.update({kind:sum(row["batches"] for row in facts["rows"] if row["kind"]==kind)
                                         for kind in ("vax","blood")})
                    recorded.append({"start":span[0],"end":span[1],"source":url,
                                     "certificate_count":facts["audited_batches"]})
                except (SourceUnavailable,ValueError,KeyError,TypeError) as error:
                    issue.setdefault(code,[]).append(str(error))
            identifier=f"{code}/{week[1]}"
            if week in links and recorded and code not in issue:
                status="records"
                checked_ids.append(code)
            elif code in issue:
                status="failed"
            else:
                status="uncovered"
            checks.append(unit(identifier,"agency / week",week[1],status,
                latest=week[1] if status=="records" else None,count=len(recorded),
                detail="; ".join(issue.get(code,[])) or ("无覆盖完整周的公示；无公告也可能表示无签发" if status=="uncovered" else None)))
            groups.append({"id":identifier,"period":week[1],"week_start":week[0],
                "source":agency["history"],"basis":"report coverage, not national totals",
                "agency":agency["name"],"agency_id":code,"authorization_source":AUTHORIZATION,
                "scope_observed":sorted(k for k in ("blood","vax") if observations[k]),
                "registry_latest":max((x[1] for x in inventory),default=None),
                "status":status,"reports":recorded,"missing_fields":dict(missing_fields)})
        for item in groups:
            if item["period"]==week[1]:
                item["verified_agencies"]=len(checked_ids)
                item["registered_agencies"]=len(catalog)
    return {"records":groups,"checks":checks,"record_units":{row["id"]:row["id"] for row in groups}}
