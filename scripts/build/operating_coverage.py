"""Build the read-only review surface from existing publication receipts."""
import json

from research.operating_review import compare
from updaters.operating_metrics import TARGET,schema


def build(repo,site):
    old=json.loads((repo/TARGET).read_text())["records"]
    ledger=json.loads((repo/"logs/review.json").read_text())["tasks"]
    config=schema()
    docs=[]
    for identifier,task in ledger.items():
        if task.get("review_type")!="operating":
            continue
        candidates=[{**value,**compare(value,old)} for value in task["candidates"]]
        docs.append({k:task[k] for k in ("ticker","title","period","status","url")} |
                    {"id":identifier,"candidates":candidates})
    output=site/"v2/update-center/operating-review.json"
    output.write_text(json.dumps({"definitions":config["metrics"],"documents":docs},ensure_ascii=False,
                       separators=(",",":"))+"\n")
