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

from data_update import ROOT, REVIEW, STATE, dump_json, read_json, save
from updaters.http import HTTP

PROCESSORS = {"insurance.monthly": "nhsa", "blood.lot-release": "lot", "vax.lot-release": "lot"}


def utc():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def evidence(cache, http):
    checked = {}

    def read(url):
        cache.mkdir(parents=True, exist_ok=True)
        name = sha256(url.encode()).hexdigest()
        link = cache / f"{name}.json"
        if link.exists():
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


def prepare(task_id, task, cache):
    name = PROCESSORS.get(task["dataset_id"])
    if not name:
        raise ValueError("This task has no validated research-data writer")
    adapter = import_module(f"research.{name}")
    http = HTTP()
    read, checked = evidence(cache, http)
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
    return {"task_id": task_id,"dataset_id":task["dataset_id"], "source":task["url"],
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
    path, field = target(task)
    old_data = read_json(path,{})
    data = deepcopy(old_data)
    value = receipt["candidate"]
    prev = next((x for x in data.get(field,[]) if x["period"]==value["period"]),None)
    if prev != receipt["old"]:
        raise ValueError("Published data changed after the review receipt was prepared")
    data[field] = sorted([v for v in data.get(field,[]) if v["period"] != value["period"]]+[value],key=lambda x:x["period"])
    updates = []
    if receipt["dataset_id"] == "insurance.monthly":
        updates.append(append_nhsa_csv(value))

    state = read_json(STATE, {})
    timestamp = utc()
    for row in state["datasets"]:
        if row["dataset_id"] != task["dataset_id"]:
            continue
        if receipt["dataset_id"] == "insurance.monthly":
            row["latest_data_period"] = data[field][-1]["period"]
            row["source"] = data[field][-1]["source"]
        else:
            # Overall national coverage remains on the legacy series. Store the
            # independently verified official-center period separately.
            row["partial_source_period"] = data[field][-1]["period"]
        row.update(last_checked=timestamp,last_success=timestamp,last_extracted=timestamp,chart_applied_at=timestamp,status="Updated",
                   detail="审核通过，已写入研究图表。" if receipt["dataset_id"]=="insurance.monthly" else
                   "审核通过，已更新中检院单机构视图。")
        row["recent_log"] = [*row.get("recent_log",[]),{"time":timestamp,"status":"Updated",
            "detail":row["detail"],"period":value["period"]}][-12:]
    state["generated_at"] = timestamp
    tasks = read_json(REVIEW,{})
    identifier = receipt["task_id"]
    if tasks["tasks"][identifier]["status"] != "open":
        raise ValueError("This exact review task has already been resolved")
    digest = sha256(dump_json(receipt)).hexdigest()
    audit = {"receipt_sha256":digest, "reviewed_at":timestamp, **receipt}
    tasks["tasks"][identifier].update(status="resolved",reviewed_at=timestamp,receipt_sha256=digest,
                             source_versions=receipt["files"])
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
    receipt=prepare(args.task_id,task,args.cache)
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
