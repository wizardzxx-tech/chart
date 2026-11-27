"""Verify the regional publication footprint without promoting partial totals."""
from collections import Counter
from datetime import date,timedelta
from hashlib import sha256
import json
from pathlib import Path
import re
from urllib.parse import parse_qs,urljoin,urlsplit

from bs4 import BeautifulSoup

from research.lot import NATIONAL, classify, summarize
from research.lot_parser import interval,issued_date,parse_tables
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
                url=urljoin(NATIONAL,link["href"].replace("¶meter","&parameter"))
                links[span,url]=set()
        registry[code]={"name":normalize(heading.get_text(" ",strip=True)),
            "history":history_url,"links":links,"authorization_source":AUTHORIZATION}
    if len(registry)<20:
        raise ValueError("NIFDC registry did not expose expected issuing institutions")
    return registry


def notice_links(tree,base,first,last):
    links={}
    for link in tree.select('a[href*="listGsxq"]'):
        title=link.get_text(" ",strip=True)
        span=interval(title)
        if span and span[0]<=last and span[1]>=first:
            published=re.search(r"\((20\d{2}-\d{2}-\d{2})\)\s*$",title)
            url=urljoin(base,link["href"].replace("¶meter","&parameter"))
            dates=links.setdefault((span,url),set())
            if published:
                dates.add(published[1])
    return links


def day_range(span):
    a,b=map(date.fromisoformat,span)
    return {(a+timedelta(days=i)).isoformat() for i in range((b-a).days+1)}


def coverage_week(week, reports):
    covered=set()
    for report in reports:
        # Avoid expanding dates outside of the week being evaluated.
        start,end=max(week[0],report["start"]),min(week[1],report["end"])
        if start<=end:
            covered.update(day_range((start,end)))
    return sorted(day_range(week)-covered)


def certificate_id(raw):
    return normalize(raw).replace(" ","").replace("批簽","批签").removesuffix("号")


def archive(spec,source,raw,records):
    home=Path(spec.get("evidence_dir") or Path(__file__).resolve().parents[2]/".review-work/lot-evidence")
    digest=sha256(raw).hexdigest()
    home.mkdir(parents=True,exist_ok=True)
    original=home/(digest+".html")
    if not original.exists():
        original.write_bytes(raw)
    # Preserve source-level statements separately even if the HTML matches.
    record_key=sha256((source["source"]+digest).encode()).hexdigest()
    (home/(record_key+".json")).write_text(json.dumps({**source,"sha256":digest,"records":records},
                                                     ensure_ascii=False,indent=2)+"\n")
    return digest


def collect(spec,http,start,end):
    landing=http.get(NATIONAL)
    catalog=agencies(landing)
    # Positive authorizations are documented independently. An unconfirmed or
    # missing scope never removes an agency from the required set.
    scope=spec.get("authorized_scope",{})
    last=date.fromisoformat(end)
    last-=timedelta(days=(last.weekday()+1)%7)
    count=max(1,min(16,(last-date.fromisoformat(start)).days//7+1)) if spec.get("backfill") else 2
    weeks=[((last-timedelta(days=n*7+6)).isoformat(),(last-timedelta(days=n*7)).isoformat())
           for n in reversed(range(count))]
    for agency in catalog.values():
        try:
            ship=BeautifulSoup(http.get(agency["history"]),"html.parser")
            for key,dates in notice_links(ship,agency["history"],weeks[0][0],weeks[-1][1]).items():
                agency["links"].setdefault(key,set()).update(dates)
        except SourceUnavailable as error:
            agency["history_error"]=str(error)
    groups,checks=[],[]
    for week in weeks:
        week_records={}
        verified=[]
        by_type={"vax":[],"blood":[]}
        week_groups=[]
        inconsistent=False
        for code,agency in catalog.items():
            inventory=agency["links"]
            issues,reported=[],[]
            observed=Counter()
            unassigned={kind:set() for kind in by_type}
            missing=Counter()
            for (span,url),dates in sorted(inventory.items()):
                if span[0]>week[1] or span[1]<week[0]:
                    continue
                try:
                    raw=http.get(url)
                    table=parse_tables(BeautifulSoup(raw,"html.parser"))
                    facts=summarize(table,span,"national")
                    proof={"start":span[0],"end":span[1],"source":url,"published":max(dates,default=None),
                           "publication_dates":sorted(dates),
                           "certificate_count":facts["audited_batches"]}
                    evidence=[]
                    for row in table:
                        ref=certificate_id(row["certificate"])
                        issue=issued_date(row["issued"])
                        if issue and not span[0]<=issue<=span[1]:
                            raise ValueError("签发日超出公告区间")
                        kind,category=classify(normalize(row["product"]))
                        evidence.append({**row,"issued":issue,"certificate":ref,"kind":kind})
                        for key in ("issued","manufacturer","mah"):
                            if not evidence[-1][key]:
                                missing[key]+=1
                        passed=normalize(row["outcome"]) in ("予以签发","签发")
                        if not passed or kind not in by_type:
                            continue
                        if issue is None and not (week[0]<=span[0] and span[1]<=week[1]):
                            unassigned[kind].add(ref)
                            continue
                        if issue and not week[0]<=issue<=week[1]:
                            continue
                        identity=(code,kind,normalize(row["product"]),normalize(row["batch"]),
                                  normalize(row["mah"] or row["manufacturer"]))
                        if ref in week_records and week_records[ref]!=identity:
                            inconsistent=True
                            raise ValueError("批签发证书在周内或机构之间冲突")
                        if ref not in week_records:
                            observed[kind]+=1
                        week_records[ref]=identity
                    proof["sha256"]=archive(spec,proof,raw,evidence)
                    reported.append(proof)
                except (SourceUnavailable,ValueError,KeyError,TypeError,OSError) as error:
                    issues.append(str(error))
            known={ref for ref,identity in week_records.items() if identity[0]==code}
            unknown={kind:len(refs-known) for kind,refs in unassigned.items()}
            uncovered=coverage_week(week,reported)
            open_days=coverage_week(week,[r for r in reported if r["published"] and r["published"]>=min(r["end"],week[1])])
            status="failed" if issues else "uncovered" if uncovered else "records"
            if status=="records":
                verified.append(code)
                for kind in by_type:
                    if not unknown[kind] and not open_days and not agency.get("history_error"):
                        by_type[kind].append(code)
            identifier=f"{code}/{week[1]}"
            checks.append(unit(identifier,"agency / week",week[1],status,
              latest=week[1] if status=="records" else None,count=len(reported),
              detail="; ".join(issues) or ("公告未覆盖 "+", ".join(uncovered) if uncovered else None)
                     or agency.get("history_error") or ("待完整发布日期核验 "+", ".join(open_days) if open_days else None)))
            week_groups.append({"id":identifier,"period":week[1],"week_start":week[0],
                "source":agency["history"],"basis":"report coverage, not national totals",
                "agency":agency["name"],"agency_id":code,"authorization_source":AUTHORIZATION,
                "scope_observed":sorted(observed),"authorized_scope":scope.get(code),
                "registry_latest":max((span[1] for span,_ in inventory),default=None),
                "status":status,"reports":reported,"missing_fields":dict(missing),
                "uncovered_days":uncovered,"open_publication_days":open_days,"unassigned":unknown,
                "verified_week_counts":dict(observed)})
        national={}
        for kind,passed in by_type.items():
            required={code for code in catalog if kind not in scope.get(code,{}).get("verified_excluded",[])}
            complete=bool(required) and not inconsistent and required.issubset(passed)
            national[kind]={"required_agencies":len(required),"verified_agencies":len(required.intersection(passed)),
                            "complete":complete,
                            "batches":sum(x[1]==kind for x in week_records.values()) if complete else None}
        for row in week_groups:
            row.update(verified_agencies=len(verified),registered_agencies=len(catalog),national=national)
        groups.extend(week_groups)
    return {"records":groups,"checks":checks,"record_units":{row["id"]:row["id"] for row in groups}}
