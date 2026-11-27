# 科伦集团市值与持股追踪

页面路径为 `/chart/kelun-tracker/`。覆盖科伦药业、科伦博泰、川宁生物、石四药集团、辰欣药业。持股事件的生效日期、披露日期与原文位于 `kelun-tracker/config/ownership.json`。

## 自动更新

GitHub Actions 每周一至周五北京时间 17:30、21:15 运行，也支持手动运行。公开参考汇率取自欧洲央行。配置授权行情服务后，同一任务更新五只股票的收盘价记录和派生指标。服务支持从 2023-07-11 回填。最新交易日若迟到一日会在页面列明，超出一日或任何关键验证失败时保留上次成功数据。

在仓库的 Actions secrets 中配置：

- `KELUN_LICENSED_FEED_URL` 为获得公开展示与下载许可的 HTTPS 数据服务。需覆盖五只证券、未复权收盘价与所需历史区间。通过静态站点公开的派生值与 CSV 也应在授权范围内。
- `KELUN_FEED_TOKEN` 为行情服务可选的 Bearer token。
- `KELUN_PAGES_TOKEN` 为可选的仓库级 Contents 写权限 token，用于沿用现有分支模式下的 Pages 推送触发。省略时，任务用 Actions token 提交，并显式请求 Pages 构建。若仓库策略拒绝 Actions token 请求构建，则设置该 token。

提交仅限 `kelun-tracker/data`。日常数据提交不会触发同一工作流的 push 条件。发生同路径并发修改时，rebase 冲突使任务失败并保留远端版本。

行情服务响应 JSON，顶层 `prices` 为完整历史数组，每条包括 `asset`、`date`（当地交易日期）、`close`（本币未复权交易所官方收盘）及 `provider`（可公开引用的来源名称）与 `source_url`（HTTPS 原始来源）。可选 `actions` 用于核对权益事项。公开 JSON 和 CSV 由程序独立生成。接入前按五个证券代码逐一对照交易所收盘，并核对报价单位、是否延迟以及是否为交易所收盘价。

## 本地验证与备用

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/kelun/requirements.txt
.venv/bin/python -m unittest discover -s scripts/kelun -v
.venv/bin/python scripts/kelun/update.py --smoke
.venv/bin/python scripts/kelun/update.py --output /tmp/kelun/processed --raw /tmp/kelun/raw
```

探测和本地模式用于检验公开端点的可达性与计算逻辑。生产发布不会回退到未核实公开授权的接口。原始 CSV 位于本地 `raw`，成品为 `processed/tracker.json` 和 `processed/daily.csv`。把本地 JSON 导入页面后只在当前标签页使用。
