"""Write a readable check report and a bounded Actions incident output."""
import json
import os
from pathlib import Path
import sys

report = json.loads(Path(sys.argv[1]).read_text())
failures = []
with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as summary:
    summary.write("## 数据源检查\n\n")
    summary.write("| 数据集 | 状态 | 统计期 | 原始响应 |\n|---|---|---|---:|\n")
    for item in report["results"]:
        summary.write(f"| {item['dataset_id']} | {item['status']} | {item['period']} | {len(item['source_files'])} |\n")
        if item["status"] in ("Validation failed", "Source unavailable") or item.get("stale"):
            failures.append({"dataset": item["dataset_id"],
                             "status": "超出发布宽限期" if item.get("stale") else item["status"],
                             "detail": item["detail"]})
with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
    output.write("ran=true\n")
    if failures:
        output.write("incidents=" + json.dumps(failures, ensure_ascii=True) + "\n")
