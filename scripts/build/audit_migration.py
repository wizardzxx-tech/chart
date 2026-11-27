"""Inventory Phase 1 historical code without copying files or data from the Mac."""
from argparse import ArgumentParser
import ast
from hashlib import sha256
from pathlib import Path

import yaml

ROOT=Path(__file__).resolve().parents[2]
RELATION={
 "medical-insurance/build_data.py":"research/nhsa.py · 图片识别新增，原年度年报重建保留历史",
 "ccc_audit_20261113/recompute.py":"research/legacy_ccc_audit.py · 原始口径全量回放",
 "working_capital_20261112/collect_statements.py":"updaters/finance.py · 标准字段和数据源",
 "vaccine_lot_release/collect.py":"research/lot_parser.py · 日期及表格",
 "vaccine_lot_release/aggregate.py":"research/vaccine_names.py · 名称及品种映射",
 "blood_lot_release/build_data.py":"research/blood_names.py · 产品及集团映射",
 "customs_trade/prepare.py":"research/trade_units.py · 单位和数量品质",
 "customs_trade/fetch.py":"updaters/trade_values.py · 限额校验及规范化",
 "customs_trade/collect_tariffline.py":"updaters/trade_values.py · 公共预览接口",
 "customs_trade/history_hs.py":"updaters/trade_values.py · 沿用网站逐年编码",
 "insulin_tracker/partd.py":"research/insulin_classification.py · Part D 分类",
 "pharmacy_company_series_20261111/collect.py":"updaters/filings.py · 公告目录及 PDF 链接",
}
parser=ArgumentParser(description=__doc__)
parser.add_argument("work",type=Path)
args=parser.parse_args()
registry=yaml.safe_load((ROOT/"config/dataset_registry.yaml").read_text())["datasets"]
inputs=sorted({p for d in registry for p in d.get("historical_scripts",[])})
lines=["# 历史脚本迁移审计","",
       "已检查第一阶段矩阵列出的本地项目。可复用变换经过移植，路径与输入由仓库或命令参数提供。"
       "依赖私有缓存、抽取配置或逐页审核的历史生成器保留本地，已发布数据仍由原文件承载。","",
       "| 历史路径 | 核查 | 迁移状态 |","|---|---|---|"]
for ref in inputs:
    candidate=ROOT/ref if ref.startswith("scripts/") else args.work/ref
    if candidate.is_dir():
        scripts=sorted(p for p in candidate.glob("*") if p.suffix in (".py",".js",".mjs"))
        finding=f"目录，{len(scripts)} 个同层代码文件"
    elif not candidate.is_file():
        finding="当前工作区未找到"
    else:
        contents=candidate.read_bytes()
        syntax=""
        if candidate.suffix==".py":
            tree=ast.parse(contents)
            syntax=f"，{sum(isinstance(x,(ast.FunctionDef,ast.AsyncFunctionDef)) for x in tree.body)} 个顶层函数"
        finding=f"SHA-256 `{sha256(contents).hexdigest()[:12]}`{syntax}"
    mode=("现有仓库可运行" if ref.startswith("scripts/") else RELATION.get(ref,
          "历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。"))
    lines.append(f"| `{ref}` | {finding} | {mode} |")
(ROOT/"docs/phase2-migration.md").write_text("\n".join(lines)+"\n")
