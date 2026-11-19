import { mountCompanyTrend } from '../pharmacy/company-trend.js';

const number = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2, signDisplay: 'exceptZero' });
const byId = id => document.getElementById(id);
const periodLabel = period => period.replace('H1', ' 上半年').replace('FY', ' 全年');
const financialMetrics = {
  revenue: { label: '收入', unit: '亿元', divisor: 1e8 },
  gross_margin: { label: '毛利率', unit: '%', divisor: 1 },
  revenue_yoy: { label: '披露收入同比', unit: '%', divisor: 1 }
};
const marginNote = '爱尔自 2026-01-01 起将医疗设备维保维修费计入营业成本，毛利率同比受成本分类调整影响。';
const surgeryNote = '爱尔自 2025-01-01 起角膜激光手术改为一眼一例，原为一人一例。2025 年起披露同比采用调整后的上年数，原始手术量曲线在此断开。';

function optionList(select, values, label = String) {
  for (const value of values) select.add(new Option(label(value), value));
}

function cellRow(body, values) {
  const tr = document.createElement('tr');
  values.forEach((value, index) => {
    const cell = document.createElement(index ? 'td' : 'th');
    if (!index) cell.scope = 'row';
    if (value instanceof Node) cell.append(value);
    else cell.textContent = value ?? '—';
    tr.append(cell);
  });
  body.append(tr);
}

function sourceLink(url, title = '原始披露') {
  const node = document.createElement('a');
  node.href = url;
  node.textContent = title;
  node.target = '_blank';
  node.rel = 'noopener';
  return node;
}

function metricText(value, suffix = '', signed = false) {
  return value == null ? '—' : (signed ? percent : number).format(value) + suffix;
}

function aggregate(rows) {
  if (!rows.length) return null;
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const cost = rows.reduce((sum, row) => sum + row.cost, 0);
  return {
    revenue,
    gross_margin: rows.length === 1 ? rows[0].gross_margin : 100 * (1 - cost / revenue),
    revenue_yoy: rows.length === 1 ? rows[0].revenue_yoy : null,
    detail: rows.map(row => row.business).join('、')
  };
}

function mountBusiness(data) {
  const category = byId('business-category');
  const frequency = byId('business-frequency');
  const metric = byId('business-metric');
  const company = byId('business-company');
  const period = byId('business-period');
  const body = byId('business-rows');
  optionList(company, data.companies.map(row => row.code), code => data.companies.find(c => c.code === code).name);
  optionList(period, [...new Set(data.segments.map(row => row.period))].sort().reverse(), periodLabel);
  period.value = '2026H1';
  const figure = byId('business-trend');
  const years = [...new Set(data.segments.map(row => row.period.slice(0, 4)))].sort();
  const renderer = mountCompanyTrend(figure, data.companies, years, {
    defaultCodes: data.companies.map(company => company.code),
    getEnd: years => years.findLastIndex(year => data.segments.some(row => row.period === year + frequency.value)),
    labelTick: () => true,
    getPoints: (company, years) => years.map(year => {
      const point = aggregate(data.segments.filter(row => row.code === company.code &&
        row.period === year + frequency.value && row.category === category.value));
      const value = point?.[metric.value];
      if (value == null) return null;
      const costChange = company.code === '300015' && year === '2026' && metric.value === 'gross_margin';
      const classificationChange = company.code === '301267' && year === '2023' && ['视光', '眼病诊疗'].includes(category.value);
      return { count: value / financialMetrics[metric.value].divisor, detail: point.detail,
        warning: costChange || classificationChange, breakBefore: costChange || classificationChange };
    }),
    describe: point => point ? { value: number.format(point.count) + ' ' + financialMetrics[metric.value].unit, detail: point.detail } : { value: '—' },
    emptyMessage: '当前分类和期间暂无可用披露'
  });

  function renderChart() {
    byId('business-caption').textContent = category.value + ' · ' + frequency.selectedOptions[0].textContent + ' · ' + metric.selectedOptions[0].textContent;
    const notes = [marginNote, '华厦 2022 年的“视光服务项目／综合眼病项目”与后续“眼视光综合项目／眼后段项目”分类有变化，相关曲线在 2023 年断开。'];
    if (metric.value === 'revenue_yoy') notes.push('同一研究分类包含多个原始业务时，同比留空，可逐项查看明细。');
    if (metric.value === 'gross_margin' && category.value === '眼病诊疗') notes.push('眼病诊疗分类合计毛利率按收入和成本加权计算。');
    const note = byId('business-basis-note');
    note.replaceChildren(notes.join(' '), ' ',
      sourceLink('https://pdf.dfcfw.com/pdf/H2_AN202608270006754571_1.pdf#page=33', '爱尔成本口径说明'));
    renderer.refresh();
  }

  function renderTable() {
    const order = ['屈光', '视光', '白内障', '眼病诊疗', '非手术治疗', '其他'];
    const rows = data.segments.filter(row => row.code === company.value && row.period === period.value)
      .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
    body.replaceChildren();
    for (const row of rows) {
      cellRow(body, [row.business, row.category, number.format(row.revenue / 1e8),
        metricText(row.revenue_yoy, '%', true), metricText(row.gross_margin, '%'),
        metricText(row.margin_delta_pp, '', true), sourceLink(row.source)]);
    }
    if (!rows.length) cellRow(body, ['当前公司与期间暂无业务明细', null, null, null, null, null, null]);
    const total = data.activity.find(row => row.code === company.value && row.period === period.value)?.revenue;
    const covered = rows.reduce((sum, row) => sum + row.revenue, 0);
    const share = total && rows.length ? '，已收录业务收入占合并收入 ' + number.format(100 * covered / total) + '%' : '';
    byId('business-status').textContent = periodLabel(period.value) + ' · ' + rows.length + ' 项原始业务' + share + '。';
  }
  for (const control of [category, frequency, metric]) control.addEventListener('change', renderChart);
  for (const control of [company, period]) control.addEventListener('change', renderTable);
  byId('business-controls').hidden = false;
  figure.hidden = false;
  renderChart();
  renderTable();
}

function volumeText(point) {
  return point ? (point.qualifier === '下限' ? '> ' : point.qualifier === '约数' ? '约 ' : '') + number.format(point.value / 1e4) : '—';
}

function mountActivity(data, network) {
  const company = byId('activity-company');
  const frequency = byId('activity-frequency');
  const metric = byId('activity-metric');
  const efficiency = byId('efficiency-period');
  optionList(company, data.companies.map(row => row.code), code => data.companies.find(c => c.code === code).name);
  const periods = [...new Set(data.activity.map(row => row.period))].sort().reverse();
  optionList(efficiency, periods, periodLabel);
  efficiency.value = '2026H1';
  const years = [...new Set(data.activity.map(row => row.period.slice(0, 4)))].sort();
  const figure = byId('activity-trend');
  const renderer = mountCompanyTrend(figure, data.companies, years, {
    defaultCode: '300015',
    getEnd: years => years.findLastIndex(year => data.activity.some(row => row.code === company.value && row.period === year + frequency.value)),
    labelTick: () => true,
    getPoints: (entity, years) => years.map(year => {
      if (entity.code !== company.value) return null;
      const row = data.activity.find(row => row.code === entity.code && row.period === year + frequency.value);
      if (!row) return null;
      const isGrowth = metric.value.endsWith('_yoy');
      const key = metric.value.replace('_yoy', '');
      const value = key === 'revenue' ? row.revenue_yoy : isGrowth ? row[key]?.yoy : row[key]?.value;
      if (value == null) return null;
      const surgeryChange = entity.code === '300015' && year === '2025' && key === 'surgeries' && !isGrowth;
      return { count: isGrowth ? value : value / 1e4, detail: row.volume_scope + '。' + row.note,
        lowerBound: !isGrowth && row[key]?.qualifier === '下限',
        warning: surgeryChange, breakBefore: surgeryChange };
    }),
    describe: point => point ? {
      value: (point.lowerBound ? '> ' : '') + number.format(point.count) + (metric.value.endsWith('_yoy') ? '%' : metric.value === 'surgeries' ? ' 万例／万台（按披露）' : ' 万人次'),
      detail: point.detail
    } : { value: '—' },
    emptyMessage: '该公司在此指标下暂无可用总量披露'
  });
  figure.querySelector('fieldset').hidden = true;

  function renderEfficiency() {
    const body = byId('efficiency-rows');
    body.replaceChildren();
    const row = data.activity.find(row => row.code === company.value && row.period === efficiency.value);
    const date = efficiency.value.slice(0, 4) + (efficiency.value.endsWith('H1') ? '-06-30' : '-12-31');
    const institutions = network.find(c => c.code === company.value)?.records.find(r => r.end === date);
    const scope = row?.volume_scope ?? '当前期间未收录诊疗量';
    let ratio = null;
    let conclusion = '该期未取得可核对的集团门诊总量和机构数。';
    if (row?.outpatients && institutions?.total && ['301239', '301267'].includes(company.value)) {
      ratio = (row.outpatients.qualifier === '下限' ? '> ' : '') + number.format(row.outpatients.value / institutions.total);
      conclusion = '中国内地合并网络，分母含医院及门诊／视光机构。期末机构数 ' + institutions.total + ' 家。';
    }
    if (company.value === '300015') conclusion = '集团诊疗量覆盖境外网络，现有机构序列为中国内地上市公司网络。单机构比值留空。';
    if (company.value === '301103') conclusion = '何氏各级／直营机构口径单列，现有资料尚不足以配对单机构诊疗量。';
    cellRow(body, [scope, institutions?.detail ?? '该日期无机构记录', ratio, conclusion]);
    byId('efficiency-note').textContent = periodLabel(efficiency.value) +
      '。此比值采用期末已开业机构数，未按开业时间加权。新增机构及并购的影响需结合原披露判断。';
  }

  function render() {
    for (const input of figure.querySelectorAll('fieldset input')) input.checked = input.value === company.value;
    const rows = data.activity.filter(row => row.code === company.value && row.period.endsWith(frequency.value));
    const isAier = company.value === '300015';
    byId('activity-caption').textContent = company.selectedOptions[0].textContent + ' · ' +
      frequency.selectedOptions[0].textContent + ' · ' + metric.selectedOptions[0].textContent;
    byId('activity-basis-note').textContent = isAier ? surgeryNote :
      '公司报告中的门诊、手术与筛查统计范围可能不同。此处只收录可明确识别的集团诊疗总量，缺少可用值时显示“—”。';
    if (isAier) byId('activity-basis-note').append(' ',
      sourceLink('https://pdf.dfcfw.com/pdf/H2_AN202508261734903432_1.pdf#page=30', '计数口径原文'));
    const body = byId('activity-rows');
    body.replaceChildren();
    for (const row of [...rows].reverse()) {
      const links = document.createDocumentFragment();
      const sources = [...new Set([row.outpatients?.source, row.surgeries?.source].filter(Boolean))];
      for (const url of sources) links.append(sourceLink(url, '诊疗量'), ' ');
      if (row.revenue_source) links.append(sourceLink(row.revenue_source, '收入'));
      cellRow(body, [periodLabel(row.period), volumeText(row.outpatients), metricText(row.outpatients?.yoy, '%', true),
        volumeText(row.surgeries), metricText(row.surgeries?.yoy, '%', true), metricText(row.revenue == null ? null : row.revenue / 1e8),
        metricText(row.revenue_yoy, '%', true), links]);
    }
    byId('activity-status').textContent = '共 ' + rows.length + ' 个期间，其中 ' +
      rows.filter(row => row.outpatients || row.surgeries).length + ' 期有可用诊疗总量。';
    renderer.refresh();
    renderEfficiency();
  }
  for (const control of [company, frequency, metric]) control.addEventListener('change', render);
  efficiency.addEventListener('change', renderEfficiency);
  byId('activity-controls').hidden = false;
  figure.hidden = false;
  render();
}

async function start() {
  const responses = await Promise.all(['company-operations.json', 'company-network.json'].map(url => fetch(url)));
  if (responses.some(response => !response.ok)) throw new Error('经营数据下载失败');
  const [data, network] = await Promise.all(responses.map(response => response.json()));
  mountBusiness(data);
  mountActivity(data, network);
}
start().catch(error => {
  byId('business-status').textContent = '经营图表暂未加载，可下载业务明细 CSV 查看。';
  byId('activity-status').textContent = '诊疗量暂未加载，可下载诊疗量明细 CSV 查看。';
  console.error(error);
});
