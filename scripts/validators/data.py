"""Dataset validation and append-only release history."""
from collections import defaultdict
from datetime import date
import math
import re
from urllib.parse import urlsplit


class ValidationFailed(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise ValidationFailed(message)


def link(value):
    parsed = urlsplit(value)
    return parsed.scheme == "https" and bool(parsed.hostname) and not parsed.username


def indexed(rows, *, allow_identical=False):
    keys = {}
    for record in rows:
        key = record["id"]
        if key in keys:
            require(allow_identical and keys[key] == record, f"Repeated or conflicting key {key}")
        keys[key] = record
    return keys


def validate_records(spec, rows, previous, end):
    rows = list(indexed(rows, allow_identical=True).values())
    existing = indexed(previous)
    schemas = {tuple(sorted(row)) for row in (*previous, *rows)}
    require(len(schemas) <= 1, "Record schema changed")
    require(len(rows) <= spec.get("max_rows_per_check", 10000), "Unusual record count")
    changed = []
    revisions = []
    rules = spec.get("contract", {})
    for item in rows:
        require(isinstance(item["id"], str) and bool(item["id"]), "Missing record ID")
        require(date.fromisoformat(item["period"]) <= date.fromisoformat(end), "Future period")
        require(link(item["source"]), "Record has no valid reference link")
        if previous:
            require(item.get("basis") == previous[0].get("basis"), "Statistical basis changed")
        for field, values in rules.get("allowed", {}).items():
            require(item.get(field) in values, f"Unexpected {field}; statutory unit or scope may have changed")
        for field, minimum in rules.get("min", {}).items():
            value = item[field]
            require(value is None or (isinstance(value, (int, float)) and math.isfinite(value)
                                     and value >= minimum), f"{field} is outside its permitted range")
        for total, parts in rules.get("totals", {}).items():
            require(abs(item[total] - sum(item[key] for key in parts)) <= rules.get("tolerance", 0),
                    f"Subtotals do not reconcile: {total}")
        old = existing.get(item["id"])
        if old == item:
            continue
        if old is not None:
            # A dataset-specific adapter must supply the actual official correction link.
            # No pilot enables in-place corrections without a reviewed provider contract.
            correction = item.get("official_revision")
            require(rules.get("accept_revisions") and correction and link(correction)
                    and urlsplit(correction).hostname == urlsplit(item["source"]).hostname,
                    f"Historical value changed for {item['id']}; official correction required")
            revisions.append({"before": old, "after": item, "official_revision": correction})
        changed.append(item)
        existing[item["id"]] = item
    combined = sorted(existing.values(), key=lambda row: (row["period"], row["id"]))
    if rules.get("monthly_continuity"):
        indexes = sorted({int(r["period"][:4]) * 12 + int(r["period"][5:7]) for r in combined})
        require(all(b == a + 1 for a, b in zip(indexes, indexes[1:])), "A monthly reporting period is missing")
    for field, limit in rules.get("max_ratio", {}).items():
        groups = defaultdict(list)
        for item in combined:
            groups[tuple(item[k] for k in rules.get("series_key", []))].append(item)
        for series in groups.values():
            values = [item[field] for item in series if item[field] is not None]
            require(not any(a > 0 and b > 0 and max(b/a, a/b) > limit for a,b in zip(values, values[1:])),
                    f"Unusual variation in {field}")
    return combined, changed, revisions


def validate_notices(notices):
    for item in notices:
        require(link(item["url"]) and item["title"] and item["indicators"], "Incomplete review task")
        date.fromisoformat(item["period"])
        date.fromisoformat(item["published"])
