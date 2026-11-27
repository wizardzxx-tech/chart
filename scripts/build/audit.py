"""Inventory tracked topic files and generate the source feasibility matrix."""
from collections import Counter
from csv import reader
from hashlib import sha256
from pathlib import Path
import json
import re
from zipfile import ZipFile


def paths(spec):
    return [path for path in [spec["local_data_path"], *spec.get("related_paths", [])] if path]


def covered_files(root, datasets):
    declared = {path for row in datasets for path in paths(row)}
    topics = {r["topic"] for r in datasets}
    actual = {p.relative_to(root).as_posix() for topic in topics for p in (root / "v2" / topic).rglob("*")
              if p.is_file() and p.suffix in (".json", ".csv", ".zip", ".txt")}
    return declared, actual


def verify_inventory(root, datasets):
    declared, actual = covered_files(root, datasets)
    unregistered = sorted(actual - declared)
    if unregistered:
        raise ValueError("Unregistered data files: " + ", ".join(unregistered))
    optional = {row["local_data_path"] for row in datasets if row.get("view") == "records"}
    absent = [path for path in sorted(declared - optional) if not (root / path).is_file()]
    if absent:
        raise ValueError("Registered file missing: " + ", ".join(absent))


def inspect(path):
    raw = path.read_bytes()
    fingerprint = sha256(raw).hexdigest()[:12]
    if path.suffix == ".csv":
        with path.open(encoding="utf-8-sig", newline="") as file:
            cols, *rows = reader(file)
        shape = f"{len(rows)} 行，{len(cols)} 列，{len(rows)-len(set(map(tuple, rows)))} 条完全重复"
    elif path.suffix == ".json":
        value = json.loads(raw)
        if isinstance(value, dict):
            shape = "、".join(f"{key}({len(x)})" if isinstance(x, (dict, list)) else key
                            for key, x in value.items())
        else:
            shape = f"{len(value)} 条"
    elif path.suffix == ".zip":
        with ZipFile(path) as archive:
            shape = f"{len(archive.namelist())} 个文件"
    elif path.suffix == ".html":
        html = raw.decode()
        scripts = re.findall(r'<script[^>]*\bsrc=["\']([^"\']+)', html)
        inline = re.findall(r'<script[^>]*\bid=["\']([^"\']+)', html)
        shape = "HTML 内嵌表格/数据。脚本 " + "、".join(scripts + inline)
    else:
        shape = f"{len(raw)} 字节"
    return shape, fingerprint


def generate(root, datasets):
    verify_inventory(root, datasets)
    levels = {"fully_automated": "自动提取候选", "rule_based": "公告发现＋审核",
              "manual_or_ai_review": "人工／AI辅助审核"}
    counts = Counter(row["automation_level"] for row in datasets)
    lines = ["# 数据源审计与自动化可行性矩阵", "",
             "注册表区分可用的结构化适配器、公告发现与人工处理。实际运行结果以网站更新中心为准。",
             f"覆盖 {len({r['topic'] for r in datasets})} 个专题、{len(datasets)} 个逻辑数据集。"
             + " ".join(f"{levels[k]} {v} 项。" for k, v in sorted(counts.items())), "",
             "保留数据统计期与网站原有单位。共享文件可承载多项数据；仅将已校验的新结构化结果另行补充。",
             "历史脚本路径以本地历史工作区 work/ 为基准。已有 scripts/ 路径对应本仓库可重建代码。",
             "", "| 数据集 | 数据期 | 数据源 | 更新方式／检查 | 口径和阻碍 | 既有代码 |",
             "|---|---|---|---|---|---|"]
    for row in datasets:
        evidence = "、".join(f"`{p}`" for p in row.get("historical_scripts", [])) or "—"
        lines.append(f"| {row['dataset_id']} · {row['label']} | {row['latest_data_period']} | "
                     f"[{row['source_name']}]({row['source_url']}) | "
                     f"{levels[row['automation_level']]} · {row['check_frequency']} | "
                     f"{'；'.join(row['validation_rules'])} | {evidence} |")
    declared, _ = covered_files(root, datasets)
    lines += ["", "## 基线文件指纹与结构", "",
              "完全重复表示 CSV 原文相同；业务主键、跨文件重复和合并口径按各数据集审核。",
              "", "| 文件 | 结构 | SHA-256 前 12 位 |", "|---|---|---|"]
    for path in sorted(declared):
        local = root / path
        if local.is_file():
            shape, fingerprint = inspect(local)
            lines.append(f"| `{path}` | {shape.replace('|', '/')} | `{fingerprint}` |")
    target = root / "docs/data-source-audit.md"
    target.write_text("\n".join(lines) + "\n")
