import {mountCompanyTrend} from '../pharmacy/company-trend.js';

const root = document.querySelector('#api-research');
const el = id => root.querySelector('#' + id);
const nf = new Intl.NumberFormat('zh-CN', {maximumFractionDigits: 2});
const format = (value, suffix = '') => Number.isFinite(value) ? nf.format(value) + suffix : '—';
const pct = value => format(value, '%');
const esc = value => String(value ?? '').replace(/[&<>"']/g, key =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[key]);
const cite = (url, label = '原文') => url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>` : '—';
const opts = (target, items) => target.replaceChildren(...items.map(([key, value]) => new Option(value, key)));
const table = (labels, rows, empty = '暂无已取得记录。') => rows.length ? `
  <div class="trade-scroll" role="region" aria-label="${esc(labels.join('、'))}" tabindex="0">
  <table class="api-table"><thead><tr>${labels.map(label => `<th scope="col">${esc(label)}</th>`).join('')}</tr></thead>
  <tbody>${rows.map(([head, ...cells]) => `<tr><th scope="row">${head}</th>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : `<p class="api-note">${esc(empty)}</p>`;
const links = {
  un: 'https://comtradeplus.un.org/en/tariffline',
  gacc: 'https://stats.customs.gov.cn/',
  chamber: 'https://www.cccmhpie.org.cn/newsinfo/11274664.html',
};

function recent(data) {
  el('industry-stats').innerHTML = `<p class="api-note">${esc(data.recentNote)} ${cite(links.gacc, '中国海关查询')}</p>` +
    table(['阶段与口径', '出口额（亿美元）', '金额同比', '净重同比', '单位金额（美元／公斤）', '单位金额变动', '来源'],
      data.recent.map(row => [esc(row.period + ' · ' + row.label), format(row.usd100m), pct(row.yoy),
        esc(row.volume ?? '—'), format(row.usdKg), esc(row.unitChange ?? '—'), cite(row.url || links.chamber, row.source)]));
  const area = el('monthly-section');
  const groups = data.monthly;
  area.hidden = !groups.length;
  if (!groups.length) return;
  const picker = el('monthly-product');
  opts(picker, groups.map(x => [x.id, x.label]));
  const periods = Array.from({length:12}, (_, i) => `${i + 1} 月`);
  const years = [2025, 2026];
  const units = {amount:'百万美元', kg:'吨', unit:'美元／公斤'};
  const selected = () => groups.find(x => x.id === picker.value);
  const value = row => {
    if (!row) return null;
    if (el('monthly-metric').value === 'kg') return row.kg ? row.kg / 1000 : null;
    if (el('monthly-metric').value === 'unit') return row.kg && row.quality==='原表' ? row.amount / row.kg : null;
    return row.amount / 1e6;
  };
  const chart = mountCompanyTrend(el('monthly-trend'), years.map(y => ({code:String(y),name:String(y)})), periods, {
    defaultCodes:years.map(String),
    labelTick: () => true,
    getPoints:s => periods.map((_, i) => {
      const row = selected().rows.find(r => r.period === Number(s.code)*100+i+1);
      const count = value(row);
      return Number.isFinite(count) ? {count, value:format(count, ' ' + units[el('monthly-metric').value]),
        detail:row.quality + ' · HS ' + selected().id} : null;
    })
  });
  function refresh() {
    const group = selected(), metric = el('monthly-metric').value;
    el('monthly-title').textContent = group.label + ' · ' + units[metric];
    const rows = new Map(group.rows.map(x => [x.period, x]));
    const matching = periods.map((_,i) => [rows.get(202501+i), rows.get(202601+i)]).filter(([a,b]) => a&&b);
    const sameYtd = [];
    for(let i=1; i<=12; i++) {
      const pair=matching.find(([, b]) => b.period %100 === i);
      if(!pair) break;
      sameYtd.push(pair);
    }
    const subtotal = (subset) => {
      const amount = subset.reduce((sum, r) => sum + r.amount, 0);
      const kg = subset.every(r => r.kg > 0 && r.quality==='原表') ? subset.reduce((sum, r)=>sum+r.kg, 0) : null;
      return {amount, kg, unit: kg ? amount / kg : null};
    };
    const yoy=(a,b) => Number.isFinite(a) && b>0 ? pct((a/b-1)*100) : '—';
    const notes = sameYtd.length ? (() => {
      const a=subtotal(sameYtd.map(row=>row[0])), b=subtotal(sameYtd.map(row=>row[1]));
      return `2026 年 1–${sameYtd.length} 月 · 同期金额 ${format(b.amount,' 美元')}（${yoy(b.amount,a.amount)}） · 净重 ${format(b.kg,' kg')}（${yoy(b.kg,a.kg)}） · 单位金额 ${format(b.unit,' 美元／公斤')}（${yoy(b.unit,a.unit)}）`;
    })() : '目前没有从 1 月开始连续覆盖的同口径月份。';
    el('monthly-evidence').innerHTML = `<p class="api-note">${notes}</p>` +
      table(['月份','美元','净重（kg）','美元／公斤','金额同比','重量同比','单位金额同比','来源'],
        [...group.rows].reverse().map(row => {
          const current=row.period>=202601, prev=rows.get(row.period-100);
          const unit=row.kg>0&&row.quality==='原表'?row.amount/row.kg:null;
          const previousUnit=prev?.kg>0&&prev.quality==='原表'?prev.amount/prev.kg:null;
          return [esc(String(row.period)),format(row.amount),format(row.kg),format(unit),
            current?yoy(row.amount,prev?.amount):'—',current&&row.quality==='原表'&&prev?.quality==='原表'?yoy(row.kg,prev.kg):'—',
            current?yoy(unit,previousUnit):'—',cite(row.source,'UN Comtrade')+` · ${esc(row.quality)}`];
        }));
    chart?.refresh();
  }
  picker.addEventListener('change', refresh);
  el('monthly-metric').addEventListener('change', refresh);
  refresh();
}

function focused(data, products) {
  const picker = el('molecule-select');
  opts(picker,data.focus.map(item=>[item.code,item.name]));
  const market = new Map(products.map(p=>[p.code,p]));
  const graph=el('focus-trend');
  const series=[{code:'uv',name:'单位金额'}];
  const years=[...new Set(products.flatMap(p=>p.series.map(r=>r.year)))].sort();
  const current=()=>data.focus.find(x=>x.code===picker.value);
  const scenarioFields=['scenario-base','scenario-share','scenario-price','scenario-cost'];
  const scenarioBase={
    apa:{amount:12.05858,name:'联邦制药 2025 年 6-APA 收入'},
    vc:{amount:22.31,name:'石药集团 2025 年维生素 C 产品收入'},
  };
  function scenario(){
    const fields=scenarioFields.map(el);
    const [base,exposure,price,cost]=fields.map(input=>input.valueAsNumber);
    const estimate=base*exposure/100*price/100-cost;
    el('scenario-result').textContent=fields.some(input=>!input.validity.valid)||!Number.isFinite(estimate)
      ? '输入同口径产品收入及其他假设后计算。'
      : `情景毛利变动 ${estimate>0?'+':''}${format(estimate)} 亿元人民币`;
  }
  const rows=()=>market.get(picker.value)?.series || [];
  const metric=()=>el('focus-metric').value;
  const metricName=()=>({unit:'美元／公斤', amount:'百万美元', volume:'吨'})[metric()];
  const sample = r => {
    const [usd,kg,quality,,coverage]=r.world;
    const raw=quality==='原表'||quality==='申报';
    const reference=el('focus-ref').checked&&quality==='估算状态未提供';
    const quotient=(raw||reference)&&kg>0&&coverage>=.995 ? usd/kg : null;
    const Count={unit:quotient, amount:usd/1e6, volume:kg>0?kg/1000:null}[metric()];
    return {usd,kg,quality,coverage,quotient,count:Count,proxy:!raw};
  };
  const chart=mountCompanyTrend(graph,series,years.map(String),{
    defaultCodes:['uv'],
    labelTick:()=>true,
    getPoints:(_,dates)=>dates.map(y=>{
      const r=rows().find(r=>r.year===Number(y));
      if(!r)return null;
      const s=sample(r);
      if(!Number.isFinite(s.count))return null;
      const prior=rows().find(p=>p.year===r.year-1);
      return {count:s.count,value:format(s.count,' '+metricName()),
        estimate:metric()!=='amount'&&s.proxy,dashedBefore:metric()!=='amount'&&s.proxy,breakBefore:prior&&prior.code!==r.code,
        detail:[r.code,s.quality, r.chinaCustomsCheck].filter(Boolean).join(' · ')};
    })
  });
  function refresh(){
    const product=current();
    el('focus-title').textContent=product.name+' · '+metricName();
    el('focus-analysis').innerHTML=`<p>${esc(product.context)} ${cite(product.source)}</p>`;
    el('focus-table').innerHTML=table(['年度','实际编码','出口额（百万美元）','净重（吨）','美元／公斤','金额同比','单位金额同比','净重证据'],
      [...rows()].reverse().map(r=>{
        const s=sample(r);
        const previous=rows().find(p=>p.year===r.year-1&&p.code===r.code);
        const p=previous&&sample(previous);
        const yoy=(x,y)=>x>0&&y>0?pct((x/y-1)*100):'—';
        return [String(r.year),r.code,format(s.usd/1e6),format(s.kg>0?s.kg/1000:null),format(s.quotient),
          yoy(s.usd,p?.usd),yoy(s.quotient,p?.quotient),r.reconciliation
            ? cite(r.reconciliation.url,'HS6 原报公斤值吻合')+' · '+cite(r.url,'HS8')
            : esc(s.quality)+' · '+cite(r.url,'贸易数据')];
      }));
    el('focus-company').innerHTML=companyTable(data.companies.filter(row=>row.products.includes(product.id)));
    chart?.refresh();
  }
  for(const id of ['molecule-select','focus-metric','focus-ref'])el(id).addEventListener('change',refresh);
  const scenarioInput=el('scenario-base');
  function prefill(){
    const official=scenarioBase[current().id];
    scenarioInput.value=official?.amount??'';
    scenarioInput.title=official?.name??'自行输入同口径的产品收入';
    scenario();
  }
  picker.addEventListener('change',prefill);
  scenarioFields.forEach(id=>el(id).addEventListener('input',scenario));
  refresh();
  prefill();
}

function companyTable(rows) {
  return table(['公司','产业链与品种','财报指标','产能或项目','量价传导'], rows.map(row=>[
    esc(row.name)+`<small>${esc(row.ticker)}</small>`,esc(row.scope),
    esc(row.finance || '该产品未单列')+' · '+cite(row.source,'披露'),
    esc(row.capacity || '—'),esc(row.transmission || '待继续核对'),
  ]));
}

function companyDirectory(data) {
  const dropdown=el('company-group');
  opts(dropdown,[['','全部公司'],...[...new Set(data.companies.map(r=>r.group))].map(group=>[group,group])]);
  function refresh() {
    el('company-table').innerHTML=companyTable(data.companies.filter(row=>!dropdown.value||row.group===dropdown.value));
  }
  dropdown.addEventListener('change',refresh);
  refresh();
}

function regulatory(data) {
  const registry = data.registry;
  const molecule=el('reg-molecule'), company=el('reg-company'), slot=el('reg-type'), status=el('reg-status');
  opts(molecule,[['','全部分子'],...Object.entries(registry.molecules).map(([k,v])=>[k,v])]);
  opts(company,[['','全部已核对公司'],...data.companies.filter(x=>registry.rows.some(r=>r.company===x.id)).map(x=>[x.id,x.name])]);
  opts(slot,[['','全部登记'],...Object.keys(registry.sources).map(id=>[id,id])]);
  const companies=new Map(data.companies.map(r=>[r.id,r.name]));
  
  const count=el('reg-count');
  el('registry-sources').innerHTML=Object.entries(registry.sources).map(([name,src])=>
    `<p class="api-note">${esc(name)} · ${esc(src.note)} ${cite(src.url, '官方出处')}${src.file?' · '+cite(src.file,'原始下载'):''}</p>`).join('');
  function refresh(){
    const rows=registry.rows.filter(r=>(!molecule.value||molecule.value===r.molecule)&&
      (!company.value||company.value===r.company)&&(!slot.value||slot.value===r.type)&&
      (!status.value||(status.value==='active')===r.active));
    count.textContent=`${rows.length} 条匹配档案 · 页面显示前 100 条，CSV 包含全部`;
    el('reg-table').innerHTML=table(['分子','持有人／匹配公司','登记类型','登记号','公开状态','登记日期'],rows.slice(0,100).map(r=>[
      esc(registry.molecules[r.molecule]),esc(r.holder)+`<small>${esc(companies.get(r.company)||'')}</small>`,
      esc(r.type),esc(r.number)+(r.source?' · '+cite(r.source,'公司披露'):''),esc(r.status),esc(r.date||'—')]));
    count.dataset.rows=String(rows.length);
    el('registry-download').onclick=()=>{
      const safe=value=>'"'+String(value ?? '').replace(/^[=+@-]/, ch=>"'"+ch).replaceAll('"','""')+'"';
      const rowsCsv=[['分子','企业','持有人','类型','登记号','状态','登记日期','来源'],
        ...rows.map(r=>[registry.molecules[r.molecule],companies.get(r.company),r.holder,r.type,r.number,r.status,r.date,r.source||registry.sources[r.type].url])];
      const url=URL.createObjectURL(new Blob(['\ufeff'+rowsCsv.map(r=>r.map(safe).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
      const a=document.createElement('a'); a.href=url; a.download='api-regulatory-filings.csv'; a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
  }
  for(const f of [molecule,company,slot,status])f.addEventListener('change',refresh);
  refresh();
}

async function get(path) {
  const response=await fetch(new URL(path,import.meta.url));
  if(!response.ok)throw new Error('HTTP '+response.status);
  return response.json();
}
async function start() {
  const [data,summary]=await Promise.all([get('./research.json'),get('./customs-trade.json')]);
  const products=(await Promise.all(summary.parts.map(get))).flat();
  focused(data,products);
  recent(data);
  companyDirectory(data);
  regulatory(data);
  el('research-status').hidden=true;
}
start().catch(error=>{
  console.error(error);
  el('research-status').textContent='研究数据暂时无法读取。';
});
