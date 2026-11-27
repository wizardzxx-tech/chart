import { mountCompanyTrend } from "../pharmacy/company-trend.js";

const byId = id => document.getElementById(id);
const binding = (id, handler, event = "change") => byId(id).addEventListener(event, handler);
const dash = "—";
const unit = 100_000_000;
const format = (value, digits = 2) => value == null ? dash :
  new Intl.NumberFormat("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const amount = value => value == null ? dash : format(value / unit);
const pct = value => value == null ? dash : `${format(value * 100, 1)}%`;
const esc = value => String(value ?? dash).replace(/[&<>"']/g, ch => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[ch]);
const href = (url, label) => url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>` : esc(label);
const internal = (id, label) => `<a href="#${esc(id)}">${esc(label)}</a>`;
const wrap = (tag, value) => `<${tag}>${esc(value)}</${tag}>`;
const small = value => wrap("small", value);
const num = value => `<span class="numeric">${esc(value)}</span>`;
const sortedUnique = values => [...new Set(values)].sort();
const modes = { ttm: "TTM 方法 C", quarter: "单季", annual: "全年", half: "上半年" };
const modeLabels = { ...modes, ttm: "TTM · 方法 C" };

let data;
let tracker;
let active = "industry";
let selectCapitalCompany;
let vbpRows = [];

function put(id, html) {
  byId(id).innerHTML = html;
}

function setupSelect(id, values) {
  put(id, values.map(item => {
    const [key, label] = Array.isArray(item) ? item : [item, item];
    return `<option value="${esc(key)}">${esc(label)}</option>`;
  }).join(""));
}

function table(headers, rows) {
  if (!rows.length) return '<p class="small">没有符合当前筛选条件的数据。</p>';
  const head = headers.map(label => `<th scope="col">${esc(label)}</th>`).join("");
  const body = rows.map(row => `<tr>${row.map((cell, index) =>
    index === 0 ? `<th scope="row">${cell}</th>` : `<td>${cell}</td>`).join("")}</tr>`).join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function cards(rows) {
  return rows.map(([label, value, note, link]) => `<div class="kpi">${wrap("span", label)}
    ${wrap("strong", value)}<span>${link ? href(link, note) : esc(note)}</span></div>`).join("");
}

function csvUrl(rows) {
  const cell = value => {
    let safe = String(value ?? "");
    if (typeof value !== "number" && /^[=+\-@\t\r]/.test(safe)) safe = "'" + safe;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const body = rows.map(row => row.map(cell).join(",")).join("\r\n");
  return URL.createObjectURL(new Blob(["\uFEFF", body], { type: "text/csv;charset=utf-8" }));
}

function download(filename, rows) {
  const url = csvUrl(rows);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const vbpHeaders = ["轮次", "采购组", "通用名", "规格包装", "企业", "中选价（元）", "分类"];
function updateVbp() {
  const round = byId("vbp-round").value;
  const group = byId("vbp-group").value;
  const company = byId("vbp-company").value;
  const query = byId("vbp-query").value.trim().toLowerCase();
  vbpRows = data.vbp.filter(row =>
    (!round || row[0] === round) && (!group || row[1] === group) &&
    (!company || row[4] === company) && (!query || row.join(" ").toLowerCase().includes(query)));
  byId("vbp-summary").textContent = `显示 ${vbpRows.length} / ${data.vbp.length} 条中选记录`;
  put("vbp-table", table(vbpHeaders, vbpRows.map(row => row.map((c, i) =>
    i === 5 ? num(format(c)) : esc(c || "原表未列")))));
  byId("vbp-export").disabled = !vbpRows.length;
}

function updateProducts() {
  const filters = ["product-molecule", "product-market", "product-class"].map(id => byId(id).value);
  const rows = data.products.filter(row => filters.every((value, index) => !value || value === row[index]));
  byId("product-summary").textContent = `显示 ${rows.length} / ${data.products.length} 条注册与上市记录。`;
  put("product-table", table(["产品", "分子／类别", "市场", "监管分类", "规格／剂型", "批准／上市时间", "持有人或合作角色", "资料"],
    rows.map(([molecule, market, classification, name, form, date, holder, source]) => [
      esc(name), esc(molecule), esc(market), esc(classification),
      esc(form), esc(date), esc(holder), href(source, "监管／公司资料")
    ])));
}

function filterTable(prefix, headers, rows, filters, columns, defaults = {}) {
  const controls = Object.entries(filters);
  for (const [name, index] of controls) {
    const id = `${prefix}-${name}`;
    const values = sortedUnique(rows.map(row => row[index]).filter(Boolean));
    setupSelect(id, [["", "全部"], ...values]);
    if (defaults[name] !== undefined) byId(id).value = defaults[name];
    binding(id, render);
  }
  let filtered;
  function render() {
    filtered = rows.filter(row => controls.every(([name, index]) => {
      const value = byId(`${prefix}-${name}`).value;
      return !value || String(row[index]) === value;
    }));
    put(`${prefix}-table`, table(headers, filtered.map(columns)));
    byId(`${prefix}-summary`).textContent = `显示 ${filtered.length} / ${rows.length} 条记录`;
    byId(`${prefix}-export`).disabled = !filtered.length;
    byId(`${prefix}-table`).scrollTop = 0;
  }
  binding(`${prefix}-export`, () => {
    const exportHeaders = [...headers];
    // This view combines the two official links in one screen column.
    if (prefix === "compare") exportHeaders.splice(-1, 1, "2021 中选来源", "2024 中选来源");
    download(`insulin-${prefix}.csv`, [exportHeaders, ...filtered]);
  }, "click");
  render();
}

function setupTracker() {
  const { comparisons, allocation, contracts, shares, national, entities, rules } = tracker.vbp;
  const delta = value => {
    if (value == null) return dash;
    const style = value > 0 ? "price-up" : value < 0 ? "price-down" : "";
    return `<span class="${style}">${value > 0 ? "+" : ""}${pct(value)}</span>`;
  };
  filterTable("compare", ["企业集团", "采购组", "通用名", "规格包装", "2021 生产／分包装主体", "2024 生产／分包装主体",
    "2021 价（元／支）", "2024 价（元／支）", "变动", "2021 分类", "2024 分类", "匹配状态", "核对事项", "来源"],
    comparisons, { company: 0, group: 1, status: 11 }, row => row.slice(0, 13).map((value, index) =>
      index === 8 ? delta(value) : [6, 7].includes(index) ? num(format(value)) : esc(value))
      .concat([row.slice(13).map((url, index) => url && href(url, index ? "2024 原表" : "2021 原表")).filter(Boolean).join(" · ")]),
    { status: "同品同规" });
  byId("compare-summary").title = "严格按同一采购组、分子配比、代表品规和生产及分包装主体匹配。";
  filterTable("alloc", ["轮次", "采购组", "企业集团", "报告所列主体", "产品或报价单元", "中选分类",
    "医院报量（万支）", "基础量（万支）", "来源"],
    allocation, { round: 0, company: 2, group: 1 }, row => row.map((value, index) =>
      index === 8 ? href(value, "披露") : [6, 7].includes(index) ? num(format(value)) : esc(value)),
    { round: "2024" });
  filterTable("pipeline", ["企业", "分子／资产", "研发类别", "市场", "进度", "申请／受理", "批准",
    "最新里程碑", "商业化", "合作方", "说明", "来源"],
    tracker.pipeline, { company: 0, market: 3, stage: 4 }, row => row.map((value, index) =>
      index === 11 ? href(value, "原始披露") : esc(value)));
  put("pipeline-links", `欧美同分子竞品及生物类似药监管身份见 ${href("../biosimilars/", "Global Biosimilar Tracker")}。`);
  filterTable("partd", ["年度", "分子", "CMS 品名／剂型", "CMS 通用名", "总支出（美元）", "处方申报次数", "受益人数", "发放计量单位"],
    tracker.partd, { year: 0, molecule: 1, brand: 2 }, row => row.map((value, index) =>
      index === 4 ? num(format(value)) : [5, 6, 7].includes(index) ? num(format(value, index === 7 ? 1 : 0)) : esc(value)),
    { year: tracker.partd[0]?.[0] });
  put("vbp-demand-share", table(["企业／范围", "2021 首年报量（万支）", "2021 份额", "2024 首年报量（万支）", "2024 份额", "原始披露"],
    shares.map(([name, v21, s21, v24, s24, l21, l24]) => [esc(name), num(format(v21)), num(typeof s21 === "string" ? s21 : pct(s21)),
      num(format(v24)), num(typeof s24 === "string" ? s24 : pct(s24)),
      [l21 && href(l21, "2021"), l24 && href(l24, "2024")].filter(Boolean).join(" · ")])));
  put("vbp-national-note", esc(national[0]) + " " + href(national[1], "国家医保局"));
  put("vbp-contract", table(["轮次／时期", "企业／地区", "口径", "数量（万支）", "说明", "来源"],
    contracts.map(([round, company, scope, value, note, url]) => [esc(round), esc(company), esc(scope), num(format(value)), esc(note), href(url, "披露")])));
  put("vbp-market", table(["期间", "企业", "分子范围", "销量份额／排名", "统计口径", "来源"],
    tracker.market.map(row => row.map((value, index) => index === 5 ? href(value, "公司披露") : esc(value)))));
  put("vbp-rule-notes", rules.map(([description, url, title]) =>
    `<p class="small">${esc(description)} ${href(url, title)}</p>`).join(""));
  put("vbp-entities", table(["研究分组", "原表主体", "归属说明"],
    entities.map(row => row.map(esc))));
}

function setupIndustry() {
  const { vbp, products, landscape, rights, partd, links } = data;
  put("industry-kpis", cards(data.industryKpis));
  setupSelect("vbp-round", [["", "全部轮次"], ["2024", "2024 接续"], ["2021", "2021 首轮"]]);
  setupSelect("vbp-group", [["", "全部采购组"], ...sortedUnique(vbp.map(row => row[1]))]);
  setupSelect("vbp-company", [["", "全部企业"], ...sortedUnique(vbp.map(row => row[4]))]);
  byId("vbp-round").value = "2024";
  ["vbp-round", "vbp-group", "vbp-company"].forEach(id => binding(id, updateVbp));
  binding("vbp-query", updateVbp, "input");
  binding("vbp-export", () => download("insulin-vbp.csv", [vbpHeaders, ...vbpRows]), "click");
  put("vbp-source", `${href(links.vbp21, "2021 中选结果原表")} · ${href(links.vbp24, "2024 中选结果原表")}。采购量仅展示可核实的公开披露。`);
  updateVbp();

  put("industry-companies", table(["公司", "集团收入（亿元）", "胰岛素相关收入（亿元）", "占集团", "披露口径／参与方式", "来源"],
    landscape.map(([name, ticker, id, revenue, insulin, share, note, source]) => [
      (id ? internal(id, name) : esc(name)) + small(ticker), num(amount(revenue)), num(amount(insulin)),
      num(share), esc(note), href(source, "原始资料")
    ])));
  put("industry-rights", rights.map(([name, description, source]) =>
    `<p><strong>${esc(name)}</strong>　${esc(description)} ${href(source, "资料")}</p>`).join(""));

  ["product-molecule", "product-market", "product-class"].forEach((id, index) => {
    setupSelect(id, [["", "全部"], ...sortedUnique(products.map(row => row[index]))]);
    binding(id, updateProducts);
  });
  updateProducts();

  const negotiation = partd.negotiation.map(([brand, interval, spending, people, url]) => [
    esc(brand), esc(interval), num(format(spending / 1_000_000)), num(format(people, 0)), href(url, "CMS 谈判披露")
  ]);
  put("partd-content", '<p class="small">年度表取 CMS 的 Overall 汇总行，保留品牌与剂型原名。申报包括首次及续配，每个品名的受益人数可重叠。空值沿用原表。 ' +
    href(tracker.partdSources[0], "CMS 官方数据目录") + " · " + href(tracker.partdSources[1], "数据字典") + " · " +
    href(tracker.partdSources[2], "原始 CSV 存档") + "</p>" +
    '<div class="scroll" role="region" tabindex="0" aria-label="CMS 药价谈判披露">' +
    table(["谈判统计产品组", "统计期", "Part D 总支出（百万美元）", "使用人数", "来源"], negotiation) + "</div>" +
    `<p class="small">两期有重叠。Fiasp／NovoLog 按 CMS 公布的六个产品名称合计。人数按原表千人取整。<br>
      ${href(links.partd, "CMS Medicare Part D")} · ${href(links.medicaid, "CMS Medicaid 药品支出")} ·
      ${href(links.sdud, "Medicaid 州级 NDC 数据")}。</p>`);
  put("sources", data.sources.map(([title, description, url]) =>
    `<p><strong>${esc(title)}</strong>　${esc(description)} ${href(url, "资料")}</p>`).join(""));
}

function period(date) {
  return `${date.slice(0, 4)}Q${Number(date.slice(5, 7)) / 3}`;
}

function source(row) {
  return Array.isArray(row.source) ? row.source.map(url => href(url, "披露")).join(" · ") : href(row.source, "披露");
}

function monthDate(year, quarter) {
  return new Date(Date.UTC(year, quarter * 3, 0)).toISOString().slice(0, 10);
}

function quarterNumber(date) {
  return Number(date.slice(0, 4)) * 4 + Number(date.slice(5, 7)) / 3 - 1;
}

function quarterEnd(number) {
  return monthDate(Math.floor(number / 4), number % 4 + 1);
}

function daysBetween(start, end) {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000);
}

function calculate(company, mode) {
  if (!company.modes.includes(mode)) return [];
  const all = company.history;
  const dates = new Map(all.map(x => [x.date, x]));
  const currency = row => row.currency ?? "CNY";
  return all.flatMap(end => {
    const year = Number(end.date.slice(0, 4));
    const q = Number(end.date.slice(5, 7)) / 3;
    if (mode === "annual" && q !== 4 || mode === "half" && q !== 2) return [];
    const hasFlow = row => row && currency(row) === currency(end) && Number.isFinite(row.rev) && Number.isFinite(row.cost);
    if (!hasFlow(end)) return [];
    const opening = dates.get(monthDate(year - 1, 4));
    const openingInCurrency = end.openingBalance ?? (opening && currency(opening) === currency(end) ? opening : null);
    let balances = [openingInCurrency, end];
    let weights = [1, 1];
    let { rev, cost } = end;
    let days = mode === "annual" ? 365 : opening && daysBetween(opening.date, end.date);
    const label = mode === "annual" ? `${year} FY` : mode === "half" ? `${year} H1` : period(end.date);

    if (mode === "ttm") {
      const latest = quarterNumber(end.date);
      balances = Array.from({ length: 5 }, (_, index) => dates.get(quarterEnd(latest - 4 + index)));
      if (!balances.every(row => row && currency(row) === currency(end))) return [];
      weights = [1, 2, 2, 2, 1];
      if (q !== 4) {
        const prior = balances[0];
        if (!hasFlow(opening) || !hasFlow(prior)) return [];
        rev += opening.rev - prior.rev;
        cost += opening.cost - prior.cost;
      }
      days = 365;
    } else if (mode === "quarter") {
      const prior = q === 1 ? opening : dates.get(monthDate(year, q - 1));
      if (!prior || currency(prior) !== currency(end)) return [];
      balances = [prior, end];
      if (q > 1) {
        if (!hasFlow(prior)) return [];
        rev -= prior.rev;
        cost -= prior.cost;
      }
      days = daysBetween(prior.date, end.date);
    }

    if (!(rev > 0 && cost > 0 && days > 0) ||
        !balances.every(row => row && ["ar", "inv", "ap"].every(key => Number.isFinite(row[key])))) return [];
    const average = key => balances.reduce((sum, row, i) => sum + row[key] * weights[i], 0) /
      weights.reduce((sum, weight) => sum + weight, 0);
    const dso = average("ar") / rev * days;
    const dio = average("inv") / cost * days;
    const dpo = average("ap") / cost * days;
    return [{ label, date: end.date, days, dso, dio, dpo, ccc: dso + dio - dpo, source: end.source, note: end.note }];
  });
}

const metricKeys = ["dso", "dpo", "dio", "ccc"];

function setupCapital() {
  const companies = Object.entries(data.companies).map(([code, company]) => ({
    code, ...company, capital: Object.fromEntries(Object.keys(modes).map(mode => [
      mode, new Map(calculate(company, mode).map(row => [period(row.date), row]))
    ]))
  }));
  const calendar = companies.flatMap(company => company.history.map(record => quarterNumber(record.date)));
  const earliest = Math.min(...calendar);
  const dates = Array.from({ length: Math.max(...calendar) - earliest + 1 },
    (_, index) => period(quarterEnd(earliest + index)));
  const mode = byId("capital-mode");
  const metric = byId("capital-metric");
  const range = byId("capital-range");
  const issuer = byId("capital-company");
  const tablePeriod = byId("capital-period");
  const periodLabel = value => {
    if (mode.value === "annual") return `${value.slice(0, 4)} FY`;
    if (mode.value === "half") return `${value.slice(0, 4)} H1`;
    return value;
  };
  setupSelect("capital-mode", Object.entries(modeLabels));
  setupSelect("capital-company", [["all", "全部公司"], ...companies.map(c => [c.code, c.name])]);
  const lastPeriod = quarters => quarters.findLastIndex(quarter => companies.some(c => c.capital[mode.value].has(quarter)));
  const rangeStart = quarters => range.value === "all" ? 0 :
    Math.max(0, lastPeriod(quarters) + 1 - Number(range.value));
  const figure = document.querySelector(".capital-trend");
  const chart = mountCompanyTrend(figure, companies, dates, {
    defaultCode: "ganlee",
    emptyMessage: "勾选有数据的公司后查看周转天数",
    getEnd: lastPeriod,
    getStart: rangeStart,
    getPoints: (company, quarters) => quarters.map(quarter => {
      const row = company.capital[mode.value].get(quarter);
      return row ? { count: row[metric.value], detail: [row.label, row.note].filter(Boolean).join(" · ") } : null;
    }),
    describe: point => point ? { value: `${format(point.count)} 天`, detail: point.detail } : { value: dash },
    labelTick: quarter => mode.value === "half" ? quarter.endsWith("Q2") : quarter.endsWith("Q4"),
    maxGap: () => ["annual", "half"].includes(mode.value) ? 4 : 1
  });
  const series = [...figure.querySelectorAll('input[type="checkbox"]')];
  const hasData = code => companies.some(c => c.code === code && c.capital[mode.value].size);

  function renderCapitalTable() {
    const selection = companies.filter(c => issuer.value === "all" || c.code === issuer.value);
    const quarters = tablePeriod.value === "all" ? [...dates].reverse() : [tablePeriod.value];
    const rows = quarters.flatMap(quarter => selection.flatMap(company => {
      const row = company.capital[mode.value].get(quarter);
      if (!row) return [];
      const links = [row.source].flat().map((url, index) => href(url, index ? "补充来源" : "财报披露"));
      return [`<tr data-company="${esc(company.code)}" data-quarter="${esc(quarter)}"><th scope="row">${esc(company.name)}</th><td>${esc(row.label)}</td>
        ${metricKeys.map(key => wrap("td", format(row[key]))).join("")}<td>${links.join(" · ")}${row.note ? small(row.note) : ""}</td></tr>`];
    }));
    put("capital-rows", rows.join(""));
    const unavailable = issuer.value === "unitedlab" && ["ttm", "quarter"].includes(mode.value);
    byId("capital-status").textContent = rows.length ? `显示 ${rows.length} 条记录` : unavailable ?
      "联邦制药披露年报和中报。可切换到全年或上半年。" : "当前期间与公司组合无可计算的记录。";
  }

  function updateChartPeriods() {
    const checked = new Set(series.filter(box => box.checked && !box.disabled).map(box => box.value));
    const selected = companies.filter(company => checked.has(company.code));
    const available = dates.filter(date => selected.some(company => company.capital[mode.value].has(date)));
    const last = lastPeriod(dates);
    const since = dates[rangeStart(dates)];
    const shown = available.filter(date => date >= since && date <= dates[last]);
    const interval = shown.length ? `${periodLabel(shown[0])} 至 ${periodLabel(shown.at(-1))} · ${shown.length} 个期间` :
      "所选公司在当前范围没有数据";
    const omitted = available.length - shown.length;
    byId("capital-chart-periods").textContent = range.value === "all" ? interval :
      `${interval} · ${omitted ? `全部历史另有 ${omitted} 个期间` : "可用数据均在近五年内"}`;
  }

  function refreshChart() {
    byId("capital-caption").textContent = `${metric.selectedOptions[0].text} · ${modes[mode.value]} · 天`;
    const latest = dates[lastPeriod(dates)];
    document.querySelector("[data-capital-latest]").textContent = latest ? periodLabel(latest) : "暂无数据";
    chart?.refresh();
    updateChartPeriods();
  }

  function updatePeriods(preferLatest = false) {
    const old = tablePeriod.value;
    const selected = companies.filter(c => issuer.value === "all" || issuer.value === c.code);
    const available = dates.filter(date => selected.some(c => c.capital[mode.value].has(date))).reverse();
    setupSelect("capital-period", [...available.map(date => [date, periodLabel(date)]), ["all", "全部期间"]]);
    tablePeriod.value = !preferLatest && (available.includes(old) || old === "all") ? old : available[0] ?? "all";
    renderCapitalTable();
  }

  binding("capital-mode", () => {
    const checked = series.filter(checkbox => checkbox.checked);
    if (checked.length && !checked.some(checkbox => hasData(checkbox.value))) {
      const available = series.find(checkbox => hasData(checkbox.value));
      if (available) available.checked = true;
    }
    refreshChart();
    updatePeriods(true);
  });
  binding("capital-metric", refreshChart);
  binding("capital-range", refreshChart);
  figure.querySelector("fieldset").addEventListener("change", updateChartPeriods);
  binding("capital-period", renderCapitalTable);
  binding("capital-company", () => updatePeriods());
  const metricsHeader = ["公司", "证券代码", "计算口径", "期间", "资产负债表日", "计算天数",
    "AR days", "AP days", "Inventory days", "CCC days", "财报出处", "口径事项"];
  const measurements = companies.flatMap(company => Object.entries(company.capital).flatMap(([key, records]) =>
    [...records.values()].map(row => [company.name, company.ticker, modeLabels[key], row.label, row.date, row.days,
      ...metricKeys.map(metric => Number(row[metric].toFixed(4))), [row.source].flat().join(" "), row.note])));
  const inputsHeader = ["公司", "证券代码", "报告期", "报表币种", "累计营收（元）", "累计营业成本（元）", "归母净利润（元）",
    "贸易应收合计（元）", "应收账款／贸易应收净额（元）", "应收票据净额（元）", "应收款项融资（元）",
    "存货（元）", "贸易应付合计（元）", "应付账款／贸易应付（元）", "应付票据（元）", "供应商融资应付款（元）",
    "重列期初贸易应收合计（元）", "重列期初存货（元）", "重列期初贸易应付合计（元）", "口径事项", "财报出处"];
  const inputs = companies.flatMap(company => company.history.map(row =>
    [company.name, company.ticker, row.date, row.currency ?? "CNY", row.rev, row.cost, row.profit, row.ar,
      ...row.arBreakdown.slice(0, 2), row.arBreakdown[2], row.inv, row.ap, row.apBreakdown[0],
      row.apBreakdown[1], row.apBreakdown[2], row.openingBalance?.ar, row.openingBalance?.inv,
      row.openingBalance?.ap, row.note, [row.source].flat().join(" ")]));
  byId("capital-download").href = csvUrl([metricsHeader, ...measurements]);
  byId("capital-input-download").href = csvUrl([inputsHeader, ...inputs]);
  document.querySelector(".capital-interactive").hidden = false;
  updatePeriods(true);
  refreshChart();
  return company => {
    issuer.value = company;
    if (company !== "all") {
      if (!hasData(company)) mode.value = "annual";
      for (const checkbox of series) checkbox.checked = checkbox.value === company;
    }
    refreshChart();
    updatePeriods(true);
  };
}

function setupCompany(company) {
  const { name, ticker, note, annual, history, segments, business, ir } = company;
  byId("company-name").textContent = name;
  byId("company-ticker").textContent = ticker;
  byId("company-note").textContent = note;
  byId("company-ir").href = ir;
  document.querySelectorAll("[data-section]").forEach(a => {
    a.href = `#${active}/${a.dataset.section}`;
  });

  const latest = history.at(-1);
  const annualRows = history.filter(row => row.date.endsWith("12-31"));
  const fy25 = annualRows.find(row => row.date.startsWith("2025"));
  const lastCCC = calculate(company, "annual").find(row => row.label === "2025 FY");
  put("company-kpis", cards([
    ["2025 年集团营收", `${amount(fy25.rev)} 亿元`, ticker, annual],
    [company.focus[0], `${amount(company.focus[1])} 亿元`, `占集团营收 ${pct(company.focus[1] / fy25.rev)}`, annual],
    ["2025 年集团 CCC", `${format(lastCCC?.ccc, 1)} 天`, "年初年末余额均值", annual]
  ]));

  const op = history.filter(row => row.date >= "2023-12-31" &&
    (row.date.endsWith("12-31") || row.date.endsWith("06-30") || row === latest));
  put("company-operations", table(["期间", "营业收入", "营业成本", "毛利率", "归母净利润", "出处"],
    [...op].reverse().map(row => [
      esc(row.date.endsWith("12-31") ? `${row.date.slice(0, 4)} FY` :
        row.date.endsWith("06-30") ? `${row.date.slice(0, 4)} H1` : `${period(row.date)} 累计`),
      num(amount(row.rev)), num(amount(row.cost)), num(pct(1 - row.cost / row.rev)), num(amount(row.profit)), source(row)
    ])));
  put("company-segments", '<h4 class="rhythm">2025 财年业务拆分</h4>' +
    table(["披露项目", "收入（亿元）", "毛利率", "口径"], segments.map(([label, total, margin, scope]) =>
      [esc(label), num(amount(total)), num(pct(margin)), esc(scope)])));
  put("company-business", '<ul class="note-list small">' + business.map(([description, url]) =>
    `<li>${esc(description)} ${href(url, "披露")}</li>`).join("") + "</ul>");
  const headers = ["期间", "披露范围", "收入（亿元）", "收入同比", "销量（万支）", "销量同比", "平均单支收入（元）", "说明", "来源"];
  const series = tracker.business[active];
  const observations = new Map(series.map(row => [row.slice(0, 2).join("|"), row]));
  const rows = series.map(([period, scope, reported, volume, growth, comparable, note, link]) => {
    const priorPeriod = String(Number(period.slice(0, 4)) - 1) + period.slice(4);
    const prior = observations.get(`${priorPeriod}|${scope}`)?.[2];
    const growthRevenue = reported !== null && prior > 0 ? reported / prior - 1 : null;
    return [period, scope, reported, growthRevenue, volume, growth,
      comparable && reported !== null && volume > 0 ? reported * 10000 / volume : null, note, link];
  });
  put("company-insulin", table(headers, rows.map(row => row.map((value, index) =>
    index === 8 ? href(value, "财报／公告") : [2, 4, 6].includes(index) ? num(format(value)) :
      [3, 5].includes(index) ? num(pct(value)) : esc(value)))));
  byId("operating-export").onclick = () => download(`insulin-${active}-operations.csv`, [headers, ...rows]);
  const bridge = tracker.bridge[active];
  put("company-bridge", bridge.length ? '<h4 class="rhythm">公司披露的量价归因</h4><div class="scroll tracker-scroll" role="region" tabindex="0" aria-label="收入变动量价归因">' +
    table(["期间", "口径", "销量贡献（亿元）", "价格贡献（亿元）", "其他（亿元）", "收入变动（亿元）", "说明", "来源"],
      bridge.map(row => row.map((value, index) => index === 7 ? href(value, "原始披露") :
        index >= 2 && index <= 5 ? num(format(value)) : esc(value)))) + "</div>" : "");
}

function setupEquity() {
  const company = byId("equity-company");
  const status = byId("equity-status");
  const targets = byId("insulin-active-targets");
  const rows = targets.querySelectorAll("tbody tr");
  function updateTargets() {
    let visible = 0;
    for (const row of rows) {
      const show = company.value === "all" || row.dataset.company === company.value;
      row.hidden = !show;
      if (show) visible++;
    }
    targets.hidden = visible === 0 || !["all", "待考核"].includes(status.value);
  }
  company.closest(".equity-filters").addEventListener("change", updateTargets);
  updateTargets();
}

function route() {
  const [id, section] = location.hash.slice(1).split("/");
  const company = Object.hasOwn(data.companies, id) ? id : null;
  const capital = [id, section].includes("working-capital");
  const equity = [id, section].some(part => part === "equity-incentives" || part === "incentives");
  const industrySection = ["vbp-tracker", "pipeline", "partd"].includes(id) ? id : null;
  const targetId = capital ? "working-capital" : equity ? "equity-incentives" : section === "operations" ? "operations" : industrySection;
  const current = targetId === "operations" ? company : targetId ?? company ?? "industry";
  const previous = active;
  active = company ?? "industry";
  byId("industry-view").hidden = Boolean(company);
  byId("company-view").hidden = !company;
  document.querySelectorAll("[data-view]").forEach(link => {
    if (link.dataset.view === current) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
  if (company && (active !== previous || !byId("company-name").textContent)) {
    setupCompany(data.companies[company]);
  }
  if (capital) selectCapitalCompany(company ?? "all");
  if (equity) {
    const control = byId("equity-company");
    control.value = company ?? "all";
    control.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (targetId) {
    byId(targetId).focus({ preventScroll: true });
    byId(targetId).scrollIntoView();
  } else if (company || id === "industry") {
    byId("contents").scrollIntoView({ block: "start" });
  }
}

try {
  [data, tracker] = await Promise.all(["data.json?v=20261120d", "tracker.json?v=20261121a"].map(async path => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Data HTTP ${response.status}`);
    return response.json();
  }));
  const partdUpdate = await fetch("public-data/cms.partd-values.json").then(r=>r.ok?r.json():null).catch(()=>null);
  const current = new Set(tracker.partd.map(r=>[r[0],r[2],r[3]].join("/")));
  for (const row of partdUpdate?.records||[]) {
    if (current.has(row.id)) continue;
    tracker.partd.push([row.year,row.molecule,row.brand,row.generic,row.spending,row.claims,row.beneficiaries,row.doses]);
    current.add(row.id);
  }
  tracker.partd.sort((a,b)=>Number(b[0])-Number(a[0]));
  data.products.push(...tracker.registrations);
  setupIndustry();
  setupTracker();
  selectCapitalCompany = setupCapital();
  setupEquity();
  window.addEventListener("hashchange", route);
  byId("contents").hidden = false;
  route();
  byId("loading").hidden = true;
} catch (error) {
  byId("contents").hidden = true;
  byId("loading").textContent = "暂时无法读取数据，请刷新页面。";
  console.error(error);
}
