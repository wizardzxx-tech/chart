const root = document.querySelector('#customs-trade');
const select = key => root.querySelector(`[data-trade="${key}"]`);
const controls = Object.fromEntries(['group','product','flow','partner','metric','year'].map(key=>[key,select(key)]));
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

function plot(figure,points,unit,changed) {
  const chart=select('plot');
  const bars=points.filter(p=>p[1]!==null);
  figure.hidden=!bars.length;
  if (!bars.length) return;
  const max=Math.max(...bars.map(p=>p[1]));
  const fmt=val=>{
    if(unit==='美元' && max >= 1e8) return display(val/1e8,' 亿美元');
    if(unit==='美元' && max >= 1e4) return display(val/1e4,' 万美元');
    return display(val,unit==='美元'?' 美元':' '+unit);
  };
  chart.replaceChildren(...points.map(([year,value,code])=>{
    const item=document.createElement('div');
    item.className='trade-bar-point';
    const block=document.createElement('div');
    block.className='trade-bar-block';
    if (value!==null) {
      const bar=document.createElement('div');
      bar.className='trade-bar';
      bar.style.setProperty('--bar-size',Math.max(0.4,(value/max)*100)+'%');
      if(changed) bar.dataset.code=code;
      block.append(bar);
    }
    const label=document.createElement('strong');
    label.textContent=year;
    const detail=document.createElement('span');
    detail.textContent=fmt(value);
    item.append(block,label,detail);
    if(changed && code){
      const scope=document.createElement('small');
      scope.textContent=code;
      item.append(scope);
    }
    return item;
  }));
}

async function start() {
  const response=await fetch(new URL('customs-trade.json',document.baseURI));
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  const {products,partners}=await response.json();
  const status = root.querySelector('.trade-status');
  const figure = root.querySelector('figure');
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
  select('rank-filter').hidden=false;

  function chooseProducts() {
    const choices=products.filter(p=>p.group===controls.group.value);
    setOptions(controls.product,choices.map(p=>[p.code,p.label]));
    choosePartners();
  }
  function choosePartners() {
    const product=products.find(p=>p.code===controls.product.value);
    const series=product.series.filter(r=>r.flow===controls.flow.value);
    const ids=[...new Set(series.flatMap(r=>r.partners.map(x=>x[0])))];
    ids.sort((a,b)=>names[a].localeCompare(names[b],'zh-CN'));
    setOptions(controls.partner,[[0,'全球'],...ids.map(id=>[id,names[id]])]);
    setOptions(controls.year,[...series].reverse().map(r=>[r.year,String(r.year)]),String(series.at(-1)?.year));
    render();
  }
  function render() {
    const product=products.find(p=>p.code===controls.product.value);
    const flow=controls.flow.value;
    const partner=Number(controls.partner.value);
    const selection=product.series.filter(r=>r.flow===flow);
    const qtyUnit=product.basis==='kg'?'千克':'计数单位';
    const unitValue='美元／'+(product.basis==='kg'?'千克':'单位');
    const scopes=new Set(selection.map(s=>s.code));
    const changed=scopes.size>1 || Boolean(product.breakYear);
    const observations=selection.flatMap(r=>{
      const datum=partner===0?r.world:r.partners.find(p=>p[0]===partner)?.slice(1);
      if(!datum) return [];
      const [amount,qty,quality,grain]=datum;
      const info=[grain ?? '伙伴原表',quality,product.breakYear===r.year?'税目调整':''].filter(Boolean).join(' · ');
      return [{year:r.year,code:r.code,amount,qty,unit:qty?amount/qty:null,info,url:r.url}];
    });
    const metric=controls.metric.value;
    const metricLabels={amount:['金额','美元'],qty:['数量',qtyUnit],unit:['单位金额',unitValue]};
    const [metricName,unit]=metricLabels[metric];
    figure.querySelector('figcaption').textContent = `${product.label} · ${names[partner]} · ${flowName(flow)}${metricName}`;
    const points=[...new Set(selection.map(r=>r.year))].sort().map(year=>{
      const observation=observations.find(x=>x.year===year);
      return [year,observation?.[metric]??null,observation?.code];
    });
    plot(figure,points,unit,changed);
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
  controls.partner.addEventListener('change',render);
  controls.metric.addEventListener('change',render);
  controls.year.addEventListener('change',render);
  chooseProducts();
}
start().catch(error=>{
  console.error(error);
  root.querySelector('.trade-status').textContent='贸易数据暂时无法加载，可使用 CSV。';
});
