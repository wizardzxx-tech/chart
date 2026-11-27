# 历史脚本迁移审计

已检查第一阶段矩阵列出的本地项目。可复用变换经过移植，路径与输入由仓库或命令参数提供。依赖私有缓存、抽取配置或逐页审核的历史生成器保留本地，已发布数据仍由原文件承载。

| 历史路径 | 核查 | 迁移状态 |
|---|---|---|
| `api_research/build.py` | SHA-256 `84996c7ed9dc`，13 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `api_research/collect.py` | SHA-256 `ddbc5c26f2f3`，1 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `api_research/collect_standard.py` | SHA-256 `22a8ce1957c3`，1 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `api_research/companies.py` | SHA-256 `b101d5285aa4`，1 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `biosimilars_cxo/build.py` | SHA-256 `08a677af16aa`，4 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `biosimilars_cxo/scan_ema.py` | SHA-256 `22193262d6f7`，1 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `biosimilars_refresh/make_evidence.py` | SHA-256 `ab69217d18d9`，7 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `biosimilars_refresh/update_page.py` | SHA-256 `268a4d8a1785`，1 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `blood_incentives_20261111/collect.py` | SHA-256 `d83989f42ea5`，3 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `blood_incentives_20261111/data.py` | SHA-256 `edadf76c09eb`，2 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `blood_lot_release/build_data.py` | SHA-256 `766b75c3ae92`，4 个顶层函数 | research/blood_names.py · 产品及集团映射 |
| `blood_products_20261111/build_data.py` | SHA-256 `00b394ba4225`，5 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `blood_products_20261111/collect.py` | SHA-256 `246b7a604964`，4 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `blood_products_20261111/filing_snippets.py` | SHA-256 `56dfa5acc73b`，0 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `blood_products_20261111/money.py` | SHA-256 `635677e03978`，2 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `blood_products_20261111/research/build_albumin.py` | SHA-256 `62b645cfdbf6`，5 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `blood_products_20261111/research/check_shanghai.py` | SHA-256 `13dc035dcf9c`，2 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `blood_products_20261111/supplement.py` | SHA-256 `0316e4f47d87`，1 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `ccc_audit_20261113/recompute.py` | SHA-256 `c219ebfeb47a`，14 个顶层函数 | research/legacy_ccc_audit.py · 原始口径全量回放 |
| `customs_trade/collect_tariffline.py` | SHA-256 `5cf999ebef66`，4 个顶层函数 | updaters/trade_values.py · 公共预览接口 |
| `customs_trade/fetch.py` | SHA-256 `be9b1ba18af1`，2 个顶层函数 | updaters/trade_values.py · 限额校验及规范化 |
| `customs_trade/history_hs.py` | SHA-256 `046d0321a5cc`，1 个顶层函数 | updaters/trade_values.py · 沿用网站逐年编码 |
| `customs_trade/import_customs.py` | SHA-256 `3ad725e18ebf`，5 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `customs_trade/import_registered_provinces.py` | SHA-256 `84fa01d0454f`，5 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `customs_trade/prepare.py` | SHA-256 `b343c865d7df`，9 个顶层函数 | research/trade_units.py · 单位和数量品质 |
| `customs_trade/qa_coverage.py` | SHA-256 `a66602d29a05`，1 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `customs_trade/supplement.py` | SHA-256 `2a0a34634860`，1 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `insulin_20261120/history/build_equity.py` | SHA-256 `4e74a05cb252`，3 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `insulin_20261120/history/build_financials.py` | SHA-256 `e84b15e85bab`，4 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `insulin_20261120/history/collect_events.py` | SHA-256 `2603bab99cd7`，0 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `insulin_tracker/business.py` | SHA-256 `1919c66a19f1`，1 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `insulin_tracker/partd.py` | SHA-256 `fe51c551b92f`，2 个顶层函数 | research/insulin_classification.py · Part D 分类 |
| `insulin_tracker/products.py` | SHA-256 `57d8f3938518`，2 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `insulin_tracker/vbp.py` | SHA-256 `ad4122d729ea`，4 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `medical-insurance/build_data.py` | SHA-256 `e4f17ea2f610`，4 个顶层函数 | research/nhsa.py · 图片识别新增，原年度年报重建保留历史 |
| `medical-services/build_data.py` | SHA-256 `fbd7dd820365`，5 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `ophthalmology_20261113/build_capital.py` | SHA-256 `876a06cfa596`，0 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `ophthalmology_20261113/build_equity.py` | SHA-256 `b02c3f3a55ee`，6 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `ophthalmology_20261113/build_hk.py` | SHA-256 `a1cdbf94e36f`，6 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `ophthalmology_20261113/build_industry.py` | SHA-256 `faabc06b5fe4`，1 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `ophthalmology_20261113/build_network.py` | SHA-256 `88703170242d`，2 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `ophthalmology_20261113/extract_numbers.py` | SHA-256 `03c102e91a10`，0 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `pharmacy_company_series_20261111/collect.py` | SHA-256 `f9726e580562`，6 个顶层函数 | updaters/filings.py · 公告目录及 PDF 链接 |
| `pharmacy_company_series_20261111/normalize.py` | SHA-256 `a239061d3c18`，7 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `pharmacy_efficiency/collect.py` | SHA-256 `fe2929851b98`，1 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `pharmacy_efficiency/derive.py` | SHA-256 `4dac2cde3139`，9 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `pharmacy_efficiency/segments.py` | SHA-256 `3524d5715b23`，3 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `pharmacy_expansion/build_equity.py` | SHA-256 `55a689cc9235`，2 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `pharmacy_expansion/build_stores.py` | SHA-256 `e00e2ed221f8`，3 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `pharmacy_incentives_20261111/collect.py` | SHA-256 `f448697398c5`，3 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `pharmacy_incentives_20261111/outcomes.py` | SHA-256 `9eedbbaf0efe`，0 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `pharmacy_store_series_20261110` | 目录，0 个同层代码文件 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `scripts/biosimilars/build_benchmark.py` | SHA-256 `8c5e8a464eba`，2 个顶层函数 | 现有仓库可运行 |
| `scripts/biosimilars/build_france.py` | SHA-256 `f742f2d4ce7a`，1 个顶层函数 | 现有仓库可运行 |
| `scripts/biosimilars/build_market_research.py` | SHA-256 `4f1031229ed5`，7 个顶层函数 | 现有仓库可运行 |
| `scripts/biosimilars/build_medicare.py` | SHA-256 `2ce6549bacfc`，11 个顶层函数 | 现有仓库可运行 |
| `scripts/biosimilars/download_medicare.py` | SHA-256 `2d8f42704b7a`，2 个顶层函数 | 现有仓库可运行 |
| `vaccine_lot_release/aggregate.py` | SHA-256 `8602877ed9d0`，16 个顶层函数 | research/vaccine_names.py · 名称及品种映射 |
| `vaccine_lot_release/collect.py` | SHA-256 `8f24b29828cb`，8 个顶层函数 | research/lot_parser.py · 日期及表格 |
| `vaccine_lot_release/legacy_collect.py` | SHA-256 `58224215950e`，1 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `vaccines_20261112/build_incentives.py` | SHA-256 `62f27fc4fe7f`，9 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `vaccines_20261112/build_overseas.py` | SHA-256 `fa4d72738e0d`，5 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `vaccines_20261112/build_quarters.py` | SHA-256 `cf53029bd8e7`，0 个顶层函数 | 历史工作脚本，依赖原始文件、人工口径或一次性研究。以注册表继续跟踪。 |
| `working_capital_20261112/collect_statements.py` | SHA-256 `7239e6202eaf`，4 个顶层函数 | updaters/finance.py · 标准字段和数据源 |
