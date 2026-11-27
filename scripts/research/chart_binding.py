"""Track whether an accepted batch adds an observation to the displayed chart."""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]


def applies(spec, changed):
    adapter=spec.get("adapter")
    if adapter=="finance":
        return bool(changed)
    if adapter=="trade_values":
        from updaters.trade_values import products_for
        existing={(p["code"],r["year"],r["flow"]) for p in products_for(spec["topic"]) for r in p["series"]}
        return any((r["product"],r["year"],r["flow"]) not in existing for r in changed)
    if adapter=="cms_values":
        if spec.get("part_d"):
            old=json.loads((ROOT/"v2/insulin/tracker.json").read_text())["partd"]
            ids={"/".join((row[0],row[2],row[3])) for row in old}
            return any(row["id"] not in ids for row in changed)
        old=json.loads((ROOT/"v2/biosimilars/data/medicare.json").read_text())
        return any(not any((x["code"],x["period"])==(r["item"]["code"],r["item"]["period"])
                           for x in old["price" if r["kind"].startswith("asp-") else r["kind"]]) for r in changed)
    return False
