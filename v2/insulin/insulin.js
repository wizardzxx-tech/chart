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
const modes = { ttm: "滚动十二个月（TTM）", quarter: "单季度", annual: "全年", half: "上半年" };
const metrics = { ccc: "CCC", dso: "DSO", dio: "DIO", dpo: "DPO" };

let data;
let active = "industry";
let cccRows = [];
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

function download(filename, rows) {
  const cell = value => {
    let safe = String(value ?? "");
    if (typeof value !== "number" && /^[=+\-@\t\r]/.test(safe)) safe = "'" + safe;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const body = rows.map(row => row.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", body], { type: "text/csv;charset=utf-8" }));
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

function drawTrend(rows, metric) {
  const canvas = byId("ccc-chart");
  const width = canvas.clientWidth;
  if (!width) return;
  const height = canvas.clientHeight;
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  if (!rows.length) return;

  const values = rows.map(row => row[metric]);
  const pad = { left: 49, right: 19, top: 14, bottom: 29 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const step = Math.max(1, Math.ceil((max - min) / 50) * 10);
  const lower = Math.floor(min / step) * step;
  const upper = Math.max(lower + step, Math.ceil(max / step) * step);
  const x = index => pad.left + plotWidth * index / Math.max(1, rows.length - 1);
  const y = value => pad.top + plotHeight * (upper - value) / (upper - lower);
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillStyle = "#4e6461";
  ctx.textAlign = "right";
  for (let tick = lower; tick <= upper; tick += step) {
    const pos = y(tick);
    ctx.strokeStyle = tick === 0 ? "#a9bcb3" : "#e0ebe4";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, pos);
    ctx.lineTo(width - pad.right, pos);
    ctx.stroke();
    ctx.fillText(String(tick), pad.left - 8, pos + 4);
  }

  ctx.strokeStyle = "#1d6757";
  ctx.lineWidth = 2.3;
  ctx.beginPath();
  values.forEach((value, i) => i ? ctx.lineTo(x(i), y(value)) : ctx.moveTo(x(i), y(value)));
  ctx.stroke();
  ctx.fillStyle = "#1d6757";
  values.forEach((value, i) => {
    ctx.beginPath();
    ctx.arc(x(i), y(value), 3.2, 0, 2 * Math.PI);
    ctx.fill();
  });
  ctx.fillStyle = "#4e6461";
  ctx.textAlign = "center";
  const stride = Math.max(1, Math.ceil(rows.length / Math.floor(plotWidth / 68 || 1)));
  rows.forEach((row, i) => {
    if (i === rows.length - 1 || (i % stride === 0 && i < rows.length - Math.max(1, stride / 2))) {
      ctx.fillText(row.label, Math.min(width - 26, x(i)), height - 8);
    }
  });
}

const metricKeys = Object.keys(metrics);
const cccHeaders = ["期间", "计算天数", "CCC（天）", "DSO（天）", "DIO（天）", "DPO（天）", "对应期报告"];
const inputHeaders = ["报告期", "累计营收（元）", "累计成本（元）", "贸易相关应收（元）", "存货（元）", "贸易相关应付（元）", "归母净利润（元）", "出处"];
const fields = ["rev", "cost", "ar", "inv", "ap", "profit"];
const breakdownHeaders = ["贸易应收／应收账款", "票据应收", "应收款项融资"];
const inputColumns = company => [...inputHeaders.slice(0, -1), ...breakdownHeaders.slice(0, company.modes.includes("ttm") ? 3 : 2),
  "贸易应付／应付账款", company.modes.includes("ttm") ? "应付票据" : "供应商融资应付款", "出处"];
const inputValues = row => [...fields.map(key => row[key]), ...row.arBreakdown, ...row.apBreakdown];

function updateCCC() {
  if (active === "industry") return;
  const company = data.companies[active];
  const mode = byId("ccc-mode").value;
  const metric = byId("ccc-metric").value;
  cccRows = calculate(company, mode);
  put("ccc-table", table(cccHeaders, [...cccRows].reverse().map(row => [
    esc(row.label), num(row.days), ...metricKeys.map(key => num(format(row[key], 1))), source(row)
  ])));
  const last = cccRows.at(-1);
  const previous = cccRows.at(-2);
  byId("ccc-change").textContent = last ? `${last.label} ${metrics[metric]} ${format(last[metric], 1)} 天` +
    (previous ? `，较 ${previous.label} ${last[metric] >= previous[metric] ? "增加" : "减少"} ${format(Math.abs(last[metric] - previous[metric]), 1)} 天。` : "。") : "";
  byId("ccc-export").disabled = !cccRows.length;
  drawTrend(cccRows, metric);
}

function setupCompany(company) {
  const { name, ticker, note, annual, history, segments, business, ir, plans } = company;
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

  setupSelect("ccc-mode", company.modes.map(mode => [mode, modes[mode]]));
  byId("ccc-metric").value = "ccc";
  put("ccc-method", `<p>CCC＝DSO＋DIO－DPO。DSO＝平均应收÷同期营收×天数。DIO＝平均存货÷同期营业成本×天数。DPO＝平均应付÷同期营业成本×天数。</p>
    <p>${esc(company.method)}</p>
    <p>全年使用年初年末均值，按 365 天计算。原始科目表中的营收与成本为年初至报告期末累计数。</p>`);
  put("ccc-inputs", table(inputColumns(company), [...history].reverse().map(row => [
    esc(row.date), ...inputValues(row).map(value => num(format(value, 2))), source(row)
  ])));
  put("incentive-plans", plans.map(plan => `<article class="plan"><h4>${esc(plan.title)}</h4>
    ${wrap("p", plan.intro)}<div class="scroll" role="region" tabindex="0" aria-label="${esc(plan.title)}">
    ${table(plan.headers, plan.rows.map(row => row.map(esc)))}</div>
    ${wrap("p", plan.note)}<p>${plan.sources.map(([url, label]) => href(url, label)).join(" · ")}</p></article>`).join(""));
  updateCCC();
}

function route() {
  const [id, section] = location.hash.slice(1).split("/");
  const next = Object.hasOwn(data.companies, id) ? id : "industry";
  const previous = active;
  active = next;
  byId("industry-view").hidden = active !== "industry";
  byId("company-view").hidden = active === "industry";
  document.querySelectorAll("[data-view]").forEach(link => {
    if (link.dataset.view === active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (active !== "industry" && (active !== previous || !byId("company-name").textContent)) {
    setupCompany(data.companies[active]);
  }
  if (active !== "industry" && ["operations", "working-capital", "incentives"].includes(section)) {
    byId(section).focus({ preventScroll: true });
    byId(section).scrollIntoView();
  }
}

try {
  const result = await fetch("data.json");
  if (!result.ok) throw new Error(`Data HTTP ${result.status}`);
  data = await result.json();
  setupIndustry();
  binding("ccc-mode", updateCCC);
  binding("ccc-metric", updateCCC);
  binding("ccc-export", () => download(`insulin-${active}-${byId("ccc-mode").value}.csv`, [cccHeaders,
    ...cccRows.map(row => [row.label, row.days, ...metricKeys.map(key => Number(row[key].toFixed(4))), [row.source].flat().join(" ")])
  ]), "click");
  binding("ccc-input-export", () => {
    const company = data.companies[active];
    download(`insulin-${active}-financial-inputs.csv`, [inputColumns(company),
      ...company.history.map(row => [row.date, ...inputValues(row), [row.source].flat().join(" ")])
    ]);
  }, "click");
  window.addEventListener("hashchange", route);
  new ResizeObserver(() => {
    if (active !== "industry") drawTrend(cccRows, byId("ccc-metric").value);
  }).observe(byId("ccc-chart"));
  byId("contents").hidden = false;
  route();
  byId("loading").hidden = true;
} catch (error) {
  byId("contents").hidden = true;
  byId("loading").textContent = "暂时无法读取数据，请刷新页面。";
  console.error(error);
}
