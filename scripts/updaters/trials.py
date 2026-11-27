"""Check a declared ClinicalTrials.gov watchlist using the official v2 API."""
import json
import re


def collect(spec, http, start, end):
    rows = []
    for identifier in spec["trial_ids"]:
        raw = json.loads(http.get(f'{spec["source_url"]}/studies/{identifier}'))["protocolSection"]
        info = raw["identificationModule"]
        status = raw["statusModule"]
        period = status["lastUpdatePostDateStruct"]["date"]
        if info["nctId"] != identifier or not re.fullmatch(r"[A-Z_]+", status["overallStatus"]):
            raise ValueError("Unexpected ClinicalTrials.gov record")
        if start <= period <= end:
            rows.append({"id": f"{identifier}/{period}", "period": period, "nct": identifier,
                         "title": info["briefTitle"], "status": status["overallStatus"],
                         "results_posted": status.get("resultsFirstPostDateStruct", {}).get("date"),
                         "source": f"https://clinicaltrials.gov/study/{identifier}",
                         "basis": "NCT registry posting"})
    return {"records": rows}
