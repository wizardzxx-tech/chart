import {drawLines,closestPeriod,colorPalette,isNumber} from './chart.js';
import {drawIndex} from './research.js';

const byId=id=>document.getElementById(id);
const markets=byId('view-market');
const nf=new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2});
const cents=new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const millis=new Intl.NumberFormat('en-US',{minimumFractionDigits:3,maximumFractionDigits:3});
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const external=(url,label)=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
const share=value=>isNumber(value)?(value*100).toFixed(1)+'%':'—';
const valueFor=(value,metric)=>!isNumber(value)?'—':
  metric==='price'?'$'+millis.format(value):metric==='spending'?'$'+cents.format(value):nf.format(value);
const metrics={
  units:['annual','units','年度计费剂量'],
  spending:['annual','spending','年度支出'],
  quarterSpending:['quarterly','spending','近期支出'],
  claims:['quarterly','claims','近期申报次数'],
  annualClaims:['annual','claims','年度申报次数'],
};
const difference=(a,b)=>isNumber(a)&&isNumber(b)?((a-b)>0?'+':'')+((a-b)*100).toFixed(1)+' 个百分点':'—';
const ratio=(number,total)=>isNumber(number)&&total>0?number/total:null;
const quarterNumber=period=>/^\d{4}Q[1-4]$/.test(period)?Number(period.slice(0,4))*4+Number(period.at(-1)):null;
function priorPeriod(rows, period, dataset){
  if(dataset==='annual')return rows.find(row=>Number(row.period)===Number(period)-1);
  const quarter=quarterNumber(period);
  return quarter===null?undefined:rows.find(row=>quarterNumber(row.period)===quarter-1);
}
const total=(rows,field)=>rows.reduce((sum,row)=>sum+(row[field]??0),0);
const moneyAxis=n=>'$'+nf.format(n);
const pctAxis=n=>Math.round(n*100)+'%';
const priceAxis=series=>{const max=Math.max(1,...series.flatMap(s=>Object.values(s.values)).filter(isNumber));
  const step=max>=100?50:max>=10?5:max>=1?1:0.1;
  return Math.ceil(max/step)*step;};

const screen={};
const shareState={canvas:'share-canvas',legend:'share-legend',hidden:new Set()};
const priceState={canvas:'price-canvas',legend:'price-legend',hidden:new Set()};
let cms,refs,research,groups,group,pending,mode;
let shareRows=[],priceRows=[];

function periodLabel(period) {
  return cms.quarterPeriods[period]?.label || period.replace(/(\d{4})Q([1-4])/,'$1 Q$2');
}
function show(id,visible){byId(id).hidden=!visible;}
function choices(id,options,selected){
  byId(id).replaceChildren(...options.map(([value,label])=>new Option(label,value)));
  if(selected) byId(id).value=selected;
}
function note(id,html){byId(id).innerHTML=html;}
function linkReport(page,label){
  return external(refs.reportUrl+'#page='+page,label);
}
function table(headers,rows){
  return `<table><thead><tr>${headers.map(heading=>`<th scope="col">${esc(heading)}</th>`).join('')}</tr></thead>
   <tbody>${rows.map(([head,...cells])=>`<tr><th scope="row">${head}</th>${cells.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function stats(entries){
  return entries.map(([label,value])=>`<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('');
}
function plot(id,spec){
  screen[id]=spec;
  drawLines(byId(id),spec);
}
function updatePlot(state){
  if (!state.spec) return;
  plot(state.canvas,{...state.spec,series:state.spec.series.filter(series=>!state.hidden.has(series.id))});
}
function useLegend(state){
  byId(state.legend).innerHTML=state.spec.series.map(series=>`<button class="series-key" type="button" data-series="${esc(series.id)}"
    aria-pressed="${!state.hidden.has(series.id)}"><i style="--series-color:${series.color}"></i>${esc(series.label)}</button>`).join('');
  updatePlot(state);
}
for(const state of [shareState,priceState]){
  byId(state.legend).addEventListener('click',event=>{
    const button=event.target.closest('button[data-series]');
    if(!button)return;
    const key=button.dataset.series;
    if(state.hidden.has(key))state.hidden.delete(key);else state.hidden.add(key);
    button.setAttribute('aria-pressed',!state.hidden.has(key));
    updatePlot(state);
  });
}

function prepareRows(dataset,metric){
  if (!group.products.length) return [];
  const products=new Map(group.products.filter(p=>p.code).map(p=>[p.code,p]));
  const rows=cms[dataset].filter(row=>products.has(row.code));
  const periods=[...new Set(rows.map(row=>row.period))].sort();
  return periods.map(period=>{
    const items=rows.filter(record=>record.period===period && isNumber(record[metric]))
      .map(record=>({...record,item:products.get(record.code),value:record[metric]}));
    const sample=total(items,'value');
    const original=items.find(row=>row.item.reference);
    const bios=items.filter(row=>!row.item.reference);
    const combined=original?ratio(total(bios,'value'),sample):null;
    return {period,items:items.map(row=>({...row,share:ratio(row.value,sample)})),original,combined,sample};
  }).filter(p=>p.items.length);
}

function seriesFor(periodRows,metric){
  const output=group.products.map((product,index)=>({
    id:product.code,
    label:product.name+(product.reference?' · 原研':''),
    color:colorPalette[index%colorPalette.length],
    strong:product.reference,dash:index>4,
    values:Object.fromEntries(periodRows.map(p=>[p.period,p.items.find(r=>r.code===product.code)?.[metric]])),
  })).filter(s=>Object.values(s.values).some(isNumber));
  if (metric==='share'&&periodRows.some(p=>isNumber(p.combined))){
    output.push({id:'combined',label:'类似药合计',color:'#155847',strong:true,dash:true,
      values:Object.fromEntries(periodRows.map(p=>[p.period,p.combined]))});
  }
  return output;
}

function renderShare(){
  const chosen=byId('cms-metric').value;
  const isReference=chosen==='iqvia';
  const quote=refs.quotes.find(q=>q.molecule===group.id);
  const [dataset,metric,label]=metrics[chosen]||[];
  shareRows=isReference?[]:prepareRows(dataset,metric);
  const available=shareRows.length>0;
  show('share-figure',!isReference&&available);
  show('market-share-detail',!isReference&&available);
  show('market-scope-detail',!isReference&&available);
  show('iqvia-reference',isReference);
  if (isReference){
    choices('market-period',[[quote.period,quote.period]],quote.period);
    note('market-metric-note','美国市场用量估计 · 直接引用三星报告');
    note('market-summary',stats([['原研',group.reference],['类似药合计',quote.value+'%'],['观察期',quote.period]]));
    note('iqvia-reference',`<p><b>直接引用 ${esc(quote.source.name)}</b></p>
      <p>${esc(quote.source.label)} · 图 ${quote.figure} · 第 ${quote.page} 页</p>
      <p class="note">观察期 ${esc(quote.period)}。图表未标注的历史点留空。份额按报告所覆盖渠道及品种计算。</p>${quote.note?`<p class="note">${esc(quote.note)}</p>`:''}`);
    note('market-source',linkReport(quote.page,'三星报告原图'));
    note('market-chart-note','');
    return;
  }
  const oldPeriod=byId('market-period').value;
  const selected=shareRows.some(r=>r.period===oldPeriod)?oldPeriod:shareRows.at(-1)?.period;
  choices('market-period',shareRows.map(r=>[r.period,periodLabel(r.period)]),selected);
  const text=dataset==='annual'?'传统 Medicare Part B · 年度原表':
    `传统 Medicare Part B · ${esc(research.quarterlyAudit.note)} ${external(research.quarterlyAudit.link,'CMS 更新入口')}`;
  note('market-metric-note',text);
  note('market-source',external(cms.quarterPeriods[selected]?.file || cms.sources[dataset].file,'CMS 原始 CSV'));
  if (!available){
    note('market-summary','');
    note('market-chart-note','此分子在该口径暂无可展示的已核对数据。');
    return;
  }
  const chartRows=dataset==='annual'?shareRows:Object.values(cms.quarterPeriods)
    .filter(p=>p.kind==='quarter').sort((a,b)=>a.id.localeCompare(b.id))
    .map(p=>shareRows.find(row=>row.period===p.id)||{period:p.id,items:[]});
  const series=seriesFor(chartRows,'share');
  shareState.spec={periods:chartRows.map(r=>r.period),series,selected,labels:periodLabel,formatY:pctAxis,upper:1};
  note('market-chart-title',label+'份额');
  note('market-chart-note',dataset==='annual'?'选择期间或点击图表查看品牌明细。':
    '折线仅显示可独立核对的单季度。全年和累计初步值可在期间选择器查看。');
  useLegend(shareState);
  shareEvidence();
}

function shareEvidence(){
  const period=byId('market-period').value;
  const record=shareRows.find(row=>row.period===period);
  if(!record)return;
  const [dataset,metric,label]=metrics[byId('cms-metric').value];
  const previous=priorPeriod(shareRows,period,dataset);
  const original=record.items.find(row=>row.item.reference)?.share;
  note('market-summary',stats([['原研份额',share(original)],['类似药合计',share(record.combined)],
    ...(previous?[[dataset==='annual'?'类似药份额同比':'类似药份额环比',difference(record.combined,previous.combined)]]:[]),
    ['可见品牌',record.items.length]]));
  note('market-period-label',esc(periodLabel(period)));
  const rawLabel=metric==='units'?'计费单位（'+group.unit+'）':label;
  note('market-table',table(['品牌','份额',...(previous?[dataset==='annual'?'同比':'环比']:[]),rawLabel,'HCPCS'],record.items.map(row=>[
    esc(row.item.name),share(row.share),
    ...(previous?[difference(row.share,previous.items.find(r=>r.code===row.code)?.share)]:[]),
    esc(valueFor(row.value,metric)),row.code,
  ])));
  note('market-codes',`<p>${esc(group.scope)}</p><p>本期分母包括 ${record.items.map(row=>esc(row.item.name)+'（'+row.code+'）').join('、')}。</p>
     ${!isNumber(record.combined)?'<p>本期原研与类似药的可见数据不足以计算类似药合计份额。</p>':''}
     ${record.items.some(row=>row.outlier)?'<p>CMS 标记本期存在每计费单位支出异常值，表内保留原始记录。</p>':''}`);
  shareState.spec.selected=period;
  updatePlot(shareState);
}

function renderPrices(){
  priceRows=prepareRows('price','price');
  const available=priceRows.length>0;
  for (const id of ['price-figure','market-price-detail']) show(id,available);
  show('price-missing',!available);
  if (!available){
    choices('market-price-period',[]);
    note('price-note','公开 CMS Part B 支付限额观察');
    note('price-summary','');
    note('price-missing','本库暂未纳入该分子的可比 Part B 支付限额。');
    note('market-price-source',external(cms.sources.payment.link,'CMS 支付限额文件'));
    return;
  }
  const selected=priceRows.at(-1).period;
  choices('market-price-period',priceRows.map(r=>[r.period,periodLabel(r.period)]),selected);
  const series=seriesFor(priceRows,'value');
  priceState.spec={periods:priceRows.map(r=>r.period),series,selected,labels:periodLabel,formatY:moneyAxis,upper:priceAxis(series)};
  note('price-note',`美元／${esc(group.unit)} · 以本图所选季度的原研限额计算折溢价`);
  useLegend(priceState);
  priceEvidence();
}

function priceEvidence(){
  const period=byId('market-price-period').value;
  const record=priceRows.find(row=>row.period===period);
  if(!record)return;
  note('price-summary',stats([['原研',group.reference],['原研限额',valueFor(record.original?.value,'price')],['生效期',periodLabel(period)]]));
  const sorted=[...record.items].sort((a,b)=>Number(b.item.reference)-Number(a.item.reference)||a.value-b.value);
  note('market-price-table',table(['品牌','美元／'+group.unit,'相对原研','HCPCS'],sorted.map(row=>[
    esc(row.item.name),valueFor(row.value,'price'),
    row.item.reference?'基准':record.original?.value>0?
    (row.value<=record.original.value?'折价 ':'溢价 ')+share(Math.abs(1-row.value/record.original.value)):'—',
    row.code,
  ])));
  note('market-price-source',external(cms.paymentPeriods[period].url,'该季度 CMS 文件')+' · '+
    external(refs.cmsPolicy,'支付口径')+
    (group.id==='rituximab'&&period==='2026Q4'?'<br>Ruxience 的该季限额采用 AMP 口径。 '+linkReport(11,'三星报告第 11 页') : ''));
  priceState.spec.selected=period;
  updatePlot(priceState);
}

function renderMilestones(){
  byId('market-approvals').href='#approvals/'+encodeURIComponent(group.id);
  byId('market-dashboard').href='#dashboard/'+encodeURIComponent(group.id);
  note('market-status',group.products.length?
    table(['品牌','FDA 获批','美国商业上市','本库最早可见医保申报','企业与权益'],group.products.map(p=>[
      esc(p.name)+(p.reference?'<small>原研</small>':''),
      p.approval?external(p.approval.source,p.approval.date||'FDA 记录'):'—',
      p.launch?external(p.launch.source,p.launch.date):'待核实',
      p.firstClaim?esc(periodLabel(p.firstClaim)):'待核实',
      esc(p.roles||p.approval?.holder||'—')+(p.assetId?`<small><a href="#pipeline/asset/${encodeURIComponent(p.assetId)}">${esc(p.assetId)} · 管线</a></small>`:''),
    ])):'<p class="note">该分子的产品记录可通过上方获批入口查看。</p>');
}

function renderMolecule(id){
  group=groups.find(item=>item.id===id)||groups[0];
  shareState.hidden.clear();
  priceState.hidden.clear();
  byId('cms-molecule').value=group.id;
  byId('market-metric-note').textContent='';
  const quoted=refs.quotes.some(q=>q.molecule===group.id);
  [...byId('cms-metric').options].forEach(o=>{o.disabled=o.value==='iqvia'?!quoted:!group.products.length;});
  const hasPublicShare=prepareRows('annual','units').some(row=>isNumber(row.combined));
  byId('cms-metric').value=quoted&&!hasPublicShare?'iqvia':'units';
  byId('market-period').replaceChildren();
  renderShare();
  renderPrices();
  renderMilestones();
  show('market-wac',group.id==='adalimumab');
  if(group.id==='adalimumab'){
    const metadata=refs.wacMetadata;
    note('market-wac-table',`<p class="note">${esc(metadata.period)} · ${esc(metadata.unit)} · ${linkReport(metadata.page,'三星报告图 27')}（转述 Buy and Bill）</p>`+
      table(['品牌与渠道','标价策略','WAC（美元）'],refs.wac.map(item=>[esc(item.brand),esc(item.variant),'$'+nf.format(item.value)]))+
      '<p class="note">为报告明示的标价示例。报告未列示这些比较值对应的包装 NDC。</p>');
  }
}

function cohortPlot(cohorts,key,id,legendId) {
  const items=cohorts.filter(c=>c[key].length);
  const maximum=Math.max(1,...items.flatMap(c=>c[key].map(row=>row.age)));
  const periods=Array.from({length:maximum},(_,i)=>i+1);
  const series=items.map(item=>({
    label:item.label,color:colorPalette[refs.cohorts.findIndex(c=>c.id===item.id)%colorPalette.length],
    values:Object.fromEntries(item[key].map(point=>[point.age,point.value])),
    dash:refs.cohorts.findIndex(c=>c.id===item.id)>3,
  }));
  note(legendId,series.map(s=>`<span class="series-key"><i style="--series-color:${s.color}"></i>${esc(s.label)}</span>`).join(''));
  plot(id,{periods,series,labels:n=>'年 '+n,formatY:key==='usage'?pctAxis:n=>nf.format(n),
    upper:key==='usage'?1:Math.max(100,Math.ceil(Math.max(0,...items.flatMap(c=>c.price.map(row=>row.value)))/25)*25)});
}
function renderCohorts(){
  const category=byId('benchmark-category').value;
  const rows=refs.cohorts.filter(c=>!category||c.category===category);
  cohortPlot(rows,'usage','benchmark-uptake','benchmark-uptake-legend');
  const priceRows=rows.map(cohort=>{
    const observed=research.indexes[cohort.id].originator;
    const price=observed.rows.filter(row=>row.period.endsWith('Q4')&&Number(row.period.slice(0,4))>cohort.launch)
      .map(row=>({age:Number(row.period.slice(0,4))-cohort.launch,period:row.period,value:row.index,limit:row.value}));
    return {...cohort,base:observed.base,baseLimit:observed.rows[0].value,
      baseType:observed.preCompetition?'竞争前一期':'最早观察期',price};
  });
  cohortPlot(priceRows,'price','benchmark-price','benchmark-price-legend');
  note('benchmark-table',table(['分子','首个类似药上市年','最新公共剂量份额','原研价格基准期','最新 Q4 指数'],priceRows.map(c=>[
    `<a href="#market/${c.id}">${esc(c.label)}</a>`,
    c.launch,esc(c.usage.at(-1)?.period||'—')+' · '+share(c.usage.at(-1)?.value),
    esc(periodLabel(c.base))+' · '+esc(c.baseType)+' · '+valueFor(c.baseLimit,'price')+'／'+esc(c.unit),
    c.price.length?esc(periodLabel(c.price.at(-1).period))+' · '+nf.format(c.price.at(-1).value):'—',
  ])));
  note('benchmark-source',external(refs.hhs,'HHS 上市年份表')+' · '+external(cms.sources.annual.link,'CMS 年度数据')+' · '+
    external(cms.sources.payment.link,'CMS 季度支付限额'));
  const select=byId('benchmark-molecule');
  choices(select.id,rows.map(item=>[item.id,item.label]),select.value);
  if(!select.value&&rows.length)select.selectedIndex=0;
  renderIndexDetail();
}
function renderIndexDetail(){
  const item=research.indexes[byId('benchmark-molecule').value];
  drawIndex(byId('benchmark-payment-detail'),item,cms,'originator');
  drawIndex(byId('benchmark-weighted-detail'),item,cms,'weighted');
}
function renderReportIndex(){
  note('market-report-index',table(['报告版次','报告季度','发布日期','原始文档'],[...refs.archive].reverse().map(r=>[
    '第 '+r.edition+' 版',esc(periodLabel(r.period)),esc(r.date||'待核对'),
    r.url?external(r.url,r.pages?'三星 PDF':'官方 PDF 入口')+(r.release?' · '+external(r.release,'发布公告'):''):
     r.release?external(r.release,'发布公告')+' · PDF 待核对':'待核对',
  ])));
  note('report-audit',`<p>品牌和分子用量份额采用 Samsung Bioepis 对 IQVIA 资料的分析。MIDAS 为标准单位，报告参考表覆盖 2017 年 1 月至 2026 年 6 月。Weekly Sales Perspectives 覆盖 2023 年 1 月至 2026 年 8 月。各图实际观察期按单项标注。</p>
    <p>价格页区分 CMS 支付限额和报告中的 WAC。WAC 示例由三星引用 Buy and Bill。 ${linkReport(38,'参考来源，第 38 页')}</p>`);
  note('supply-sources',`<p>供应状态请核对 FDA 原始公告和短缺登记。三星的匿名批发商访谈作为定性资料。 ${external(refs.supply.fda,'FDA 药品短缺入口')} · ${linkReport(refs.supply.interviewPage,'三星访谈')}</p>`);
}

function setupModel(){
  const options=[['','选择参照分子'],...refs.cohorts.filter(c=>c.usage.length).map(c=>[c.id,c.label])];
  choices('model-benchmark-select',options);
  show('model-benchmark-box',true);
}
function selectedCohort(){
  return refs.cohorts.find(c=>c.id===byId('model-benchmark-select').value);
}
function modelReference(){
  const obs=selectedCohort()?.usage.at(-1);
  byId('apply-benchmark').disabled=!obs;
  note('model-benchmark-note',obs?`传统 Medicare Part B · ${obs.period} · 上市后第 ${obs.age} 年 · 已纳入编码剂量份额 ${share(obs.value)}`:
    '选取成熟品种的最新公开剂量份额，可手动填入当前情景的用量渗透率。');
}
byId('model-benchmark-select').addEventListener('change',modelReference);
byId('apply-benchmark').addEventListener('click',()=>{
  const obs=selectedCohort()?.usage.at(-1);
  if(!obs)return;
  const input=byId('slider-1');
  input.value=String(Math.round(obs.value*100));
  input.dispatchEvent(new Event('input',{bubbles:true}));
});

function updateRoute(){
  const [view,...params]=location.hash.slice(1).split('/');
  if(view!=='market'&&view!=='model')return;
  if(cms&&refs){ if(view==='market') showMarket(params[0]); return; }
  if(pending)return;
  pending=Promise.all(['medicare','market-references','market-research'].map(id=>fetch(new URL('./data/'+id+'.json',import.meta.url)).then(r=>{
    if(!r.ok)throw new Error(id+' HTTP '+r.status);return r.json();
  }))).then(async ([medicare,references,updated])=>{
    const supplement=await fetch(new URL('./public-data/cms.partb-values.json',import.meta.url))
      .then(r=>r.ok?r.json():null).catch(()=>null);
    for(const row of supplement?.records||[]){
      const key=row.kind.startsWith('asp-')?'price':row.kind;
      if(!['price','annual','quarterly'].includes(key))continue;
      const at=medicare[key].findIndex(item=>item.code===row.item.code&&item.period===row.item.period);
      if(at<0) medicare[key].push(row.item);
      else if(row.approved_revision) medicare[key][at]=row.item;
      if(row.period_meta) medicare.quarterPeriods[row.item.period]={...row.period_meta,file:row.source};
    }
    cms=medicare;
    refs=references;
    research=updated;
    groups=[...cms.groups,...refs.quotes.filter(q=>!cms.groups.some(g=>g.id===q.molecule)).map(q=>({
      id:q.molecule,label:q.label,reference:q.reference,products:[],
    }))];
    choices('cms-molecule',groups.map(g=>[g.id,g.label]));
    choices('benchmark-category',[['','全部领域'],...[...new Set(refs.cohorts.map(c=>c.category))].map(c=>[c,c])]);
    show('market-loading',false);
    show('market-content',true);
    setupModel();
    modelReference();
    if(location.hash.startsWith('#market'))showMarket(location.hash.split('/')[1]);
  }).catch(()=>{
    cms=refs=null;
    show('market-loading',true);
    byId('market-loading').textContent='市场数据暂时无法读取。';
    const retry=document.createElement('button');
    retry.className='outline';
    retry.textContent='重新加载';
    retry.addEventListener('click',updateRoute,{once:true});
    byId('market-loading').append(' ',retry);
  }).finally(()=>{pending=null;});
}

function showMarket(route){
  mode=route==='reports'||route==='benchmark'?route:'molecule';
  document.querySelectorAll('[data-market-tab]').forEach(tab=>{
    if(tab.dataset.marketTab===mode)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current');
  });
  for(const id of ['molecule','benchmark','reports'])show('market-'+id+'-view',mode===id);
  if(mode==='benchmark')renderCohorts();
  else if(mode==='reports')renderReportIndex();
  else renderMolecule(route||byId('cms-molecule').value||groups[0].id);
}

byId('cms-molecule').addEventListener('change',event=>{
  renderMolecule(event.target.value);
  history.replaceState(null,'','#market/'+group.id);
});
byId('cms-metric').addEventListener('change',renderShare);
byId('market-period').addEventListener('change',shareEvidence);
byId('market-price-period').addEventListener('change',priceEvidence);
byId('benchmark-category').addEventListener('change',renderCohorts);
byId('benchmark-molecule').addEventListener('change',renderIndexDetail);
for(const [state,selector,callback] of [[shareState,'market-period',shareEvidence],[priceState,'market-price-period',priceEvidence]]){
  byId(state.canvas).addEventListener('click',event=>{
    const spec=state.spec;
    if(!spec)return;
    const period=closestPeriod(event.currentTarget,event.offsetX,spec.periods);
    if(period){byId(selector).value=period;callback();}
  });
}
byId('market-export').addEventListener('click',()=>{
  const [dataset,metric,label]=metrics[byId('cms-metric').value];
  window.downloadCsv(group.id+'-'+metric,['分子','期间','品牌','HCPCS',label,'本期分母','份额',
      dataset==='annual'?'同比':'环比','CMS 原始来源'],
    shareRows.flatMap(p=>{
      const prior=priorPeriod(shareRows,p.period,dataset);
      return p.items.map(row=>[group.label,periodLabel(p.period),row.item.name,row.code,row.value,p.sample,share(row.share),
        difference(row.share,prior?.items.find(r=>r.code===row.code)?.share),
        cms.quarterPeriods[p.period]?.file||cms.sources[dataset].file]);
    }));
});
byId('price-export').addEventListener('click',()=>{
  window.downloadCsv(group.id+'-payment',['分子','生效季','品牌','HCPCS','计费单位','支付限额（美元）','CMS 原始来源'],
    priceRows.flatMap(p=>p.items.map(row=>[group.label,periodLabel(p.period),row.item.name,row.code,group.unit,row.value,cms.paymentPeriods[p.period].url])));
});
const observer=new ResizeObserver(entries=>entries.forEach(({target})=>{
  if(!markets.hidden&&screen[target.id])drawLines(target,screen[target.id]);
}));
for(const id of ['share-canvas','price-canvas','benchmark-uptake','benchmark-price'])observer.observe(byId(id));
window.addEventListener('hashchange',updateRoute);
updateRoute();
