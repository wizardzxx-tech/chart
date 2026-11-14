import { mountCompanyTrend } from './company-trend.js';

const at = id => document.getElementById(id);
const num = new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2});
const format = (v,unit='') => Number.isFinite(v) ? num.format(v)+unit : '—';
const definitions = {
  sales:['TTM 直营店均零售收入','万元／店'], growth:['店均收入同比','%'], direct:['直营门店同比','%'],
  sssg:['同店销售同比（SSSG）','%'],density:['日均坪效','元／㎡／天']
};
const categories = {retail:'医药零售',franchise:'加盟／联盟／分销',wholesale:'批发／分销',
  convenience:'便利零售',manufacturing:'制造／工业',services:'供应商服务', omnichannel:'新零售（混合渠道）'};

function make(tag,text) {
  const el = document.createElement(tag);
  el.textContent = text;
  return el;
}
function tableRows(id,rows) {
  at(id).querySelector('tbody').replaceChildren(...rows.map(([name,...values])=>{
    const tr = document.createElement('tr');
    const th = make('th',name);
    th.scope = 'row';
    tr.append(th);
    for (const v of values) {
      const td = make('td',v instanceof Node ? '' : v);
      if (v instanceof Node) td.append(v);
      tr.append(td);
    }
    return tr;
  }));
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = make('td','该筛选范围暂无已核实数据。');
    td.colSpan = at(id).querySelectorAll('thead th').length;
    tr.append(td);
    at(id).querySelector('tbody').append(tr);
  }
}

function sourceLinks(ids,sources) {
  const refs = document.createDocumentFragment();
  ids.forEach((i,j)=>{
    const [name,url] = sources[i];
    const link = make('a',ids.length>1?String(j+1):'原文');
    link.href = url;
    link.title = name;
    link.setAttribute('aria-label',name);
    link.target = '_blank';
    link.rel = 'noopener';
    if (j) refs.append(' · ');
    refs.append(link);
  });
  return refs;
}
function labelPeriod(quarter) {
  return `${quarter.slice(0,4)} ${['Q1','上半年','前三季度','全年'][Number(quarter.at(-1))-1]}`;
}
function order(rows) {
  return [...rows].sort((a,b)=>b[1].localeCompare(a[1]));
}
function setDates(select,values,latest=true) {
  for (const v of [...new Set(values)].sort().reverse()) select.add(new Option(v,v));
  select.add(new Option('全部季度','all'));
  if (!latest) select.value = 'all';
}
function filtered(rows,period,company) {
  return order(rows).filter(r=>(period==='all'||r[1]===period)&&(company==='all'||r[0]===company));
}
function byKey(rows) {
  return new Map(rows.map(r=>[`${r[0]}/${r[1]}`,r]));
}

async function start() {
  const response = await fetch(new URL('retail-research.json',import.meta.url));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const {companies,segments,efficiency,network,disclosed,sources} = await response.json();
  const issuers = Object.entries(companies).map(([code,name])=>({code,name}));
  const allPeriods = [...new Set([...segments,...efficiency,...network,...disclosed].map(r=>r[1]))].sort();
  const networkPeriod = at('network-period'), networkCompany = at('network-company');
  setDates(networkPeriod,network.map(r=>r[1]));
  const renderNetwork = () => tableRows('network-detail',filtered(network,networkPeriod.value,networkCompany.value)
    .map(([c,q,,...r])=>[companies[c],q,...r.slice(0,7).map(x=>format(x,'%')),sourceLinks(r[8],sources)]));
  networkPeriod.addEventListener('change',renderNetwork);
  networkCompany.addEventListener('change',renderNetwork);
  renderNetwork();

  const unitMetric = at('unit-metric'), unitPeriod = at('unit-period'), unitCompany = at('unit-company');
  setDates(unitPeriod,[...efficiency,...disclosed].map(r=>r[1]));
  const unitData = byKey(efficiency), netData = byKey(network);
  const defaultChartSelection = (id, code) => {
    const figure = at(id);
    if (figure.querySelector('input:checked:not(:disabled)')) return;
    const fallback = figure.querySelector(`input[value="${code}"]:not(:disabled)`) ?? figure.querySelector('input:not(:disabled)');
    if (fallback) fallback.checked = true;
  };
  const reported = {sssg:byKey(disclosed.filter(r=>r[2]==='sssg')),density:byKey(disclosed.filter(r=>r[2]==='density'))};
  const unitTrend = mountCompanyTrend(at('unit-chart'),issuers,allPeriods,{
    emptyMessage:'勾选有披露的公司',
    maxGap:()=>unitMetric.value==='sssg'?1:2,
    getStart: dates=>Math.max(0,dates.length-21),
    getPoints: (company,dates) => dates.map(q=>{
      const key = `${company.code}/${q}`, metric = unitMetric.value;
      const unit = definitions[metric][1];
      const e = unitData.get(key);
      if (metric==='direct') {
        const count = netData.get(key)?.[4];
        return Number.isFinite(count) ? {count,value:format(count,unit)} : null;
      }
      if (reported[metric]) {
        const r = reported[metric].get(key);
        if (!r) return null;
        const [, , ,low,high,, ,detail] = r;
        const value = metric==='sssg' ? (low===high ? '约 '+format(low,'%') : format(low,'%')+'–'+format(high,'%')) : format(low,unit);
        return {count:(low+high)/2,value,detail};
      }
      const count = e?.[metric==='sales'?4:5];
      return Number.isFinite(count) ? {count,value:format(count,unit),detail:`平均直营店 ${format(e[3])} 家 · ${e[6]} 个时点`} : null;
    }),
    describe: point=>point ?? {value:'—'}
  });
  function renderUnit() {
    tableRows('unit-detail',filtered(efficiency,unitPeriod.value,unitCompany.value)
      .map(([c,q,r,a,s,g,n,refs])=>[companies[c],q,format(r/1e8),format(a),format(s),format(g,'%'),n,sourceLinks(refs,sources)]));
  }
  function refreshUnit() {
    at('unit-chart-caption').textContent = definitions[unitMetric.value].join(' · ');
    unitTrend.refresh();
    defaultChartSelection('unit-chart',unitMetric.value==='sssg'?'603883':'603939');
    unitTrend.refresh();
  }
  unitMetric.addEventListener('change',refreshUnit);
  unitPeriod.addEventListener('change',renderUnit);
  unitCompany.addEventListener('change',renderUnit);
  renderUnit();
  tableRows('unit-disclosed',order(disclosed).map(([c,q,k,lo,hi,daily,ref,note])=>[companies[c],q,definitions[k][0],
    k==='sssg' ? (lo===hi?'约 '+format(lo,'%'):format(lo,'%')+'–'+format(hi,'%')) :
      format(lo,' 元／㎡／天')+(daily ? ' · 日均店效 '+format(daily,' 元／店'):''),
    note,sourceLinks([ref],sources)]));

  const mix = {category:at('mix-category'),period:at('mix-period'),company:at('mix-company'),metric:at('mix-metric')};
  setDates(mix.period,segments.map(r=>r[1]));
  const series = Object.fromEntries(Object.keys(categories).map(k=>[k,byKey(segments.filter(r=>r[2]===k))]));
  const mixTrend = mountCompanyTrend(at('mix-chart'),issuers,allPeriods,{
    emptyMessage:'勾选有披露的公司',
    maxGap:()=>mix.metric.value==='revenue'?4:2,
    getStart: dates=>Math.max(0,dates.length-21),
    getPoints:(company,dates)=>dates.map(q=>{
      const r = series[mix.category.value==='all'?'retail':mix.category.value].get(`${company.code}/${q}`);
      const revenue = mix.metric.value==='revenue';
      if (!r || (revenue && !q.endsWith('Q4'))) return null;
      const count = revenue ? r[4]/1e8 : r[6];
      return Number.isFinite(count) ? {count,value:format(count,revenue?' 亿元':'%'),detail:r[3]+' · '+labelPeriod(q)} : null;
    }),
    describe:point=>point ?? {value:'—'}
  });
  function renderMix() {
    const rows = mix.category.value==='all' ? segments : segments.filter(r=>r[2]===mix.category.value);
    tableRows('mix-detail',filtered(rows,mix.period.value,mix.company.value)
      .map(([c,q,k,l,r,co,gm,ref])=>[companies[c],labelPeriod(q),categories[k],l,format(r/1e8),format(co===null?null:co/1e8),format(gm,'%'),sourceLinks([ref],sources)]));
  }
  function refreshMix() {
    const k = mix.category.value==='all'?'retail':mix.category.value;
    const revenue = mix.metric.value==='revenue';
    at('mix-chart-caption').textContent = categories[k]+' · '+(revenue?'全年收入（亿元）':'毛利率（%）');
    mixTrend.refresh();
    defaultChartSelection('mix-chart','603939');
    mixTrend.refresh();
    renderMix();
  }
  mix.category.addEventListener('change',refreshMix);
  mix.metric.addEventListener('change',refreshMix);
  mix.period.addEventListener('change',renderMix);
  mix.company.addEventListener('change',renderMix);
  refreshMix();
}

start().catch(error=>{
  console.error(error);
  for (const id of ['network-detail','unit-detail','mix-detail']) {
    at(id).replaceChildren(make('p','暂时无法加载明细，可使用上方 CSV。'));
  }
});
