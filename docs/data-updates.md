# 医药行业公开数据库更新

[可行性矩阵](data-source-audit.md)列出各统计口径、原始出处、站点文件和既有采集代码。唯一调度配置是 `config/dataset_registry.yaml`。新增主题时登记页面、来源、统计口径和数据文件。通过历史回放、手动 dry run 和云端验证后，再安排自动检查。

## 运行

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements-updates.txt
.venv/bin/python scripts/data_update.py --audit
.venv/bin/python scripts/data_update.py --dataset fda.drugsfda --dry-run
.venv/bin/python scripts/data_update.py --dataset fda.insulins --start 2022-01-01 --end 2023-12-31
.venv/bin/python scripts/data_update.py --topic vaccines --dry-run
.venv/bin/python scripts/data_update.py --schedule monthly
.venv/bin/python scripts/build/site.py dist
```

GitHub Actions 的 Manual data update 可选择专题或填写一个或多个以逗号分隔的注册表 ID，默认 dry run。历史区间使用原始统计期。FDA 可回填 API 仍保存的批准行动，ClinicalTrials.gov 追踪指定试验当前的最新发布版本，公告回填受已公开索引范围限制。针对版本退市、来源封锁和超出索引的档案，按矩阵列明的官方来源补录。干跑结果同时出现在 Actions 摘要和运行报告里。

| 检查 | 北京时间 | 内容 |
|---|---|---|
| Daily | 每日 07:23 | 中检院批签发公告 |
| Weekly | 每周一 07:37 | 医保、医疗服务、FDA、NCT、药监及政策、上市公司公告 |
| Monthly | 15、23、28 日和月末附近 07:47 | Comtrade 发布目录及 CMS 文件目录 |

GitHub 的排程可能排队。写入和 Pages 发布共用一组并发锁。任务使用各自所需权限。通过校验的静态站点以 Pages artifact 部署，工作流在本次运行显式部署，无需等待自动提交触发另一次构建。仓库需在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。

## 统计口径与记录

- 站点保留既有专题图表及历史序列。FDA 新文件是已批准提交行动，包含补充批准。NCT 样本是注册地址和状态快照。CMS 部分先更新官方数据文件索引，原 Medicare 付费和购药系列保留原有代码与样本口径。
- 中检院公告检查只涵盖中检院自身发布页。全国汇总仍需核实地方机构覆盖、证书去重、统计期和公开发布范围。医保月度图片须复核数字和累计口径。
- `logs/checks-YYYY-MM.jsonl` 保存逐次结果、每个成功响应的 URL 与 SHA-256，以及已获准修订的前后记录和依据。网页保留每项最近 12 次记录。
- `logs/review.json` 收集待审文件的链接、期末、发布日期、发现时间和相关指标，不发布其提取结果。人工确认后以有来源的修订更新对应专题，并将该任务改为 `resolved`。固化规则不可靠时保持审核模式。
- 可自动发布的适配器在结构、主键、发布日期、来源或统计口径不合规时保留上一个有效版本。数值序列可在注册表配置单位、单期或累计、期数连续性、数值范围、异常比率和分项合计等检查。合法历史修订必须在适配器中提供同一官方发布方的修订依据，并在注册表明示授权自动修订。
- GitHub Issue 按数据集去重。来源暂不可用、解析或校验错误及超过该来源宽限期会提示；没有新一期不单独告警。日志区分网络可达与数据真正更新。
- 当前不调用 AI API。未来接入时将凭据保存在 GitHub Secrets，自定文件与调用预算并保留原文及提取依据，提取结果仍进入审核。
