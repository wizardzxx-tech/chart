import {mountCompanyTrend} from '../pharmacy/company-trend.js';

const company = document.querySelector('#blood-company');
const year = document.querySelector('#blood-year');
const basis = document.querySelector('#blood-basis');
const status = document.querySelector('#blood-status');
const tbody = document.querySelector('#blood-company-rows');
const controls = company.closest('form');
const formatter = new Intl.NumberFormat('en-US', {maximumFractionDigits: 2});
const moneyFormatter = new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const quantity = (n, prefix = '') => n == null ? '—' : prefix + formatter.format(n);
const money = n => n == null ? '—' : moneyFormatter.format(n / 1e8);
const perTon = (n, mark) => {
  if (n == null) return '—';
  if (mark === '超') return '＜' + moneyFormatter.format(Math.ceil(n * 100) / 100);
  return (mark ? '约' : '') + moneyFormatter.format(n);
};

function child(parent, tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  parent.append(node);
  return node;
}

function appendSources(parent, row) {
  const details = child(parent, 'details');
  details.className = 'blood-source';
  child(details, 'summary', '查来源');
  for (const [label, part] of [
    ['本年采浆与浆站', row.ops],
    ['本年血制品收入与成本', row.pnl],
    ['上年采浆量', row.metrics]
  ]) {
    if (!part) continue;
    child(details, 'b', label);
    if (part.note) child(details, 'p', part.note);
    for (const source of part.sources) {
      const link = child(details, 'a', source.title);
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener';
    }
  }
}

function initTrend(data) {
  const figure = document.querySelector('.blood-trend');
  const metric = document.querySelector('#blood-chart-metric');
  const metricBasis = document.querySelector('#blood-chart-basis');
  const caption = document.querySelector('#blood-chart-caption');
  const canvas = figure.querySelector('canvas');
  const companies = data.companies.map(c => ({
    ...c,
    name: c.code === '688765' ? c.name + '（重组）' : c.name,
    annual: new Map((c.code === '688765' ? data.recombinant : c.rows).map(row => [row.year,row]))
  }));
  const years = companies.flatMap(c=>[...c.annual.keys()]);
  const firstYear = Math.min(...years);
  const timeline = Array.from({length:Math.max(...years)-firstYear+1},(_,i)=>String(firstYear+i));
  const isPerTon = () => metric.value === 'revenue' || metric.value === 'profit';

  function readPoint(company, year) {
    const row = company.annual.get(Number(year));
    if (!row) return null;
    const field = metric.value;
    if (company.code === '688765') {
      if (field !== 'alb') return null;
      const previous = company.annual.get(Number(year)-1);
      return {count:row.revenue/1e8, detail:row.scope, breakBefore:previous?.scope!==row.scope};
    }
    if (field === 'volume') {
      const {volume,volumeMark} = row.ops ?? {};
      return Number.isFinite(volume) ? {count:volume, estimate:volumeMark} : null;
    }
    if (!isPerTon()) {
      const revenue = row.pnl?.[field];
      return Number.isFinite(revenue) ? {count:revenue/1e8} : null;
    }
    const {metrics,pnl} = row;
    const key = metricBasis.value === 'reported' ? (field==='revenue'?'reportedRevenue':'reportedProfit') : field;
    if (!Number.isFinite(metrics?.[key])) return null;
    const scopeChanged = pnl?.note.includes('前一年采浆与收入范围不同');
    const detail = `${metrics.priorYear} 年采浆量 ${quantity(metrics.priorVolume,metrics.priorMark)} 吨` +
      (scopeChanged ? ' · 并表范围变化' : '');
    return {count:metrics[key], estimate:metrics.priorMark, detail};
  }

  const chart = mountCompanyTrend(figure,companies,timeline,{
    defaultCode:'600161',
    getPoints:(company,periods)=>periods.map(year=>readPoint(company,year)),
    labelTick:()=>true,
    emptyMessage:'勾选有数据的公司后查看趋势',
    describe(point) {
      if (!point) return {value:'—'};
      const amount = isPerTon() ? perTon(point.count,point.estimate) :
        metric.value === 'volume' ? quantity(point.count,point.estimate) : moneyFormatter.format(point.count);
      return {value:amount+' '+metric.selectedOptions[0].dataset.unit,detail:point.detail};
    }
  });
  function update() {
    const option = metric.selectedOptions[0];
    caption.textContent = `${option.textContent}（${option.dataset.unit}）`;
    canvas.setAttribute('aria-label', caption.textContent+'年度折线图');
    document.querySelector('#blood-chart-basis-label').hidden = !isPerTon();
    document.querySelector('#blood-chart-recombinant-note').hidden = metric.value !== 'alb';
    chart?.refresh();
  }
  metric.addEventListener('change',update);
  metricBasis.addEventListener('change',update);
  update();
}

async function init() {
  const response = await fetch('data.json');
  if (!response.ok) throw Error('血制品数据不可用');
  const data = await response.json();
  const observations = data.companies.flatMap(c => c.rows.map(row => ({...row, code:c.code, name:c.name})));
  observations.sort((a,b) => b.year - a.year);
  function render() {
    const selected = observations.filter(r => (company.value==='all'||r.code===company.value) &&
      (year.value==='all'||String(r.year)===year.value));
    const report = basis.value === 'reported';
    const fragment = document.createDocumentFragment();
    for (const row of selected) {
      const {ops,pnl,metrics} = row;
      const tr = child(fragment, 'tr');
      child(tr, 'th', row.name).scope = 'row';
      for (const cell of [String(row.year), quantity(ops?.volume,ops?.volumeMark),quantity(ops?.stations),quantity(ops?.active),
        money(pnl?.total),money(pnl?.alb),money(pnl?.imported),money(pnl?.ivig),money(pnl?.other),money(pnl?.cost),
        quantity(metrics?.priorVolume,metrics?.priorMark)]) {
        child(tr, 'td', cell);
      }
      const scopeChanged = pnl?.note.includes('前一年采浆与收入范围不同');
      for (const value of [report?metrics?.reportedRevenue:metrics?.revenue,report?metrics?.reportedProfit:metrics?.profit]) {
        const cell = child(tr, 'td', perTon(value,metrics?.priorMark));
        if (scopeChanged && value != null) {
          child(cell,'sup','†');
          cell.title = pnl.note;
        }
      }
      appendSources(child(tr, 'td'), row);
    }
    tbody.replaceChildren(fragment);
    status.textContent = selected.length ? `${selected.length} 条年度记录` : '当前筛选下无记录。';
  }
  controls.addEventListener('change', render);
  controls.hidden = false;
  render();
  initTrend(data);
}
init().catch(() => { status.textContent='公司数据暂时无法加载，可下载 CSV。'; });

