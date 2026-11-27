"""Discover official documents and queue their links for review."""
from datetime import date
import re
import unicodedata
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup


def notices_from_html(body, source, title_pattern):
    # The NHSA index renders its list from CDATA fragments.
    html = body.decode("utf-8-sig")
    fragments = re.findall(r"<record><!\[CDATA\[(.*?)\]\]></record>", html, re.S)
    html += "".join(fragments)
    soup = BeautifulSoup(html, "html.parser")
    expression = re.compile(title_pattern)
    dates = re.compile(r"20\d\d[-/]\d{1,2}[-/]\d{1,2}")
    results = {}
    for anchor in soup.select("a[href]"):
        title = " ".join((anchor.get("title") or anchor.get_text(" ", strip=True)).split())
        title = unicodedata.normalize("NFKC", title).strip()
        if not expression.search(title):
            continue
        target = urljoin(source, anchor["href"])
        parsed = urlsplit(target)
        if target == source or parsed.scheme != "https" or not parsed.hostname:
            continue
        if parsed.hostname != urlsplit(source).hostname or not re.search(r"\.s?html?$", parsed.path):
            continue
        matches = dates.search(anchor.parent.get_text(" ", strip=True))
        if not matches:
            likely = re.search(r"/(20\d\d)/(\d{1,2})/(\d{1,2})/", parsed.path)
            if likely:
                published = date(*map(int, likely.groups())).isoformat()
            else:
                continue
        else:
            published = date(*map(int, re.split(r"[-/]", matches[0]))).isoformat()
        results[target] = {"title": title, "url": target, "published": published}
    return list(results.values())


def reporting_end(title, published):
    if "签发日期" in title:
        points = re.findall(r"(?:(20\d\d)年)?(\d{1,2})月(\d{1,2})日", title)
        if points and points[0][0]:
            year = int(points[-1][0] or points[0][0])
            if not points[-1][0] and int(points[-1][1]) < int(points[0][1]):
                year += 1
            return date(year, int(points[-1][1]), int(points[-1][2])).isoformat()
    annual = re.match(r"(20\d\d)年全国医疗保障事业发展统计公报", title)
    if annual:
        return annual[1] + "-12-31"
    monthly = re.match(r"(20\d\d)年(?:\d{1,2}[-—–])?(\d{1,2})月", title)
    if monthly:
        from calendar import monthrange
        year, month = map(int, monthly.groups())
        return date(year, month, monthrange(year, month)[1]).isoformat()
    return published


def collect(spec, http, start, end):
    url = spec["source_url"]
    body = http.get(url)
    notices = notices_from_html(body, url, spec["title_pattern"])
    if not notices and not spec.get("allow_empty_index"):
        raise ValueError("Official listing did not expose parseable report links")
    tasks = []
    for notice in notices:
        period = reporting_end(notice["title"], notice["published"])
        revision = bool(re.search(r"修订|勘误|更正", notice["title"]))
        # A normal release at or before the audited baseline is not new work.
        if not start <= period <= end or not (period > spec["review_since"] or revision):
            continue
        tasks.append({**notice, "period": period, "indicators": spec["label"],
                      "revision": revision})
    return {"notices": tasks}
