import { mountCompanyTrend } from '../pharmacy/company-trend.js';

const section = document.querySelector('#working-capital');
const status = section.querySelector('.capital-status');
const precision = new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const days = value => Number.isFinite(value) ? precision.format(value) : '—';

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function sourceLink(name, url, title) {
  const link = element('a', name);
  link.href = url;
  link.title = title;
  link.target = '_blank';
  link.rel = 'noopener';
  return link;
}

async function start() {
  const response = await fetch(new URL('working-capital.json',document.baseURI));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const companies = data.companies.map(c => ({
    name:c.name, code:c.code, periods:new Map(c.records.map(r=>[r[0],r]))
  }));
  const panel = section.querySelector('.capital-interactive');
  const figure = section.querySelector('.capital-trend');
  const mode = section.querySelector('#capital-mode');
  const metric = section.querySelector('#capital-metric');
  const range = section.querySelector('#capital-range');
  const period = section.querySelector('#capital-period');
  const issuer = section.querySelector('#capital-company');
  const table = section.querySelector('tbody');
  const periods = Array.from(new Set(companies.flatMap(c=>[...c.periods.keys()]))).sort();
  for (const quarter of [...periods].reverse()) period.add(new Option(quarter,quarter));
  period.value = data.latest;
  section.querySelector('[data-capital-latest]').textContent=data.latest;
  for (const company of companies) issuer.add(new Option(company.name,company.code));
  const trend = mountCompanyTrend(figure,companies,periods,{
    defaultCode: companies.some(c=>c.code==='603939') ? '603939' : '600161',
    emptyMessage: '勾选公司后查看周转天数',
    getStart: dates => range.value==='all' ? 0 : Math.max(0,dates.length-Number(range.value)),
    getPoints: (company,dates) => dates.map(quarter => {
      const observation = company.periods.get(quarter)?.[Number(mode.value)];
      const value = observation?.[0]?.[Number(metric.value)];
      if (!Number.isFinite(value)) return null;
      return {count:value, detail:observation[1].map(n=>n.quarter+' '+n.title).join(' · ')};
    }),
    describe: point => point ? {value:days(point.count)+' 天',detail:point.detail} : {value:'—'}
  });

  function renderTable() {
    const filtered = issuer.value === 'all' ? companies : companies.filter(c=>c.code===issuer.value);
    const chosenPeriods = period.value === 'all' ? [...periods].reverse() : [period.value];
    const rows = [];
    for (const quarter of chosenPeriods) {
      for (const c of filtered) {
        const record = c.periods.get(quarter);
        if (!record) continue;
        const [values, notes, missing] = record[Number(mode.value)];
        const tr = document.createElement('tr');
        tr.dataset.company = c.code;
        tr.dataset.quarter = quarter;
        const heading = element('th',c.name);
        heading.scope = 'row';
        const source = document.createElement('td');
        if (notes.length || missing) {
          const details = document.createElement('details');
          details.append(element('summary', notes.length ? notes.map(n=>n.title).join('；') : missing));
          for (const note of notes) {
            const p = element('p',note.quarter+' '+note.text+' ');
            if (note.source) p.append(sourceLink('查看披露',note.source.url,note.source.title));
            details.append(p);
          }
          if (notes.length && missing) details.append(element('p',missing));
          source.append(details);
        }
        if (record[3]) source.append(sourceLink('当期报告',record[3].url,record[3].title));
        else if (record[4]) source.append(sourceLink('合并报表',record[4],c.name+'财务分析'));
        tr.append(heading,element('td',quarter),...values.map(v=>element('td',days(v))),source);
        rows.push(tr);
      }
    }
    table.replaceChildren(...rows);
    status.textContent = rows.length ? `显示 ${rows.length} 条记录` : '该公司在所选季度暂无记录。';
  }

  function refreshChart() {
    section.querySelector('#capital-caption').textContent =
      `${metric.selectedOptions[0].text} · ${mode.value==='1'?'TTM 方法 C':'单季'} · 天`;
    trend.refresh();
  }

  period.add(new Option('全部季度','all'));
  mode.addEventListener('change', () => {refreshChart();renderTable();});
  metric.addEventListener('change', refreshChart);
  range.addEventListener('change', refreshChart);
  period.addEventListener('change', renderTable);
  issuer.addEventListener('change', renderTable);
  panel.hidden = false;
  refreshChart();
  renderTable();
}
start().catch(() => {
  status.textContent = '暂时无法加载数据，可下载上方 CSV。';
});
