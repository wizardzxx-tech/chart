"""Run data checks, refresh accepted snapshots, and maintain the site update index."""
from argparse import ArgumentParser
from collections import Counter
from datetime import date, datetime, timezone
from hashlib import sha256
from importlib import import_module
import json
import os
from pathlib import Path
import re
from tempfile import NamedTemporaryFile
from zoneinfo import ZoneInfo

import yaml

from build.audit import generate, verify_inventory
from updaters.http import HTTP, SourceUnavailable
from research.chart_binding import applies
from research.checks import GOOD, PROBLEM, summarize
from validators.data import material
from validators.data import validate_notices, validate_records

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "config/dataset_registry.yaml"
SITE = ROOT / "v2/update-center"
STATE = SITE / "status.json"
REVIEW = ROOT / "logs/review.json"
TODAY = datetime.now(ZoneInfo("Asia/Shanghai")).date().isoformat()
LEVELS = {"fully_automated", "rule_based", "manual_or_ai_review"}
SCHEDULES = {"daily", "weekly", "monthly", "manual"}
FIELDS = "dataset_id topic source_name source_url source_format data_frequency check_frequency latest_data_period local_data_path updater_script automation_level validation_rules review_required".split()
LABELS = {"pharmacy": "零售药房", "blood-products": "血制品", "vaccines": "疫苗",
          "ophthalmology": "眼科医院", "medical-insurance": "医保基金", "medical-services": "医疗服务量",
          "api": "原料药", "medical-devices": "医疗器械", "biosimilars": "生物类似药", "insulin": "胰岛素"}


def read_json(path, fallback):
    return json.loads(path.read_bytes()) if path.exists() else fallback


def dump_json(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode()


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(dir=path.parent, delete=False) as file:
        file.write(dump_json(value))
    os.replace(file.name, path)


def load_registry():
    registry = yaml.safe_load(REGISTRY.read_text())
    if registry["version"] != 1:
        raise ValueError("Unsupported registry version")
    seen = set()
    for row in registry["datasets"]:
        key = row.get("dataset_id", "")
        if not set(FIELDS) <= row.keys() or key in seen or not re.fullmatch(r"[a-z0-9.-]+", key):
            raise ValueError(f"Invalid dataset registry entry: {key}")
        seen.add(key)
        if row["check_frequency"] not in SCHEDULES or row["automation_level"] not in LEVELS:
            raise ValueError(f"{key} needs a valid level and frequency")
        script = row["updater_script"]
        if script and script != f"scripts/updaters/{row['adapter']}.py":
            raise ValueError(f"{key} must name a source adapter")
        if not script and row["check_frequency"] != "manual":
            raise ValueError(f"{key} has a schedule but no executable adapter")
        if row.get("view") == "records" and (row["review_required"]
                or row["local_data_path"] != f"v2/{row['topic']}/public-data/{key}.json"):
            raise ValueError(f"{key} has an unsafe publication path or review policy")
    return registry["datasets"]


def base_status(spec, previous):
    entry = {key: spec[key] for key in ("dataset_id", "topic", "label", "source_name", "source_url", "data_frequency",
                                       "check_frequency", "automation_level", "review_required", "section")}
    entry["topic_label"] = LABELS.get(spec["topic"], spec["topic"])
    entry["monitoring_enabled"] = bool(spec["updater_script"])
    entry["chart_binding"] = bool(spec.get("chart_binding"))
    if spec.get("view") == "records":
        entry["data_url"] = "../" + spec["local_data_path"].removeprefix("v2/")
    entry |= {key: previous[key] for key in ("latest_data_period", "last_checked", "last_success",
              "last_source_success", "recent_log", "status", "detail", "eligible_cloud_check", "partial_source_period", "chart_applied_at", "last_extracted", "quality_notes",
              "subtasks", "coverage") if key in previous}
    entry.setdefault("latest_data_period", spec["latest_data_period"])
    entry["source"] = previous.get("source", spec["source_url"])
    entry.setdefault("status", "Manual update required" if not spec["updater_script"] else None)
    entry.setdefault("recent_log", [])
    return entry


def confirmed_cms_revision(spec,row,old,stamp,evidence):
    if spec["dataset_id"]!="cms.partb-values":
        return None
    path=ROOT/"config/cms-2025-full-year-review.json"
    if not path.exists():
        return None
    approved=read_json(path,{})
    rule=approved["rows"].get(row["id"])
    if (not rule or rule["after"]!=stamp or rule["before"]!=sha256(dump_json(material(old,spec))).hexdigest()
            or row["source"]!=approved["replacement"]["url"]
            or not any(x["url"]==row["source"] and x["sha256"]==approved["replacement"]["sha256"] for x in evidence)):
        return None
    return {"source":row["source"],"source_versions":[approved["prior"],approved["replacement"]],
            "task_id":rule["task"],"reviewed_by":approved["reviewed_by"],
            "scope":approved["scope"],"manifest_sha256":sha256(path.read_bytes()).hexdigest()}


def check_one(spec, state, http, args, tasks, now):
    name = spec["dataset_id"]
    output = None
    archive = []
    if not spec["updater_script"]:
        return "Manual update required", "现有数据依赖人工复核或补录。", output, archive
    adapter = import_module(f"updaters.{spec['adapter']}")
    start = args.start or spec.get("incremental_start", "2018-01-01")
    end = args.end or TODAY
    state["quality_notes"] = []
    prior_checks = {item["id"]:item for item in state.get("subtasks",[])}
    response = adapter.collect({**spec,"previous_checks":prior_checks,
                                "backfill":bool(args.start or args.end)}, http, start, end)
    if not response.get("checks") or any(x["status"] in GOOD for x in response["checks"]):
        state["last_source_success"] = now
    if "checks" in response:
        state["subtasks"] = response["checks"]
        for task in state["subtasks"]:
            last_ok = now if task["status"] in GOOD and task["attempted"] else prior_checks.get(task["id"],{}).get("last_ok")
            if last_ok:
                task["last_ok"] = last_ok
    state["quality_notes"] = response.get("warnings", [])
    if spec["review_required"]:
        found = response["notices"]
        validate_notices(found)
        for notice in found:
            base = f"{name}/{notice['url']}"
            key = sha256(base.encode()).hexdigest()[:24]
            if notice.get("dataset_checksum"):
                key = sha256((base+"/"+notice["dataset_checksum"]).encode()).hexdigest()[:24]
            resolved = tasks.get(key,{})
            if resolved.get("status")=="resolved" and spec.get("review_processor"):
                primary=[item for item in resolved.get("source_versions",[])
                         if item["url"]==notice["url"] or "/picture/" in item["url"]]
                hashes=[sha256(http.get(item["url"])).hexdigest() for item in primary]
                if hashes!=[item["sha256"] for item in primary]:
                    key=sha256((base+"/"+"/".join(hashes)).encode()).hexdigest()[:24]
                    notice={**notice,"revision":True,"supersedes":resolved["receipt_sha256"]}
            tasks.setdefault(key, {**notice, "dataset_id": name, "topic": spec["topic"],
                                   "first_seen": now, "status": "open"})
        count = sum(task["dataset_id"] == name and task["status"] == "open" for task in tasks.values())
        if count:
            return "Pending review", f"{count} 份来源文件待审核。", output, archive
        return "No new data", "已检查官方目录。", output, archive

    path = ROOT / spec["local_data_path"]
    old = read_json(path, {"records": [], "source_files": []})
    candidates = response["records"]
    definition_migrations=[]
    if spec.get("adapter")=="finance" and candidates:
        from updaters.finance import migrate_legacy_sga
        for i,record in enumerate(old["records"]):
            corrected=migrate_legacy_sga(record)
            if corrected is record:
                continue
            definition_migrations.append({"id":record["id"],"source":record["source"],
                "reason":"The legacy SEC selling field used the combined US GAAP SG&A tag.",
                "before":{k:record[k] for k in ("selling","quarter","ttm")},
                "after":{k:corrected[k] for k in ("selling","sga","quarter","ttm")}})
            old["records"][i]=corrected
    reviewed_revisions=[]
    if "checks" in response:
        existing = {row["id"]:row for row in old["records"]}
        shortlisted = []
        check_rows = {item["id"]:item for item in state["subtasks"]}
        by_unit = {}
        for row in candidates:
            by_unit.setdefault(response.get("record_units",{}).get(row["id"],row["id"]),[]).append(row)
        for identifier, rows in by_unit.items():
            task = check_rows.get(identifier)
            accepted = []
            for row in rows:
                published = existing.get(row["id"])
                if published is not None and material(row,spec) != material(published,spec):
                    stamp = sha256(dump_json(material(row,spec))).hexdigest()
                    key = sha256((name+"/"+row["id"]+"/"+stamp).encode()).hexdigest()[:24]
                    proof=confirmed_cms_revision(spec,row,published,stamp,http.evidence)
                    if proof:
                        accepted.append({**row,"approved_revision":proof})
                        reviewed_revisions.append({"before":published,"after":row,"evidence":proof})
                        continue
                    tasks.setdefault(key, {"title":f'{name} · {row["id"]} 历史修订',
                        "dataset_id":name,"topic":spec["topic"],"url":row["source"],"period":row["period"],
                        "first_seen":now,"status":"open","revision":True,"row_id":row["id"],
                        "candidate_sha256":stamp,"unit_id":identifier})
                    if task:
                        task.update(status="pending_revision",detail="来源值有变，保留上次通过校验的数据")
                else:
                    accepted.append(row)
            try:
                validate_records(spec,accepted,[existing[r["id"]] for r in accepted if r["id"] in existing
                                                and "approved_revision" not in r],end)
            except (ValueError, KeyError, TypeError, IndexError) as error:
                if task:
                    task.update(status="failed",detail=str(error)[:250])
                continue
            if task and task["status"]=="records" and all(r["id"] in existing for r in accepted):
                task["status"]="unchanged"
            shortlisted.extend(accepted)
        candidates=shortlisted
    corrected={r["id"] for r in candidates if "approved_revision" in r}
    combined, changed, archive = validate_records(spec,candidates,
         [r for r in old["records"] if r["id"] not in corrected],end)
    archive.extend(revision for revision in reviewed_revisions if revision["after"]["id"] in corrected)
    for revision in reviewed_revisions:
        proof=revision["evidence"]
        if revision["after"]["id"] in corrected and proof["task_id"] in tasks:
            tasks[proof["task_id"]].update(status="resolved",reviewed_at=now,approval=proof)
    if not combined:
        return "No new data", "所选期间未发现新记录。", output, archive
    latest = max(combined, key=lambda row: row["period"])
    state["source"] = latest["source"]
    state["latest_data_period"] = latest.get("edition", latest["period"])
    state["last_extracted"] = now
    if changed or definition_migrations:
        archive.extend(definition_migrations)
        before = {(x["url"], x["sha256"]) for x in old["source_files"]}
        after = {(x["url"], x["sha256"]) for x in http.evidence}
        processor=spec.get("processing_version")
        method_changed=processor and old.get("processing_version")!=processor
        if changed and before and before == after and not (definition_migrations or reviewed_revisions or method_changed):
            raise ValueError("Source fingerprints unchanged while normalized records changed")
        output = (path, {"dataset_id": name, "updated_at": now, "source_files": http.evidence,
                         "records": combined, **({"processing_version":processor} if processor else {})})
        state["last_success"] = now
        if spec.get("chart_binding") and applies(spec, changed):
            state["chart_applied_at"] = now
        return "Updated", f"新增或经核验修订 {len(changed)} 条。", output, archive
    return "No new data", "已核对来源与已发布记录。", output, archive


def select(specs, args):
    if args.dataset and args.topic:
        raise ValueError("Select a topic or dataset")
    if args.dataset:
        requested = set(args.dataset.split(","))
        selected = [r for r in specs if r["dataset_id"] in requested]
        if {r["dataset_id"] for r in selected} != requested:
            raise ValueError("Unknown dataset ID")
        return selected
    if args.topic:
        selected = [r for r in specs if r["topic"] == args.topic]
        if not selected:
            raise ValueError("Unknown topic")
        return selected
    if args.schedule in ("all", "manual"):
        return specs if args.schedule == "manual" else [r for r in specs if r["updater_script"]]
    return [r for r in specs if r["check_frequency"] == args.schedule]


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--schedule", choices=["all", *sorted(SCHEDULES)], default="all")
    parser.add_argument("--dataset", help="One ID or comma-separated dataset IDs")
    parser.add_argument("--retry-partial",action="store_true",help="Retry recently failed company data checks")
    parser.add_argument("--topic")
    parser.add_argument("--start", type=lambda text: date.fromisoformat(text).isoformat())
    parser.add_argument("--end", type=lambda text: date.fromisoformat(text).isoformat())
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--audit", action="store_true", help="Regenerate the source feasibility matrix")
    parser.add_argument("--index-only", action="store_true", help="Build the registry index without checking sources")
    parser.add_argument("--report", type=Path, help="Write a machine-readable summary, including for dry runs")
    args = parser.parse_args()
    if args.start and args.start > (args.end or TODAY) or args.end and args.end > TODAY:
        parser.error("Use a valid historical period range")
    specs = load_registry()
    verify_inventory(ROOT, specs)
    if args.audit:
        generate(ROOT, specs)
        return
    previous = read_json(STATE, {"datasets": []})
    known = {row["dataset_id"]: row for row in previous["datasets"]}
    states = {r["dataset_id"]: base_status(r, known.get(r["dataset_id"], {})) for r in specs}
    tasks = read_json(REVIEW, {"tasks": {}})["tasks"]
    baseline_review = dump_json(tasks)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    report_items = []
    selected=[] if args.index_only else select(specs,args)
    if args.retry_partial and not args.index_only:
        names={r["dataset_id"] for r in selected}
        selected.extend(row for row in specs if row["dataset_id"] not in names
                        and row.get("adapter") in ("finance","filings","cms_values")
                        and known.get(row["dataset_id"],{}).get("coverage",{}).get("failed"))
    trade = [row for row in selected if row.get("adapter")=="trade_values"]
    if trade:
        # These datasets share the provider's request limit. Give unfilled
        # series and those with the oldest last success a chance to run first.
        positions=(i for i,row in enumerate(selected) if row.get("adapter")=="trade_values")
        priority=sorted(trade,key=lambda item: known.get(item["dataset_id"],{}).get("last_success") or "")
        for i,row in zip(positions,priority):
            selected[i]=row
    for spec in selected:
        name = spec["dataset_id"]
        state = states[name]
        http = HTTP()
        output, archive = None, []
        try:
            status, detail, output, archive = check_one(spec, state, http, args, tasks, now)
        except SourceUnavailable as error:
            status, detail = "Source unavailable", str(error)
        except Exception as error:
            status, detail = "Validation failed", f"{type(error).__name__}: {error}"[:300]
            state["subtasks"] = []
            state.pop("coverage",None)
        finally:
            http.session.close()
        checks = state.get("subtasks",[])
        if checks:
            state["coverage"] = coverage = summarize(checks)
            if any(item["status"] in PROBLEM for item in checks):
                state["quality_notes"] = [*state.get("quality_notes",[]), *[
                    f'{item["id"]}: {item.get("detail",item["status"])}'
                    for item in checks if item["status"] in PROBLEM]]
                if status in ("Updated","No new data","Pending review"):
                    status = "Partial success" if coverage["successful"] or coverage["previously_verified"] else "Source unavailable"
                    detail = f'{detail} 成功 {coverage["successful"]}/{coverage["configured"]}，失败 {coverage["failed"]}，未覆盖 {coverage["uncovered"]}，修订待审 {coverage["pending_revision"]}。'
        state |= {"status": status, "detail": detail, "last_checked": now}
        if os.environ.get("GITHUB_ACTIONS") == "true" and status in ("Updated", "No new data", "Pending review", "Partial success"):
            state["eligible_cloud_check"] = True
        event = {"dataset_id": name, "time": now, "status": status, "detail": detail,
                 "period": state["latest_data_period"], "source_files": http.evidence,
                 "quality_notes":state.get("quality_notes", []), "subtasks":checks,
                 "coverage":state.get("coverage",{})}
        if archive:
            event["revisions"] = archive
        max_age = spec.get("max_age_days")
        if max_age and status in ("Updated", "No new data"):
            period = state["latest_data_period"]
            if re.fullmatch(r"\d{4}-\d{2}", period):
                period += "-01"
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", period):
                event["stale"] = (date.fromisoformat(TODAY) - date.fromisoformat(period)).days > max_age
        if not args.dry_run and output:
            save(*output)
        state["recent_log"] = [*state["recent_log"], {k: event[k] for k in ("time", "status", "detail", "period")}][-12:]
        report_items.append(event)
        print(f"{name:30} {status:24} {detail}", flush=True)
    report = {"time": now, "dry_run": args.dry_run, "results": report_items,
              "counts": dict(Counter(row["status"] for row in report_items))}
    if not args.dry_run:
        save(STATE, {"generated_at": now, "datasets": list(states.values())})
        if dump_json(tasks) != baseline_review:
            save(REVIEW, {"tasks": tasks})
        if report_items:
            monthly = ROOT / "logs" / f"checks-{now[:7]}.jsonl"
            with monthly.open("a", encoding="utf-8") as file:
                file.writelines(json.dumps(event, ensure_ascii=False) + "\n" for event in report_items)
    if args.report:
        save(args.report, report)


if __name__ == "__main__":
    main()
