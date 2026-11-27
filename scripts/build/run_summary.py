"""Write a readable check report and reconcile source incidents."""
from datetime import datetime
import json
import os
from pathlib import Path
import sys

report=json.loads(Path(sys.argv[1]).read_text())
state=Path(__file__).resolve().parents[2]/"v2/update-center/status.json"
now=datetime.fromisoformat(report["time"])
incidents=[]
with open(os.environ["GITHUB_STEP_SUMMARY"],"a",encoding="utf-8") as summary:
    summary.write("## 数据源检查\n\n")
    summary.write("| 数据集 | 状态 | 统计期 | 配置 / 实查 / 成功 / 最新 | 原始响应 |\n|---|---|---|---|---:|\n")
    for item in report["results"]:
        coverage=item.get("coverage",{})
        counts=" / ".join(str(coverage[k]) for k in ("configured","checked","successful","latest")) if coverage else "—"
        summary.write(f"| {item['dataset_id']} | {item['status']} | {item['period']} | {counts} | {len(item['source_files'])} |\n")
    for item in report["results"]:
        notes=item.get("quality_notes",[])
        if notes:
            summary.write(f"\n### {item['dataset_id']} 检查提示\n\n")
            for warning in notes:
                summary.write(f"- {warning}\n")
        if item["status"] in ("Partial success","Validation failed","Source unavailable") or item.get("stale"):
            problems=[f"{unit['id']}: {unit.get('detail',unit['status'])}" for unit in item.get("subtasks",[])
                      if unit["status"] in ("failed","uncovered","pending_revision")]
            incidents.append({"dataset":item["dataset_id"],
                "status":"超出发布宽限期" if item.get("stale") else item["status"],
                "detail":"\n".join([item.get("detail",""),*(problems or notes)][:50])})
        elif item["status"] in ("Updated","No new data","Pending review"):
            incidents.append({"dataset":item["dataset_id"],"status":"Recovered"})
    grace={"daily":3,"weekly":10,"monthly":46}
    for row in json.loads(state.read_text())["datasets"]:
        days=grace.get(row["check_frequency"])
        if not days or not row.get("last_checked"):
            continue
        elapsed=(now-datetime.fromisoformat(row["last_checked"])).days
        if elapsed>days:
            incidents.append({"dataset":"schedule/"+row["dataset_id"],"status":"计划任务检查长时间未运行",
                "detail":f"距上次检查 {elapsed} 天，宽限期 {days} 天。"})
        else:
            incidents.append({"dataset":"schedule/"+row["dataset_id"],"status":"Recovered"})
with open(os.environ["GITHUB_OUTPUT"],"a",encoding="utf-8") as output:
    output.write("ran=true\n")
    if incidents:
        output.write("incidents="+json.dumps(incidents,ensure_ascii=True)+"\n")
