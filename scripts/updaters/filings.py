"""Discover issuer filings using the company's public disclosure relay.

Query and notice URL match the repository's historical pharmacy collector.
The downloadable issuer document remains subject to review.
"""
import json
import re


def collect(spec, http, start, end):
    notices = []
    lower = max(start, spec["review_since"])
    for code in spec["company_codes"]:
        body = http.get(spec["source_url"], params={"sr": "-1", "page_size": 25, "page_index": 1,
                         "ann_type": "A", "stock_list": code, "f_node": "0", "s_node": "0"})
        listing = json.loads(body)["data"]
        if not listing or not listing.get("list"):
            raise ValueError(f"Announcement index unavailable for {code}")
        for item in listing["list"]:
            stamp = item["notice_date"][:10]
            title = item["title"].split(":", 1)[-1].strip()
            if not lower <= stamp <= end or not re.search(r"季度报告|半年度报告|年度报告|经营数据|股权激励", title):
                continue
            if re.search(r"摘要|英文|说明会|预告|快报|预约", title):
                continue
            key = item["art_code"]
            if not re.fullmatch(r"AN\d+", key):
                raise ValueError("Unexpected issuer notice ID")
            notices.append({"url":f"https://pdf.dfcfw.com/pdf/H2_{key}_1.pdf", "title":f"{code} · {title}",
                            "published": stamp, "period": stamp, "indicators": spec["label"]})
    return {"notices": notices}
