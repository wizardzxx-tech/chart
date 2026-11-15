import {mountCompanyTrend} from '../pharmacy/company-trend.js';

const int = new Intl.NumberFormat('en-US');
const pct = value => value.toFixed(1)+'%';
const categories = ['进口','国产','待核'];
const shades = ['albumin-import','albumin-domestic','albumin-unknown'];
const byId = id => document.getElementById(id);
const node = (tag, className, text = '') => Object.assign(document.createElement(tag), {className, textContent:text});

function renderOrigin(data, mode, basis) {
  const observed = basis === 'observed';
  const share = mode === 'share';
  const records = data.reconciliation.map(entry => {
    if (observed) {
      const total = entry.observed.reduce((a,b)=>a+b,0);
      return [entry.period, share ? entry.observed.map(count=>100*count/total) : entry.observed];
    }
    const row = entry.published;
    return [entry.period, share ? [row.importShare,row.domesticShare,0] :
      row.imported == null ? null : [row.imported,row.domestic,0]];
  });
  const maxValue = Math.max(...records.map(([,values])=>values ? values.reduce((a,b)=>a+b,0) : 0));
  const cap = share ? 100 : Math.ceil(maxValue/2000)*2000;
  const format = value => share ? pct(value) : int.format(value)+' 批';
  const bars = byId('albumin-bars');
  byId('albumin-origin-caption').textContent = (observed ? '本站逐批采集' : '行业公开统计')+' · '+(share ? '批次构成' : '批次数');
  const keys = observed ? categories : categories.slice(0,2);
  byId('albumin-origin-chart').querySelector('.blood-research-scale').replaceChildren(...keys.map((key,index) =>
    node('span','albumin-key '+shades[index],key)));
  bars.replaceChildren(...records.map(([period, values]) => {
    const column = node('div','albumin-column'+(period.endsWith('H1')?' albumin-half':''));
    const track = node('div','albumin-track');
    if (values) {
      const tooltip = node('div','albumin-value');
      tooltip.textContent = period+' · '+values.flatMap((value,index)=>
        index===2 && !observed ? [] : [categories[index]+' '+format(value)]).join(' / ');
      track.tabIndex = 0;
      track.setAttribute('role','img');
      track.setAttribute('aria-label',tooltip.textContent);
      values.forEach((value,index)=>{
        if (!value) return;
        const slice = node('span','albumin-segment '+shades[index]);
        slice.style.height = 100*value/cap+'%';
        slice.setAttribute('aria-hidden','true');
        if (index===0 && value/cap > .27) slice.textContent = share ? pct(value) : int.format(value);
        track.append(slice);
      });
      column.append(track,tooltip);
    } else {
      track.append(node('span','albumin-missing','—'));
      track.setAttribute('aria-label',period+'公开绝对批次数未标示');
      column.append(track);
    }
    column.append(node('span','albumin-period',period));
    return column;
  }));
  byId('albumin-series-note').textContent = observed && share ?
    '本站图中待核批次计入总数。下方核对表用已知来源地的批次计算进口占比。' :
    share ? '2019–2025 年采用卫光生物 2026 年 5 月版，2026H1 采用西南证券半年统计。' :
      '柱高上限 '+int.format(cap)+' 批。H1 为半年度。'+(observed ? '' : '前期公开图未标示精确批次数，空栏保留。');
}

function renderBrands(data) {
  const sourceControl = byId('albumin-brand-source');
  const origin = byId('albumin-brand-origin').value;
  sourceControl.querySelector('[value="filing"]').disabled = origin === '国产';
  if (sourceControl.selectedOptions[0]?.disabled) sourceControl.value = 'published';
  const source = sourceControl.value;
  const periodControl = byId('albumin-brand-year');
  for (const opt of periodControl.options) opt.disabled = !data.rankings[opt.value][source];
  if (periodControl.selectedOptions[0]?.disabled) periodControl.value = '2025';
  const period = periodControl.value;
  const rank = data.rankings[period][source][origin].filter(([,count])=>count == null || count > 0);
  const chart = byId('albumin-brand-chart');
  if (!rank.length) {
    chart.replaceChildren(node('p','blood-note','这个期间暂无该来源地的可归属记录。'));
  } else {
    chart.replaceChildren(...rank.map(([name,count,share])=>{
      const item = node('div','blood-brand-row');
      const meter = node('span','blood-brand-meter');
      const fill = node('span',origin==='进口' ? 'albumin-import' : 'albumin-domestic');
      fill.style.width = share+'%';
      meter.setAttribute('aria-hidden','true');
      meter.append(fill);
      item.append(node('span','blood-brand-name',name),meter,node('strong','blood-brand-value',pct(share)),
        node('span','blood-brand-count',count==null ? '—' : int.format(count)+' 批'));
      return item;
    }));
  }
  const reference = source === 'published' ? data.brandSources[origin] :
    source === 'filing' ? data.filingBrands.source : data.lotSource;
  const link = node('a','',reference.title);
  Object.assign(link,{href:reference.url,target:'_blank',rel:'noopener'});
  const title = period === '2026YTD' ? '2026 年至 '+data.asOf : period;
  const denominator = source === 'filing' ? data.filingBrands.total : rank.reduce((sum,[,count])=>sum+count,0);
  byId('albumin-brand-note').replaceChildren(
    title+' · '+origin+'分母 '+int.format(denominator)+' 批。',link);
}

function initProducts(data) {
  const figure = byId('blood-product-trend');
  const columns = data.products.columns.slice(1);
  const rows = data.products.rows.filter(([period])=>/^\d{4}$/.test(period));
  const byYear = new Map(rows.map(([year,...values])=>[year,values]));
  const series = columns.map((name,index)=>({code:String(index),name,index}));
  mountCompanyTrend(figure,series,rows.map(([year])=>year),{
    defaultCodes:['0','1','3','4'],
    getPoints:(item,years)=>years.map(year=>{
      const count = byYear.get(year)?.[item.index];
      return count == null ? null : {count};
    }),
    labelTick:()=>true,
    emptyMessage:'勾选有数据的品种后查看趋势',
    describe:point=>({value:point ? int.format(point.count)+' 批' : '—'})
  });
}

function initEventFilters() {
  for (const controls of document.querySelectorAll('[data-event-controls]')) {
    const section = controls.closest('section');
    const [company, type] = controls.querySelectorAll('select');
    const rows = section.querySelectorAll('tbody tr');
    const status = section.querySelector('[data-event-status]');
    const render = () => {
      let visible = 0;
      for (const row of rows) {
        row.hidden = Boolean((company.value && row.dataset.company !== company.value) ||
          (type.value && row.dataset.kind !== type.value));
        if (!row.hidden) visible++;
      }
      status.textContent = visible ? int.format(visible)+' 条已核实披露' : '当前组合无记录。';
    };
    status.setAttribute('role','status');
    controls.addEventListener('change',render);
    render();
  }
}

async function init() {
  initEventFilters();
  const response = await fetch('blood-research-data.json');
  if (!response.ok) throw Error('血制品专题数据暂时无法加载');
  const data = await response.json();
  const mode = byId('albumin-view');
  const source = byId('albumin-series');
  const originSection = byId('albumin-origin-chart');
  const brandSection = byId('albumin-brands');
  const show = () => {
    originSection.hidden = brandSection.hidden = false;
    if (mode.value === 'brands') {
      originSection.hidden = true;
      byId('albumin-series-setting').hidden = true;
      renderBrands(data);
    } else {
      brandSection.hidden = true;
      byId('albumin-series-setting').hidden = false;
      renderOrigin(data,mode.value,source.value);
    }
  };
  mode.addEventListener('change',show);
  source.addEventListener('change',show);
  brandSection.addEventListener('change',()=>renderBrands(data));
  show();
  initProducts(data);
}
init().catch(() => {
  byId('albumin-series-note').textContent = '图表暂时无法加载。可查阅下表或下载 CSV。';
});
