const localized = {
  'Updated':'已更新', 'No new data':'暂无新数据', 'Pending review':'待审核',
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
