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
