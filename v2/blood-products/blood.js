const company = document.querySelector('#blood-company');
const year = document.querySelector('#blood-year');
const basis = document.querySelector('#blood-basis');
const status = document.querySelector('#blood-status');
const tbody = document.querySelector('#blood-company-rows');
const controls = company.closest('form');
const formatter = new Intl.NumberFormat('en-US', {maximumFractionDigits: 2});
const moneyFormatter = new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const quantity = (n, prefix = '') => n == null ? '—' : prefix + formatter.format(n);
const money = n => n == null ? '—' : moneyFormatter.format(n / 1e8);
const perTon = (n, mark) => {
  if (n == null) return '—';
  if (mark === '超') return '＜' + moneyFormatter.format(Math.ceil(n * 100) / 100);
  return (mark ? '约' : '') + moneyFormatter.format(n);
};

function child(parent, tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  parent.append(node);
  return node;
}

function appendSources(parent, row) {
  const details = child(parent, 'details');
  details.className = 'blood-source';
  child(details, 'summary', '查来源');
  for (const [label, part] of [
    ['本年采浆与浆站', row.ops],
    ['本年血制品收入与成本', row.pnl],
    ['上年采浆量', row.metrics]
  ]) {
    if (!part) continue;
    child(details, 'b', label);
    if (part.note) child(details, 'p', part.note);
    for (const source of part.sources) {
      const link = child(details, 'a', source.title);
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener';
    }
  }
}

async function init() {
  const response = await fetch('data.json');
  if (!response.ok) throw Error('血制品数据不可用');
  const data = await response.json();
  const observations = data.companies.flatMap(c => c.rows.map(row => ({...row, code:c.code, name:c.name})));
  observations.sort((a,b) => b.year - a.year);
  function render() {
    const selected = observations.filter(r => (company.value==='all'||r.code===company.value) &&
      (year.value==='all'||String(r.year)===year.value));
    const report = basis.value === 'reported';
    const fragment = document.createDocumentFragment();
    for (const row of selected) {
      const {ops,pnl,metrics} = row;
      const tr = child(fragment, 'tr');
      child(tr, 'th', row.name).scope = 'row';
      for (const cell of [String(row.year), quantity(ops?.volume,ops?.volumeMark),quantity(ops?.stations),quantity(ops?.active),
        money(pnl?.total),money(pnl?.alb),money(pnl?.imported),money(pnl?.ivig),money(pnl?.other),money(pnl?.cost),
        quantity(metrics?.priorVolume,metrics?.priorMark)]) {
        child(tr, 'td', cell);
      }
      const scopeChanged = pnl?.note.includes('前一年采浆与收入范围不同');
      for (const value of [report?metrics?.reportedRevenue:metrics?.revenue,report?metrics?.reportedProfit:metrics?.profit]) {
        const cell = child(tr, 'td', perTon(value,metrics?.priorMark));
        if (scopeChanged && value != null) {
          child(cell,'sup','†');
          cell.title = pnl.note;
        }
      }
      appendSources(child(tr, 'td'), row);
    }
    tbody.replaceChildren(fragment);
    status.textContent = selected.length ? `${selected.length} 条年度记录` : '当前筛选下无记录。';
  }
  controls.addEventListener('change', render);
  controls.hidden = false;
  render();
}
init().catch(() => { status.textContent='公司数据暂时无法加载，可下载 CSV。'; });
