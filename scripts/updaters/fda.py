"""Collect public FDA approval actions, keyed by application and submission."""
import json
import re
from datetime import datetime
from urllib.parse import quote


def collect(spec, http, start, end):
    found = {}
    for molecule in spec["products"]:
        query = f'products.active_ingredients.name.exact:"{molecule.upper()}"'
        raw = json.loads(http.get(spec["source_url"], params={"search": query, "limit": 100}))
        total = raw["meta"]["results"]["total"]
        if total != len(raw["results"]):
            raise ValueError("FDA search exceeded the verified page budget")
        if not total:
            raise ValueError(f"No Drugs@FDA registrations for {molecule}")
        for item in raw["results"]:
            app = item["application_number"]
            if not re.fullmatch(r"(?:ANDA|NDA|BLA)\d{6}", app):
                raise ValueError("Unexpected FDA application ID")
            for action in item["submissions"]:
                if action.get("submission_status") != "AP":
                    continue
                period = datetime.strptime(action["submission_status_date"], "%Y%m%d").date().isoformat()
                if not start <= period <= end:
                    continue
                kind = action["submission_type"]
                number = action["submission_number"]
                key = f"{app}/{kind}/{number}/{period}"
                row = {"id": key, "period": period, "application": app, "action": kind, "submission": number,
                       "applicant": item.get("sponsor_name", ""), "molecule": molecule,
                       "source": "https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?"
                                 f"event=overview.process&ApplNo={quote(app[-6:])}",
                       "basis": "FDA approved submission action"}
                if key in found:
                    if set(found[key]["molecule"].split(" + ")) != {molecule}:
                        row["molecule"] = " + ".join(sorted(set(found[key]["molecule"].split(" + ")) | {molecule}))
                found[key] = row
    return {"records": list(found.values())}
