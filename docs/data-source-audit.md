# 数据源审计与自动化可行性矩阵

注册表区分可用的结构化适配器、公告发现与人工处理。实际运行结果以网站更新中心为准。
覆盖 10 个专题、60 个逻辑数据集。自动提取候选 4 项。 人工／AI辅助审核 44 项。 公告发现＋审核 12 项。

保留数据统计期与网站原有单位。共享文件可承载多项数据；仅将已校验的新结构化结果另行补充。
历史脚本路径以本地历史工作区 work/ 为基准。已有 scripts/ 路径对应本仓库可重建代码。

| 数据集 | 数据期 | 数据源 | 更新方式／检查 | 口径和阻碍 | 既有代码 |
|---|---|---|---|---|---|
| pharmacy.stores · 上市公司门店数 | 2026Q3 | [上市公司定期报告／巨潮资讯](https://www.cninfo.com.cn/) | 人工／AI辅助审核 · manual | 总数与直营/加盟及开关店核对；估算季度单独标记 | `pharmacy_company_series_20261111/collect.py`、`pharmacy_company_series_20261111/normalize.py`、`pharmacy_expansion/build_stores.py` |
| pharmacy.national · 中国药店总数 | 2026Q3 | [上市公司年报转引中康资讯／国家药监局](https://www.cninfo.com.cn/) | 人工／AI辅助审核 · manual | 官方与中康独立；净增减反推、插值及实际披露区分 | `pharmacy_store_series_20261110`、`pharmacy_expansion/build_stores.py` |
| pharmacy.retail-sales · 全国零售药品销售额 | 2025 | [商务部／中康资讯转引](https://scyxs.mofcom.gov.cn/) | 人工／AI辅助审核 · manual | 零售渠道、有无电商与统计范围分开 | `pharmacy_store_series_20261110` |
| pharmacy.efficiency · 单店效率、加盟率和扩张质量 | 2026Q3 | [上市公司定期报告／巨潮资讯](https://www.cninfo.com.cn/) | 人工／AI辅助审核 · manual | 直营店分母口径与披露或估算分开，覆盖率标记样本公司 | `pharmacy_efficiency/collect.py`、`pharmacy_efficiency/derive.py` |
| pharmacy.segments · 零售／分销收入及毛利率 | 2026Q3 | [上市公司定期报告／巨潮资讯](https://www.cninfo.com.cn/) | 人工／AI辅助审核 · manual | 交叉分部不能加总；同口径匹配收入与成本 | `pharmacy_efficiency/segments.py` |
| pharmacy.ccc · A 股营运资金与财报输入 | 2026Q3 | [上市公司定期报告／巨潮资讯](https://www.cninfo.com.cn/) | 人工／AI辅助审核 · manual | 五季加权、TTM收入及成本、票据合并重述、CCC等式与单季勾稽 | `working_capital_20261112/collect_statements.py`、`ccc_audit_20261113/recompute.py` |
| pharmacy.equity · 股权激励与考核 | 2028（目标） | [上市公司定期报告／巨潮资讯](https://www.cninfo.com.cn/) | 人工／AI辅助审核 · manual | 报告期、公告终稿、合并口径和不可辨认的缺项人工核对 | `pharmacy_incentives_20261111/collect.py`、`pharmacy_incentives_20261111/outcomes.py`、`pharmacy_expansion/build_equity.py` |
| blood.national · 中国采浆与单采浆站 | 2025 | [公司招股书/年报转引与主管部门数据](https://www.cninfo.com.cn/) | 人工／AI辅助审核 · manual | 浆站总数与在营数区分 | `blood_products_20261111/build_data.py`、`blood_products_20261111/supplement.py` |
| blood.company · 公司采浆、分品种收入及吨浆指标 | 2025 | [上市公司定期报告／巨潮资讯](https://www.cninfo.com.cn/) | 人工／AI辅助审核 · manual | 上年同范围采浆量与当年血制品收入、毛利；金额元与吨 | `blood_products_20261111/collect.py`、`blood_products_20261111/money.py` |
| blood.albumin · 白蛋白批次结构和行业口径对照 | 2026-11-08 | [中检院／上药监／行业统计](https://bio.nidc.org.cn/pqf/search.do?formAction=pqfGs) | 人工／AI辅助审核 · manual | 统计机构覆盖、进口国产依据及重复证书 | `blood_products_20261111/research/build_albumin.py`、`blood_products_20261111/research/check_shanghai.py` |
| blood.lot-release · 血制品批签发 | 2026-11-08 | [中检院公告与全国汇总](https://www.nidc.org.cn/xxgk/ggtzh/jwgk/shwzhppfgg/index.html) | 公告发现＋审核 · daily | 仅检查中检院公告；汇总前须核查跨机构覆盖、证书去重及发布口径 | `blood_lot_release/build_data.py`、`vaccine_lot_release/collect.py` |
| blood.events · 浆站事件、并购与产品升级 | 2026 | [上市公司定期报告／巨潮资讯](https://www.cninfo.com.cn/) | 人工／AI辅助审核 · manual | 报告期、公告终稿、合并口径和不可辨认的缺项人工核对 | `blood_products_20261111/filing_snippets.py`、`blood_products_20261111/supplement.py` |
| blood.recombinant · 重组人白蛋白产品及商业指标 | 2026 | [上市公司定期报告／巨潮资讯](https://www.cninfo.com.cn/) | 人工／AI辅助审核 · manual | 报告期、公告终稿、合并口径和不可辨认的缺项人工核对 | `blood_products_20261111/build_data.py` |
| blood.ccc · A 股营运资金与财报输入 | 2026Q3 | [上市公司定期报告／巨潮资讯](https://www.cninfo.com.cn/) | 人工／AI辅助审核 · manual | 五季加权、TTM收入及成本、票据合并重述、CCC等式与单季勾稽 | `working_capital_20261112/collect_statements.py`、`ccc_audit_20261113/recompute.py` |
| blood.equity · 股权激励与考核 | 2026（含目标） | [上市公司定期报告／巨潮资讯](https://www.cninfo.com.cn/) | 人工／AI辅助审核 · manual | 报告期、公告终稿、合并口径和不可辨认的缺项人工核对 | `blood_incentives_20261111/collect.py`、`blood_incentives_20261111/data.py` |
| vax.lot-release · 全国疫苗批签发 | 2026-11-08 | [中检院公告与全国汇总](https://www.nidc.org.cn/xxgk/ggtzh/jwgk/shwzhppfgg/index.html) | 公告发现＋审核 · daily | 日常仅发现中检院公告；跨机构、批签发周与剂数的口径需要核实 | `vaccine_lot_release/collect.py`、`vaccine_lot_release/aggregate.py`、`vaccine_lot_release/legacy_collect.py` |
| vax.doses · 公司披露的批签发剂数 | 2026H1 | [上市公司定期报告／巨潮资讯](https://www.cninfo.com.cn/) | 人工／AI辅助审核 · manual | 批次不得换算为剂数；样本公司单独保留 | `vaccine_lot_release/aggregate.py` |
| vax.trade · 海关进出口、伙伴与量价 | 2025 | [联合国 Comtrade／中国海关总署](https://comtradeapi.un.org/public/v1/getDATariffline/C/A/HS) | 公告发现＋审核 · monthly | HS版本与贸易方向、分母单位、估算标记、伙伴与全球合计核对；现有脚本依赖数据分片，验证配额、授权及跨编码连续性后启用 | `customs_trade/fetch.py`、`customs_trade/prepare.py` |
| vax.ccc · A 股营运资金与财报输入 | 2026Q3 | [上市公司定期报告／巨潮资讯](https://www.cninfo.com.cn/) | 人工／AI辅助审核 · manual | 五季加权、TTM收入及成本、票据合并重述、CCC等式与单季勾稽 | `vaccines_20261112/build_quarters.py`、`vaccines_20261112/build_overseas.py`、`ccc_audit_20261113/recompute.py` |
| vax.overseas-ccc · 港美股营运资金与财报输入 | 2026H1 | [港交所／SEC 公司定期报告](https://www.hkexnews.hk/) | 人工／AI辅助审核 · manual | 不同半年度／年报口径独立核对 | `vaccines_20261112/build_quarters.py`、`vaccines_20261112/build_overseas.py`、`ccc_audit_20261113/recompute.py` |
| vax.equity · 股权激励与境外公开目标 | 2028（目标） | [上市公司定期报告／巨潮资讯](https://www.cninfo.com.cn/) | 人工／AI辅助审核 · manual | 区分目标、已达成、撤销及未到考核期 | `vaccines_20261112/build_incentives.py`、`vaccines_20261112/build_overseas.py` |
| eye.industry · 眼科机构、诊疗与手术量 | 2025（以分项为准） | [卫健委／公司招股书转引](https://www.nhc.gov.cn/mohwsbwstjxxzx/s2906/new_list.shtml) | 人工／AI辅助审核 · manual | 医院数、手术单位和预测行不得混作实际 | `ophthalmology_20261113/build_industry.py` |
| eye.network · 医院、诊所与视光机构网络 | 2026H1 | [上市公司定期报告／巨潮资讯](https://www.cninfo.com.cn/) | 人工／AI辅助审核 · manual | 合并机构与品牌网络不可混用 | `ophthalmology_20261113/build_network.py` |
| eye.operations · 分业务收入毛利、门诊手术及经营指标 | 2026H1 | [上市公司定期报告／巨潮资讯](https://www.cninfo.com.cn/) | 人工／AI辅助审核 · manual | 披露财年、单期／累计、单位及公司分部口径 | `ophthalmology_20261113/extract_numbers.py` |
| eye.ccc · A 股营运资金与财报输入 | 2026Q3 | [上市公司定期报告／巨潮资讯](https://www.cninfo.com.cn/) | 人工／AI辅助审核 · manual | 五季加权、TTM收入及成本、票据合并重述、CCC等式与单季勾稽 | `ophthalmology_20261113/build_capital.py`、`ophthalmology_20261113/build_hk.py`、`ccc_audit_20261113/recompute.py` |
| eye.overseas-ccc · 港美股营运资金与财报输入 | 2026H1 | [港交所／SEC 公司定期报告](https://www.hkexnews.hk/) | 人工／AI辅助审核 · manual | 不同半年度／年报口径独立核对 | `ophthalmology_20261113/build_capital.py`、`ophthalmology_20261113/build_hk.py`、`ccc_audit_20261113/recompute.py` |
| eye.equity · 股权激励与考核 | 2028（目标） | [上市公司定期报告／巨潮资讯](https://www.cninfo.com.cn/) | 人工／AI辅助审核 · manual | 报告期、公告终稿、合并口径和不可辨认的缺项人工核对 | `ophthalmology_20261113/build_equity.py` |
| insurance.fund · 基本医保基金与参保 | 2025 | [国家医保局](https://www.nhsa.gov.cn/col/col7/index.html) | 公告发现＋审核 · weekly | 原报告的收入、支出与参保；长表与正式公报可能修订 | `medical-insurance/build_data.py` |
| insurance.monthly · 基本医保统筹及生育保险累计指标 | 2026-09 | [国家医保局](https://www.nhsa.gov.cn/col/col7/index.html) | 公告发现＋审核 · weekly | 新期为图片，先审核；区分统筹/个人账户、权责发生制和累计期 | `medical-insurance/build_data.py` |
| insurance.channels · 医疗机构与药店费用 | 2025 | [国家医保局正式公报与统计长表](https://www.nhsa.gov.cn/col/col7/index.html) | 人工／AI辅助审核 · manual | 分项与合计勾稽；留存修订依据 | `medical-insurance/build_data.py` |
| insurance.inpatient · 分等级次均住院费用 | 2025 | [国家医保局正式公报与统计长表](https://www.nhsa.gov.cn/col/col7/index.html) | 人工／AI辅助审核 · manual | 分项与合计勾稽；留存修订依据 | `medical-insurance/build_data.py` |
| insurance.drg · DRG/DIP覆盖率 | 2025 | [国家医保局正式公报与统计长表](https://www.nhsa.gov.cn/col/col7/index.html) | 人工／AI辅助审核 · manual | 分项与合计勾稽；留存修订依据 | `medical-insurance/build_data.py` |
| insurance.procurement · 省平台药品网采 | 2025 | [国家医保局正式公报与统计长表](https://www.nhsa.gov.cn/col/col7/index.html) | 人工／AI辅助审核 · manual | 分项与合计勾稽；留存修订依据 | `medical-insurance/build_data.py` |
| insurance.resources · 卫生资源与卫生总费用长表 | 2025 | [国家医保局正式公报与统计长表](https://www.nhsa.gov.cn/col/col7/index.html) | 人工／AI辅助审核 · manual | 分项与合计勾稽；留存修订依据 | `medical-insurance/build_data.py` |
| services.activity · 全国诊疗量、出院量和床位使用率 | 2026-03 | [国家卫健委](https://www.nhc.gov.cn/mohwsbwstjxxzx/s2906/new_list.shtml) | 公告发现＋审核 · weekly | 已保留历史解析器；有访问限制或口径变化则入待审核；区分单月、累计、全年 | `medical-services/build_data.py` |
| services.resources · 医院、床位和卫生总费用 | 2025 | [国家卫健委／国家医保局长表](https://www.nhc.gov.cn/mohwsbwstjxxzx/s2906/new_list.shtml) | 人工／AI辅助审核 · manual | 卫健委与医保局医院数不一致单独注记 | `medical-services/build_data.py` |
| api.trade · 海关进出口、伙伴与量价 | 2025 | [联合国 Comtrade／中国海关总署](https://comtradeapi.un.org/public/v1/getDATariffline/C/A/HS) | 公告发现＋审核 · monthly | HS版本与贸易方向、分母单位、估算标记、伙伴与全球合计核对；现有脚本依赖数据分片，验证配额、授权及跨编码连续性后启用 | `customs_trade/fetch.py`、`customs_trade/collect_tariffline.py`、`customs_trade/prepare.py` |
| api.focus · 重点原料药量价及国内公司映射 | 2026-09 | [中国医保商会／上市公司定期报告](https://www.cninfo.com.cn/) | 人工／AI辅助审核 · manual | 相关生产商与产品需证据；会刊累计口径不能直接同比 | `api_research/build.py`、`api_research/collect.py` |
| api.registry · 原料药海外注册及分子映射 | 2026 | [FDA / EDQM 等注册与企业公开资料](https://www.fda.gov/drugs/drug-master-files-dmfs) | 人工／AI辅助审核 · manual | DMF与批件及供应资格区分；映射人工确认 | `api_research/companies.py`、`api_research/collect_standard.py` |
| devices.trade · 海关进出口、伙伴与量价 | 2025 | [联合国 Comtrade／中国海关总署](https://comtradeapi.un.org/public/v1/getDATariffline/C/A/HS) | 公告发现＋审核 · monthly | HS版本与贸易方向、分母单位、估算标记、伙伴与全球合计核对；现有脚本依赖数据分片，验证配额、授权及跨编码连续性后启用 | `customs_trade/fetch.py`、`customs_trade/history_hs.py`、`customs_trade/prepare.py` |
| devices.recent · 2026 医疗器械月度与累计海关数据 | 2026-09（以品种为准） | [UN Comtrade 发布可用性／中国海关总署](https://comtradeapi.un.org/public/v1/getDa/C/M/HS) | 公告发现＋审核 · monthly | 同比冲突、整机与零件及累计和真实单月分别核查 | `customs_trade/supplement.py`、`customs_trade/qa_coverage.py` |
| devices.attribution · 制造商归属、生产基地与省级数据 | 2025（归属案例） | [海关总署统计服务／制造商公告](https://stats.customs.gov.cn/) | 人工／AI辅助审核 · manual | 企业注册地、货源地、口岸区分；已确认、估算、未分配 | `customs_trade/import_registered_provinces.py`、`customs_trade/import_customs.py` |
| biosimilars.approvals · 中美欧精选获批和撤回 | 2026-11（核查） | [FDA Purple Book／EMA／NMPA](https://purplebooksearch.fda.gov/index.cfm?event=downloads) | 人工／AI辅助审核 · manual | BLA、产品和状态去重；跨区不同批准状态保留 | `biosimilars_refresh/update_page.py` |
| biosimilars.patents · 参照药、专利与独占期 | 2026-11（核查） | [FDA Purple Book／专利与公司法律披露](https://purplebooksearch.fda.gov/index.cfm?event=downloads) | 人工／AI辅助审核 · manual | 区分专利、独占、和解与上市；留存法域 | `biosimilars_refresh/make_evidence.py` |
| biosimilars.pipeline · 人工核实的全球研发管线 | 2026-11（核查） | [ClinicalTrials.gov／监管及公司公开材料](https://clinicaltrials.gov/api/v2) | 人工／AI辅助审核 · manual | 实验状态、适应症、注册进度与权属独立核对 | `biosimilars_refresh/update_page.py` |
| biosimilars.uptake · CMS Part B 年度、季度、支付上限 | 2026Q4（支付） | [CMS 开放数据及 Medicare ASP](https://data.cms.gov/summary-statistics-on-use-and-payments/medicare-medicaid-spending-by-drug/) | 人工／AI辅助审核 · manual | 参考剂量及 HCPCS、报告期、ASP 支付限额与费用分别对照 | `scripts/biosimilars/download_medicare.py`、`scripts/biosimilars/build_medicare.py` |
| biosimilars.market · 市场份额、价格、品牌收入及法国市场 | 2026-11（核查） | [CMS／ASPE／法国公开医保／公司报告](https://data.cms.gov/summary-statistics-on-use-and-payments/medicare-medicaid-spending-by-drug/) | 人工／AI辅助审核 · manual | WAC、支付限额、费用和实际成交价区分；市场份额分母可溯 | `scripts/biosimilars/build_market_research.py`、`scripts/biosimilars/build_benchmark.py`、`scripts/biosimilars/build_france.py` |
| biosimilars.cxo · CXO合同、交易款与机会情景 | 2026-11-23（核查） | [公司公告／监管文件](https://www.cninfo.com.cn/) | 人工／AI辅助审核 · manual | 明确区分已确认合同/交易和情景假设 | `biosimilars_cxo/build.py`、`biosimilars_cxo/scan_ema.py` |
| insulin.vbp · 集采量价、分量和续约 | 2024（全国接续） | [国家及省级医保局、联采平台](https://www.nhsa.gov.cn/col/col7/index.html) | 人工／AI辅助审核 · manual | 报价、约定量、剂型和采购单位不可混用 | `insulin_tracker/vbp.py` |
| insulin.products · 胰岛素注册、权属与管线 | 2026-11（核查） | [NMPA／FDA／EMA／企业披露](https://www.nmpa.gov.cn/xxgk/ggtg/ypggtg/index.html) | 人工／AI辅助审核 · manual | 地区、注册状态及产品持证区别；产权公告人工核对 | `insulin_tracker/products.py`、`insulin_tracker/business.py` |
| insulin.partd · 美国 Medicare Part D 开支与用药 | 2024 | [CMS Medicare Part D 开放数据](https://data.cms.gov/summary-statistics-on-use-and-payments/medicare-medicaid-spending-by-drug/) | 人工／AI辅助审核 · manual | 年度用量、赔付频次、金额及药品映射 | `insulin_tracker/partd.py` |
| insulin.operating · 公司经营、分部和营运资金 | 2026Q3 | [上市公司定期报告／巨潮资讯](https://www.cninfo.com.cn/) | 人工／AI辅助审核 · manual | 公司历年率和单位、财报扩展口径、首尾及TTM分母 | `insulin_tracker/business.py`、`insulin_20261120/history/build_financials.py` |
| insulin.equity · 股权激励与考核 | 2028（目标） | [上市公司定期报告／巨潮资讯](https://www.cninfo.com.cn/) | 人工／AI辅助审核 · manual | 报告期、公告终稿、合并口径和不可辨认的缺项人工核对 | `insulin_20261120/history/build_equity.py`、`insulin_20261120/history/collect_events.py` |
| fda.drugsfda · FDA Drugs@FDA 批准日期追踪 | — | [FDA openFDA Drugs@FDA](https://api.fda.gov/drug/drugsfda.json) | 自动提取候选 · weekly | 对照 FDA 申请号与提交号；仅批准行动，非新分子首次批准。 | — |
| fda.insulins · FDA 胰岛素批准行动 | — | [FDA openFDA Drugs@FDA](https://api.fda.gov/drug/drugsfda.json) | 自动提取候选 · weekly | FDA 申请号、行动类型及编号，记录新批件与补充批准；不覆盖既有全球注册。 | — |
| nih.clinical-trials · 美国 NCT 登记试验更新 | — | [ClinicalTrials.gov](https://clinicaltrials.gov/api/v2) | 自动提取候选 · weekly | 仅跟踪 NCT 登记、状态和首次公布的结果日期；试验状态不等同于公司管线结论。 | — |
| cms.catalog · CMS Part B 文件发布清单 | — | [CMS / Data.gov 官方目录](https://catalog.data.gov/) | 自动提取候选 · monthly | 只更新官方数据发布清单；年度、季度和支付限额金额不混用。 | — |
| insulin.nmpa-notices · 药监局注册公告检查 | — | [国家药监局](https://www.nmpa.gov.cn/xxgk/ggtg/ypggtg/index.html) | 公告发现＋审核 · weekly | 公告链接进入待审核；无结构化胰岛素产品匹配证据时不更新。 | `insulin_tracker/products.py` |
| pharmacy.policy-notices · 医保政策原文检查 | — | [国家医保局](https://www.nhsa.gov.cn/col/col104/index.html) | 公告发现＋审核 · weekly | 仅发现新政策文档，匹配指标后审核。 | `pharmacy_efficiency/collect.py` |
| filings.exchange-notices · 上市公司定期报告发现 | — | [上市公司公告／东方财富转引](https://np-anotice-stock.eastmoney.com/api/security/ann) | 公告发现＋审核 · weekly | 样本公司最新公告发现。按原始公告日期与原文复核；历史采集脚本另覆盖完整上市公司样本。 | `working_capital_20261112/collect_statements.py` |

## 基线文件指纹与结构

完全重复表示 CSV 原文相同；业务主键、跨文件重复和合并口径按各数据集审核。

| 文件 | 结构 | SHA-256 前 12 位 |
|---|---|---|
| `v2/api/customs-trade-1.json` | 12 条 | `05e783fbcabb` |
| `v2/api/customs-trade-2.json` | 4 条 | `b8d5ac787f05` |
| `v2/api/customs-trade-3.json` | 7 条 | `2a88f5f177a9` |
| `v2/api/customs-trade.csv` | 144 行，29 列，0 条完全重复 | `70564cb6a0ff` |
| `v2/api/customs-trade.json` | partners(189)、parts(3)、partnerLabels(8) | `eac50d77498e` |
| `v2/api/research.json` | focus(6)、recent(13)、recentNote、monthly(0)、companies(20)、registry(3) | `7ed6f4b6b166` |
| `v2/biosimilars/data/market-references.json` | quotes(11)、archive(15)、cohorts(7)、hhs、cmsPolicy、reportUrl、wac(4)、wacMetadata(5)、supply(2) | `94cbe06eb5c6` |
| `v2/biosimilars/data/market-research.json` | indexes(9)、partD(3)、brandSales(8)、france(4)、patentResources(3)、evidenceDate、quarterlyAudit(4) | `c2e48c363330` |
| `v2/biosimilars/data/medicare.json` | sources(3)、groups(9)、annual(146)、quarterly(79)、price(694)、quarterPeriods(2)、paymentPeriods(20) | `17c7edb3a359` |
| `v2/biosimilars/data/service-contracts.json` | last_verified、providers(13)、clients(6)、service_contracts(7)、exposure(4)、roles(17)、economics(6)、extra_molecules(2)、policy(3) | `cb70e8d6dd3c` |
| `v2/biosimilars/index.html` | HTML 内嵌表格/数据。脚本 ../assets/data-updates.js、market.js、research.js、snapshot | `8696fc6f0cd5` |
| `v2/biosimilars/public-data/cms.catalog.json` | dataset_id、updated_at、source_files(2)、records(1) | `4fa412dd3351` |
| `v2/biosimilars/public-data/fda.drugsfda.json` | dataset_id、updated_at、source_files(6)、records(215) | `868c598f791c` |
| `v2/biosimilars/public-data/nih.clinical-trials.json` | dataset_id、updated_at、source_files(1)、records(1) | `52a154881d1d` |
| `v2/blood-products/albumin-manufacturers.csv` | 486 行，7 列，0 条完全重复 | `cbc706166c33` |
| `v2/blood-products/albumin-market.csv` | 13 行，17 列，0 条完全重复 | `41adce152613` |
| `v2/blood-products/blood-research-data.json` | asOf、reconciliation(8)、rankings(18)、audit(2)、versions(5)、brandSources(2)、filingBrands(2)、shanghaiAudit(11)、mappingSources(2)、lotSource(2)、products(2) | `c625f4173fc6` |
| `v2/blood-products/company-plasma.csv` | 100 行，34 列，0 条完全重复 | `34abaf816f16` |
| `v2/blood-products/data.json` | national(14)、companies(8)、recombinant(4)、transactions(19) | `389c66113b07` |
| `v2/blood-products/equity-incentives.csv` | 24 行，12 列，0 条完全重复 | `908050837ae7` |
| `v2/blood-products/lot-release-summary.zip` | 1 个文件 | `f25a4bf81b9b` |
| `v2/blood-products/lot-release.json` | start、end、stats(19)、annual(17)、officialAnnual(1)、coverage(20)、checks(2)、rows(11715)、columns(10) | `32dcc9762d96` |
| `v2/blood-products/national-plasma.csv` | 14 行，6 列，0 条完全重复 | `4e0e837d76ac` |
| `v2/blood-products/plasma-transactions.csv` | 19 行，6 列，0 条完全重复 | `9f6f78178f45` |
| `v2/blood-products/product-lot-trends.csv` | 9 行，9 列，0 条完全重复 | `1320cb0e6fbf` |
| `v2/blood-products/product-upgrades.csv` | 16 行，8 列，0 条完全重复 | `92193b9db675` |
| `v2/blood-products/station-events.csv` | 15 行，10 列，0 条完全重复 | `8a543de0024d` |
| `v2/blood-products/working-capital-inputs.csv` | 512 行，27 列，0 条完全重复 | `7807328d3c12` |
| `v2/blood-products/working-capital.csv` | 1014 行，22 列，0 条完全重复 | `a550ffacfbe2` |
| `v2/blood-products/working-capital.json` | companies(8)、first、latest、updated | `27c0acbb2b1f` |
| `v2/insulin/data.json` | links(5)、industryKpis(3)、vbp(91)、products(19)、landscape(11)、rights(2)、partd(3)、sources(4)、companies(3) | `32b5094b5116` |
| `v2/insulin/equity-incentives.csv` | 33 行，11 列，0 条完全重复 | `cd3c098cb84d` |
| `v2/insulin/public-data/fda.insulins.json` | dataset_id、updated_at、source_files(5)、records(57) | `0e2714b1e343` |
| `v2/insulin/tracker.json` | vbp(7)、market(9)、business(3)、bridge(3)、partd(325)、partdSources(3)、pipeline(39)、registrations(60) | `0fbbfc0eb7d5` |
| `v2/medical-devices/customs-trade-1.json` | 2 条 | `9ebc899c2f5c` |
| `v2/medical-devices/customs-trade-2.json` | 1 条 | `48849694d0b7` |
| `v2/medical-devices/customs-trade-3.json` | 3 条 | `d27987e53653` |
| `v2/medical-devices/customs-trade-4.json` | 4 条 | `3492aa8bd2fc` |
| `v2/medical-devices/customs-trade-5.json` | 3 条 | `e966b742dde0` |
| `v2/medical-devices/customs-trade-6.json` | 3 条 | `0c5b85c6599f` |
| `v2/medical-devices/customs-trade-recent.csv` | 15 行，20 列，0 条完全重复 | `4079c9a8e5b3` |
| `v2/medical-devices/customs-trade.csv` | 268 行，25 列，0 条完全重复 | `e2fecc5a3871` |
| `v2/medical-devices/customs-trade.json` | partners(232)、parts(6)、recent(5) | `696305f2de5e` |
| `v2/medical-devices/imaging-customs-request.txt` | 3345 字节 | `377144466535` |
| `v2/medical-devices/imaging-exports.csv` | 33 行，20 列，0 条完全重复 | `4137b2626e21` |
| `v2/medical-devices/index.html` | HTML 内嵌表格/数据。脚本 ../assets/data-updates.js、../assets/customs-trade.js | `ceee9ea45dd1` |
| `v2/medical-devices/manufacturer-sites.csv` | 24 行，8 列，0 条完全重复 | `905c791dfd53` |
| `v2/medical-insurance/data.csv` | 387 行，8 列，0 条完全重复 | `55fb1225be6b` |
| `v2/medical-insurance/index.html` | HTML 内嵌表格/数据。脚本 ../assets/data-updates.js、medical-insurance.js | `ffad165fc203` |
| `v2/medical-insurance/trends.json` | fund(2)、channels(2)、employeeInpatient(2)、residentInpatient(2)、procurement(2) | `9e9720f888ce` |
| `v2/medical-services/activity.json` | annual(9)、monthly(30)、cumulative(25)、monthlyIndex、groups(7)、periods(3)、metrics(8)、fields(3) | `feee731ddd81` |
| `v2/medical-services/health-resources.csv` | 252 行，6 列，0 条完全重复 | `d4a0eccffcf8` |
| `v2/medical-services/index.html` | HTML 内嵌表格/数据。脚本 ../assets/data-updates.js、medical-services.js | `0ad741024688` |
| `v2/medical-services/service-activity.csv` | 1487 行，11 列，0 条完全重复 | `e4f3a1dfe401` |
| `v2/ophthalmology/company-activity.csv` | 60 行，18 列，0 条完全重复 | `48615b7c3600` |
| `v2/ophthalmology/company-network.csv` | 92 行，8 列，0 条完全重复 | `8beaf4e4d491` |
| `v2/ophthalmology/company-network.json` | 8 条 | `08e75b20a07f` |
| `v2/ophthalmology/company-operations.json` | companies(4)、segments(194)、activity(60) | `e79439190214` |
| `v2/ophthalmology/company-segments.csv` | 194 行，12 列，0 条完全重复 | `5bee0a0e4874` |
| `v2/ophthalmology/equity-incentives.csv` | 35 行，12 列，0 条完全重复 | `d708b357ed89` |
| `v2/ophthalmology/industry-series.json` | 109 条 | `12e9fa3cdb29` |
| `v2/ophthalmology/industry.csv` | 109 行，8 列，0 条完全重复 | `0fada58f6a03` |
| `v2/ophthalmology/overseas-inputs.csv` | 54 行，10 列，0 条完全重复 | `461d210d189f` |
| `v2/ophthalmology/overseas-working-capital.csv` | 80 行，16 列，0 条完全重复 | `08630e045c94` |
| `v2/ophthalmology/overseas.json` | companies(3)、rows(80)、modes(3) | `c53e0afac4a6` |
| `v2/ophthalmology/working-capital-inputs.csv` | 234 行，27 列，0 条完全重复 | `791cc593dc81` |
| `v2/ophthalmology/working-capital.csv` | 464 行，22 列，0 条完全重复 | `dc53918e8133` |
| `v2/ophthalmology/working-capital.json` | companies(5)、first、latest、updated | `2841b03baa7e` |
| `v2/pharmacy/china-pharmacy-stores.csv` | 36 行，8 列，0 条完全重复 | `f8b05ac8fc36` |
| `v2/pharmacy/company-stores.csv` | 653 行，18 列，0 条完全重复 | `cfaef26edf3b` |
| `v2/pharmacy/company-stores.json` | companies(14)、sources(471) | `9ae321fc8a88` |
| `v2/pharmacy/direct-store-share.csv` | 3 行，11 列，0 条完全重复 | `e57238d8c5e3` |
| `v2/pharmacy/equity-incentives.csv` | 58 行，12 列，0 条完全重复 | `bc80e282358a` |
| `v2/pharmacy/index.html` | HTML 内嵌表格/数据。脚本 ../assets/data-updates.js、company-stores.js、../assets/working-capital.js、equity-incentives.js、stores-chart.js、retail-research.js、stores-series | `7299e99a5bb4` |
| `v2/pharmacy/industry-retail-sales.csv` | 14 行，6 列，0 条完全重复 | `4c0c4c084281` |
| `v2/pharmacy/retail-peers.json` | peer(14)、sources(675)、franchise(190) | `e1a8ece229b8` |
| `v2/pharmacy/retail-research.json` | companies(14)、segments(387)、efficiency(88)、network(319)、disclosed(31)、sources(675) | `f99ca47152e2` |
| `v2/pharmacy/retail-segments.csv` | 387 行，10 列，0 条完全重复 | `a47b840508a5` |
| `v2/pharmacy/store-efficiency.csv` | 319 行，16 列，0 条完全重复 | `4eb9e6491efa` |
| `v2/pharmacy/unit-economics.csv` | 119 行，15 列，0 条完全重复 | `d678bfe3a853` |
| `v2/pharmacy/working-capital-inputs.csv` | 781 行，27 列，0 条完全重复 | `bb998c95fb59` |
| `v2/pharmacy/working-capital.csv` | 1552 行，22 列，0 条完全重复 | `76f7b367a872` |
| `v2/pharmacy/working-capital.json` | companies(14)、first、latest、updated | `24214e468856` |
| `v2/vaccines/customs-trade.csv` | 10 行，25 列，0 条完全重复 | `23ed6251fa61` |
| `v2/vaccines/customs-trade.json` | products(1)、partners(162) | `045ce8228231` |
| `v2/vaccines/equity-incentives.csv` | 46 行，12 列，0 条完全重复 | `1f88e9db8b89` |
| `v2/vaccines/lot-release-summary.csv` | 740 行，14 列，0 条完全重复 | `63a8c2306f56` |
| `v2/vaccines/lot-release-summary.zip` | 1 个文件 | `e7a944bb3f09` |
| `v2/vaccines/lot-release.json` | start、end、stats(18)、annual(17)、officialAnnual(8)、coverage(20)、checks(2)、rows(10479)、columns(10) | `e438bb6cd2e9` |
| `v2/vaccines/overseas-inputs.csv` | 70 行，10 列，0 条完全重复 | `fbc73e42c402` |
| `v2/vaccines/overseas-working-capital.csv` | 105 行，16 列，0 条完全重复 | `447891d7af1a` |
| `v2/vaccines/overseas.json` | companies(6)、rows(105)、modes(3) | `625b9967daab` |
| `v2/vaccines/release-doses.json` | sources(6)、records(80) | `d85ec9ebc992` |
| `v2/vaccines/working-capital-inputs.csv` | 514 行，27 列，0 条完全重复 | `15ef1fdbba81` |
| `v2/vaccines/working-capital.csv` | 1024 行，22 列，0 条完全重复 | `990dd98fb056` |
| `v2/vaccines/working-capital.json` | companies(12)、first、latest、updated | `11a0d71e4c73` |
