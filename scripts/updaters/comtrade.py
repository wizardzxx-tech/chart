"""Check China's original HS report releases without downloading trade values."""
from calendar import monthrange
from datetime import date
import json
from urllib.parse import urlencode


def periods(start, end, frequency):
    first, last = date.fromisoformat(start), date.fromisoformat(end)
    if frequency == "A":
        return [str(y) for y in range(first.year, last.year+1)]
    bounds = range(first.year*12 + first.month - 1, last.year*12 + last.month)
    return [f"{i//12}{i%12+1:02d}" for i in bounds]


def collect(spec, http, start, end):
    candidates = []
    frequency = spec["upstream_frequency"]
    # Checks limit to the current publication cycle unless a backfill is given.
    requested = periods(start if start != "2018-01-01" else spec["review_since"], end, frequency)
    for offset in range(0, len(requested), 12):
        params = {"reporterCode": 156, "period": ",".join(requested[offset:offset+12])}
        archive = json.loads(http.get(spec["source_url"], params=params))
        if archive.get("error") or archive["count"] != len(archive["data"]):
            raise ValueError("UN Comtrade availability response failed its count check")
        for item in archive["data"]:
            if not item["isOriginalClassification"]:
                continue
            if item["reporterCode"] != 156 or item["freqCode"] != frequency or item["totalRecords"] < 1:
                raise ValueError("UN Comtrade reporter, frequency or coverage changed")
            period = str(item["period"])
            year, month = int(period[:4]), int(period[4:] or 12)
            last = date(year, month, monthrange(year, month)[1]).isoformat()
            revision = item["lastReleased"] > item["firstReleased"]
            published = item["lastReleased"][:10]
            if last <= spec["review_since"] and not (revision and published > spec["review_since"]):
                continue
            source = spec["source_url"] + "?" + urlencode({"reporterCode":156,"period":period})
            candidates.append({"title":f"中国 {period} 原始 HS 数据可用性", "url":source, "period":last,
                               "published":published, "indicators":spec["label"], "revision":revision,
                               "dataset_checksum":str(item["datasetChecksum"])})
    return {"notices": candidates}
