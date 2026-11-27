const localized = {
  'Updated':'已更新', 'Partial success':'部分成功', 'No new data':'暂无新数据', 'Pending review':'待审核',
  'Source unavailable':'来源暂不可用', 'Validation failed':'校验失败',
  'Manual update required':'需人工更新'
};
const methods = {fully_automated:'结构化自动采集', rule_based:'规则发现 · 人工审核',
  manual_or_ai_review:'人工或 AI 辅助审核'};
const frequencies = {daily:'每日', weekly:'每周', monthly:'每月', manual:'随披露人工处理',
  quarterly:'每季', annual:'每年', semiannual:'每半年', irregular:'不定期',
  'monthly + annual':'月度及年度'};
const statusURL = new URL('../update-center/status.json', import.meta.url);
const centerURL = new URL('../update-center/', import.meta.url);

function node(tag, text, css) {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (css) el.className = css;
  return el;
}

function link(title, url) {
  const a = node('a', title);
  a.href = new URL(url, centerURL).href;
  return a;
}

function formatted(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit',
    day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).format(new Date(value));
}

function renderCenter(root, datasets) {
  root.replaceChildren();
  const total = datasets.length;
  const counts = [
    ['Source monitoring coverage', datasets.filter(row => row.monitoring_enabled).length],
    ['Extraction coverage', datasets.filter(row => row.last_extracted && row.dataset_id !== 'cms.catalog').length],
    ['Review coverage', datasets.filter(row => row.review_required).length],
    ['Cloud updates linked to charts', datasets.filter(row => row.chart_binding && row.chart_applied_at && row.eligible_cloud_check && !row.review_required).length]
  ];
  const coverage = node('dl','','update-coverage');
  for (const [label,value] of counts) coverage.append(node('dt',label),node('dd',`${value} / ${total} · ${Math.round(1000*value/total)/10}%`));
  root.append(coverage);
  const verification=node('p');
  verification.append(link('查看线上 JSON 与浏览器验收记录',
    'https://github.com/wizardzxx-tech/chart/actions/workflows/pages.yml'));
  root.append(verification);
  const bar = node('div', '', 'update-controls');
  const topic = node('select'); const status = node('select'); const query = node('input');
  query.type = 'search'; query.placeholder = '数据集、来源或主题';
  const topics = new Map(datasets.map(row => [row.topic, row.topic_label]));
  const option = (parent, label, value) => { const item = node('option', label); item.value=value; parent.append(item); };
  option(topic, '全部专题', '');
  for (const [value, label] of topics) option(topic, label, value);
  option(status, '全部状态', '');
  for (const [value, label] of Object.entries(localized)) option(status, label, value);
  option(status, '待首次检查', 'initial');
  for (const [label, input] of [['专题', topic],['状态', status],['搜索', query]]) {
    input.setAttribute('aria-label', label);
    const wrapper = node('label', label); wrapper.append(input); bar.append(wrapper);
  }
  const count = node('p', '', 'update-count'); count.setAttribute('aria-live','polite');
  const scroll = node('div', '', 'update-scroll'); const table = node('table');
  table.append(node('caption', '数据集更新状态'));
  const thead = table.createTHead().insertRow();
  for (const title of ['数据集','最新统计期','最近检查','最近成功更新','发布 / 检查','更新方式','当前状态','历史日志']) {
    const th = node('th', title); th.scope = 'col'; thead.append(th);
  }
  const tbody = table.createTBody();
  const render = () => {
    const items = datasets.filter(row => (!topic.value || topic.value === row.topic)
      && (!status.value || status.value === (row.status || 'initial'))
      && (!query.value || [row.label,row.source_name,row.topic_label,row.dataset_id]
        .join(' ').toLowerCase().includes(query.value.trim().toLowerCase())));
    count.textContent = `显示 ${items.length} / ${datasets.length} 项 · 时间为北京时间`;
    tbody.replaceChildren();
    for (const item of items) {
      const tr = tbody.insertRow();
      const header = node('th'); header.scope = 'row';
      header.append(link(item.label, `../${item.topic}/#${item.section || ''}`),
        node('span', item.topic_label, 'update-sub'), link(item.source_name,item.source || item.source_url));
      if (item.data_url && item.last_success) header.append(link('查看校验后的记录 JSON', item.data_url));
      tr.append(header);
      for (const value of [item.latest_data_period, formatted(item.last_checked), formatted(item.last_success),
        `${frequencies[item.data_frequency] || item.data_frequency} / ${frequencies[item.check_frequency]}`,
        methods[item.automation_level]]) tr.insertCell().textContent = value;
      const cell = tr.insertCell();
      const tag = node('span', localized[item.status] || '待首次检查', 'update-pill');
      tag.dataset.status = item.status || 'initial'; tag.title = item.status || '';
      cell.append(tag);
      if (item.detail) cell.append(node('span', item.detail, 'update-sub'));
      if(item.coverage&&item.subtasks?.length){
        const c=item.coverage;
        const more=node('details');
        more.append(node('summary',`配置 ${c.configured} · 实查 ${c.checked} · 成功 ${c.successful} · 有实际数据 ${c.actual_data??c.latest} · 最新 ${c.latest}`));
        const list=node('ul');
        const labels={records:'取得数据',unchanged:'暂无新增',no_new:'暂无新增',unpublished:'尚未发布',
          failed:'失败',uncovered:'未覆盖',pending_revision:'修订待审'};
        const priority={'failed':0,'pending_revision':1,'uncovered':2};
        const units=[...item.subtasks].sort((a,b)=>(priority[a.status]??3)-(priority[b.status]??3));
        for(const task of units){
          const entry=node('li',`${task.id} · ${labels[task.status]||task.status}`+
            (task.observed_period||task.latest_period?` · 已取得 ${task.observed_period||task.latest_period}`:'')+
            (task.detail?` · ${task.detail}`:''));
          if(task.source)entry.append(' ',link('原始出处',task.source));
          list.append(entry);
        }
        more.append(node('p',`暂无新增 ${c.no_new} · 沿用已核对 ${c.previously_verified??0} · 失败 ${c.failed} · 未覆盖 ${c.uncovered} · 修订待审 ${c.pending_revision}`),list);
        cell.append(more);
      } else if(item.quality_notes?.length) {
        const more=node('details');more.append(node('summary','检查提示'));
        const list=node('ul');for(const warning of item.quality_notes)list.append(node('li',warning));
        more.append(list);cell.append(more);
      }
      const history = tr.insertCell();
      if (item.recent_log.length) {
        const details = node('details'); details.append(node('summary', `最近 ${item.recent_log.length} 次`));
        const ul = node('ul');
        for (const row of [...item.recent_log].reverse()) {
          ul.append(node('li', `${formatted(row.time)} · ${localized[row.status]} · ${row.detail}`));
        }
        details.append(ul); history.append(details);
      } else history.textContent = '—';
    }
  };
  for (const select of [topic,status,query]) select.addEventListener('input',render);
  scroll.append(table);
  root.append(bar,count,scroll);
  render();
}

function showTopic(datasets) {
  const topic = document.body.dataset.updateTopic;
  if (!topic) return;
  const bySection = new Map();
  for (const item of datasets.filter(row => row.topic === topic)) {
    if (!bySection.has(item.section)) bySection.set(item.section, []);
    bySection.get(item.section).push(item);
  }
  for (const [target,batch] of bySection) {
    const section = document.getElementById(target);
    const area = node('div','','update-provenance');
    area.setAttribute('aria-label','数据统计期、来源和更新时间');
    for (const item of batch) {
      const line = node('p');
      line.append(node('strong',item.label),
        document.createTextNode(` · ${item.latest_data_period} · `), link(item.source_name, item.source || item.source_url),
        document.createTextNode(item.last_success ? ` · 更新 ${formatted(item.last_success)}` : ' · 暂无自动更新时间'));
      if (item.data_url && item.last_success) {
        line.append(document.createTextNode(' · '),link('下载记录',item.data_url));
      }
      area.append(line);
    }
    const chart = section?.querySelector('figure, svg[role="img"], canvas, [class*="chart-wrap"]');
    if (chart) chart.after(area);
    else if (section?.matches('figure, svg, canvas')) section.after(area);
    else if (section) section.append(area);
    else (document.querySelector('.update-topic-status') || document.querySelector('main')).append(area);
  }
}

const center = document.querySelector('[data-update-center]');
if (center || document.body.dataset.updateTopic) {
  fetch(statusURL, {cache:'no-cache'}).then(response=>{
    if (!response.ok) throw new Error('Unavailable');
    return response.json();
  }).then(({datasets})=>{
    if (center) renderCenter(center, datasets);
    showTopic(datasets);
  }).catch(()=>{
    if (center) center.textContent = '暂时无法读取数据更新记录，请稍后刷新。';
  });
}

if (document.body.dataset.updateTopic) import('./research-updates.js');

function evidenceTable(headers,values){
  const scroller=node('div','','update-scroll'), table=node('table');
  const head=table.createTHead().insertRow();
  for(const label of headers){const title=node('th',label);title.scope='col';head.append(title);}
  const body=table.createTBody();
  for(const row of values){
    const line=body.insertRow();
    for(const value of row){
      const cell=line.insertCell();
      if(value instanceof Node)cell.append(value);else cell.textContent=value??'—';
    }
  }
  scroller.append(table);
  return scroller;
}

async function evidenceData(file) {
  const r=await fetch(new URL(file,centerURL));
  if(!r.ok)throw new Error('资料暂不可读');
  return r.json();
}

async function financeEvidence() {
  const root=document.querySelector('[data-field-coverage]');
  if(!root)return;
  const {fields,companies}=await evidenceData('financial-coverage.json');
  root.append(node('h2','公司财务字段覆盖'));
  const company=node('select');company.setAttribute('aria-label','字段覆盖公司');
  const period=node('select');period.setAttribute('aria-label','字段覆盖报告期');
  for(const [ticker,data] of Object.entries(companies))company.add(new Option(data.name+' · '+ticker,ticker));
  if(companies['603939.SH'])company.value='603939.SH';
  const body=node('div');root.append(company,period,body);
  function records(){
    const values=companies[company.value].records;
    period.replaceChildren(...values.map((row,i)=>new Option(row.period,i)));
    if(values.length)period.value=String(values.length-1);
    render();
  }
  function render(){
    body.replaceChildren();
    const row=companies[company.value].records[Number(period.value)];
    if(!row){body.append(node('p','暂无可核对的财务字段。'));return;}
    const modes={quarterly_cn:'A 股财政报告期',quarterly_us:'SEC 报告期',native_verified_history:'历史披露原生报告期'};
    body.append(node('p',`${row.period} · ${modes[row.mode]} · ${row.currency} · 公告日 ${row.announced||'待补'} · ${row.fields.length}/${row.eligible.length} 个有值字段`));
    const accounting={ar:'balance',ap:'balance',inventory:'balance',revenue:'income',cost:'income',net_profit:'income',selling:'income',sga:'income',rd:'income',admin:'income',finance:'income'};
    body.append(evidenceTable(['财务字段','覆盖','原件或申报码'],Object.entries(fields).map(([field,label])=>{
      const page=row.pages[accounting[field]];
      const evidence=node('span',row.tags[field]||'');
      if(row.source)evidence.append(' ',link(page?'PDF 第 '+page+' 页':'财报原件',row.source+(page?'#page='+page:'')));
      else if(row.locator)evidence.append(link('公告入口',row.locator));
      return [label,row.fields.includes(field)?'有值':row.eligible.includes(field)?'缺失':'不适用',evidence];
    })));
  }
  company.addEventListener('change',records);period.addEventListener('change',render);
  records();
}

async function operatingEvidence() {
  const root=document.querySelector('[data-operating-review]');
  if(!root)return;
  const data=await evidenceData('operating-review.json');
  root.append(node('h2','特色经营指标审核'));
  const defs=node('details');defs.append(node('summary','指标定义与单位'));
  defs.append(evidenceTable(['专题','指标','单位','期间要求','业务范围'],Object.values(data.definitions)));
  root.append(defs);
  const select=node('select');select.setAttribute('aria-label','经营指标公告');
  const body=node('div');
  for(const doc of data.documents)select.add(new Option(doc.title,doc.id));
  root.append(select,body);
  const num=x=>x==null?'—':new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(x);
  function render(){
    body.replaceChildren();
    const doc=data.documents.find(x=>x.id===select.value);
    if(!doc){body.append(node('p','暂无待核对公告。'));return;}
    body.append(node('p',doc.period+' · '+(doc.status==='resolved'?'已审核':'待审')+' · '+doc.id),link('原始公告',doc.url));
    body.append(evidenceTable(['指标','旧值','提取值','单位','同比 %','原文证据'],doc.candidates.map(r=>{
      const proof=node('span',r.excerpt);
      proof.append(' ',link('PDF 第 '+r.page+' 页',r.source+'#page='+r.page));
      return [r.label,num(r.before),num(r.after),r.unit,num(r.yoy_pct),proof];
    })));
  }
  select.addEventListener('change',render);render();
}
financeEvidence().catch(console.warn);
operatingEvidence().catch(console.warn);
