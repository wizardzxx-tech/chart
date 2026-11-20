const section = document.getElementById('view-market');
const lookup = id => document.getElementById(id);
const metrics = {
  units: {dataset: 'annual', field: 'units', title: '年度计费剂量份额', raw: '计费单位（10 mg）'},
  spending: {dataset: 'annual', field: 'spending', title: '年度支出份额', raw: '支出（美元）'},
  quarterSpending: {dataset: 'quarterly', field: 'spending', title: '近期支出份额', raw: '支出（美元）'},
  claims: {dataset: 'quarterly', field: 'claims', title: '近期申报份额', raw: '申报次数（Claims）'},
  price: {dataset: 'price', field: 'price', title: '季度支付限额', raw: '美元／10 mg'},
};
const colors = ['#303d43', '#217b69', '#b36a21', '#3965a3', '#975f88', '#6e7b27', '#23798b', '#754e32'];
const pageNumber = new Intl.NumberFormat('zh-CN', {maximumFractionDigits: 2});
const priceFormat = new Intl.NumberFormat('en-US', {minimumFractionDigits: 3, maximumFractionDigits: 3});
const moneyFormat = new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const oneDecimal = new Intl.NumberFormat('zh-CN', {minimumFractionDigits: 1, maximumFractionDigits: 1});
const hasValue = value => typeof value === 'number' && Number.isFinite(value);
const percent = value => hasValue(value) ? oneDecimal.format(value * 100) + '%' : '—';
const escapeHtml = value => {
  const substitutions = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
  return String(value ?? '').replace(/[&<>"']/g, character => substitutions[character]);
};
const outside = (url, label) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
const rate = (value, total) => hasValue(value) && total > 0 ? value / total : null;
const ppChange = (value, baseline) => {
  if (!hasValue(value) || !hasValue(baseline)) return '—';
  const points = Math.round((value - baseline) * 1000) / 10;
  return (points > 0 ? '+' : '') + oneDecimal.format(points) + ' 个百分点';
};
const axisLayout = {left: 51, right: 26, top: 16, bottom: 39};
const combined = {code: 'combined', name: '类似药合计'};
const plotProducts = () => metric.field === 'price' ? group.products : [...group.products, combined];

let data;
let pending;
let group;
let metric;
let currentPeriod;
let chartPeriods = [];
let allPeriods = [];
let entriesByPeriod;
let activeCodes = new Set();
let drawFrame;

function labelFor(period) {
  return data.quarterPeriods[period]?.label || period.replace(/(\d{4})Q([1-4])/, '$1 Q$2');
}

function amount(value, field) {
  if (!hasValue(value)) return '—';
  if (field === 'price') return '$' + priceFormat.format(value);
  if (field === 'spending') return '$' + moneyFormat.format(value);
  return pageNumber.format(value);
}

function referenceValue(period) {
  return entriesByPeriod.get(period).find(entry => entry.product.reference)?.value;
}

function comparePeriod(period) {
  if (metric.dataset === 'annual') return String(Number(period) - 1);
  const match = /^(\d{4})Q([1-4])$/.exec(period);
  if (!match) return '';
  const [, year, quarter] = match;
  return quarter === '1' ? (Number(year) - 1) + 'Q4' : year + 'Q' + (Number(quarter) - 1);
}

function buildSeries() {
  const rows = data[metric.dataset];
  const productMap = new Map(group.products.filter(product => product.code).map(product => [product.code, product]));
  allPeriods = [...new Set(rows.filter(row => productMap.has(row.code)).map(row => row.period))].sort();
  chartPeriods = allPeriods.filter(period => metric.dataset !== 'quarterly' || data.quarterPeriods[period].kind === 'quarter');
  entriesByPeriod = new Map();
  for (const period of allPeriods) {
    const source = rows.filter(row => row.period === period && productMap.has(row.code));
    const total = source.reduce((sum, row) => sum + (row[metric.field] ?? 0), 0);
    entriesByPeriod.set(period, source.map(row => ({
      product: productMap.get(row.code), value: row[metric.field],
      share: metric.field === 'price' ? null : rate(row[metric.field], total), outlier: row.outlier,
    })));
  }
}

function chartColors() {
  return new Map(plotProducts().map((product, i) => [
    product.code, product === combined ? '#155847' : colors[i % colors.length],
  ]));
}

function drawChart() {
  const canvas = lookup('share-canvas');
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  const series = chartPeriods.flatMap(period => entriesByPeriod.get(period));
  const price = metric.field === 'price';
  const upper = price ? Math.ceil(Math.max(25, ...series.map(row => row.value || 0)) / 25) * 25 : 1;
  const areaWidth = width - axisLayout.left - axisLayout.right;
  const areaHeight = height - axisLayout.top - axisLayout.bottom;
  const x = index => chartPeriods.length === 1
    ? axisLayout.left + areaWidth / 2
    : axisLayout.left + areaWidth * index / Math.max(1, chartPeriods.length - 1);
  const y = value => axisLayout.top + areaHeight * (1 - value / upper);
  ctx.font = '11px system-ui';
  ctx.fillStyle = '#52646a';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const t = upper * i / 4;
    ctx.strokeStyle = '#dce7df';
    ctx.beginPath();
    ctx.moveTo(axisLayout.left, y(t));
    ctx.lineTo(width - axisLayout.right, y(t));
    ctx.stroke();
    ctx.fillText(price ? '$' + pageNumber.format(t) : Math.round(t * 100) + '%', axisLayout.left - 8, y(t));
  }
  const selected = chartPeriods.indexOf(currentPeriod);
  if (selected >= 0) {
    ctx.strokeStyle = '#7c9389';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(x(selected), axisLayout.top);
    ctx.lineTo(x(selected), height - axisLayout.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.textAlign = 'center';
  const tickEvery = Math.max(1, Math.ceil(chartPeriods.length / Math.max(2, Math.floor(areaWidth / 70))));
  chartPeriods.forEach((period, i) => {
    if (i !== 0 && i !== chartPeriods.length - 1 &&
        (i % tickEvery || chartPeriods.length - 1 - i < tickEvery)) return;
    ctx.fillText(labelFor(period), x(i), height - 15);
  });
  const swatches = chartColors();
  for (const [index, product] of plotProducts().entries()) {
    const code = product.code;
    if (!activeCodes.has(code)) continue;
    ctx.strokeStyle = swatches.get(code);
    ctx.fillStyle = swatches.get(code);
    ctx.lineWidth = product.reference || product === combined ? 2.8 : 1.9;
    ctx.setLineDash(product === combined ? [7, 4] : index > 4 ? [3, 3] : []);
    let connected = false;
    const points = [];
    ctx.beginPath();
    chartPeriods.forEach((period, i) => {
      const entries = entriesByPeriod.get(period);
      const row = entries.find(entry => entry.product.code === code);
      let value = price ? row?.value : row?.share;
      if (product === combined && entries.some(entry => entry.product.reference && hasValue(entry.share))) {
        value = entries.filter(entry => !entry.product.reference)
          .reduce((sum, entry) => sum + (entry.share ?? 0), 0);
      }
      if (!hasValue(value)) {
        connected = false;
        return;
      }
      const point = [x(i), y(value), i];
      points.push(point);
      if (connected) ctx.lineTo(point[0], point[1]);
      else ctx.moveTo(point[0], point[1]);
      connected = true;
    });
    ctx.stroke();
    ctx.setLineDash([]);
    for (const [px, py, i] of points) {
      ctx.beginPath();
      ctx.arc(px, py, selected === i ? 4 : 2.35, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}

function updateChart() {
  cancelAnimationFrame(drawFrame);
  drawFrame = requestAnimationFrame(drawChart);
}

function renderLegend() {
  const swatches = chartColors();
  const seen = new Set(chartPeriods.flatMap(period =>
    entriesByPeriod.get(period).filter(row => hasValue(row.value)).map(row => row.product.code)));
  lookup('share-legend').innerHTML = plotProducts().filter(product => product === combined || seen.has(product.code)).map(product =>
    `<button class="series-key" type="button" data-code="${escapeHtml(product.code)}" aria-pressed="${activeCodes.has(product.code)}">
      <i style="--series-color:${swatches.get(product.code)}"></i>${escapeHtml(product.name)}${product.reference ? ' · 原研' : ''}</button>`
  ).join('');
}

function dataRow(entry, previous) {
  const price = metric.field === 'price';
  const comparison = price ? rate(entry.value, referenceValue(currentPeriod)) : entry.share;
  let change = '—';
  if (previous) {
    if (price && hasValue(entry.value) && hasValue(previous.value) && previous.value > 0) {
      const ratio = entry.value / previous.value - 1;
      change = (ratio > 0 ? '+' : '') + percent(ratio);
    } else if (!price) change = ppChange(entry.share, previous.share);
  }
  const relative = price && hasValue(comparison)
    ? entry.product.reference ? '基准' : (comparison <= 1 ? '折价 ' : '溢价 ') + percent(Math.abs(1 - comparison))
    : percent(comparison);
  return [amount(entry.value, metric.field), relative, change];
}

function renderEvidence() {
  const price = metric.field === 'price';
  const active = [...(entriesByPeriod.get(currentPeriod) || [])];
  if (price) active.sort((a, b) => Number(Boolean(b.product.reference)) - Number(Boolean(a.product.reference)) ||
    (a.value ?? Infinity) - (b.value ?? Infinity));
  const rows = active.filter(row => hasValue(row.value));
  const original = rows.find(row => row.product.reference);
  const summation = rows.reduce((sum, row) => sum + row.value, 0);
  const biosimilars = rows.filter(row => !row.product.reference).reduce((sum, row) => sum + row.value, 0);
  const previous = entriesByPeriod.get(comparePeriod(currentPeriod)) || [];
  const changeLabel = metric.dataset === 'annual' ? '同比变化' : '环比变化';
  const listTitle = metric.dataset === 'quarterly' ? labelFor(currentPeriod) + ' · 初步'
    : labelFor(currentPeriod);
  lookup('market-period-label').textContent = listTitle;
  lookup('market-summary').innerHTML = `<div><span>参照原研</span><strong>${escapeHtml(group.reference)}</strong></div>
    <div><span>${price ? '原研支付限额／10 mg' : '类似药合计份额'}</span><strong>${
      price ? amount(original?.value, 'price') : percent(original ? rate(biosimilars, summation) : null)}</strong></div>
    <div><span>本期有数据的品牌</span><strong>${rows.length}</strong></div>`;
  const headings = price ? [metric.raw, '相对原研折溢价', changeLabel] : ['份额', changeLabel, metric.raw];
  lookup('market-table').innerHTML = `<table>
    <thead><tr><th scope="col">品牌</th>${headings.map(title => `<th scope="col">${title}</th>`).join('')}
    <th scope="col">HCPCS</th></tr></thead>
    <tbody>${active.map(entry => {
      const {product} = entry;
      const [raw, relative, delta] = dataRow(entry, previous.find(row => row.product.code === product.code));
      const values = price ? [raw, relative, delta] : [relative, delta, raw];
      return `<tr><th scope="row">${escapeHtml(product.name)}${product.reference ? '<small>原研</small>' : ''}</th>
        ${values.map(value => `<td class="market-value">${value}</td>`).join('')}<td>${product.code}</td></tr>`;
    }).join('')}</tbody>
    ${price ? '' : `<tfoot><tr><th scope="row">已纳入编码合计</th>
      <td>${summation ? '100.0%' : '—'}</td><td>—</td><td class="market-value">${amount(summation, metric.field)}</td><td>—</td></tr></tfoot>`}
    </table>`;
  lookup('market-codes').innerHTML = `<p>${escapeHtml(group.scope)}</p>
    <p>本期计入 ${rows.map(row => `${escapeHtml(row.product.name)}（${row.product.code}）`).join('、') || '无可用数据'}。
    不公开或未收录的值保留为空。隐藏曲线时，份额分母仍按以上编码计算。</p>
    ${rows.some(row => row.outlier) ? '<p>CMS 标记本期存在每剂量单位支出异常值。计费剂量与支出仍按原表列示。</p>' : ''}
    ${previous.length && rows.length !== previous.filter(row => hasValue(row.value)).length
      ? '<p>与上期的可见品牌数不同，份额变化也反映统计范围的变化。</p>' : ''}`;
  const source = metric.dataset === 'price' ? data.sources.payment : data.sources[metric.dataset];
  const detail = metric.dataset === 'price'
    ? outside(data.paymentPeriods[currentPeriod].url, '本期 CMS 原表')
    : outside(source.file, 'CMS 原表 CSV');
  lookup('market-source').innerHTML = [outside(source.link, 'CMS 数据入口'), detail,
    ...(source.method ? [outside(source.method, '季度方法说明')] : [])].join(' · ');
  updateChart();
}

function renderMilestones() {
  lookup('market-status').innerHTML = `<table><thead><tr>
    <th scope="col">品牌</th><th scope="col">FDA 获批</th><th scope="col">美国商业上市</th>
    <th scope="col">本库最早可见医保申报</th><th scope="col">企业与权益</th>
    </tr></thead><tbody>${group.products.map(product => {
      const approved = product.approval ? outside(product.approval.source, product.approval.date || 'FDA 记录') : '—';
      const launch = product.launch ? outside(product.launch.source, product.launch.date) : '待核实';
      const observed = product.firstClaim ? labelFor(product.firstClaim) : '待核实';
      const asset = product.assetId ? `<small><a href="#pipeline/${encodeURIComponent(group.id)}">${escapeHtml(product.assetId)} · 管线</a></small>` : '';
      return `<tr><th scope="row">${escapeHtml(product.name)}${product.reference ? '<small>原研</small>' : ''}</th>
        <td>${approved}${product.approval?.code ? `<small>${escapeHtml(product.approval.code)}</small>` : ''}</td>
        <td>${launch}</td><td>${escapeHtml(observed)}</td>
        <td>${escapeHtml(product.roles || product.approval?.holder || '—')}${asset}</td></tr>`;
    }).join('')}</tbody></table>
    <p class="note">首次可见申报的起点取决于本库数据覆盖。企业关系按公开披露和 FDA 许可持有人列示。</p>`;
  lookup('market-approvals').href = '#approvals/' + group.id;
}

function renderMetric() {
  metric = metrics[lookup('cms-metric').value];
  buildSeries();
  const periodSelect = lookup('market-period');
  currentPeriod = allPeriods.at(-1);
  periodSelect.replaceChildren(...allPeriods.map(period => new Option(labelFor(period), period)));
  periodSelect.value = currentPeriod;
  activeCodes = new Set(plotProducts().map(product => product.code));
  lookup('market-chart-title').textContent = metric.title;
  lookup('market-metric-note').textContent = {
    annual: '传统 Medicare Part B 年度档。份额分母为同分子、同剂型范围内本期可见的计费编码。',
    quarterly: `CMS 初步数据 · ${data.sources.quarterly.version} 版。曲线只展示单季度，可在期间选择器中查看全年初步数据。季度数据会修订。`,
    price: '按美元／10 mg 展示各季度生效的 CMS 支付限额。明细按支付限额从低到高排列，以同季度原研为折溢价基准。',
  }[metric.dataset];
  lookup('market-chart-note').textContent =
    chartPeriods.length < 2 ? '当前只有一个可单独比较的季度，先显示该期数据点。'
      : '点击图上日期或用期间选择器查看明细。缺失值对应断点。';
  lookup('share-canvas').setAttribute('aria-label', group.label + ' · ' + metric.title + '。精确值见期间明细表。');
  renderLegend();
  renderEvidence();
}

function renderGroup(id) {
  group = data.groups.find(candidate => candidate.id === id) || data.groups[0];
  lookup('cms-molecule').value = group.id;
  renderMetric();
  renderMilestones();
}

function setPeriod(period) {
  currentPeriod = period;
  lookup('market-period').value = period;
  renderEvidence();
}

function marketRoute() {
  const [view, selection] = location.hash.slice(1).split('/');
  if (view !== 'market') return;
  return selection || lookup('cms-molecule').value || 'trastuzumab';
}

async function showMarket() {
  const requested = marketRoute();
  if (!requested) return;
  if (data) {
    renderGroup(requested);
    return;
  }
  if (pending) return;
  const status = lookup('market-loading');
  status.textContent = '正在读取 CMS 数据。';
  pending = fetch(new URL('./data/medicare.json', import.meta.url)).then(response => {
    if (!response.ok) throw new Error('CMS snapshot HTTP ' + response.status);
    return response.json();
  }).then(snapshot => {
    data = snapshot;
    lookup('cms-molecule').replaceChildren(...data.groups.map(item => new Option(item.label, item.id)));
    if (marketRoute()) renderGroup(marketRoute());
    status.hidden = true;
    lookup('market-content').hidden = false;
    updateChart();
  }).catch(() => {
    data = null;
    status.textContent = 'CMS 数据暂时无法读取。';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'outline';
    retry.textContent = '重新加载';
    retry.addEventListener('click', showMarket, {once: true});
    status.append(' ', retry);
  }).finally(() => {
    pending = null;
  });
}

lookup('cms-molecule').addEventListener('change', event => {
  renderGroup(event.target.value);
  history.replaceState(null, '', '#market/' + group.id);
});
lookup('cms-metric').addEventListener('change', renderMetric);
lookup('market-period').addEventListener('change', event => setPeriod(event.target.value));
lookup('share-legend').addEventListener('click', event => {
  const button = event.target.closest('[data-code]');
  if (!button) return;
  const code = button.dataset.code;
  if (activeCodes.has(code)) activeCodes.delete(code);
  else activeCodes.add(code);
  button.setAttribute('aria-pressed', activeCodes.has(code));
  updateChart();
});
lookup('share-canvas').addEventListener('click', event => {
  if (!chartPeriods.length) return;
  const width = event.currentTarget.clientWidth - axisLayout.left - axisLayout.right;
  const coordinate = event.offsetX - axisLayout.left;
  const index = Math.max(0, Math.min(chartPeriods.length - 1, Math.round(coordinate / width * (chartPeriods.length - 1))));
  setPeriod(chartPeriods[index]);
});
lookup('market-export').addEventListener('click', () => {
  const header = ['分子', '期间', '品牌', 'HCPCS', metric.raw, '本期份额或相对原研', '原始数据'];
  const exported = allPeriods.flatMap(period => entriesByPeriod.get(period).map(entry => [
    group.label, labelFor(period), entry.product.name, entry.product.code,
    entry.value, metric.field === 'price' ? percent(rate(entry.value, referenceValue(period))) : percent(entry.share),
    metric.field === 'price' ? data.paymentPeriods[period].url : data.sources[metric.dataset].file,
  ]));
  window.downloadCsv(group.id + '-' + metric.field, header, exported);
});
new ResizeObserver(() => {
  if (!section.hidden && group) updateChart();
}).observe(lookup('share-canvas'));
window.addEventListener('hashchange', showMarket);
showMarket();
