const section = document.querySelector('#overseas-capital');
const status = section.querySelector('#overseas-status');
const company = section.querySelector('#overseas-company');
const mode = section.querySelector('#overseas-mode');
const range = section.querySelector('#overseas-range');
const body = section.querySelector('tbody');
const formatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function cell(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}

async function mount() {
  const response = await fetch(new URL('overseas.json', document.baseURI));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const { companies, rows } = await response.json();
  const names = Object.keys(companies);

  function render() {
    const display = [];
    for (const code of company.value === 'all' ? names : [company.value]) {
      const entries = rows.filter(row => row.code === code &&
        (mode.value === 'all' || row.mode === mode.value));
      const latest = entries[0]?.period;
      const chosen = range.value === 'all' ? entries : entries.filter(row => row.period === latest);
      for (const entry of chosen) {
        const tr = document.createElement('tr');
        tr.dataset.company = code;
        tr.dataset.mode = entry.mode;
        const heading = cell('th', companies[code]);
        heading.scope = 'row';
        const source = cell('td','');
        source.className = 'vaccine-refs';
        for (const [i, url] of entry.sources.entries()) {
          const a = cell('a', `报告 ${i+1}`);
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener';
          source.append(a);
        }
        tr.append(heading, cell('td', entry.period), cell('td', entry.mode),
          ...entry.values.map(v => cell('td', Number.isFinite(v) ? formatter.format(v) : '—')), source);
        display.push(tr);
      }
    }
    body.replaceChildren(...display);
    status.textContent = display.length ? `显示 ${display.length} 条记录` : '当前筛选下无可用记录。';
  }

  for (const select of [company, mode, range]) select.addEventListener('change', render);
  section.querySelector('.vaccine-filters').hidden = false;
  render();
}

mount().catch(() => {
  status.textContent = '暂时无法加载数据，可下载上方 CSV。';
});
