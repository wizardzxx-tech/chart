import { mountCompanyTrend } from '../pharmacy/company-trend.js';

const root = document.querySelector('#customs-trade');
const select = key => root.querySelector(`[data-trade="${key}"]`);
const controls = Object.fromEntries(['group','product','flow','partner','metric','year','unit','chart-group','view','focus','range','level'].map(key=>[key,select(key)]));
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
    if(label instanceof Node) th.append(label);
    else th.textContent=label;
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

function original(url, name='UN Comtrade') {
  const link=document.createElement('a');
  link.href=url;
  link.target='_blank';
  link.rel='noopener';
  link.textContent=name;
  return link;
}

function unitValueAllowed(product,quality) {
  return !product.holdUnitValue && !(product.basis==='unit' && quality==='估算');
}

function observation(row,partner,product) {
  const datum=partner===0?row.world:row.partners.find(r=>r[0]===partner)?.slice(1);
  if(!datum) return null;
  const [amount,qty,quality,grain]=datum;
  return {amount,qty,unit:qty&&unitValueAllowed(product,quality)?amount/qty:null,quality,grain:grain??'伙伴明细'};
}

async function start() {
  const response=await fetch(new URL('customs-trade.json',document.baseURI));
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  const {products,partners}=await response.json();
  const status = root.querySelector('.trade-status');
  const figure = root.querySelector('figure');
  const hasDirections = root.dataset.topic==='vaccines';
  const device=root.dataset.topic==='medical-devices';
  const metricLabels={amount:'金额',qty:'数量',unit:'单位金额',amountYoY:'金额同比',qtyYoY:'数量同比',share:'所选伙伴占比',top5:'前五贸易伙伴占比'};
  if(root.dataset.topic==='medical-devices') controls.unit.value='unit';
  const names = Object.fromEntries(Object.entries(partners).map(([code,[iso,name]])=>[code,iso?regionNames.of(iso):name]));
  const download=select('download-partners');
  download.hidden=false;
  download.addEventListener('click',()=>{
    const rows=[['品类','商品','年度','方向','实际编码','贸易伙伴代码','贸易伙伴','金额（美元）','数量','单位','单位金额（美元）','数量状态','源查询']];
    for(const product of products) for(const row of product.series) {
      const unit=product.basis==='kg'?'千克':'报告计数（个）';
      for(const [id,amount,qty,status] of row.partners) {
        rows.push([product.group,product.label,row.year,flowName(row.flow),row.code,id,names[id],
          amount,qty,unit,qty&&unitValueAllowed(product,status)?amount/qty:null,status,row.url]);
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
  const byCode=new Map(products.map(p=>[p.code,p]));
  const chartSeries=hasDirections||device
    ? [...(device?[{code:'trade-X',name:'出口',fixedFlow:'X'},{code:'trade-M',name:'进口',fixedFlow:'M'}]:
        ['X','M'].map(flow=>({...plotProducts[0],fixedFlow:flow,name:flowName(flow),code:flow}))),
      ...(device?plotProducts.map(p=>({...p,name:p.chartLabel??p.label})):[])]
    : plotProducts.map(p=>({...p,name:p.chartLabel??p.label}));
  const years=plotProducts.flatMap(p=>p.series.map(r=>r.year));
  const latest=Math.max(...years);
  const oldest=Math.min(...years);
  const periods=Array.from({length:latest-oldest+1},(_,i)=>String(oldest+i));
  const firstYear=()=>device&&controls.range.value!=='all'?latest-Number(controls.range.value)+1:oldest;
  const single=()=>device&&controls.view.value==='single';
  const checked=code=>figure.querySelector(`input[value="${code}"]`)?.checked;
  const detail=()=>byCode.get(controls.product.value);
  const focus=()=>byCode.get(controls.focus?.value);
  const listed=series=>device?(single()?Boolean(series.fixedFlow):series.group===controls['chart-group'].value):true;
  const inLevel=row=>!device||controls.level.value==='all'||String(row.code.length)===controls.level.value;
  const sameScope=(a,b)=>a&&b&&a.code===b.code&&a.source===b.source;
  const isPercent=metric=>['amountYoY','qtyYoY','share','top5'].includes(metric);
  const needsUnits=metric=>['qty','unit'].includes(metric);
  const units=product=>product.basis==='kg'?'千克':'个';
  const defaultGroup='影像';
  if(device) setOptions(controls['chart-group'],groups.map(g=>[g,g]),defaultGroup);

  function metricValue(metric,row,last,partner,product) {
    const d=observation(row,partner,product);
    if(!d) return null;
    if(metric==='share') return partner&&row.world?.[0]?100*d.amount/row.world[0]:null;
    if(metric==='top5'){
      const subtotal=row.partners.reduce((sum,r)=>sum+r[1],0);
      if(!row.world?.[0] || Math.abs(subtotal/row.world[0]-1)>0.005) return null;
      return row.partners.slice(0,5).reduce((sum,r)=>sum+r[1],0)/row.world[0]*100;
    }
    if(metric.endsWith('YoY')){
      if(!sameScope(row,last)||product.breakYear===row.year) return null;
      const prev=observation(last,partner,product);
      const amount=metric==='amountYoY';
      if(!amount&&(d.quality==='估算'||prev?.quality==='估算'||row.declaredUnit!==last.declaredUnit)) return null;
      const field=amount?'amount':'qty';
      return prev?.[field]>0&&Number.isFinite(d[field])?100*(d[field]/prev[field]-1):null;
    }
    return d[metric];
  }
  const chart=mountCompanyTrend(figure,chartSeries,periods,{
    defaultCodes:device?['trade-X','trade-M','90221200','90181310']:hasDirections?['X','M']:[chartSeries[0].code],
    labelTick:()=>true,
    getStart:()=>firstYear()-oldest,
    emptyMessage:'勾选有可比数据的系列',
    getPoints:(series,dates)=>{
      const product=single()?focus():series;
      const metric=controls.metric.value;
      if(!product||!listed(series)||(!single()&&needsUnits(metric)&&product.basis!==controls.unit.value)) return dates.map(()=>null);
      const flow=series.fixedFlow??controls.flow.value;
      const reports=new Map(product.series.filter(r=>r.flow===flow&&inLevel(r)).map(r=>[r.year,r]));
      const partner=metric==='top5'?0:Number(controls.partner.value);
      return dates.map(date=>{
        const year=Number(date);
        const row=reports.get(year), previous=reports.get(year-1);
        if(!row||year<firstYear()) return null;
        const value=metricValue(metric,row,previous,partner,product);
        if(!Number.isFinite(value)) return null;
        const datum=observation(row,partner,product);
        return {count:value/(metric==='amount'?1e6:1),
          value:display(value,isPercent(metric)?'%':metric==='amount'?' 美元':metric==='qty'?' '+units(product):' 美元／'+units(product)),
          detail:`${row.code} · ${row.source} · ${metric==='qty'?datum.quality:product.scope}`,
          breakBefore:product.breakYear===year||(previous&&!sameScope(row,previous))||
            (metric==='qty'&&previous&&row.declaredUnit!==previous.declaredUnit),
          estimate:metric==='qty'&&datum.quality==='估算'};
      });
    },
    describe:point=>point??{value:'—'}
  });

  function selectedReports() {
    const metric=controls.metric.value;
    const requiresData=needsUnits(metric)||metric==='qtyYoY';
    const partnerSeries=device?(single()?chartSeries.filter(s=>s.fixedFlow):chartSeries.filter(listed)):
      chartSeries;
    const active=partnerSeries.filter(s=>checked(s.code));
    return active.flatMap(series=>{
      const product=single()?focus():series;
      if(!product || (requiresData&&!single()&&needsUnits(metric)&&product.basis!==controls.unit.value)) return [];
      if(metric==='unit'&&product.holdUnitValue) return [];
      return product.series.filter(r=>r.year>=firstYear()&&inLevel(r)&&r.flow===(series.fixedFlow??controls.flow.value));
    });
  }
  function updatePartners() {
    const metric=controls.metric.value;
    const groups=new Map();
    for(const row of selectedReports()){
      for(const [id,,qty,quality] of row.partners) {
        if((metric==='qty'||metric==='qtyYoY')&&!qty) continue;
        if(metric==='unit'&&(!qty || (quality==='估算'&&(single()?focus()?.basis==='unit':controls.unit.value==='unit')))) continue;
        groups.set(id,names[id]);
      }
    }
    const partners=metric==='top5'?[]:[...groups].sort((a,b)=>a[1].localeCompare(b[1],'zh-CN'));
    const items=metric==='share'&&partners.length?partners:[[0,'全球'],...partners];
    setOptions(controls.partner,items);
    controls.partner.disabled=metric==='top5';
  }

  function updateTrend() {
    const metric=controls.metric.value;
    const base=single()?focus()?.basis:controls.unit.value;
    const kind=base==='kg'?'千克':'个';
    const unit=metric==='amount'?'百万美元':isPercent(metric)?'%':metric==='qty'?kind:`美元／${kind}`;
    select('unit-label').hidden=!needsUnits(metric)||single()||hasDirections;
    const name=single()?focus()?.label:device?controls['chart-group'].value:'';
    const flow=single()||hasDirections?'进出口':flowName(controls.flow.value);
    figure.querySelector('figcaption').textContent=[name,names[controls.partner.value],`${flow}${metricLabels[metric]}（${unit}）`].filter(Boolean).join(' · ');
    for (const series of chartSeries) figure.querySelector(`input[value="${series.code}"]`).closest('label').hidden=!listed(series);
    chart.refresh();
  }

  function chooseProducts(preferred) {
    const choices=products.filter(p=>p.group===controls.group.value);
    setOptions(controls.product,choices.map(p=>[p.code,p.label]),preferred);
  }
  function updateYear() {
    const series=detail()?.series.filter(r=>r.flow===controls.flow.value&&r.year>=firstYear()&&inLevel(r))??[];
    setOptions(controls.year,[...series].reverse().map(r=>[r.year,String(r.year)]),controls.year.value||String(series.at(-1)?.year));
  }
  function chooseFocus() {
    const options=plotProducts.filter(p=>p.group===controls['chart-group'].value);
    setOptions(controls.focus,options.map(p=>[p.code,p.label]));
    if(single()) {controls.group.value=controls['chart-group'].value;chooseProducts(controls.focus.value);}
    else if(!options.some(p=>checked(p.code))) figure.querySelector(`input[value="${options[0].code}"]`).checked=true;
    refresh();
  }
  function refresh() {
    if(device) select('focus-label').hidden=!single();
    updatePartners();
    updateYear();
    updateTrend();
    render();
  }

  function rankBar(name,fraction) {
    const group=document.createElement('span');
    group.className='trade-rank-name';
    group.textContent=name;
    if(Number.isFinite(fraction)){
      const bar=document.createElement('span');
      bar.className='trade-rank-bar';
      bar.style.setProperty('--share',Math.min(100,fraction*100)+'%');
      bar.setAttribute('aria-hidden','true');
      group.append(bar);
    }
    return group;
  }

  function render() {
    const product=detail();
    const flow=controls.flow.value;
    const partner=Number(controls.partner.value);
    const selection=product.series.filter(r=>r.flow===flow&&r.year>=firstYear()&&inLevel(r));
    const qtyUnit=units(product);
    const observations=selection.flatMap(row=>{
      const datum=observation(row,partner,product);
      if(!datum) return [];
      const info=[row.code.length===8?'中国税目 HS8':'国际 HS6',product.scope,datum.grain,datum.quality,
        product.holdUnitValue?'单位金额待核':null,row.quantityInputs?`原表数量单位 ${row.quantityInputs}`:null,row.method,product.breakYear===row.year?'税目调整':null].filter(Boolean).join(' · ');
      return [{...row,...datum,info}];
    });
    status.textContent=observations.length?
      `${product.label} · ${names[partner]} · ${flowName(flow)} · ${observations.length} 个年度`:
      product.mappingOnly?product.note:'该筛选下暂无已核实记录。';
    renderRows('history',[...observations].reverse().map(r=>[r.year,r.code,display(r.amount),
      display(r.qty,' '+(r.declaredUnit??qtyUnit)),display(r.unit,' 美元／'+(r.declaredUnit??qtyUnit)),
      r.info,original(r.url,r.source)]),'暂无可用记录。',7);
    const rank=selection.find(r=>r.year===Number(controls.year.value));
    const denominator=rank?.world?.[0];
    const leader=rank?.partners[0]?.[1];
    renderRows('rank',(rank?.partners??[]).slice(0,10).map(([id,amount,qty,quality])=>[rankBar(names[id],leader?amount/leader:null),display(amount),
      display(denominator?100*amount/denominator:null,'%'),display(qty,' '+qtyUnit),
      display(qty&&unitValueAllowed(product,quality)?amount/qty:null,' 美元／'+qtyUnit),quality]),
      '该年度暂无伙伴明细。',6);
    if(device){
      const balanceProduct=single()?focus():product;
      const paired=new Map(balanceProduct.series.filter(r=>r.flow==='M').map(r=>[r.year,r]));
      const balances=balanceProduct.series.filter(x=>x.flow==='X'&&x.year>=firstYear()&&inLevel(x)).flatMap(x=>{
        const m=paired.get(x.year);
        if(!sameScope(x,m)) return [];
        const exports=observation(x,partner,balanceProduct), imports=observation(m,partner,balanceProduct);
        if(!exports||!imports) return [];
        return [[x.year,x.code,display(exports.amount),display(imports.amount),
          display(exports.amount-imports.amount),display(exports.amount?imports.amount/exports.amount*100:null,'%')]];
      }).reverse();
      select('balance-panel').hidden=false;
      renderRows('balance',balances,'该商品暂无可比较的同期进出口记录。',6);
    }
  }
  controls.group.addEventListener('change',()=>{
    chooseProducts();
    if(single()&&detail().series.length){
      controls['chart-group'].value=controls.group.value;
      setOptions(controls.focus,plotProducts.filter(p=>p.group===controls.group.value).map(p=>[p.code,p.label]),detail().code);
    }
    refresh();
  });
  controls.product.addEventListener('change',()=>{
    if(single()&&focus()?.group===controls.group.value&&detail().series.length) controls.focus.value=detail().code;
    refresh();
  });
  controls.flow.addEventListener('change',refresh);
  controls.partner.addEventListener('change',()=>{render();updateTrend();});
  controls.metric.addEventListener('change',refresh);
  controls.unit.addEventListener('change',refresh);
  controls.year.addEventListener('change',render);
  figure.querySelector('fieldset').addEventListener('change',refresh);
  chooseProducts();
  if(device){
    controls['chart-group'].addEventListener('change',chooseFocus);
    controls.view.addEventListener('change',chooseFocus);
    controls.range.addEventListener('change',refresh);
    controls.level.addEventListener('change',refresh);
    controls.focus.addEventListener('change',()=>{
      controls.group.value=controls['chart-group'].value;
      chooseProducts(controls.focus.value);
      refresh();
    });
    chooseFocus();
  } else refresh();
}
start().catch(error=>{
  console.error(error);
  root.querySelector('.trade-status').textContent='贸易数据暂时无法加载，可使用 CSV。';
});
