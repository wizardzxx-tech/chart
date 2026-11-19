import { mountCompanyTrend } from '../pharmacy/company-trend.js';

const section = document.querySelector('#company-network');
const figure = section.querySelector('figure');
const metric = section.querySelector('#network-metric');
const range = section.querySelector('#network-range');
const caption = section.querySelector('figcaption');
const status = section.querySelector('#network-status');
const number = new Intl.NumberFormat('zh-CN');
const scopeNote = {
  hospitals: '中国内地眼科医院。爱尔为上市公司网络，排除并购基金机构。何氏各级机构与德视佳全球诊所可分别选择。',
  clinics: '中国内地诊所、视光中心或门诊等机构。机构类型沿用各公司原始披露。',
  heshi: '何氏各级眼保健／直营机构单列。2025 年起披露使用直营机构表述，跨期需核对范围。',
  euro: '德视佳全球诊所、卫星诊所及早期咨询中心。保留 2026-03-31 等实际披露日期。'
};

function valueFor(company, record) {
  if (metric.value === 'euro') return company.code === '01846' ? record.clinics ?? record.total : null;
  if (metric.value === 'heshi') return company.code === '301103' ? record.total : null;
  if (['01846', '301103'].includes(company.code)) return null;
  return record[metric.value];
}

function monthDistance(before, after) {
  return (Number(after.slice(0, 4)) - Number(before.slice(0, 4))) * 12 +
    Number(after.slice(5, 7)) - Number(before.slice(5, 7));
}

function appendCell(tr, content, heading = false) {
  const td = document.createElement(heading ? 'th' : 'td');
  if (heading) td.scope = 'row';
  if (content instanceof Node) td.append(content);
  else td.textContent = content ?? '—';
  tr.append(td);
}
function disclosure(url) {
  const a = document.createElement('a');
  a.href = url;
  a.textContent = '原始披露';
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

async function start() {
  const response = await fetch('company-network.json');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const companies = (await response.json()).map(company => ({
    ...company, records: new Map(company.records.map(record => [record.end, record]))
  }));
  const actualDates = [...new Set(companies.flatMap(company => [...company.records.keys()]))].sort();
  const latest = actualDates.at(-1);
  const firstYear = Number(actualDates[0].slice(0, 4));
  const lastYear = Number(latest.slice(0, 4));
  const dates = new Set(actualDates);
  for (let year = firstYear; year <= lastYear; year++) {
    for (const end of ['06-30', '12-31']) {
      const date = year + '-' + end;
      if (date >= actualDates[0] && date <= latest) dates.add(date);
    }
  }
  const periods = [...dates].sort();
  const chart = mountCompanyTrend(figure, companies, periods, {
    defaultCode: '300015',
    getPoints: (company, dates) => {
      let previous = null;
      return dates.map(date => {
        const record = company.records.get(date);
        const count = record ? valueFor(company, record) : null;
        if (count == null) return null;
        const breakBefore = previous != null && monthDistance(previous, date) > 6;
        previous = date;
        return { count, detail: record.detail, breakBefore };
      });
    },
    describe: point => point ? { value: number.format(point.count) + ' 家', detail: point.detail } : { value: '—' },
    labelTick: period => period.endsWith('12-31') || period === '2026-03-31',
    getStart: dates => range.value === 'all' ? 0 : Math.max(0, dates.findIndex(date => Number(date.slice(0, 4)) >= lastYear - 5)),
    maxGap: () => periods.length,
    emptyMessage: '请选择当前机构范围有披露数据的公司'
  });
  function renderChanges() {
    const body = section.querySelector('#network-changes');
    body.replaceChildren();
    for (const company of companies) {
      const eligible = [...company.records.values()].filter(row => valueFor(company, row) != null).sort((a, b) => a.end.localeCompare(b.end));
      const row = eligible.at(-1);
      if (!row) continue;
      const yearAgo = String(Number(row.end.slice(0, 4)) - 1) + row.end.slice(4);
      const prior = company.records.get(yearAgo);
      const value = valueFor(company, row);
      const priorValue = prior ? valueFor(company, prior) : null;
      const delta = priorValue == null ? null : new Intl.NumberFormat('zh-CN', { signDisplay: 'exceptZero' }).format(value - priorValue);
      const tr = document.createElement('tr');
      appendCell(tr, company.name, true);
      appendCell(tr, row.end);
      appendCell(tr, number.format(value));
      appendCell(tr, delta);
      appendCell(tr, row.detail);
      appendCell(tr, disclosure(row.url));
      body.append(tr);
    }
  }
  function update() {
    const target = metric.value === 'euro' ? '01846' : metric.value === 'heshi' ? '301103' : '300015';
    const controls = [...figure.querySelectorAll('fieldset input')];
    const available = new Set(companies.filter(c => [...c.records.values()].some(r => valueFor(c, r) != null)).map(c => c.code));
    if (!controls.some(input => available.has(input.value) && input.checked)) {
      for (const input of controls) input.checked = input.value === target;
    }
    caption.textContent = metric.selectedOptions[0].textContent + ' · 家';
    section.querySelector('#network-scope').textContent = scopeNote[metric.value];
    chart.refresh();
    renderChanges();
  }
  for (const input of [metric, range]) input.addEventListener('change', update);
  section.querySelector('.eye-network-controls').hidden = false;
  figure.hidden = false;
  update();
}
start().catch(error => {
  status.textContent = '图表暂时无法加载，可展开公司明细或下载 CSV。';
  console.error(error);
});
