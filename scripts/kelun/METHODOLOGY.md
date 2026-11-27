# 口径与数据字典

| 字段 | 口径 |
|---|---|
| `date` | 沪深、港股交易日的并集 |
| `close`、`trade_date`、`quote_state` | 本币未复权收盘价、实际成交日、可用状态。已知休市可引用最近收盘，开市缺价留空 |
| `shares`、`capital_date` | 最近生效的已发行股本，使用发行人报告或实施公告 |
| `economic_shares`、`ownership_date` | 母公司直接及全资子公司的经济持股和依据日期。受控员工平台另列 |
| `fx`、`fx_date` | CNY/EUR ÷ HKD/EUR，表示每港元人民币元数；共享同一 ECB 日期，最多沿用五个日历日 |
| `cap`、`parent_cap` | 收盘价 × 已发行股份 × 本币兑人民币参考汇率 ÷ 10 亿 |
| `stake`、`listed` | 经济持股数 × 收盘价 × 汇率 ÷ 10 亿，合计要求四项都可用 |
| `residual`、`coverage` | 科伦市值减上市持股份额，以及上市持股份额 ÷ 科伦市值 |
| `status`、`flags` | 缺项、暂定或完整及原因。记录披露期末与公告日期 |
| `metadata`、`updated_at` | 每只股票最近行情、缺价交易日、异常波动、提供方和生成时间 |

持股与股本一律按本身历史日期向后匹配。对尚未补齐的变动日期，沿用最近已披露快照并标为暂定。此序列用于回顾历史。定期报告可在相关期末之后发表。持股价值使用确切股数时，可在发行人同期总股本尚未证实的情况下计算。石四药对辰欣药业的穿透份额已经包含在石四药的市值，辰欣一栏只增加科伦直接持股。石四药发行人股东名册与科伦半年报存在比例差异，持股表给出两者与计算依据。

已发行股本采用披露的总股数，石四药的分母含库存股；单列持股估值仍按经济股数计算。市值为当地收盘快照，HKD/CNY 是参考价。当次日 ECB 数据晚于北京时间第二轮更新，后续更新会补入当日参考汇率。

## 日线来源与授权比较

| 来源 | 回填与稳定性 | 公开使用与成本 |
|---|---|---|
| [AKShare／东方财富](https://about.eastmoney.com/home/protocol) | 五股中部分请求触发限流。本地测试使用单股历史 | 无需订阅即可测试。东方财富限制复制、对外提供行情及衍生用途，公开发布禁用 |
| [Yahoo Finance](https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html) | 本地验证可回溯至 2023 年 7 月。非承诺服务，可能限流 | 本地核验备用，未核实可用于公开网页和 CSV |
| [Twelve Data](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage) | 提供商有商用服务。签约前逐个测试五只证券及起始日期 | 非美市场商用需要额外审批，公开分发需要相应协议。费用按市场和授权报价 |
| [EODHD](https://eodhd.com/help/commercial) | 个人免费档仅一年。商用需验证是否为交易所官方收盘及五股历史覆盖 | 公开对外显示按商用授权处理，询价须覆盖派生值及可下载数据 |
| [HKEX 历史行情](https://data.hkex.com.hk/catalog/dataset/0a05f55287014916ab0ea3cff1c26000?lang=en) · [SSE／CIIS](https://english.sse.com.cn/markets/dataservice/products/) · [深交所](https://www.szse.cn/market/trend/index.html) | 直接交易所来源。香港及内地可能需要分开接入 | HKEX 所列全市场历史产品标价 HKD 78,000；适用本项目的公开展示及分发权限需要另核。沪深由各市场确认范围与报价 |
| [欧洲央行](https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html) | 已验证历史序列与可下载 API | 免费公开参考统计，注明来源 |

[CIIS《市场数据业务指南》](https://www.ciis.com.hk/hongkong/en/uploadfiles/202407/22/2024072210065182863681.pdf#page=11) 指出，沪市及相关指数的日终信息自港时午夜起可免另办转发许可，更新频率每天最多一次。辰欣药业直接接入上交所日终数据，以次日刷新方式列出历史收盘价、公司市值和科伦持股价值。首次回填与备用供应商重合的记录中，2024-07-05 的收盘价存在差异，采用上交所原值。该规则明确针对沪市及相关指数，不能据此处理深交所和港交所的收盘价。辰欣药业可独立展示。集团合计需要四项上市持股与母公司市值齐备。

自动任务的行情输入由仓库设置的授权接口提供。公开程序和数据层不打包第三方行情站内容。
