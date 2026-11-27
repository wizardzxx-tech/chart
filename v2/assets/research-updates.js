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
  const rows=payload.records.filter(r=>allowed.includes(r.ticker));
  if(!rows.length)return;
  const section=panel(parent,'标准财务报表与周转天数');
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
    body.append(source(latest.source));
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
