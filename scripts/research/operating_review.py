"""Review extracted operating metrics against normalized site evidence."""
from datetime import date
from hashlib import sha256
import json

from updaters.operating_metrics import ROOT,TARGET,extract


def rows():
    return json.loads((ROOT/TARGET).read_text())["records"]


def compare(record, existing):
    old=next((r for r in existing if r["id"]==record["id"]),None)
    stamp=date.fromisoformat(record["period"])
    prior=next((r for r in existing if r["ticker"]==record["ticker"] and r["metric"]==record["metric"]
                and r["period_kind"]==record["period_kind"] and r["scope"]==record["scope"]
                and r["unit"]==record["unit"] and r["period"]==f"{stamp.year-1}-{stamp:%m-%d}"),None)
    yoy=(record["value"]/prior["value"]-1)*100 if prior and prior["value"]>0 else None
    return {"before":old["value"] if old else None,"after":record["value"],
            "year_ago":prior["value"] if prior else None,"yoy_pct":yoy}


def prepare(task_id,task,read,checked):
    raw=read(task["url"])
    if task.get("dataset_checksum")!=sha256(raw).hexdigest():
        raise ValueError("PDF 版本已变更或需要补足人工取值证据")
    candidates=extract(task["ticker"],task["document_title"],task["published"],task["url"],raw)
    if not candidates or candidates!=task["candidates"]:
        raise ValueError("取值和审核队列内容发生变化，请复核最新版")
    existing=rows()
    current={item["id"]:item for item in existing}
    return {"receipt_version":2,"task_id":task_id,"dataset_id":task["dataset_id"],"source":task["url"],
            "write_targets":[TARGET],"old":{r["id"]:current.get(r["id"]) for r in candidates},
            "candidate":{"period":task["period"],"source":task["url"],"records":candidates},
            "diff":{r["id"]:compare(r,existing) for r in candidates},"files":list(checked.values()),
            "validation":{"passed":True,"adapter":"operating_metrics"}}
