(() => {
  const panel = document.querySelector('#company-stores');
  const filters = panel.querySelector('.company-filters');
  const companySelect = panel.querySelector('#store-company');
  const periodSelect = panel.querySelector('#store-period');
  const basisSelect = panel.querySelector('#store-basis');
  const status = panel.querySelector('#company-row-status');
  const table = panel.querySelector('.company-table-wrap');
  const body = panel.querySelector('#company-store-rows');
  const detail = panel.querySelector('#company-source-detail');
  const number = new Intl.NumberFormat('en-US');
  const fields = [
    ['total','期末药店总数'], ['direct','直营'], ['franchise','加盟'], ['open','新开／新增'],
    ['close','关闭'], ['acquired','并购'], ['new_franchise','新增加盟'], ['relocated','搬迁'],
    ['group_total','集团合计']
  ];
  const flows = new Set(['open','close','acquired','new_franchise','relocated']);
  let lastSourceButton;

  function add(tag, text, parent) {
    const el = document.createElement(tag);
    if (text !== null) el.textContent = text;
    parent.append(el);
    return el;
  }

  async function load() {
    const response = await fetch('company-stores.json');
    if (!response.ok) throw new Error('门店数据加载失败');
    const { companies, sources } = await response.json();
    const periods = [...new Set(companies.flatMap(c => c.records.map(([q])=>q)))].sort().reverse();
    const rows = companies.flatMap(c => c.records.map(([quarter,values])=>({ company:c, quarter, values })));
    rows.sort((a,b)=>b.quarter.localeCompare(a.quarter));

    companies.forEach(c=>companySelect.add(new Option(c.name,c.code)));
    periodSelect.add(new Option('近 8 季度','recent'));
    periodSelect.add(new Option('全部季度','all'));
    periods.forEach(q=>periodSelect.add(new Option(q,q)));
    periodSelect.value = periods[0];

    function openSource(row, button) {
      detail.replaceChildren();
      const heading = add('div',null,detail);
      heading.className = 'company-source-head';
      add('h3',row.company.name+' · '+row.quarter,heading);
      const close = add('button','收起来源',heading);
      close.type='button';
      close.addEventListener('click',()=>{
        detail.hidden=true;
        lastSourceButton?.focus();
      });
      add('p',row.company.note,detail);
      const shown = add('dl',null,detail);
      fields.forEach(([field,label])=>{
        const key = basisSelect.value==='ytd' && flows.has(field) ? field+'_ytd' : field;
        const data = row.values[key];
        if (!data) return;
        const [value,refs,method,note] = data;
        add('dt',label+' · '+number.format(value)+' 家',shown);
        const line = add('dd',method+(note ? ' · '+note : ''),shown);
        refs.forEach(index=>{
          const [title,url,page] = sources[index];
          const link = add('a',title+' 第 '+page+' 页',line);
          link.href = url;
          link.target='_blank';
          link.rel='noopener';
        });
      });
      lastSourceButton = button;
      detail.hidden=false;
      detail.focus();
    }

    function render() {
      const selectedCompany = companySelect.value;
      const period = periodSelect.value;
      const ytd = basisSelect.value==='ytd';
      const fragment = document.createDocumentFragment();
      let selected = rows.filter(row => (selectedCompany==='all' || row.company.code===selectedCompany) &&
        (period==='all' || period===row.quarter || (period==='recent' && periods.slice(0,8).includes(row.quarter))));
      if (period==='all') selected = selected.filter(row=>Object.keys(row.values).length);
      if (selectedCompany!=='all' && !selected.length && period!=='all' && period!=='recent') {
        const company=companies.find(c=>c.code===selectedCompany);
        selected=[{company,quarter:period,values:{}}];
      }
      for (const row of selected) {
        const tr=add('tr',null,fragment);
        const company=add('th',row.company.name,tr);
        company.scope='row';
        add('td',row.quarter,tr);
        for (const [field] of fields) {
          const val = row.values[ytd && flows.has(field) ? field+'_ytd' : field];
          const cell = add('td',val ? number.format(val[0]) : '—',tr);
          if (val && (val[2]==='累计相减'||val[2]==='计算')) add('sup','*',cell);
          if (val && val[3]) cell.title=val[3];
        }
        const sourceCell=add('td',null,tr);
        if (Object.keys(row.values).length) {
          const button=add('button','查来源',sourceCell);
          button.type='button';
          button.className='source-button';
          button.addEventListener('click',()=>openSource(row,button));
        } else {
          sourceCell.textContent='—';
        }
      }
      body.replaceChildren(fragment);
      detail.hidden=true;
      const filled=selected.filter(row=>row.values.total).length;
      status.textContent=selected.length+' 行 · '+filled+' 行有期末总数 · '+(ytd?'年内累计变动':'单季变动');
    }
    filters.addEventListener('change',render);
    filters.hidden=false;
    table.hidden=false;
    render();
  }
  load().catch(()=>{
    status.textContent='门店表暂时无法加载。可下载 CSV 查看完整数据。';
  });
})();
