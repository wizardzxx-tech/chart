import { mountCompanyTrend } from '../pharmacy/company-trend.js';

const section = document.querySelector('#lot-release');
const get = id => section.querySelector('#lot-' + id);
const number = new Intl.NumberFormat('zh-CN');
const collator = new Intl.Collator('zh-CN', { numeric: true });
const grain = get('grain');
const filters = [...section.querySelectorAll('[data-lot-filter]')];
const filterColumns = {agency:3, company:4, holder:5, category:6, product:7, origin:8, program:9};
const periodColumns = {year:0, month:1, quarter:2};
const timeLabels = {year:'年度', month:'月度', quarter:'季度'};
const dependentFilters = ['holder','category','product'];
const status = get('status');
const pageSize = 16;

function chartPeriods(data, mode) {
  const dates = [];
  const [startYear,startMonth] = data.start.split('-').map(Number);
  const [endYear,endMonth] = data.end.split('-').map(Number);
  for (let month = startYear * 12 + startMonth - 1; month < endYear * 12 + endMonth; month++) {
    const y = Math.floor(month / 12);
    const m = month % 12 + 1;
    dates.push(mode === 'year' ? String(y) : mode === 'quarter' ? y + 'Q' + Math.ceil(m / 3) :
      y + '-' + String(m).padStart(2,'0'));
  }
  return [...new Set(dates)];
}

function cell(value, heading = false) {
  const node = document.createElement(heading ? 'th' : 'td');
  if (heading) node.scope = 'row';
  node.textContent = value;
  return node;
}

function mount(data) {
  const chart = get('trend');
  let shown = [], page = 0;
  const body = get('table-wrap').querySelector('tbody');

  function setOptions(filter, values) {
    const prior = filter.value;
    filter.length = 1;
    for (const value of [...values].sort(collator.compare)) filter.add(new Option(value,value));
    if (values.has(prior)) filter.value = prior;
  }

  for (const filter of filters) {
    if (dependentFilters.includes(filter.dataset.lotFilter)) continue;
    const values = new Set(data.rows.map(row=>row[filterColumns[filter.dataset.lotFilter]]));
    setOptions(filter, values);
  }

  function matches(row, id) {
    const selected = get(id).value;
    return !selected || selected === row[filterColumns[id]];
  }

  function updateDependentFilters() {
    const companyRows = data.rows.filter(row=>matches(row,'company'));
    const holders = new Set(companyRows.map(row=>row[filterColumns.holder]));
    setOptions(get('holder'), holders);
    const holderRows = companyRows.filter(row=>matches(row,'holder'));
    setOptions(get('category'), new Set(holderRows.map(row=>row[filterColumns.category])));
    const categoryRows = holderRows.filter(row=>matches(row,'category'));
    setOptions(get('product'), new Set(categoryRows.map(row=>row[filterColumns.product])));
  }

  function renderPage() {
    const totalPages = Math.max(1, Math.ceil(shown.length / pageSize));
    body.replaceChildren(...shown.slice(page * pageSize,(page + 1) * pageSize).map(([period,category,company,count])=>{
      const tr = document.createElement('tr');
      tr.append(cell(period,true),cell(category),cell(company),cell(number.format(count)));
      return tr;
    }));
    get('table-wrap').hidden = !shown.length;
    get('pagination').hidden = totalPages === 1;
    get('prev').disabled = page === 0;
    get('next').disabled = page + 1 === totalPages;
    get('page').textContent = `第 ${page + 1} / ${totalPages} 页`;
  }

  const byPeriod = new Map();
  const charts = Object.fromEntries(['month','year','quarter'].map(mode=>{
    const figure = mode === 'quarter' ? chart : chart.cloneNode(true);
    if (figure !== chart) {
      figure.id = 'lot-trend-' + mode;
      figure.querySelector('fieldset').replaceChildren();
      const caption = figure.querySelector('figcaption');
      caption.id = 'lot-caption-' + mode;
      caption.textContent = timeLabels[mode] + '批签发批次数';
      figure.querySelector('canvas').setAttribute('aria-labelledby',caption.id);
      figure.querySelector('#lot-chart-help').remove();
      chart.after(figure);
    }
    const renderer = mountCompanyTrend(figure,[{code:'total',name:'获签批次'}],chartPeriods(data,mode),{
      defaultCode:'total',
      labelTick:()=>true,
      getPoints:(_company, dates)=>dates.map(date=>({count:byPeriod.get(date) ?? 0})),
      describe:point=>point ? {value:number.format(point.count)+' 批'} : {value:'—'},
    });
    return [mode,{figure,renderer}];
  }));
  function render() {
    updateDependentFilters();
    const mode = grain.value;
    const filtered = data.rows.filter(row=>filters.every(filter=>!filter.value ||
      row[filterColumns[filter.dataset.lotFilter]] === filter.value));
    const totals = new Map();
    byPeriod.clear();
    let total = 0, unassigned = 0;
    const agencies = new Set();
    for (const row of filtered) {
      const period = row[periodColumns[mode]];
      const n = row[10];
      total += n;
      agencies.add(row[3]);
      if (period.startsWith('跨')) unassigned += n;
      else byPeriod.set(period,(byPeriod.get(period) ?? 0) + n);
      const key = JSON.stringify([period,row[6],row[4]]);
      totals.set(key,(totals.get(key) ?? 0) + n);
    }
    get('count').textContent = number.format(total);
    get('agency-count').textContent = agencies.size;
    get('unassigned-label').textContent = mode === 'month' ? '跨月未归期' : '跨季未归期';
    get('unassigned').parentElement.hidden = mode === 'year';
    get('unassigned').textContent = number.format(unassigned);
    get('caption').textContent = timeLabels[mode] + '批签发批次数';
    shown = [...totals].map(([key,n])=>[...JSON.parse(key),n])
      .sort((a,b)=>collator.compare(a[0],b[0]) || b[3] - a[3] || collator.compare(a[2],b[2]));
    page = 0;
    renderPage();
    status.textContent = filtered.length ? `当前筛选汇总 ${shown.length} 条` : '当前筛选在本次公示中暂无匹配。';
    for (const [key,{figure,renderer}] of Object.entries(charts)) {
      figure.hidden = key !== mode || !filtered.length;
      if (!figure.hidden) renderer.refresh();
    }
  }

  for (const control of [grain,...filters]) control.addEventListener('change',render);
  get('reset').addEventListener('click',()=>{
    grain.value = 'quarter';
    for (const filter of filters) filter.value = '';
    render();
  });
  get('prev').addEventListener('click',()=>{page--;renderPage();});
  get('next').addEventListener('click',()=>{page++;renderPage();});
  get('controls').hidden = false;
  render();
}

try {
  const response = await fetch('lot-release.json');
  if (!response.ok) throw new Error('数据暂不可用');
  mount(await response.json());
} catch {
  status.textContent = '交互数据暂未加载，可下载汇总 CSV 或查看官方公示。';
}
