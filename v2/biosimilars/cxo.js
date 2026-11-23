const byId = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[char]);
const source = (url, label = '原始来源') =>
  `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
const route = (view, parts, label) =>
  `<a href="#${view}/${parts.map(encodeURIComponent).join('/')}">${esc(label)}</a>`;
const number = new Intl.NumberFormat('zh-CN', {maximumFractionDigits: 3});
const labels = {CRO: 'CRO · 临床及注册', CDO: 'CDO · 开发', CMO: 'CMO · 制造', '许可': '技术许可', '资产交易': '资产交易'};
const snapshot = JSON.parse(byId('snapshot').textContent);
const assets = new Map(snapshot.assets.map(asset => [asset.id, asset]));
const companies = new Map(snapshot.companies.map(company => [company.id, company.name]));
const page = byId('view-cxo');
const loading = byId('cxo-loading');
const filters = Object.fromEntries(['provider', 'molecule', 'asset', 'service'].map(key => [key, byId('cxo-' + key)]));
const download = byId('cxo-download');
const dataUrl = new URL('./data/service-contracts.json', import.meta.url);
let request;
let data;
let providers;
let clients;
let molecules;
let downloadRows = [];
let dashboardMolecule;

function loadData() {
  if (!request) {
    request = fetch(dataUrl).then(response => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).then(rows => {
      data = rows;
      providers = new Map(rows.providers.map(provider => [provider.id, provider]));
      clients = new Map(rows.clients.map(client => [client.id, client.name]));
      molecules = {...snapshot.molecules, ...rows.extra_molecules};
      return rows;
    }).catch(error => {
      request = undefined;
      throw error;
    });
  }
  return request;
}

function setOptions(select, options, placeholder, selected = '') {
  select.replaceChildren(new Option(placeholder, ''), ...options.map(([value, label]) => new Option(label, value)));
  select.value = options.some(([value]) => value === selected) ? selected : '';
}

function moleculeLabel(id) {
  const molecule = molecules[id];
  return [molecule.reference, molecule.cn || molecule.name].filter(Boolean).join(' · ');
}

function providerName(id) {
  return providers.get(id)?.name || '服务商未披露';
}

function assetLink(id) {
  return route('pipeline', ['asset', id], assets.get(id).display || id);
}

function readHash() {
  try {
    const [path, query] = location.hash.slice(1).split('?');
    return [decodeURIComponent(path).split('/'), new URLSearchParams(query)];
  } catch {
    return [[], new URLSearchParams()];
  }
}

function updateAssetOptions(molecule, value) {
  const options = snapshot.assets.filter(asset => !molecule || asset.molecule === molecule)
    .map(asset => [asset.id, [asset.display || asset.id, companies.get(asset.company)].filter(Boolean).join(' · ')])
    .sort((a, b) => a[1].localeCompare(b[1], 'zh-CN', {numeric: true}));
  setOptions(filters.asset, options, '全部资产', value);
}

function applyRoute() {
  const [[, field, value], query] = readHash();
  const asset = field === 'asset' ? assets.get(value) : null;
  const molecule = asset?.molecule || (field === 'molecule' ? value : query.get('molecule'));
  setOptions(filters.provider, data.providers.map(provider => [provider.id, provider.name]), '全部服务商',
    field === 'company' ? value : query.get('provider'));
  setOptions(filters.molecule, Object.keys(molecules).sort((a, b) => moleculeLabel(a).localeCompare(moleculeLabel(b)))
    .map(id => [id, moleculeLabel(id)]), '全部分子', molecule);
  setOptions(filters.service, Object.entries(labels), '全部服务', query.get('service'));
  updateAssetOptions(filters.molecule.value, asset?.id);
  renderCxo();
}

function updateFilters(event) {
  if (event.target === filters.molecule) updateAssetOptions(filters.molecule.value);
  if (event.target === filters.asset && filters.asset.value) {
    const selected = assets.get(filters.asset.value);
    filters.molecule.value = selected.molecule;
    updateAssetOptions(selected.molecule, selected.id);
  }
  const {provider, molecule, asset, service} = filterValues();
  const path = asset ? 'asset/' + encodeURIComponent(asset) : molecule ? 'molecule/' + encodeURIComponent(molecule) : '';
  const query = new URLSearchParams();
  if (provider) query.set('provider', provider);
  if (service) query.set('service', service);
  history.replaceState(null, '', '#cxo' + (path ? '/' + path : '') + (query.size ? '?' + query : ''));
  renderCxo();
}

function filterValues() {
  return Object.fromEntries(Object.entries(filters).map(([key, select]) => [key, select.value]));
}

function evidenceFor({provider = '', molecule = '', asset = '', service = ''}) {
  const matchesProvider = row => !provider || row.provider_id === provider;
  const locationMatches = row => asset ? row.asset_id === asset : !molecule || row.molecule === molecule;
  const matchingContracts = data.service_contracts.filter(row => matchesProvider(row)
    && (!service || row.service_type.includes(service)));
  return {
    contracts: matchingContracts.filter(locationMatches),
    roles: data.roles.filter(row => matchesProvider(row) && locationMatches(row)
      && (!service || row.service_type === service)),
    profiles: !asset && !molecule && !service ? data.providers.filter(row => !provider || row.id === provider) : [],
    exposure: !asset && !molecule && !service ? data.exposure.filter(matchesProvider) : [],
    leads: !asset ? matchingContracts.flatMap(contract => (contract.pipeline_leads ?? [])
      .filter(id => !molecule || id === molecule).map(id => ({id, contract}))) : [],
  };
}

function table(headers, rows, empty) {
  if (!rows.length) return `<p class="note">${esc(empty)}</p>`;
  return `<div class="scroll" tabindex="0"><table class="cxo-table"><thead><tr>${headers.map(header =>
    `<th scope="col">${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(([heading, ...cells]) =>
    `<tr><th scope="row">${heading}</th>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function contractCard(row) {
  const project = row.asset_id ? assetLink(row.asset_id) : row.molecule
    ? route('cxo', ['molecule', row.molecule], moleculeLabel(row.molecule)) + '<small>仅关联原研分子</small>'
    : '多项目安排 · 未公布候选代号';
  const milestones = row.events.length ? `<details><summary>关键节点</summary><ul class="cxo-timeline">${row.events.map(event =>
    `<li><time>${esc(event.date)}</time> · ${esc(event.label)} ${source(event.url, '披露')}</li>`).join('')}</ul></details>` : '';
  return `<article class="panel market-workspace cxo-card" data-contract="${esc(row.contract_id)}">
    <div class="cxo-card-title"><h4>${esc(row.title)}</h4><span class="cxo-state">${esc(row.contract_status)}</span></div>
    <p class="note">${route('cxo', ['company', row.provider_id], providerName(row.provider_id))} ×
      ${esc(clients.get(row.client_id))} · ${esc(row.date)} · ${esc(row.service_type.join(' / '))}</p>
    <dl class="cxo-keys">
      <dt>所涉资产</dt><dd>${project}</dd>
      <dt>范围</dt><dd>${esc(row.scope)}</dd>
      <dt>收费机制</dt><dd>${esc(row.economic_terms)}</dd>
      <dt>生产及权益</dt><dd>${esc(row.manufacturing_rights)}</dd>
    </dl>
    ${milestones}
    <p class="note">${row.sources.map(ref => source(ref.url, ref.label)).join(' · ')}</p>
  </article>`;
}

function renderFinances(finances, contracts) {
  const lookup = new Map(contracts.map(contract => [contract.contract_id, contract]));
  byId('cxo-economics').innerHTML = table(['服务商及客户', '期间', '会计或交易项目', '金额（百万）', '披露口径', '来源'],
    finances.map(item => {
      const contract = lookup.get(item.contract_id);
      return [esc(providerName(contract.provider_id)) + '<small>' + esc(clients.get(contract.client_id)) + '</small>',
        esc(item.period), esc(item.kind), esc(item.currency + ' ' + number.format(item.amount)),
        esc(item.note), source(item.source)];
    }), '当前筛选没有披露可归因的收入或交易款。');
}

function renderExposure({profiles, exposure, roles}) {
  const companyRows = profiles.map(provider => [route('cxo', ['company', provider.id], provider.name)
    + (provider.basis ? '<small>' + esc(provider.basis) + '</small>' : ''), esc(provider.scope),
    esc(provider.financial || '类似药业务的分项收入及占比未见披露。'), source(provider.source)]);
  const profileTable = profiles.length ? table(['服务商', '公开业务范围', '收入披露', '来源'], companyRows, '') : '';
  const disclosedTable = exposure.length ? `<h4>公司披露的业务进展</h4>${table(['服务商', '指标', '披露值', '口径', '来源'],
    exposure.map(row => [esc(providerName(row.provider_id)), esc(row.label), esc(row.value), esc(row.scope),
      source(row.source)]), '')}` : '';
  const rolesTable = table(['服务商', '产品或资产', '持有人或申办方', '可确认工序及依据', '来源'],
    roles.map(row => [esc(providerName(row.provider_id)), esc(row.name) + '<small>' +
      (row.asset_id ? assetLink(row.asset_id) : route('cxo', ['molecule', row.molecule], moleculeLabel(row.molecule)) + ' · 分子级')
      + '</small>', esc(row.holder), esc(row.role) + '<small>' + esc(row.status + ' · ' + row.site) + '</small>',
      source(row.source, row.source_label)]), '目前没有符合筛选条件的公开供应角色。');
  byId('cxo-exposure').innerHTML = profileTable + disclosedTable + '<h4>产品级公开记录</h4>'
    + '<p class="note">制造场址为监管列名。生产排他性、实际批次及供货收入待逐项披露。'
    + '临床文件仅支持表中所列工作范围。</p>' + rolesTable;
}

function opportunity({molecule, asset}, evidence) {
  const element = byId('cxo-opportunity');
  const pathway = '<p class="note">原研独占期 → 类似药开发 → 临床与注册、工艺开发 → 验证与商业供货 → 服务费、许可或分成。</p>';
  const shortcuts = ['pembrolizumab', 'daratumumab', 'dupilumab', 'emicizumab'];
  const leads = evidence.leads.length ? `<h4>已公开的开发方向</h4><ul>${evidence.leads.map(({id, contract}) =>
    `<li>${route('cxo', ['molecule', id], moleculeLabel(id))} · ${esc(providerName(contract.provider_id))}
      × ${esc(clients.get(contract.client_id))}，已列入框架的早期开发方向，逐项行权和收入待披露。
      ${contract.sources.map(ref => source(ref.url, ref.label)).join(' · ')}</li>`).join('')}</ul>` : '';
  if (!molecule) {
    element.innerHTML = pathway + '<p>' + shortcuts.map(id => route('cxo', ['molecule', id], molecules[id].reference)).join(' · ')
      + '</p>' + leads + `<p>${route('model', [], '打开 CXO 收入敏感性模型')}</p>`;
    return;
  }
  const profile = snapshot.cliffs.find(row => row.id === molecule);
  const tracked = snapshot.assets.filter(row => row.molecule === molecule);
  const count = new Set(tracked.flatMap(row => row.companyIds?.length ? row.companyIds : [row.company]).filter(Boolean)).size;
  const events = profile?.events.filter(event => ['patent', 'exclusivity'].includes(event.kind)) || [];
  const nextEvents = events.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const timeline = nextEvents.length ? `<p class="note">专利或独占节点 ${nextEvents.map(event =>
    source(event.source, [event.region, event.date, event.label].join(' '))).join(' · ')}。</p>` : '';
  const state = evidence.contracts.length + evidence.roles.length
    ? '已有公开合作或服务证据，金额与商业供货范围见上表。'
    : '当前筛选没有可归属的合同或服务商。后续外包及商业供货需等待披露。';
  element.innerHTML = `<h4>${esc(asset ? assets.get(asset).display || asset : moleculeLabel(molecule))}</h4>
    <p>${tracked.length ? '现有管线收录 ' + tracked.length + ' 项资产、' + count + ' 家开发企业。'
      : '现有管线暂无该分子的候选代号。'} ${state}</p>
    ${timeline}${pathway}${leads}
    <p>${profile ? route('cliff', [molecule], '专利及独占期') + ' · ' : ''}
      ${route('model', Number.isFinite(profile?.sales) ? [molecule] : [], '用自定义参数测算 CXO 收入')}</p>`;
}

function prepareDownload({contracts, exposure, leads, roles}, finances) {
  const rows = [];
  for (const contract of contracts) rows.push([
    'Confirmed Contract', contract.contract_id, providerName(contract.provider_id), clients.get(contract.client_id),
    contract.molecule, contract.asset_id, contract.service_type.join(' / '), contract.contract_status,
    contract.title, contract.scope + ' ' + contract.economic_terms + ' ' + contract.manufacturing_rights,
    '', '', contract.date, contract.sources.map(ref => ref.url).join(' | '), contract.last_verified,
  ]);
  for (const item of finances) {
    const contract = contracts.find(row => row.contract_id === item.contract_id);
    rows.push(['Confirmed Contract', item.contract_id, providerName(contract.provider_id), clients.get(contract.client_id),
      contract.molecule, contract.asset_id, contract.service_type.join(' / '), '财报披露',
      item.kind, item.note, item.amount, item.currency, item.period, item.source, data.last_verified]);
  }
  for (const row of exposure) rows.push(['Disclosed Exposure', '', providerName(row.provider_id), '', '', '',
    '', '公司披露', row.label, row.value + '。' + row.scope, '', '', '', row.source, data.last_verified]);
  for (const row of roles) rows.push(['Disclosed Exposure', row.id, providerName(row.provider_id), row.holder,
    row.molecule, row.asset_id, row.service_type, row.status, row.name, row.role + ' · ' + row.site, '', '', '',
    row.source, row.last_verified]);
  for (const {id, contract} of leads) rows.push(['Theoretical Opportunity', contract.contract_id,
    providerName(contract.provider_id), clients.get(contract.client_id), id, '', 'CDO', '公开开发方向',
    moleculeLabel(id), '行权、服务节点及收入待披露。', '', '', '2026-11-04',
    contract.sources.map(ref => ref.url).join(' | '), contract.last_verified]);
  downloadRows = rows;
  download.disabled = !rows.length;
}

function renderCxo() {
  const selection = filterValues();
  const evidence = evidenceFor(selection);
  const ids = new Set(evidence.contracts.map(row => row.contract_id));
  const finances = data.economics.filter(row => ids.has(row.contract_id));
  const linked = new Set(evidence.roles.map(row => row.asset_id).filter(Boolean)).size;
  byId('cxo-scope').textContent = `${evidence.contracts.length} 项已公告合同或框架 · ${evidence.roles.length} 条产品级公开记录 · ${linked} 项代码级匹配 · 核对日期 ${data.last_verified}`;
  byId('cxo-contracts').innerHTML = evidence.contracts.length ? evidence.contracts.map(contractCard).join('')
    : '<p class="note">当前筛选没有确认到候选资产对应的合同或合作框架。分子级合作可通过清除资产筛选查看。</p>';
  renderFinances(finances, evidence.contracts);
  renderExposure(evidence);
  opportunity(selection, evidence);
  prepareDownload(evidence, finances);
}

async function showCxo() {
  if (page.hidden) return;
  try {
    await loadData();
    if (page.hidden) return;
    applyRoute();
    byId('cxo-regulatory').innerHTML = `<ul>${data.policy.map(row =>
      `<li><strong>${esc(row.name)}</strong> · ${esc(row.stage)}。 ${esc(row.detail)} ${source(row.source)}</li>`).join('')}
      <li><strong>商业化 CDMO</strong> · 收入受获批数量、实际外包率、批次数和合同供货权益影响。</li></ul>`;
    loading.hidden = true;
    byId('cxo-content').hidden = false;
  } catch {
    loading.textContent = 'CXO 数据暂时无法读取。';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'outline';
    retry.textContent = '重新加载';
    retry.addEventListener('click', showCxo, {once: true});
    loading.append(' ', retry);
  }
}

export async function renderCxoContext(container, molecule) {
  dashboardMolecule = molecule;
  try {
    await loadData();
    if (dashboardMolecule !== molecule) return;
    const evidence = evidenceFor({molecule});
    const results = [
      ...evidence.contracts.map(row => `${esc(providerName(row.provider_id))} · ${esc(row.title)}`),
      ...evidence.roles.map(row => `${esc(providerName(row.provider_id))} · ${esc(row.name)} · ${esc(row.role)}`),
    ];
    const summary = results.length ? `<ul>${results.slice(0, 4).map(row => `<li>${row}</li>`).join('')}</ul>`
      : '<p class="note">暂未查到可归属至该分子的公开外包安排。</p>';
    container.innerHTML = `<h3>CXO 合作与供应角色</h3>${summary}
      <p>${route('cxo', ['molecule', molecule], '查看合同、供应证据与潜在机会')}</p>`;
  } catch {
    if (dashboardMolecule === molecule) container.innerHTML = `<h3>CXO 合作与供应角色</h3>
      <p>${route('cxo', ['molecule', molecule], '查看 CXO 数据')}</p>`;
  }
}

const form = byId('cxo-model-form');
const inputs = Array.from(form.querySelectorAll('input'));
const modelResult = byId('cxo-model-result');
function renderModel() {
  if (byId('view-model').hidden) return;
  const molecule = byId('model-molecule').value;
  if (molecule) {
    byId('cxo-model-context').innerHTML = '查看 ' + route('cxo', ['molecule', molecule],
      snapshot.molecules[molecule].reference + ' 的外包证据') + '。计算器使用独立输入。';
  }
  if (inputs.some(input => !input.validity.valid)) {
    modelResult.textContent = '请检查输入范围。数量和金额应为非负值，比例应介于 0% 和 100% 之间。';
    return;
  }
  if (inputs.every(input => input.value === '')) {
    modelResult.textContent = '填写同一期间的假设，或使用示例查看计算过程。';
    return;
  }
  const values = Object.fromEntries(inputs.map(input => [input.name, Number(input.value)]));
  const projects = values.projects * values.exercise / 100;
  const batches = values.batches * values.outsourcing / 100;
  const develop = projects * values.developmentFee;
  const production = batches * values.batchFee;
  const royalty = values.royaltySales * values.royaltyRate / 100;
  const total = develop + production + values.milestones + royalty;
  if (!Number.isFinite(total)) {
    modelResult.textContent = '计算结果超出支持范围，请缩小输入金额。';
    return;
  }
  const unit = '百万' + {USD: '美元', EUR: '欧元', CNY: '人民币'}[byId('cxo-currency').value];
  const n = number.format;
  modelResult.innerHTML = `<strong>假设期间收入 ${n(total)} ${unit}</strong>
    <dl class="cxo-keys">
      <dt>开发服务费</dt><dd>${n(projects)} 个预期行权项目 × ${n(values.developmentFee)} = ${n(develop)}</dd>
      <dt>生产服务费</dt><dd>${n(batches)} 个预期外包批次 × ${n(values.batchFee)} = ${n(production)}</dd>
      <dt>许可及里程碑</dt><dd>${n(values.milestones)}</dd>
      <dt>销售分成</dt><dd>${n(values.royaltySales)} × ${n(values.royaltyRate)}% = ${n(royalty)}</dd>
      <dt>一次性处置现金</dt><dd>${n(values.saleProceeds)}（单列现金流）</dd>
    </dl>`;
}

Object.values(filters).forEach(select => select.addEventListener('change', updateFilters));
download.addEventListener('click', () => window.downloadCsv('biosimilar-cxo', [
  '证据分类', '记录编号', '服务商', '客户／许可持有人', '原研分子', '资产代码', '服务类型', '状态',
  '记录或会计项目', '口径与权益', '金额（百万）', '币种', '期间或日期', '原始来源', '核对日期',
], downloadRows));
form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', renderModel);
byId('model-molecule').addEventListener('change', renderModel);
byId('cxo-model-example').addEventListener('click', () => {
  const example = [10, 40, 2, 20, 50, .5, 2, 100, 3, 7];
  inputs.forEach((input, i) => {input.value = example[i];});
  renderModel();
});
window.addEventListener('hashchange', () => {
  showCxo();
  renderModel();
});
showCxo();
renderModel();
