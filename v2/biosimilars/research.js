import {drawLines, colorPalette, isNumber} from './chart.js';

const byId = id => document.getElementById(id);
const format = new Intl.NumberFormat('zh-CN', {maximumFractionDigits: 2});
const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[char]);
const source = (url, label = '原文') => url
  ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : '—';
const route = (view, id, label) => `<a href="#${view}/${encodeURIComponent(id)}">${esc(label)}</a>`;
const n = value => isNumber(value) ? format.format(value) : '—';
const pct = value => isNumber(value) ? n(value * 100) + '%' : '—';
const pp = value => isNumber(value) ? (value > 0 ? '+' : '') + n(value * 100) + ' pp' : '—';
const regions = {US: '美国', EU: '欧洲', CN: '中国', ROW: '美国以外', INTL: '国际', JP: '日本'};
const kinds = {patent: '专利', exclusivity: '监管独占期', estimate: '公司估计',
  approval: '监管批准', launch: '商业上市', litigation: '诉讼'};
const currencies = {USD: '美元', EUR: '欧元', CHF: '瑞郎', GBP: '英镑', JPY: '日元', CNY: '元'};
const money = (value, currency) => isNumber(value) ? n(value * 10) + ' 亿' + currencies[currency] : '—';
const validLicense = row => !/撤回|失效|取消|吊销|拒绝|终止|未生效/.test(row.status);

function table(headers, rows, empty = '暂无核实记录。') {
  if (!rows.length) return `<p class="note">${esc(empty)}</p>`;
  return `<div class="scroll" tabindex="0"><table><thead><tr>${headers.map(x =>
    `<th scope="col">${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(([label, ...cells]) =>
    `<tr><th scope="row">${label}</th>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function svgFreePlot(canvas, points, label, options = {}) {
  const observed = points.filter(point => isNumber(point.value));
  canvas.hidden = !observed.length;
  if (!observed.length) return;
  const rows = options.series || [{label, color: colorPalette[0],
    values: Object.fromEntries(observed.map(point => [point.period, point.value]))}];
  const ymax = Math.max(...observed.map(row => row.value));
  const upper = options.upper || Math.max(25, Math.ceil(ymax / 25) * 25);
  drawLines(canvas, {series: rows, periods: [...new Set(points.map(point => point.period))],
    labels: x => x, formatY: options.formatY || n, upper});
}

function priceBasis(index, period) {
  return index.preCompetition
    ? `${period} = 100 · 首次美国商业上市前`
    : `${period} = 100 · 最早可用观察期`;
}

export function drawIndex(container, index, cms, kind) {
  container.replaceChildren();
  if (!index) {
    container.innerHTML = '<p class="note">此分子暂无已核实的可比 Part B 价格或计费单位数据。</p>';
    return;
  }
  const isWeighted = kind === 'weighted';
  const selected = index[kind];
  if (!selected.rows.length) {
    container.innerHTML = '<p class="note">此分子暂无可比数据。</p>';
    return;
  }
  const title = isWeighted ? '分子加权单位支出指数' : '原研支付限额指数';
  const sourceUrl = isWeighted ? cms.sources.annual.file : cms.sources.payment.link;
  const launch = index.originator.launch;
  container.innerHTML = `
    <h3>${title}</h3>
    <p class="note">${priceBasis(selected, selected.base)}。美元／${esc(index.unit)}。
      ${source(sourceUrl, 'CMS 原始数据')}
      ${launch ? ' · ' + source(launch.source, launch.date + ' 美国首个商业上市依据') : ''}</p>
    <p class="note">${isWeighted
      ? 'Implied Spending per Billing Unit。传统 Medicare Part B 已纳入品牌支出合计 ÷ 相同计费单位数量合计。随品牌组合和支付结构变化。'
      : '传统 Medicare Part B 原研 HCPCS 的公开支付限额，按生效季度计算。'}</p>
    <canvas class="research-canvas" role="img" aria-label="${title}"></canvas>
    <details class="market-disclosure"><summary>数值、分母和原始来源</summary>
      ${table(isWeighted ? ['年份', '指数', '美元／' + index.unit, '支出（美元）', '计费单位数', 'HCPCS']
         : ['季度', '指数', '美元／' + index.unit, '来源'], selected.rows.map(row =>
        [esc(row.period), n(row.index), n(row.value), ...(isWeighted
          ? [n(row.spending), n(row.units), esc(row.codes.join('、')) +
              (row.outliers.length ? '<small> CMS 异常值标记 ' + esc(row.outliers.join('、')) + '</small>' : '')]
          : [source(cms.paymentPeriods[row.period]?.url, '季度文件')])]))}
      <p class="note">${esc(index.scope)}</p></details>`;
  const canvas = container.querySelector('canvas');
  plotWhenVisible(canvas, () => svgFreePlot(canvas,
    selected.rows.map(row => ({period: row.period, value: row.index})), title));
}

const chartCallbacks = new WeakMap();
const researchObserver = new ResizeObserver(entries => entries.forEach(({target}) => {
  if (target.clientWidth > 0) chartCallbacks.get(target)?.();
}));
function plotWhenVisible(canvas, render) {
  chartCallbacks.set(canvas, render);
  researchObserver.observe(canvas);
}

const sum = (rows, field) => rows.reduce((acc, row) => acc + (row[field] ?? 0), 0);
const quarterNumber = period => /^\d{4}Q[1-4]$/.test(period)
  ? Number(period.slice(0, 4)) * 4 + Number(period.at(-1)) : null;

function sliceShares(rows, products, periods, field) {
  return periods.map(period => {
    const items = rows.filter(r => r.period === period && products.has(r.code) && isNumber(r[field]));
    const total = sum(items, field);
    const reference = items.filter(r => products.get(r.code).reference);
    return {period, items, total,
      original: reference.length && total > 0 ? sum(reference, field) / total : null};
  }).filter(record => record.total > 0);
}

function drawMarket(container, cms, group, research, requestedPeriod) {
  const products = new Map((group?.products || []).filter(product => product.code)
    .map(product => [product.code, product]));
  const periods = Object.values(cms.quarterPeriods).filter(period => period.kind === 'quarter')
    .map(period => period.id).sort();
  const quarterRows = sliceShares(cms.quarterly, products, periods, 'claims');
  const years = [...new Set(cms.annual.map(row => row.period))].sort();
  const annualRows = sliceShares(cms.annual, products, years, 'units');
  const useQuarters = requestedPeriod === 'quarter' || (!requestedPeriod && quarterRows.length > 1) || !annualRows.length;
  const visible = useQuarters ? quarterRows : annualRows;
  const label = useQuarters ? 'Part B 单季申报份额' : 'Part B 年度计费单位份额';
  if (!visible.length) {
    container.innerHTML = '<p class="note">此分子暂无已入库的 Part B 份额。</p>';
    return;
  }
  const previousHeader = useQuarters ? '类似药份额环比' : '类似药份额同比';
  container.innerHTML = `<h3>${label}</h3>
    <div class="market-main-controls"><label>份额口径<select aria-label="Part B 份额口径">
      ${annualRows.length ? '<option value="annual">年度计费单位</option>' : ''}
      ${quarterRows.length ? '<option value="quarter">单季申报</option>' : ''}
    </select></label></div>
    <p class="note">传统 Medicare 按服务付费。分母为同一分子与剂型中已计入编码的可见记录。</p>
    <canvas class="research-canvas" role="img" aria-label="${label}"></canvas>
    ${table(['观察期', '原研份额', '类似药份额', previousHeader, '计入品牌'], visible.map((row, i) => {
      const similar = isNumber(row.original) ? 1 - row.original : null;
      const previous = visible[i - 1];
      const sequence = useQuarters ? quarterNumber : Number;
      const step = previous && sequence(row.period) - sequence(previous.period) === 1 && isNumber(previous.original);
      return [esc(row.period), pct(row.original), pct(similar),
        step && isNumber(similar) ? pp(similar - (1 - previous.original)) : '—', n(row.items.length)];
    }))}
    <p class="note">${esc(research.quarterlyAudit.note)}
      ${route('market', group.id, '各品牌趋势、环比与 CSV')}</p>`;
  const select = container.querySelector('select');
  select.value = useQuarters ? 'quarter' : 'annual';
  select.addEventListener('change', () => drawMarket(container, cms, group, research, select.value));
  const canvas = container.querySelector('canvas');
  const plotted = visible.map(row => ({period: row.period, value: row.original}));
  const series = [
    {label: '原研', color: colorPalette[0], values: Object.fromEntries(plotted.map(r => [r.period, r.value]))},
    {label: '类似药合计', color: colorPalette[1], values: Object.fromEntries(plotted.map(r =>
      [r.period, isNumber(r.value) ? 1 - r.value : null]))},
  ];
  canvas.insertAdjacentHTML('beforebegin', `<div class="series-legend">${series.map(s =>
    `<span class="series-key"><i style="--series-color:${s.color}"></i>${s.label}</span>`).join('')}</div>`);
  plotWhenVisible(canvas, () => svgFreePlot(canvas, plotted, label, {series, upper: 1, formatY: pct}));
}

function drawChannel(container, spec, rows) {
  container.replaceChildren();
  if (!rows.length) return;
  const {title, quantity, moneyLabel, note, link, reference, file, showPrice} = spec;
  const hasBrand = row => row.brand !== 'Inconnu';
  const periods = [...new Set(rows.map(row => row.period))].sort();
  const brands = [...new Set(rows.filter(hasBrand).map(row => row.brand))].sort((a, b) =>
    Number(b === reference) - Number(a === reference) || a.localeCompare(b));
  container.innerHTML = `<h3>${title}</h3>
    <div class="market-main-controls"><label>年度<select></select></label></div>
    <p class="note">${esc(note)} ${source(link, '官方数据与口径')}
    ${file ? ' · ' + source(file, '原始文件') : ''}</p>
    <div class="series-legend" aria-label="品牌"></div>
    <canvas class="research-canvas" role="img" aria-label="${title}品牌份额"></canvas>
    <div class="channel-table"></div>`;
  const current = container.querySelector('select');
  current.replaceChildren(...periods.map(period => new Option(period, period)));
  current.value = periods.at(-1);
  const view = container.querySelector('.channel-table');
  const canvas = container.querySelector('canvas');
  const totals = new Map(periods.map(period => [period, sum(rows.filter(row => row.period === period && hasBrand(row)), quantity)]));
  const series = brands.map((brand, i) => ({label: brand, color: colorPalette[i % colorPalette.length],
    values: Object.fromEntries(rows.filter(row => row.brand === brand && isNumber(row[quantity]))
      .map(row => [row.period, totals.get(row.period) > 0 ? row[quantity] / totals.get(row.period) : null]))}));
  container.querySelector('.series-legend').innerHTML = series.map(s =>
    `<span class="series-key"><i style="--series-color:${s.color}"></i>${esc(s.label)}</span>`).join('');
  plotWhenVisible(canvas, () => svgFreePlot(canvas, periods.map(period => ({period, value: 1})),
    title, {series, upper: 1, formatY: pct}));
  const refresh = () => {
    const sample = rows.filter(row => row.period === current.value)
      .sort((a, b) => (b[quantity] ?? 0) - (a[quantity] ?? 0));
    const denominator = totals.get(current.value);
    const competitors = sample.filter(r => r.brand !== reference && hasBrand(r));
    const originator = sample.find(r => r.brand === reference);
    view.innerHTML = `<p class="note">已识别品牌合计 ${n(denominator)} · 原研份额 ${denominator && isNumber(originator?.[quantity])
      ? pct(originator[quantity] / denominator) : '—'} · 类似药份额 ${denominator && originator
      ? pct(sum(competitors, quantity) / denominator) : '—'}</p>` +
      table(['品牌', quantity === 'claims' ? '申报件数' : '报销盒数', '份额', moneyLabel,
        ...(showPrice ? ['每盒实报（欧元）'] : []), ...(file ? [] : ['来源'])], sample.map(row =>
        [hasBrand(row) ? esc(row.brand) : '品牌未知（份额待定）', n(row[quantity]), denominator && hasBrand(row) && isNumber(row[quantity]) ? pct(row[quantity] / denominator) : '—',
          n(row.spending), ...(showPrice ? [row[quantity] && isNumber(row.spending)
            ? n(row.spending / row[quantity]) : '—'] : []), ...(file ? [] : [source(row.source)])]));
  };
  current.addEventListener('change', refresh);
  refresh();
}

function showDossier(container, dossier, region, research) {
  if (!dossier) {
    container.innerHTML = '<p class="note">此分子暂无完整专利档案。</p>';
    return;
  }
  const events = dossier.events.filter(event => !region || event.region === region)
    .sort((a, b) => a.date.localeCompare(b.date));
  const listed = Object.entries(dossier.regionalSales || {});
  const salesPeriod = dossier.period || '2025';
  const saleRows = region ? listed.filter(([key]) => key === region)
    : [...(isNumber(dossier.sales) ? [['全球', dossier.sales]] : []), ...listed];
  container.innerHTML = `<h3>原研销售与竞争窗口</h3>
    ${table(['地区', '原研销售', '披露期间'], saleRows.map(([key, value]) =>
      [esc(regions[key] || key), esc(money(value, dossier.currency)), esc(salesPeriod) + ' · ' + source(dossier.source)]),
    '该地区、剂型或披露期间暂无可用原研销售额。')}
    <p class="note">${esc(dossier.scope)}。 ${esc(dossier.note)}</p>
    ${table(['时间', '地区', '证据类型', '描述'], events.map(event =>
      [esc(event.date), esc(regions[event.region]), esc(kinds[event.kind]),
        esc(event.label) + ' · ' + source(event.source)]))}
    ${table(['地区', '当前核对范围'], Object.entries(dossier.regionNotes || {})
      .filter(([key]) => !region || key === region).map(([key, value]) => [esc(regions[key]),
        esc(value) + ' · ' + source(dossier.regionSources?.[key] || research.patentResources[key], '核查入口')]))}
    <p class="note">${route('cliff', dossier.id, '专利时间轴')}${dossier.id === 'aflibercept-8mg'
      ? ' · ' + route('dashboard', 'aflibercept', '查看阿柏西普 2 mg') : ''}${isNumber(dossier.sales)
      ? ' · ' + route('model', dossier.id, '情景模型') : ''}</p>`;
}

function showCompetition(container, approvals, assets, brands, region, id, companies) {
  const eligible = approvals.filter(row => row.molecule === id && (!region || row.region === region));
  const pipeline = assets.filter(row => row.molecule === id && (!region || row.current[region]));
  const launched = eligible.filter(row => row.launch && validLicense(row));
  const confirmed = new Set(launched.map(row => [row.region, row.brand].join('|')));
  const commercial = eligible.filter(row => validLicense(row)).length;
  const sales = brands.filter(row => row.molecule === id && (!region || row.region === region));
  container.innerHTML = `<h3>获批、商业上市与在研竞争者</h3>
    <p class="note">所选地区有 ${n(commercial)} 条可见批准记录、${n(confirmed.size)} 条带日期的商业上市品牌记录、${n(pipeline.length)} 项已关联研发资产。合作资产按资产 ID 去重。</p>
    ${table(['已确认商业上市品牌', '地区', '日期', '开发资产／持有人'], [...launched].sort((a,b) =>
      a.launch.localeCompare(b.launch)).map(row =>
      [esc(row.brand), esc(regions[row.region]), esc(row.launch) + ' · ' + source(row.launchSource || row.source),
        row.assetId ? route('pipeline', 'asset/' + row.assetId, row.assetId) : esc(row.holder)]))}
    ${table(['研发资产', '开发商与商业权益', '地区进展'], pipeline.map(asset =>
      [route('pipeline', 'asset/' + asset.id, asset.display || asset.id),
        esc(asset.developer || companies.get(asset.company) || asset.company) +
          (asset.partners?.length ? '<small>' + asset.partners.map(p =>
            esc([companies.get(p.company) || p.name || p.company, p.role, p.territories].filter(Boolean).join(' · '))).join('<br>') + '</small>' : ''),
        Object.values(asset.current).filter(event => !region || event.region === region).map(event =>
          esc((regions[event.region] || event.region) + ' ' + event.stage + ' ' + (event.date || '')) +
          ' · ' + source(event.source)).join('<br>')]))}
    ${sales.length ? table(['产品收入', '会计口径', '地区', '期间'], sales.map(row =>
      [esc(row.brand), esc(money(row.value, row.currency)) + ' · ' + esc(row.scope),
        esc(regions[row.region] || row.region), esc(row.period) + ' · ' + source(row.source)])) : ''}
    <p class="note">${route('approvals', id, '完整监管记录')} · ${route('pipeline', id, '各资产和权益详情')}</p>`;
}

const dashboard = byId('view-dashboard');
const snapshot = JSON.parse(byId('snapshot').textContent);
const companies = new Map(snapshot.companies.map(company => [company.id, company.name]));
const cmsSelect = byId('dashboard-molecule');
const regionSelect = byId('dashboard-region');
cmsSelect.replaceChildren(...Object.entries(snapshot.molecules).sort(([, a], [, b]) =>
  a.name.localeCompare(b.name)).map(([id, value]) => new Option(
  [value.reference, value.cn || value.name].filter(Boolean).join(' · '), id)));
const fetchData = name => fetch(new URL(`./data/${name}.json`, import.meta.url)).then(response => {
  if (!response.ok) throw new Error(name + ' HTTP ' + response.status);
  return response.json();
});
let requested = null;
let result = null;
function updateDashboard() {
  if (dashboard.hidden) return;
  if (!result) {
    if (requested) return;
    requested = Promise.all([fetchData('medicare'), fetchData('market-research')]).then(data => {
      result = data;
      byId('dashboard-loading').hidden = true;
      updateDashboard();
    }).catch(() => {
      byId('dashboard-loading').textContent = '市场数据暂时无法读取。';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'outline';
      retry.textContent = '重新加载';
      retry.addEventListener('click', updateDashboard, {once: true});
      byId('dashboard-loading').append(' ', retry);
    }).finally(() => {requested = null;});
    return;
  }
  const raw = location.hash.slice(1).split('/')[1];
  let key;
  try {key = decodeURIComponent(raw ?? '');} catch {key = '';}
  if (snapshot.molecules[key]) cmsSelect.value = key;
  const id = cmsSelect.value;
  const region = regionSelect.value;
  const [cms, research] = result;
  const profile = snapshot.cliffs.find(row => row.id === id);
  const group = cms.groups.find(row => row.id === id);
  showDossier(byId('dash-patent'), profile, region, research);
  showCompetition(byId('dash-competition'), snapshot.approvals, snapshot.assets,
    research.brandSales, region, id, companies);
  const showUs = !region || region === 'US';
  const showFr = !region || region === 'EU';
  byId('dash-us').hidden = !showUs || !group;
  byId('dash-france').hidden = !showFr || !['adalimumab', 'ustekinumab'].includes(id);
  byId('dash-partd').hidden = !showUs || !research.partD.rows.some(row => row.molecule === id);
  if (showUs && group) {
    drawMarket(byId('dash-share'), cms, group, research);
    drawIndex(byId('dash-originator'), research.indexes[id], cms, 'originator');
    drawIndex(byId('dash-weighted'), research.indexes[id], cms, 'weighted');
  }
  const reference = snapshot.molecules[id].reference;
  drawChannel(byId('dash-partd'), {title: '美国 Medicare Part D · 年度品牌申报份额',
    quantity: 'claims', moneyLabel: '总药品支出（美元）', reference,
    note: '使用 CMS Overall 行。相同品牌的规格合计，无品牌后缀保持单列。份额以所列品牌可见申报件数为分母，支出为回扣前金额。2020–2024 年年度数据用于历史基线。11 月版 Part D 初表截至 2026Q2，明细尚未入库。',
    link: research.partD.source, file: research.partD.file}, research.partD.rows.filter(row => row.molecule === id));
  const france = research.france.rows.filter(row => row.molecule === id);
  if (france.length) {
    drawChannel(byId('dash-france'), {title: '法国 Open Medic · 年度报销盒数',
      quantity: 'packs', moneyLabel: '实际报销（欧元）', reference,
      note: '法国全险种社区药房报销数据，按品牌汇总。每个包装计一盒，住院及医院返售不在统计范围内。来源为法国国家医疗保险基金 CNAM，Licence Ouverte 2.0。',
      link: research.france.source, showPrice: true}, france);
  } else {
    byId('dash-france').innerHTML = `<h3>法国社区药房</h3><p class="note">品牌分项数据待取得。 ${source(research.france.source, '官方资料')}</p>`;
  }
}

cmsSelect.value = 'pembrolizumab';
cmsSelect.addEventListener('change', () => {
  history.replaceState(null, '', '#dashboard/' + encodeURIComponent(cmsSelect.value));
  updateDashboard();
});
regionSelect.addEventListener('change', updateDashboard);
window.addEventListener('hashchange', updateDashboard);
updateDashboard();
