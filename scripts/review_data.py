"""Prepare and approve reviewed research updates using independently verified receipts."""
from argparse import ArgumentParser
from copy import deepcopy
import csv
from datetime import datetime, timezone
from decimal import Decimal
from hashlib import sha256
from importlib import import_module
import io
from pathlib import Path
import os
from getpass import getuser

from data_update import ROOT, REVIEW, STATE, TODAY, dump_json, load_registry, read_json, save
from updaters.http import HTTP
from validators.data import material, validate_records

PROCESSORS = {"insurance.monthly": "nhsa", "blood.lot-release": "lot", "vax.lot-release": "lot"}


def utc():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def evidence(cache, http, *, offline=False):
    checked = {}

    def read(url):
        cache.mkdir(parents=True, exist_ok=True)
        name = sha256(url.encode()).hexdigest()
        link = cache / f"{name}.json"
        if offline:
            if not link.exists():
                raise ValueError("No archived response for the offline replay")
            stored = read_json(link, {})
            body = (cache / stored["sha256"]).read_bytes()
            if stored["url"] != url or sha256(body).hexdigest() != stored["sha256"]:
                raise ValueError("Cached official source failed its digest check")
        else:
            body = http.get(url)
            raw = sha256(body).hexdigest()
            stored = {"url": url, "sha256": raw, "bytes": len(body)}
            (cache / raw).write_bytes(body)
            save(link, stored)
        checked[url] = stored
        return body

    return read, checked


def target(task):
    if task["dataset_id"] == "insurance.monthly":
        return ROOT / "v2/medical-insurance/trends.json", "pooled"
    return ROOT / "v2" / task["topic"] / "center-updates.json", "reports"


def review_spec(task):
    return next(x for x in load_registry() if x["dataset_id"]==task["dataset_id"])


def prepare_structured(task_id,task):
    spec=review_spec(task)
    destination=ROOT/spec["local_data_path"]
    adapter=import_module("updaters."+spec["adapter"])
    http=HTTP()
    start=spec.get("incremental_start","2018-01-01")
    end=TODAY
    if spec["adapter"]=="trade_values":
        start=end=task["period"]
    try:
        result=adapter.collect({**spec,"review_unit":task["unit_id"],"backfill":True},http,start,end)
        candidate=next((item for item in result["records"] if item["id"]==task["row_id"]),None)
        if not candidate or sha256(dump_json(material(candidate,spec))).hexdigest()!=task["candidate_sha256"]:
            raise ValueError("The live candidate changed or is unavailable. Check the newest version of this review.")
        validate_records(spec,[candidate],[],TODAY)
        old=next((x for x in read_json(destination,{"records":[]})["records"]
                  if x["id"]==task["row_id"]),None)
        if not old:
            raise ValueError("No published original to revise")
        return {"receipt_version":2,"task_id":task_id,"dataset_id":task["dataset_id"],
                "source":candidate["source"],"files":http.evidence,
                "write_targets":[str(destination.relative_to(ROOT))],"old":old,"candidate":candidate,
                "diff":{k:{"before":old.get(k),"after":v} for k,v in material(candidate,spec).items() if old.get(k)!=v},
                "validation":{"passed":True,"adapter":spec["adapter"]}}
    finally:
        http.session.close()


def prepare(task_id, task, cache, *, offline=False):
    if task.get("row_id"):
        if offline:
            raise ValueError("Structured review must recollect the official source")
        return prepare_structured(task_id,task)
    name = PROCESSORS.get(task["dataset_id"])
    if not name:
        raise ValueError("This task has no validated research-data writer")
    adapter = import_module(f"research.{name}")
    http = HTTP()
    read, checked = evidence(cache, http, offline=offline)
    destination, section = target(task)
    data = read_json(destination, {})
    history = data.get(section, [])
    old = next((point for point in history if point["period"] in (task["period"],task["period"][:7])), None)
    previous = None
    if name == "nhsa":
        from research.nhsa import extract_image
        nearest = sorted([x for x in history if x["period"][:4] == task["period"][:4]
                          and x["period"] < task["period"][:7]], key=lambda x:x["period"])
        previous = nearest[-1] if nearest else None
        if not previous and task["period"] == "2026-10-31":
            prior_asset = "https://www.nhsa.gov.cn/picture/0/9cf80d7b6514490f826ff62e83df737e.png"
            previous = extract_image(read(prior_asset))
    try:
        value = adapter.candidate(task,read,previous)
    finally:
        http.session.close()
    return {"receipt_version":2,"task_id": task_id,"dataset_id":task["dataset_id"], "source":task["url"],
            "write_targets":[str(destination.relative_to(ROOT)), *(
                ["v2/medical-insurance/data.csv"] if name=="nhsa" else [])],
            "files":list(checked.values()), "old":old,"comparison_base":previous,
            "candidate":value,"diff":{k:{"before":(old or {}).get(k),"after":v}
                                     for k,v in value.items() if (old or {}).get(k)!=v},
            "validation":{"passed":True,"adapter":name}}


def append_nhsa_csv(value):
    path = ROOT / "v2/medical-insurance/data.csv"
    with path.open(encoding="utf-8-sig",newline="") as file:
        data = list(csv.reader(file))
    year, month = value["period"].split("-")
    period = f"{year} 年 1–{int(month)} 月"
    group = "统筹基金年内累计"
    rows = [row for row in data if not (row[0] == group and row[1] == period)]
    from research.nhsa import CATEGORIES
    for category, label in CATEGORIES.items():
        income, spending = [Decimal(value[f"{category}_{metric}"]) for metric in ("income","spending")]
        for metric, number in (("基金收入",income),("基金支出",spending),("收支差额",income-spending)):
            rows.append([group,period,label,metric,str(number),"亿元",value["source"],"累计；不含职工个人账户"])
    rows.append([group,period,"职工医保（含生育）","其中：生育保险基金待遇支出",value["maternity_spending"],
                 "亿元",value["source"],"包含于职工医保支出"])
    output = io.StringIO()
    csv.writer(output,quoting=csv.QUOTE_ALL).writerows(rows)
    return path, output.getvalue().encode("utf-8-sig")


def apply(receipt, task):
    structured=bool(task.get("row_id"))
    if structured:
        spec=review_spec(task)
        path,field=ROOT/spec["local_data_path"],"records"
    else:
        path,field=target(task)
    old_data = read_json(path,{})
    data = deepcopy(old_data)
    value = deepcopy(receipt["candidate"])
    key="id" if structured else "period"
    prev = next((x for x in data.get(field,[]) if x[key]==value[key]),None)
    if prev != receipt["old"]:
        raise ValueError("Published data changed after the review receipt was prepared")
    timestamp = utc()
    digest = sha256(dump_json(receipt)).hexdigest()
    approval={"task_id":receipt["task_id"],"receipt_sha256":digest,
              "reviewed_at":timestamp,"reviewed_by":os.environ.get("GITHUB_ACTOR") or getuser(),
              "source":receipt["source"],"source_sha256":[x["sha256"] for x in receipt["files"]]}
    if structured:
        value["approved_revision"]=approval
        remaining=[v for v in data[field] if v[key]!=value[key]]
        data[field],_,_=validate_records(spec,[value],remaining,TODAY)
        data.update(updated_at=timestamp,source_files=receipt["files"])
    else:
        data[field] = sorted([v for v in data.get(field,[]) if v[key] != value[key]]+[value],key=lambda x:x["period"])
    updates = []
    if receipt["dataset_id"] == "insurance.monthly":
        updates.append(append_nhsa_csv(value))

    state = read_json(STATE, {})
    for row in state["datasets"]:
        if row["dataset_id"] != task["dataset_id"]:
            continue
        if structured:
            row["latest_data_period"] = data[field][-1]["period"]
            row["source"] = data[field][-1]["source"]
        elif receipt["dataset_id"] == "insurance.monthly":
            row["latest_data_period"] = data[field][-1]["period"]
            row["source"] = data[field][-1]["source"]
        else:
            # Overall national coverage remains on the legacy series. Store the
            # independently verified official-center period separately.
            row["partial_source_period"] = data[field][-1]["period"]
        row.update(last_checked=timestamp,last_success=timestamp,last_extracted=timestamp,chart_applied_at=timestamp,status="Updated",
                   detail="审核通过，已写入研究图表。" if structured or receipt["dataset_id"]=="insurance.monthly" else
                   "审核通过，已更新中检院单机构视图。")
        row["recent_log"] = [*row.get("recent_log",[]),{"time":timestamp,"status":"Updated",
            "detail":row["detail"],"period":value["period"]}][-12:]
    state["generated_at"] = timestamp
    tasks = read_json(REVIEW,{})
    identifier = receipt["task_id"]
    if tasks["tasks"][identifier]["status"] != "open":
        raise ValueError("This exact review task has already been resolved")
    audit = {**approval, **receipt}
    tasks["tasks"][identifier].update(status="resolved",reviewed_at=timestamp,receipt_sha256=digest,
                             source_versions=receipt["files"],approval=approval,write_targets=receipt["write_targets"])
    # Generate and validate the complete transaction before writing any files.
    for output, contents in updates:
        import os
        from tempfile import NamedTemporaryFile
        with NamedTemporaryFile(dir=output.parent, delete=False) as stream:
            stream.write(contents)
        os.replace(stream.name,output)
    save(path,data)
    save(STATE,state)
    save(ROOT/"logs"/"reviewed"/f"{identifier}.json",audit)
    save(REVIEW,tasks)


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("task_id",nargs="?")
    parser.add_argument("--list",action="store_true")
    parser.add_argument("--cache",type=Path,default=ROOT/".review-work/raw")
    parser.add_argument("--output",type=Path,default=None)
    parser.add_argument("--approve-sha256",help="Exact receipt checksum after reviewing the proposed changes")
    parser.add_argument("--offline",action="store_true",help="Replay an archived source without approving")
    parser.add_argument("--report",type=Path,help="Write a publication-run report after approval")
    args=parser.parse_args()
    tasks = read_json(REVIEW,{})["tasks"]
    if args.list:
        for key, task in tasks.items():
            print(key, task["status"], task["dataset_id"], task["period"], task["url"])
        return
    if args.task_id not in tasks:
        parser.error("Use --list to find a known task")
    task=tasks[args.task_id]
    if task["status"] != "open":
        print(f"{args.task_id} already resolved")
        if args.report:
            save(args.report,{"time":utc(),"results":[]})
        return
    if args.offline and args.approve_sha256:
        parser.error("Approval requires a fresh official file")
    receipt=prepare(args.task_id,task,args.cache,offline=args.offline)
    output = args.output or ROOT/".review-work"/f"{args.task_id}.json"
    save(output,receipt)
    digest=sha256(dump_json(receipt)).hexdigest()
    print(f"{args.task_id} {digest} {output}")
    if args.approve_sha256:
        if args.approve_sha256 != digest:
            parser.error("The raw document or proposed values changed. Inspect the new receipt.")
        apply(receipt,task)
        if args.report:
            save(args.report,{"time":utc(),"results":[{"dataset_id":task["dataset_id"],
                "status":"Updated","period":receipt["candidate"]["period"],"source_files":receipt["files"]}]})


if __name__ == "__main__":
    main()
