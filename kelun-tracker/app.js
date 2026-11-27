const byId = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[char]);
const link = (url, label) => /^https:\/\//.test(url) ?
  `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : esc(label);
const fmt = new Intl.NumberFormat('zh-CN', {minimumFractionDigits:2, maximumFractionDigits:2});
const integer = new Intl.NumberFormat('zh-CN');
const n = value => Number.isFinite(value) ? fmt.format(value) : '—';
const pct = value => Number.isFinite(value) ? n(value * 100) + '%' : '—';
const rate = value => Number.isFinite(value) ? value.toFixed(4) : '—';
const states = {complete:'完整', provisional:'暂定', incomplete:'缺项'};
const assetNames = {kelun:'科伦药业', skb:'科伦博泰', cn:'川宁生物', ssy:'石四药集团', cisen:'辰欣药业'};
const measures = [
  ['parent_cap','科伦市值',n,'全股本市值'], ['listed','上市持股合计',n,'四家被投公司的经济权益'],
  ['residual','剩余权益价值',n,'科伦市值减去上市持股'], ['coverage','上市资产覆盖率',pct,'上市持股合计 ÷ 科伦市值'],
];
const plots = {displaylogo:false, responsive:true, scrollZoom:false, modeBarButtonsToRemove:['lasso2d','select2d']};
let assets = [];
let ownership = [];
let fx = [];
let published = null;
let imported = null;
let feedStatus = 'pending';
let activeRange = '1Y';
let viewRows = [];
let page = 0;
const pageSize = 24;
const json = async url => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response.json();
};

function chart(id, traces, settings = {}) {
  const element = byId(id);
  if (!traces.length || !window.Plotly) {
    if (element.classList.contains('js-plotly-plot')) window.Plotly.purge(element);
    element.classList.add('empty');
    element.textContent = traces.length ? '图表组件暂不可用，数据仍可在下方表格查看。' : '当前时段暂无可绘制的数据。';
    return;
  }
  if (element.classList.contains('empty')) element.textContent = '';
  element.classList.remove('empty');
  window.Plotly.react(element, traces, {
    autosize:true, margin:{l:53,r:16,t:17,b:52}, paper_bgcolor:'#fff', plot_bgcolor:'#fff',
    font:{family:'-apple-system, PingFang SC, Microsoft YaHei, sans-serif',color:'#405c6b',size:11},
    xaxis:{type:'date',showgrid:false, automargin:true}, yaxis:{gridcolor:'#e3ebee',zerolinecolor:'#8299a2',automargin:true},
    hovermode:'x unified', legend:{orientation:'h',y:-.17}, ...settings,
  }, plots).catch(() => {
    element.classList.add('empty');
    element.textContent = '图表暂时无法显示。';
  });
}

function line(name, data, color, unit, extra = {}) {
  return {type:'scatter',mode:'lines',name,x:data.map(row=>row[0]),y:data.map(row=>row[1]),
    connectgaps:false,line:{color,width:2},hovertemplate:`%{y:.2f}${unit}<extra>${name}</extra>`,...extra};
}

function since(date) {
  if (activeRange === 'All') return '0000-01-01';
  if (activeRange === 'YTD') return date.slice(0,4) + '-01-01';
  const end = new Date(date+'T00:00:00Z');
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() - {'1M':1,'3M':3,'6M':6,'1Y':12}[activeRange]);
  const days = new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();
  end.setUTCDate(Math.min(day, days));
  return end.toISOString().slice(0,10);
}

function renderOwnership() {
  byId('ownership-summary').tBodies[0].innerHTML = assets.map(asset => {
    const records = ownership.filter(row=>row.asset===asset.id).sort((a,b)=>b.effective.localeCompare(a.effective));
    const capital = records.find(row=>Number.isSafeInteger(row.shares));
    const holding = records.find(row=>Number.isSafeInteger(row.economic_shares));
    const share = holding && capital ? holding.economic_shares / capital.shares : null;
    const basis = holding || capital;
    return `<tr><th scope="row">${esc(assetNames[asset.id])}<small class="dim">${esc(asset.ticker)}</small></th>
      <td>${holding ? integer.format(holding.economic_shares) : '—'}</td><td>${pct(share)}</td>
      <td>${capital ? integer.format(capital.shares) : '—'}${capital ? `<small class="dim">${esc(capital.effective)}</small>` : ''}</td>
      <td>${esc(holding?.effective || '—')}</td>
      <td>${esc(basis?.note)} ${basis ? link(basis.source,'原文') : ''}
        ${basis?.alternate_source ? ' · ' + link(basis.alternate_source,'母公司不同口径') : ''}
        ${capital && basis!==capital ? ' · ' + link(capital.source,'股本原文') : ''}</td></tr>`;
  }).join('');
  byId('ownership-history').tBodies[0].innerHTML = ownership.slice().sort((a,b)=>b.effective.localeCompare(a.effective))
    .map(row=>`<tr><th scope="row">${esc(assetNames[row.asset])}</th><td>${esc(row.effective)}</td><td>${esc(row.disclosed)}</td>
      <td>${row.shares === undefined ? '—' : integer.format(row.shares)}</td>
      <td>${row.economic_shares === undefined ? '—' : integer.format(row.economic_shares)}</td>
      <td>${esc(row.note)} ${link(row.source,'原文')}</td></tr>`).join('');
}

function renderMetrics(current) {
  byId('asof').textContent = current ? `${current.date} · 金额单位为人民币十亿元 · ${states[current.status]}`
    : '金额单位为人民币十亿元';
  byId('metrics').innerHTML = measures.map(([key,label,display,note]) =>
    `<div class="metric"><span class="metric-label">${label}</span>
      <strong class="${current?.[key]<0 ? 'negative' : ''}">${display(current?.[key])}</strong><small>${note}</small></div>`).join('');
}

function latestSnapshot(data, currency) {
  const now = new Date();
  const days = Math.floor((now-Date.parse(data.rows.at(-1).date+'T00:00:00+08:00'))/86400000);
  const notices = [];
  if (days > 5) notices.push(`行情时间距今 ${days} 天，请核对数据源的最新交易日期。`);
  if (data.rows.at(-1).status !== 'complete') notices.push('最近日期存在沿用的披露快照或缺项。详见逐日状态。');
  const dateDiffers = data.rows.at(-1).fx_date && data.rows.at(-1).fx_date !== data.rows.at(-1).date;
  if (dateDiffers) notices.push(`该日计算使用 ${data.rows.at(-1).fx_date} 的欧洲央行汇率。`);
  currency.hidden = !notices.length;
  currency.textContent = notices.join(' ');
}

function renderFeed(data) {
  const badge = byId('feed-badge');
  const message = byId('feed-copy');
  const status = byId('quality-status');
  const warning = byId('warnings');
  byId('clear-import').hidden = !imported;
  const lastFx = fx.at(-1);
  byId('fx-head').textContent = lastFx ? `欧洲央行参考汇率 ${lastFx[0]} · ${rate(lastFx[1])} 人民币元／港元` : '';
  if (!data) {
    badge.textContent = '持股及参考汇率';
    message.textContent = feedStatus === 'error' ? '已发布行情暂时无法读取。' :
      feedStatus === 'checking' ? '正在读取已发布行情。' : '公开收盘行情等待授权数据源接入。';
    warning.hidden = true;
    status.textContent = '行情接入后可逐项核对最近交易日、缺失交易日及异常波动。';
    return;
  }
  badge.textContent = imported ? '本地数据 · 仅在当前浏览器' : '已发布行情';
  const time = new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short'})
    .format(new Date(data.updated_at));
  message.textContent = `行情截至 ${data.rows.at(-1).date}。数据校验时间 ${time}（北京时间）。`;
  status.innerHTML = assets.map(a=>{
    const quality = data.metadata[a.id];
    return `<span class="quality">${esc(assetNames[a.id])} · 最近交易日 ${esc(quality.last_trade)} · ${esc(quality.providers.join('、'))}
      · 缺失 ${quality.missing_sessions} 个开市日 · ${quality.unusual_move_dates.length} 个单日波动超过 30% 的复核点
      ${Array.isArray(quality.sources) ? quality.sources.map(url=>link(url,'来源')).join(' · ') : ''}</span>`;
  }).join('');
  latestSnapshot(data,warning);
}

function renderMainCharts() {
  const amounts = viewRows.filter(row=>Number.isFinite(row.residual));
  const keys = assets.filter(a=>a.kind==='investee');
  const components = keys.map(asset=>({
    type:'bar',name:assetNames[asset.id],x:viewRows.map(row=>row.date),y:viewRows.map(row=>Number.isFinite(row.residual) ? row.assets[asset.id].stake : null),
    marker:{color:asset.color},hovertemplate:'%{y:.2f} 十亿元<extra>%{fullData.name}</extra>',
  }));
  if (amounts.length) {
    components.push({type:'bar',name:'剩余权益',x:viewRows.map(r=>r.date),y:viewRows.map(r=>r.residual),
      marker:{color:'#9daeb7'},hovertemplate:'%{y:.2f} 十亿元<extra>剩余权益</extra>'});
    components.push(line('科伦市值',viewRows.map(r=>[r.date,r.parent_cap]),'#143d52',' 十亿元'));
  }
  chart('composition',amounts.length ? components : [],{barmode:'relative'});
  chart('residual',amounts.length ? [line('剩余权益',viewRows.map(r=>[r.date,r.residual]),'#00675e',' 十亿元')] : []);
  chart('coverage',amounts.length ? [line('覆盖率',viewRows.map(r=>[r.date,r.coverage]),'#5a6eb2','',
    {hovertemplate:'%{y:.2%}<extra>上市资产覆盖率</extra>'})] : [],
    {yaxis:{tickformat:'.0%',gridcolor:'#e3ebee',automargin:true}});
  const latestFx=fx.at(-1);
  const start=latestFx ? since((imported || published)?.rows.at(-1)?.date || latestFx[0]) : '';
  const fxRows=fx.filter(row=>row[0]>=start);
  chart('fx',fxRows.length ? [line('港元兑人民币',fxRows,'#00675e','',{hovertemplate:'%{y:.4f}<extra>HKD/CNY</extra>'})] : []);
  renderCompanyCaps();
}

function renderCompanyCaps() {
  const selected=new Set([...byId('companies').querySelectorAll('input:checked')].map(input=>input.value));
  const traces=assets.filter(a=>selected.has(a.id) && viewRows.some(r=>Number.isFinite(r.assets[a.id].cap)))
    .map(a=>line(assetNames[a.id],viewRows.map(r=>[r.date,r.assets[a.id].cap]),a.color,' 十亿元'));
  chart('company-caps',traces);
}

function renderWaterfall() {
  const from=byId('from').value;
  const to=byId('to').value;
  const set=(imported || published)?.rows.filter(row=>row.date>=from && row.date<=to && row.status!=='incomplete') || [];
  const first=set[0], last=set.at(-1);
  const note=byId('waterfall-note');
  if (!from || !to || !first || first===last) {
    note.textContent=from && to ? '区间内需要至少两个持股价值完整的交易日期。' : '';
    chart('waterfall',[]);
    return;
  }
  const investees=assets.filter(a=>a.kind==='investee');
  chart('waterfall',[{type:'waterfall',
    x:['期初市值',...investees.map(a=>assetNames[a.id]),'剩余权益','期末市值'],
    y:[first.parent_cap,...investees.map(a=>last.assets[a.id].stake-first.assets[a.id].stake),last.residual-first.residual,0],
    measure:['absolute',...investees.map(()=> 'relative'),'relative','total'],
    decreasing:{marker:{color:'#a45454'}},increasing:{marker:{color:'#007c74'}},totals:{marker:{color:'#254a5f'}},
    hovertemplate:'%{x} · %{y:.2f} 十亿元<extra></extra>',
  }],{xaxis:{type:'category',automargin:true,tickangle:-22},hovermode:'closest'});
  note.textContent=`实际计算区间 ${first.date} 至 ${last.date}。`;
}

function renderTable() {
  byId('csv').disabled=!viewRows.length;
  byId('prev').disabled=page===0;
  byId('next').disabled=(page+1)*pageSize>=viewRows.length;
  byId('page-label').textContent=viewRows.length ? `${page+1} / ${Math.ceil(viewRows.length/pageSize)} 页` : '';
  byId('daily-info').textContent=viewRows.length ? `${viewRows.length} 个日期 · 人民币十亿元 · 从新到旧` : '暂无已加载的收盘市场数据';
  byId('daily').tBodies[0].innerHTML=viewRows.length ? viewRows.slice().reverse().slice(page*pageSize,(page+1)*pageSize)
    .map(row=>`<tr><th scope="row">${esc(row.date)}</th><td>${n(row.parent_cap)}</td><td>${n(row.listed)}</td>
    <td class="${row.residual<0 ? 'negative' : ''}">${n(row.residual)}</td><td>${pct(row.coverage)}</td>
    <td>${rate(row.fx)}<small class="dim">${esc(row.fx_date)}</small></td>
    ${assets.filter(a=>a.kind==='investee').map(a=>`<td>${n(row.assets[a.id].stake)}</td>`).join('')}
    <td>${states[row.status]}${row.flags.length ? `<details><summary>明细</summary>${row.flags.map(esc).join('<br>')}</details>` : ''}</td></tr>`)
    .join('') : '<tr><td colspan="11">暂无逐日市值数据。</td></tr>';
}

function downloadCsv() {
  const fields=['close','trade_date','quote_state','shares','capital_date','economic_shares','ownership_date','cap','stake'];
  const rows=[['日期','科伦市值（十亿元）','上市持股合计（十亿元）','剩余权益（十亿元）','覆盖率','HKD/CNY','汇率日期','状态',
    ...assets.flatMap(a=>fields.map(field=>a.id+'_'+field))],...viewRows.map(r=>[
    r.date,r.parent_cap,r.listed,r.residual,r.coverage,r.fx,r.fx_date,states[r.status],
    ...assets.flatMap(a=>fields.map(field=>r.assets[a.id][field])),
  ])];
  const cell = v => {
    const value=String(v ?? '');
    const safe=typeof v==='string' && /^[=+@\-\t\r]/.test(value) ? "'" + value : value;
    return '"' + safe.replace(/"/g,'""') + '"';
  };
  const url=URL.createObjectURL(new Blob(['\ufeff',rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download='kelun-market-cap-'+viewRows.at(-1).date+'.csv';
  anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function render(resetDates=false) {
  const data=imported || published;
  const latest=data?.rows.at(-1);
  const start=latest ? since(latest.date) : '';
  viewRows=data?.rows.filter(row=>row.date>=start) || [];
  page=0;
  renderFeed(data);
  renderMetrics(latest);
  if (resetDates) {
    for (const [id, value] of [['from',viewRows[0]?.date],['to',latest?.date]]) {
      byId(id).min=data?.rows[0].date || '';
      byId(id).max=latest?.date || '';
      byId(id).value=value || '';
      byId(id).disabled=!latest;
    }
  }
  renderMainCharts();
  renderWaterfall();
  renderTable();
}

function validate(data) {
  const date=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const nullable=value=>value===null || Number.isFinite(value);
  if (data?.schema_version!==1 || !Number.isFinite(Date.parse(data.updated_at)) || !Array.isArray(data.rows) || !data.rows.length
      || data.rows.length>15000 || !assets.every(a=>{
        const m=data.metadata?.[a.id];
        return date(m?.last_trade) && Number.isInteger(m.missing_sessions) && Array.isArray(m.unusual_move_dates)
          && Array.isArray(m.providers) && m.providers.every(x=>typeof x==='string');
      }) || !data.rows.every((r,i)=>date(r.date) && (!i || data.rows[i-1].date<r.date) && Object.hasOwn(states,r.status)
      && Array.isArray(r.flags) && measures.every(([key])=>nullable(r[key])) && nullable(r.fx)
      && assets.every(a=>r.assets?.[a.id] && nullable(r.assets[a.id].cap) && nullable(r.assets[a.id].stake)))) {
    throw new Error('文件不符合本页数据格式。');
  }
  return data;
}

async function init() {
  renderMetrics(null);
  const items=await Promise.allSettled([json('config/universe.json'),json('config/ownership.json'),json('data/fx.json')]);
  if (items[0].status!=='fulfilled' || items[1].status!=='fulfilled') {
    byId('feed-copy').textContent='基础配置读取失败，请刷新页面。';
    return;
  }
  assets=items[0].value;
  ownership=items[1].value;
  fx=items[2].status==='fulfilled' ? items[2].value.observations : [];
  renderOwnership();
  byId('companies').insertAdjacentHTML('beforeend',assets.map((a,i)=>`<label><input type="checkbox" value="${esc(a.id)}" ${i<2 ? 'checked' : ''}>${esc(assetNames[a.id])}</label>`).join(''));
  feedStatus='checking';
  render(true);
  try {
    const config=await json('data/feed.json');
    if (config.market_data) published=validate(await json('data/tracker.json'));
    feedStatus=published ? 'live' : 'pending';
  } catch {
    feedStatus='error';
  }
  render(true);
}

byId('ranges').addEventListener('click',event=>{
  const button=event.target.closest('[data-range]');
  if (!button) return;
  activeRange=button.dataset.range;
  byId('ranges').querySelectorAll('button').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  render(true);
});
byId('companies').addEventListener('change',renderCompanyCaps);
for (const id of ['from','to']) byId(id).addEventListener('change',renderWaterfall);
byId('prev').addEventListener('click',()=>{page--;renderTable();});
byId('next').addEventListener('click',()=>{page++;renderTable();});
byId('csv').addEventListener('click',downloadCsv);
byId('clear-import').addEventListener('click',()=>{
  imported=null;
  byId('file').value='';
  byId('feedback').textContent='';
  render(true);
});
byId('file').addEventListener('change',async event=>{
  const file=event.target.files[0];
  if (!file) return;
  try {
    if (!assets.length || file.size>25000000) throw new Error('页面尚在载入，或文件超过 25 MB。');
    imported=validate(JSON.parse(await file.text()));
    byId('feedback').textContent='数据已加载到当前页面。';
    render(true);
  } catch (error) {
    byId('feedback').textContent='无法读取该文件。请使用更新程序生成的 tracker.json。';
  }
});
window.addEventListener('load',()=>{
  if (assets.length) render(true);
},{once:true});
init();
