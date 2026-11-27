"""Describe provider subchecks consistently without conflating release and access."""
GOOD = {"records", "unchanged", "no_new", "unpublished"}
PROBLEM = {"failed", "uncovered", "pending_revision"}


def unit(key, kind, period, status, *, latest=None, detail=None, count=0, attempted=True):
    value = {"id": key, "kind": kind, "period": period, "status": status,
             "attempted": attempted, "count": count}
    if latest:
        value["latest_period"] = latest
    if detail:
        value["detail"] = str(detail)[:250]
    return value


def summarize(checks):
    return {"configured":len(checks), "checked":sum(x["attempted"] for x in checks),
            "successful":sum(x["status"] in GOOD and x["attempted"] for x in checks),
            "previously_verified":sum(x["status"] in GOOD and not x["attempted"] for x in checks),
            "failed":sum(x["status"]=="failed" for x in checks),
            "uncovered":sum(x["status"]=="uncovered" for x in checks),
            "pending_revision":sum(x["status"]=="pending_revision" for x in checks),
            "no_new":sum(x["status"] in ("unchanged","no_new","unpublished") for x in checks),
            "actual_data":sum(x.get("latest_period") is not None and x["status"] in ("records","unchanged")
                              and "catalog" not in x["kind"] for x in checks),
            "latest":sum(x.get("latest_period") is not None and x.get("latest_period")==x.get("period")
                         for x in checks if x["status"] in ("records","unchanged") and "catalog" not in x["kind"])}
