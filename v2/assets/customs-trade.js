import { mountCompanyTrend } from '../pharmacy/company-trend.js';

const root = document.querySelector('#customs-trade');
const select = key => root.querySelector(`[data-trade="${key}"]`);
const controls = Object.fromEntries(['group','product','flow','partner','metric','year','unit'].map(key=>[key,select(key)]));
const format = new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2});
const display = (v,unit='') => Number.isFinite(v) ? format.format(v)+unit : '—';
const regionNames = new Intl.DisplayNames(['zh-CN'],{type:'region'});
const flowName = value => value==='M'?'进口':'出口';

function setOptions(el, choices, preferred=el.value) {
  el.replaceChildren(...choices.map(([value, label])=>new Option(label,value)));
  if (choices.some(([value])=>String(value)===preferred)) el.value=preferred;
}

function renderRows(key, records, empty, columns) {
  const tbody = select(key).querySelector('tbody');
  const rows = records.map(([label,...values])=>{
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = label;
    tr.append(th);
    values.forEach(value=>{
      const td = document.createElement('td');
      if (value instanceof Node) td.append(value);
      else td.textContent = value;
      tr.append(td);
    });
    return tr;
  });
  if (!rows.length) {
    const tr = document.createElement('tr'), td = document.createElement('td');
    td.colSpan=columns;
    td.textContent=empty;
    tr.append(td);
    rows.push(tr);
  }
  tbody.replaceChildren(...rows);
}

function original(url) {
  const link=document.createElement('a');
  link.href=url;
  link.target='_blank';
  link.rel='noopener';
  link.textContent='UN Comtrade';
  return link;
}

function observation(row,partner) {
  const datum=partner===0?row.world:row.partners.find(r=>r[0]===partner)?.slice(1);
  if(!datum) return null;
  const [amount,qty,quality,grain]=datum;
  return {amount,qty,unit:qty?amount/qty:null,quality,grain:grain??'伙伴明细'};
}

async function start() {
  const response=await fetch(new URL('customs-trade.json',document.baseURI));
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  const {products,partners}=await response.json();
  const status = root.querySelector('.trade-status');
  const figure = root.querySelector('figure');
  const hasDirections = root.dataset.topic==='vaccines';
  const metricLabels = {amount:'金额',qty:'数量',unit:'单位金额'};
  if(root.dataset.topic==='medical-devices') controls.unit.value='unit';
  const names = Object.fromEntries(Object.entries(partners).map(([code,[iso,name]])=>[code,iso?regionNames.of(iso):name]));
  const download=select('download-partners');
  download.hidden=false;
  download.addEventListener('click',()=>{
    const rows=[['品类','商品','年度','方向','实际编码','贸易伙伴代码','贸易伙伴','金额（美元）','数量','单位','单位金额（美元）','数量状态','源查询']];
    for(const product of products) for(const row of product.series) {
      const unit=product.basis==='kg'?'千克':'计数单位';
      for(const [id,amount,qty,status] of row.partners) {
        rows.push([product.group,product.label,row.year,flowName(row.flow),row.code,id,names[id],
          amount,qty,unit,qty?amount/qty:null,status,row.url]);
      }
    }
    const csv='\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');
    link.href=url;
    link.download='customs-trade-partners.csv';
    link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  const groups = [...new Set(products.map(p=>p.group))];
  setOptions(controls.group,groups.map(g=>[g,g]));
  root.querySelector('.trade-filters').hidden=false;
  select('detail-filters').hidden=false;
  select('rank-filter').hidden=false;

  const plotProducts=products.filter(p=>p.series.length);
  const chartSeries=hasDirections
    ? ['X','M'].map(flow=>({...plotProducts[0], fixedFlow:flow, name:flowName(flow), code:flow}))
    : plotProducts.map(p=>({...p, name:p.chartLabel??p.label}));
  const years=plotProducts.flatMap(p=>p.series.map(r=>r.year));
  const periods=Array.from({length:Math.max(...years)-Math.min(...years)+1},(_,i)=>String(Math.min(...years)+i));
  const chart = mountCompanyTrend(figure,chartSeries,periods,{
    defaultCodes: hasDirections ? ['X','M'] : root.dataset.topic==='medical-devices'
      ? ['90221200','90181310'] : [chartSeries[0].code],
    labelTick:()=>true,
    emptyMessage:'勾选有可比数据的商品',
    getPoints:(product,dates)=>{
      const metric=controls.metric.value;
      if(metric!=='amount' && product.basis!==controls.unit.value) return dates.map(()=>null);
      const flows=product.series.filter(r=>r.flow===(product.fixedFlow??controls.flow.value));
      const series=new Map(flows.map(r=>[r.year,r]));
      return dates.map(s=>{
        const year=Number(s), row=series.get(year);
        if(!row) return null;
        const datum=observation(row,Number(controls.partner.value));
        if(!Number.isFinite(datum?.[metric])) return null;
        const previous=series.get(year-1);
        const switched=previous && row.code!==previous.code;
        const renamed=switched && row.code.slice(0,6)!==previous.code.slice(0,6);
        const before=product.breakYear===year || renamed;
        return {count:datum[metric]/(metric==='amount'?1e6:1),
          value:display(datum[metric],metric==='amount'?' 美元':metric==='qty'?product.basis==='kg'?' 千克':' 计数单位':
            product.basis==='kg'?' 美元／千克':' 美元／单位'),
          detail:`${row.code} · ${datum.quality}`,breakBefore:before,dashedBefore:switched,estimate:datum.quality==='估算'};
      });
    },
    describe:point=>point??{value:'—'}
  });

  function updateTrend() {
    const metric=controls.metric.value;
    const kind=controls.unit.value==='kg'?'千克':'计数单位';
    const unit=metric==='amount'?'百万美元':metric==='qty'?kind:`美元／${controls.unit.value==='kg'?'千克':'单位'}`;
    select('unit-label').hidden=metric==='amount';
    const flow=hasDirections?'疫苗进出口':flowName(controls.flow.value);
    if(hasDirections) select('unit-label').hidden=true;
    figure.querySelector('figcaption').textContent=`${names[controls.partner.value]} · ${flow}${metricLabels[metric]}（${unit}）`;
    chart.refresh();
  }

  function chooseProducts() {
    const choices=products.filter(p=>p.group===controls.group.value);
    setOptions(controls.product,choices.map(p=>[p.code,p.label]));
    choosePartners();
  }
  function choosePartners() {
    const product=products.find(p=>p.code===controls.product.value);
    const series=product.series.filter(r=>r.flow===controls.flow.value);
    const ids=[...new Set(plotProducts.flatMap(p=>p.series.filter(r=>hasDirections||r.flow===controls.flow.value).flatMap(r=>r.partners.map(x=>x[0]))))];
    ids.sort((a,b)=>names[a].localeCompare(names[b],'zh-CN'));
    setOptions(controls.partner,[[0,'全球'],...ids.map(id=>[id,names[id]])]);
    setOptions(controls.year,[...series].reverse().map(r=>[r.year,String(r.year)]),String(series.at(-1)?.year));
    render();
    updateTrend();
  }
  function render() {
    const product=products.find(p=>p.code===controls.product.value);
    const flow=controls.flow.value;
    const partner=Number(controls.partner.value);
    const selection=product.series.filter(r=>r.flow===flow);
    const qtyUnit=product.basis==='kg'?'千克':'计数单位';
    const unitValue='美元／'+(product.basis==='kg'?'千克':'单位');
    const observations=selection.flatMap(row=>{
      const datum=observation(row,partner);
      if(!datum) return [];
      const info=[datum.grain,datum.quality,product.breakYear===row.year?'税目调整':''].filter(Boolean).join(' · ');
      return [{...row,...datum,info}];
    });
    status.textContent=observations.length?
      `${product.label} · ${names[partner]} · ${flowName(flow)} · ${observations.length} 个年度`:
      product.mappingOnly?product.note:'该筛选下暂无已核实记录。';
    renderRows('history',[...observations].reverse().map(r=>[r.year,r.code,display(r.amount),
      display(r.qty,' '+qtyUnit),display(r.unit,' '+unitValue),r.info,original(r.url)]),'暂无可用记录。',7);
    const rank=selection.find(r=>r.year===Number(controls.year.value));
    const denominator=rank?.world?.[0];
    renderRows('rank',(rank?.partners??[]).slice(0,15).map(([id,amount,qty])=>[names[id],display(amount),
      display(denominator?100*amount/denominator:null,'%'),display(qty,' '+qtyUnit),display(qty?amount/qty:null,' '+unitValue)]),
      '该年度暂无伙伴明细。',5);
  }
  controls.group.addEventListener('change',chooseProducts);
  controls.product.addEventListener('change',choosePartners);
  controls.flow.addEventListener('change',choosePartners);
  controls.partner.addEventListener('change',()=>{render();updateTrend();});
  controls.metric.addEventListener('change',updateTrend);
  controls.unit.addEventListener('change',updateTrend);
  controls.year.addEventListener('change',render);
  chooseProducts();
}
start().catch(error=>{
  console.error(error);
  root.querySelector('.trade-status').textContent='贸易数据暂时无法加载，可使用 CSV。';
});
