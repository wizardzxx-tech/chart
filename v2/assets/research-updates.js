const root = new URL('../', import.meta.url);
const topic = document.body.dataset.updateTopic;
const number = Intl.NumberFormat('zh-CN',{maximumFractionDigits:2});
const elem=(tag,text)=>{const el=document.createElement(tag); if(text!=null)el.textContent=text;return el;};
const format=v=>v==null?'—':number.format(v);
const get=async path=>{
  const response=await fetch(new URL(path,root));
  if(!response.ok) return null;
  return response.json();
};

function table(container, headers, rows) {
  const wrap=elem('div'); wrap.className='update-scroll';
  const t=elem('table'); const h=t.createTHead().insertRow(); const b=t.createTBody();
  for(const name of headers){const th=elem('th',name);th.scope='col';h.appendChild(th);}
  for(const row of rows){
    const r=b.insertRow();
    for(const value of row){
      const cell=r.insertCell();
      if(value instanceof HTMLElement)cell.append(value);else cell.textContent=value;
    }
  }
  wrap.appendChild(t); container.appendChild(wrap);
}
function source(url,text='原始来源') {
  const link=elem('a',text);link.href=url;return link;
}
function chart(container,title, points, unit) {
  const section=elem('figure'); section.className='research-line';
  section.append(elem('figcaption',title));
  const valid=points.filter(point=>Number.isFinite(point[1]));
  if(!valid.length) {section.append(elem('p','此口径暂无可计算数据。'));container.append(section);return;}
  const width=720, height=196, left=62, right=20, top=16, bottom=35;
  const min=Math.min(0,...valid.map(p=>p[1])), max=Math.max(1,...valid.map(p=>p[1]));
  const namespace='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(namespace,'svg');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  svg.setAttribute('role','img');svg.setAttribute('aria-label',title+'（'+unit+'）');svg.style.width='100%';
  function draw(type,attr,text){
    const item=document.createElementNS(namespace,type);
    for(const [key,value] of Object.entries(attr))item.setAttribute(key,value);
    if(text)item.textContent=text;svg.append(item);return item;
  }
  const x=i=>left+i*(width-left-right)/Math.max(1,points.length-1);
  const y=n=>height-bottom-(n-min)*(height-top-bottom)/(max-min);
  for(const n of [min,(min+max)/2,max]){
    draw('line',{x1:left,x2:width-right,y1:y(n),y2:y(n),stroke:'#d9e6e3'});
    draw('text',{x:left-6,y:y(n)+4,fill:'#51686c','text-anchor':'end','font-size':11},format(n));
  }
  let previous=null;
  for(const [i,[label,value]] of points.entries()){
    if(i===0||i===points.length-1||i%Math.ceil(points.length/6)===0){
      draw('text',{x:x(i),y:height-10,fill:'#51686c','text-anchor':'middle','font-size':11},label);
    }
    if(!Number.isFinite(value)){previous=null;continue;}
    if(previous)draw('line',{x1:previous[0],y1:previous[1],x2:x(i),y2:y(value),stroke:'#187f75','stroke-width':2});
    const point=draw('circle',{cx:x(i),cy:y(value),r:3,fill:'#187f75'});
    draw('title',{},label+'  '+format(value)+' '+unit);
    point.appendChild(svg.lastElementChild);
    previous=[x(i),y(value)];
  }
  section.appendChild(svg);container.appendChild(section);
}
function panel(parent,title) {
  const section=elem('section');section.className='update-provenance';section.append(elem('h3',title));parent.append(section);return section;
}
async function insurance() {
  const parent=document.getElementById('pooled');
  const data=await get('medical-insurance/trends.json');
  if(!parent||!data?.pooled?.length)return;
  document.getElementById('pooled-title').textContent='统筹基金 · 年内累计';
  const groups={total:'合计',employee:'职工医保（含生育）',resident:'城乡居民医保'};
  const latest=data.pooled.at(-1);
  const section=panel(parent,'最新审核入库的月度统计');
  table(section,['累计截至','基金','收入（亿元）','支出（亿元）','收支差额（亿元）','来源'],
    data.pooled.slice().reverse().flatMap(d=>Object.entries(groups).map(([group,label])=>{
      const income=Number(d[group+'_income']), spend=Number(d[group+'_spending']);
      return [d.period,label,format(income),format(spend),format(income-spend),source(d.source)];
    })));
  const points=data.pooled.map(d=>[d.period,Number(d.total_income)]);
  if(points.length===1 && latest.period==='2026-10')points.unshift(['2026-09',23028.33]);
  chart(section,'本年累计统筹基金收入',points,'亿元');
  section.append(elem('p',`其中生育保险基金待遇累计支出 ${format(latest.maternity_spending)} 亿元。`),source(latest.image,'官方原图'));
}
async function lots(topic) {
  const parent=document.getElementById('lot-release');
  const result=await get(topic+'/center-updates.json');
  if(!parent||!result?.reports?.length)return;
  const section=panel(parent,'中检院公告新增批次');
  section.append(elem('p','以下统计范围为中检院自身公告。全国图表继续使用各签发机构核验后的历史数据。'));
  chart(section,'中检院公告期内签发批次',result.reports.map(r=>[r.period,r.total]),'批');
  const rows=result.reports.slice().reverse();
  table(section,['签发区间','本专题批数','批签发机构','来源'],
    rows.map(r=>[r.start+' 至 '+r.period,r.total,r.agency,source(r.source)]));
  for(const row of rows){
    if(!row.aggregates.length)continue;
    const d=elem('details');d.append(elem('summary',row.period+' 品种与公司明细'));
    table(d,['品种','公司／集团','原始产品名','批数'],row.aggregates.map(x=>[x.category,x.company,x.product,x.batches]));
    section.append(d);
  }
}
async function finance(topic) {
  const parent=document.getElementById('working-capital');
  if(!parent)return;
  const payload=await get('pharmacy/public-data/financials.standard.json');
  if(!payload?.records?.length)return;
  const registry={pharmacy:['603939.SH','603233.SH'],'blood-products':['600161.SH'],vaccines:['300122.SZ'],
    ophthalmology:['300015.SZ'],insulin:['603087.SH','LLY.US']};
  const allowed=registry[topic]; if(!allowed)return;
  const rows=payload.records.filter(r=>r.filing?.topics?.includes(topic)||allowed.includes(r.ticker));
  if(!rows.length)return;
  const section=panel(parent,'标准财务报表与周转天数');
  section.dataset.researchFinance=topic;
  const menu=elem('select');menu.setAttribute('aria-label','公司');
  for(const ticker of [...new Set(rows.map(r=>r.ticker))]){
    const opt=elem('option',rows.find(r=>r.ticker===ticker).name+' · '+ticker);opt.value=ticker;menu.append(opt);
  }
  const metric=elem('select');metric.setAttribute('aria-label','财务指标');
  const fields={revenue:'营业收入',cost:'营业成本',net_profit:'归母净利润',operating_cash_flow:'经营现金流',
      capex:'资本开支',gross_margin:'毛利率',ccc:'现金转换周期',dso:'DSO',dio:'DIO',dpo:'DPO'};
  for(const [key,label] of Object.entries(fields)){
    const option=elem('option',label);option.value=key;metric.append(option);
  }
  const mode=elem('select');mode.setAttribute('aria-label','财务口径');
  for(const [key,label] of [['quarter','单季'],['ttm','TTM']]){const option=elem('option',label);option.value=key;mode.append(option);}
  const body=elem('div');section.append(menu,metric,mode,body);
  const render=()=>{
    body.replaceChildren();
    const series=rows.filter(r=>r.ticker===menu.value).sort((a,b)=>a.period.localeCompare(b.period));
    const raw=series[0].currency;
    const field=metric.value;
    const unit=field==='gross_margin'?'%':['dso','dio','dpo','ccc'].includes(field)?'天':raw+' 百万';
    const multiplier=unit==='%'?100:unit==='天'?1:1e-6;
    chart(body,fields[field],series.map(r=>[r.period.slice(0,7),r[mode.value]?.[field]==null?null:r[mode.value][field]*multiplier]),unit);
    const latest=series.at(-1);
    body.append(elem('p',`最新报告期 ${latest.period}`),source(latest.filing?.document_url||latest.source));
  };
  for(const control of [menu,metric,mode])control.addEventListener('change',render);
  render();
}

if(topic==='medical-insurance')insurance().catch(console.warn);
if(['blood-products','vaccines'].includes(topic))lots(topic).catch(console.warn);
if(topic)finance(topic).catch(console.warn);

async function regulatory() {
  const [fda,trials]=await Promise.all([get('biosimilars/public-data/fda.research-actions.json'),
    get('biosimilars/public-data/nih.clinical-trials.json')]);
  const approvals=document.getElementById('view-approvals');
  if(approvals && fda?.records?.length) {
    const section=panel(approvals,'FDA 批准行动监测');
    const labels={initial:'首次批准',supplement:'补充批准',other:'其他批准行动',reference:'参照药',
      biosimilar:'生物类似药',unverified:'分类待核'};
    table(section,['日期','分子','申请号','行动','分类','来源'],
      fda.records.slice(-30).reverse().map(row=>[row.period,row.molecule,row.application,
        labels[row.action_kind],labels[row.category],source(row.source)]));
  }
  const pipeline=document.getElementById('view-pipeline');
  if(pipeline && trials?.records?.length) {
    const section=panel(pipeline,'ClinicalTrials.gov 已匹配试验');
    table(section,['NCT','公开更新日','试验状态','来源'],trials.records.map(row=>[row.nct,row.period,row.status,source(row.source)]));
  }
}
if(topic==='biosimilars')regulatory().catch(console.warn);

async function monthlyTrade(topic,feed) {
  const parent=document.getElementById('customs-trade');
  if(!parent)return;
  const [data,summary,hs6,history,master]=await Promise.all([
    ...['monthly','summary','hs6','reference-history'].map(k=>get(topic+'/public-data/'+feed+'.trade-'+k+'.json')),
    get(topic+'/customs-trade.json')]);
  if(!master)return;
  const products=master.products||((await Promise.all(master.parts.map(name=>get(topic+'/'+name)))).flat());
  const manual=(master.recent?.monthly||[]).flatMap(series=>series.points.map(([period,amount])=>({
    period:String(period).replace(/(\d{4})(\d{2})/,'$1-$2-01'),product:series.code,code:series.code,
    flow:series.flow,amount,qty:null,unit:null,quality:series.quantityStatus,
    source:master.recent.sources[series.source].url})));
  const feeds={original:data?.records||[],summary:summary?.records||[],hs6:hs6?.records||[],history:history?.records||[],manual};
  const section=panel(parent,'月度进出口与来源版本');
  section.dataset.monthlyTrade=topic;
  section.append(elem('p','全国单月美元值。各来源和税号分别展示。同比、年内累计和滚动额要求同来源、同编码及可比月份齐备。'));
  const vintage=elem('select');vintage.setAttribute('aria-label','月度数据来源');
  const names={original:'UN Comtrade 原申报码',summary:'国贸通公开月报 · HS8',
    hs6:'UN Comtrade 标准 HS6',history:'HS10 历史金额 · HS归类通',manual:'历史人工核验 · 海关转引'};
  for(const [key,label] of Object.entries(names)){
    if(feeds[key].length||key==='original')vintage.add(new Option(label,key));
  }
  vintage.value=feeds.summary.length?'summary':'original';
  const picker=elem('select');picker.setAttribute('aria-label','月度商品');
  const flow=elem('select');flow.setAttribute('aria-label','月度贸易方向');
  const view=elem('select');view.setAttribute('aria-label','月度指标');
  const fields={amount:'月度金额（美元）',qty:'月度数量',asp:'单位金额',growth:'金额同比（%）',ytd:'年内累计金额（美元）',rolling:'滚动三个月金额（美元）'};
  for(const [key,label] of Object.entries(fields)) view.add(new Option(label,key));
  for(const [key,label] of [['X','出口'],['M','进口']]) flow.add(new Option(label,key));
  const output=elem('div');section.append(vintage,picker,flow,view,output);
  const refreshProducts=()=>{
    const previous=picker.value;
    const codes=vintage.value==='original'?products.map(p=>p.code):[...new Set(feeds[vintage.value].map(r=>r.product))];
    picker.replaceChildren(...codes.map(code=>{
      const product=products.find(p=>p.code===code);
      const notes={'9022120000':'CT','9018131000':'成套 MRI','9018129110':'彩超整机','902212':'CT','382219':'其他诊断或实验室试剂','382213':'血型鉴定试剂'};
      const publicLabel=feeds[vintage.value].find(r=>r.product===code&&r.product_label)?.product_label;
      const label=product?.label||notes[code]||publicLabel;
      return new Option(label?label+' · '+code:code,code);
    }));
    if(codes.includes(previous))picker.value=previous;
    else if(vintage.value==='original'){
      const initial=feeds.original.find(r=>r.flow==='X');
      if(initial)picker.value=initial.product;
    }
  };
  const monthIndex=day=>12*Number(day.slice(0,4))+Number(day.slice(5,7))-1;
  const monthLabel=n=>Math.floor(n/12)+'-'+String(n%12+1).padStart(2,'0');
  const render=()=>{
    output.replaceChildren();
    const selected=feeds[vintage.value].filter(r=>r.product===picker.value&&r.flow===flow.value);
    if(!selected.length){output.append(elem('p','该品类和方向尚无已核对的月度记录。'));return;}
    const byMonth=new Map(selected.map(r=>[monthIndex(r.period),r]));
    const end=Math.max(...byMonth.keys()), start=Math.min(...byMonth.keys());
    const compatible=(a,b)=>a&&b&&a.code===b.code&&a.unit===b.unit;
    const sum=(idx,len,row)=>{
      const values=Array.from({length:len},(_,i)=>byMonth.get(idx-i));
      return values.every(v=>compatible(row,v))?values.reduce((a,r)=>a+r.amount,0):null;
    };
    const points=Array.from({length:end-start+1},(_,i)=>{
      const idx=start+i,row=byMonth.get(idx),base=byMonth.get(idx-12);
      const derived=row?{...row,growth:compatible(row,base)&&base.amount>0?(row.amount/base.amount-1)*100:null,
        ytd:sum(idx,(idx%12)+1,row),rolling:sum(idx,3,row)}:null;
      return [monthLabel(idx),derived];
    });
    const chosen=byMonth.get(end);
    const unit={kg:'千克',number:'申报计数'}[chosen.unit]||chosen.unit||'待核实';
    output.append(elem('p',`已核对至 ${monthLabel(end)} · HS ${chosen.code} · 数量单位 ${unit}`));
    chart(output,fields[view.value],points.map(([m,row])=>[m,row?.[view.value]]),'');
    table(output,['月份','金额（美元）','数量','单位金额','金额同比%','年内累计金额','滚动三个月金额','数量口径','来源'],
      points.slice(-36).reverse().map(([m,d])=>[m,...['amount','qty','asp','growth','ytd','rolling'].map(k=>format(d?.[k])),
        d?.quality||d?.world?.[2]||'—',d?source(d.source):'—']));
  };
  for(const select of [picker,flow,view])select.addEventListener('change',render);
  vintage.addEventListener('change',()=>{refreshProducts();render();});
  refreshProducts();
  render();
}
const tradeFeeds={api:'api','medical-devices':'devices',vaccines:'vax'};
if(topic in tradeFeeds) monthlyTrade(topic,tradeFeeds[topic]).catch(console.warn);

async function agencyCoverage() {
  const parent=document.getElementById('lot-release');
  if(!parent)return;
  const data=await get('vaccines/public-data/vax.agency-coverage.json');
  if(!data?.records?.length)return;
  const section=panel(parent,'全国公示 · 分机构覆盖');
  section.dataset.agencyCoverage='';
  const dates=[...new Set(data.records.map(r=>r.period))].sort().reverse();
  const picker=elem('select');picker.setAttribute('aria-label','批签发覆盖周');
  for(const date of dates)picker.add(new Option(date+' 截止周',date));
  section.append(picker);
  const scope=topic==='vaccines'?'vax':'blood';
  const official=dates.slice().reverse().map(date=>[date,data.records.find(r=>r.period===date).national?.[scope]]);
  if(official.some(([,value])=>value?.complete)){
    chart(section,'全国已核验周批签发',official.map(([date,value])=>[date,value?.batches]),'批');
  }
  const result=elem('div');section.append(result);
  const render=()=>{
    result.replaceChildren();
    const rows=data.records.filter(r=>r.period===picker.value);
    const latest=rows[0];
    result.append(elem('p',`${latest.verified_agencies}/${latest.registered_agencies} 家机构已核对完整周公告。各机构可能采用不同签发区间，暂无公告的机构记为覆盖待确认。`));
    const national=latest.national?.[scope];
    if(national) result.append(elem('p',`可用于本专题全国汇总的覆盖为 ${national.verified_agencies}/${national.required_agencies} 家 · ${national.complete?'全国批数 '+national.batches:'全国批数待核'}`));
    table(result,['签发机构','所选周覆盖','公告数','缺失日期','跨周待归属批数','已核授权','目录最新周','官方入口'],rows.map(r=>{
      const authority=r.authorized_scope;
      const scopeConfirmed=authority?.verified_included?.includes(scope);
      return [r.agency,r.status==='records'?'已核对完整周':r.status==='failed'?'原表读取失败':'待核对',
        r.reports.length,r.uncovered_days?.join('、')||'—',format(r.unassigned?.[scope]),
        scopeConfirmed?source(authority.source,'官方授权依据'):'待补证',
        r.registry_latest||'—',source(r.source)];
    }));
    result.append(source(latest.authorization_source,'机构及授权调整公告'));
  };
  picker.addEventListener('change',render);render();
}
if(['vaccines','blood-products'].includes(topic))agencyCoverage().catch(console.warn);

async function operatingMetrics(topic) {
  const target=document.getElementById('working-capital')||document.querySelector('main');
  const data=await get('update-center/operating-metrics.json');
  const records=(data?.records||[]).filter(r=>r.topic===topic);
  if(!records.length||!target)return;
  const section=panel(target,'已审核经营指标');section.dataset.operatingReviewed=topic;
  const modes={point:'期末',quarter:'单季',half:'半年累计',annual:'全年'};
  table(section,['报告期','公司','指标','数值','单位','期间','来源'],records.slice(-30).reverse().map(r=>[
    r.period,r.ticker,r.label,format(r.value),r.unit,modes[r.period_kind],source(r.source+'#page='+r.page,'财报第 '+r.page+' 页')]));
}
if(['pharmacy','blood-products','ophthalmology','insulin'].includes(topic))operatingMetrics(topic).catch(console.warn);
