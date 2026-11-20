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
  byId("product-summary").textContent = `显示 ${rows.length} / ${data.products.length} 条代表性产品记录。同一产品在不同辖区可有独立批准记录。`;
  put("product-table", table(["产品", "分子／类别", "市场", "监管分类", "规格／剂型", "批准日", "持有人或合作角色", "资料"],
    rows.map(([molecule, market, classification, name, form, date, holder, source]) => [
      esc(name), esc(molecule) + small("胰岛素类似物"), esc(market), esc(classification),
      esc(form), esc(date), esc(holder), href(source, "监管／公司资料")
    ])));
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

  const rows = partd.rows.map(([brand, name, spending, claims, year]) => [
    esc(brand), esc(name), num(format(spending / 1_000_000)), num(format(claims, 0)), num(year)
  ]);
  const negotiation = partd.negotiation.map(([brand, interval, spending, people, url]) => [
    esc(brand), esc(interval), num(format(spending / 1_000_000)), num(format(people, 0)), href(url, "CMS 谈判披露")
  ]);
  put("partd-content", (rows.length ? '<div class="scroll" role="region" tabindex="0" aria-label="Part D 品牌数据">' +
    table(["品牌", "CMS 通用名", "总支出（百万美元）", "申报次数", "年度"], rows) + "</div>" :
    "") +
    '<div class="scroll" role="region" tabindex="0" aria-label="CMS 药价谈判披露">' +
    table(["谈判统计产品组", "统计期", "Part D 总支出（百万美元）", "使用人数", "来源"], negotiation) + "</div>" +
    `<p class="small">两期有重叠。Fiasp／NovoLog 按 CMS 公布的六个产品名称合计。人数按原表千人取整。<br>
      ${esc(partd.note)}<br>${href(links.partd, "CMS Medicare Part D")} · ${href(links.medicaid, "CMS Medicaid 药品支出")} ·
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

function daysBetween(start, end) {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000);
}

function calculate(company, mode) {
  if (!company.modes.includes(mode)) return [];
  const all = company.history;
  const dates = new Map(all.map(x => [x.date, x]));
  return all.flatMap((end, index) => {
    const year = Number(end.date.slice(0, 4));
    const q = Number(end.date.slice(5, 7)) / 3;
    if (mode === "annual" && q !== 4 || mode === "half" && q !== 2) return [];
    const opening = dates.get(monthDate(year - 1, 4));
    let balances = [opening, end];
    let weights = [1, 1];
    let { rev, cost } = end;
    let days = mode === "annual" ? 365 : opening && daysBetween(opening.date, end.date);
    let label = mode === "annual" ? `${year} FY` : mode === "half" ? `${year} H1` : period(end.date);

    if (mode === "ttm") {
      const prior = dates.get(monthDate(year - 1, q));
      balances = all.slice(Math.max(0, index - 4), index + 1);
      if (!prior || balances.length !== 5 || balances[0].date !== prior.date || (q !== 4 && !opening)) return [];
      weights = [1, 2, 2, 2, 1];
      if (q !== 4) {
        rev += opening.rev - prior.rev;
        cost += opening.cost - prior.cost;
      }
      days = 365;
    } else if (mode === "quarter") {
      const prior = q === 1 ? opening : dates.get(monthDate(year, q - 1));
      if (!prior) return [];
      balances = [prior, end];
      if (q > 1) {
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
    return [{ label, date: end.date, days, dso, dio, dpo, ccc: dso + dio - dpo, source: end.source }];
  });
}

const metricKeys = ["dso", "dpo", "dio", "ccc"];

function setupCapital() {
  const companies = Object.entries(data.companies).map(([code, company]) => ({
    code, ...company, capital: Object.fromEntries(Object.keys(modes).map(mode => [
      mode, new Map(calculate(company, mode).map(row => [period(row.date), row]))
    ]))
  }));
  const dates = sortedUnique(companies.flatMap(company =>
    company.history.map(record => period(record.date))));
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
  const figure = document.querySelector(".capital-trend");
  const chart = mountCompanyTrend(figure, companies, dates, {
    defaultCode: "ganlee",
    emptyMessage: "勾选有数据的公司后查看周转天数",
    getEnd: lastPeriod,
    getStart: quarters => range.value === "all" ? 0 : Math.max(0, lastPeriod(quarters) + 1 - Number(range.value)),
    getPoints: (company, quarters) => quarters.map(quarter => {
      const row = company.capital[mode.value].get(quarter);
      return row ? { count: row[metric.value], detail: row.label } : null;
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
      const links = [row.source].flat().map((url, index) => href(url, index ? "重列披露" : "财报披露"));
      return [`<tr data-company="${esc(company.code)}" data-quarter="${esc(quarter)}"><th scope="row">${esc(company.name)}</th><td>${esc(row.label)}</td>
        ${metricKeys.map(key => wrap("td", format(row[key]))).join("")}<td>${links.join(" · ")}</td></tr>`];
    }));
    put("capital-rows", rows.join(""));
    const unavailable = issuer.value === "unitedlab" && ["ttm", "quarter"].includes(mode.value);
    byId("capital-status").textContent = rows.length ? `显示 ${rows.length} 条记录` : unavailable ?
      "联邦制药披露年报和中报。可切换到全年或上半年。" : "当前期间与公司组合无可计算的记录。";
  }

  function refreshChart() {
    byId("capital-caption").textContent = `${metric.selectedOptions[0].text} · ${modes[mode.value]} · 天`;
    const latest = dates[lastPeriod(dates)];
    document.querySelector("[data-capital-latest]").textContent = latest ? periodLabel(latest) : "暂无数据";
    chart?.refresh();
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
  binding("capital-period", renderCapitalTable);
  binding("capital-company", () => updatePeriods());
  const metricsHeader = ["公司", "证券代码", "计算口径", "期间", "资产负债表日", "计算天数",
    "AR days", "AP days", "Inventory days", "CCC days", "财报出处"];
  const measurements = companies.flatMap(company => Object.entries(company.capital).flatMap(([key, records]) =>
    [...records.values()].map(row => [company.name, company.ticker, modeLabels[key], row.label, row.date, row.days,
      ...metricKeys.map(metric => Number(row[metric].toFixed(4))), [row.source].flat().join(" ")])));
  const inputsHeader = ["公司", "证券代码", "报告期", "累计营收（元）", "累计营业成本（元）", "归母净利润（元）",
    "贸易应收合计（元）", "应收账款／贸易应收净额（元）", "应收票据净额（元）", "应收款项融资（元）",
    "存货（元）", "贸易应付合计（元）", "应付账款／贸易应付（元）", "应付票据（元）", "供应商融资应付款（元）", "财报出处"];
  const inputs = companies.flatMap(company => company.history.map(row => {
    const mainland = company.modes.includes("ttm");
    return [company.name, company.ticker, row.date, row.rev, row.cost, row.profit, row.ar,
      ...row.arBreakdown.slice(0, 2), row.arBreakdown[2], row.inv, row.ap, row.apBreakdown[0],
      mainland ? row.apBreakdown[1] : null, mainland ? null : row.apBreakdown[1], [row.source].flat().join(" ")];
  }));
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
  const targetId = capital ? "working-capital" : equity ? "equity-incentives" : section === "operations" ? "operations" : null;
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
  const result = await fetch("data.json");
  if (!result.ok) throw new Error(`Data HTTP ${result.status}`);
  data = await result.json();
  setupIndustry();
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
