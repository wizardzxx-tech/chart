"""Build only independently attributable aggregates from official release notices."""
from collections import Counter
from hashlib import sha256
from urllib.parse import urljoin
import re

from bs4 import BeautifulSoup

from updaters.http import SourceUnavailable
from research import blood_names, vaccine_names as names
from research.lot_parser import interval, parse_tables

NATIONAL = "https://bio.nidc.org.cn/pqf/search.do?formAction=pqfGs"
CENTER = "中国药品检定研究院"


def classify(product):
    if re.search(r"诊断|试剂|检测试剂|抗毒素|抗血清|重组人血白蛋白", product):
        return "other", ""
    group = blood_names.category(product)
    if group:
        return "blood", group
    if re.search(r"免疫球蛋白|人血白蛋白|纤维蛋白原|人凝血因子", product):
        raise ValueError(f"Unmapped blood-product heading: {product}")
    if re.search(r"疫苗|卡介苗",product):
        return "vax", names.product_type(product)
    return "other", ""


def summarize(rows, span, scope):
    evidence = {}
    product_counts = Counter()
    exclusions = Counter()
    for item in rows:
        cert = names.normalize(item["certificate"]).replace(" ", "")
        cert = cert.replace("批簽","批签").removesuffix("号")
        if not re.fullmatch(r"批签[^0-9]*20\d{2}[A-Z0-9-]{4,10}", cert):
            raise ValueError("Notice contains an unverified certificate ID")
        identity = names.batch_identity({**item,"mah":item["mah"] or item.get("manufacturer","")})
        code = names.normalize(item["outcome"])
        if cert in evidence:
            if evidence[cert] != (identity, code):
                raise ValueError("Conflicting repeated certificate identity")
            continue
        evidence[cert] = (identity, code)
        issuer, holder, product, _ = identity
        kind, category = classify(product)
        if code not in ("予以签发", "签发", "不予签发"):
            raise ValueError("Unexpected release conclusion")
        if code == "不予签发":
            exclusions["rejected"] += 1
        elif kind == "other":
            exclusions["other_biologics"] += 1
        else:
            if kind == "vax":
                company = names.group_name(holder)
            else:
                company, _ = blood_names.group(holder, *span)
            product_counts[kind, issuer, category, company, product] += 1
    if scope != "national" and any(identity[0] != CENTER for identity, _ in evidence.values()):
        raise ValueError("Center-only notice contains another agency")
    if len(evidence) != sum(product_counts.values()) + sum(exclusions.values()):
        raise ValueError("Classified, excluded, and issued totals fail reconciliation")
    return dict(rows=[{"kind": key[0], "agency": key[1], "category": key[2], "company": key[3],
                       "product": key[4], "batches":value}
                      for key,value in sorted(product_counts.items())],
                audited_batches=len(evidence), duplicate_rows=len(rows)-len(evidence), exclusions=dict(exclusions))


def coverage(read, span):
    content = read(NATIONAL)
    soup = BeautifulSoup(content, "html.parser")
    agencies = {}
    for table in soup.find_all("table"):
        header = table.find("strong", recursive=True)
        links = table.select('a[href*="listGsxq"]')
        if not header or not links or any(len(t.select('a[href*="listGsxq"]')) for t in table.find_all("table")):
            continue
        agency = names.normalize(header.get_text(" ",strip=True))
        matching = sum(window[0] <= span[1] and window[1] >= span[0] for a in links
                       if (window:=interval(a.get_text(" ",strip=True))))
        if agency:
            agencies[agency] = matching
    if len(agencies) < 8:
        raise ValueError("National public landing page did not yield expected agencies")
    return {"official_index": NATIONAL, "index_sha256": sha256(content).hexdigest(),
            "agencies_indexed": len(agencies), "agencies_with_overlapping_links": sum(x>0 for x in agencies.values()),
            "agencies": agencies, "national_reconciled": False}


def candidate(task, read, previous=None):
    data = read(task["url"])
    doc = BeautifulSoup(data,"html.parser")
    title = doc.title.get_text(" ",strip=True)
    span = interval(title)
    if not span or span[-1] != task["period"]:
        raise ValueError("Official reporting interval changed")
    summary = summarize(parse_tables(doc),span,"center")
    # The center publishes a complete notice for its own certificates. National
    # coverage remains incomplete even when the provincial index has some links.
    try:
        national = coverage(read,span)
    except (SourceUnavailable, ValueError, OSError):
        national = {"official_index": NATIONAL, "national_reconciled": False, "index_available":False}
    kind = task["dataset_id"].split(".")[0]
    aggregates = [row for row in summary.pop("rows") if row["kind"] == kind]
    return {"period":span[-1],"start":span[0],"source":task["url"],"sha256":sha256(data).hexdigest(),
            "basis":"center-issued certificates","unit":"批","agency":CENTER, "national":national,
            "total":sum(r["batches"] for r in aggregates),"aggregates":aggregates, **summary}
