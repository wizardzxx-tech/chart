(() => {
  const panel = document.querySelector('#equity-incentives');
  const filters = panel.querySelector('.equity-filters');
  const company = filters.querySelector('#equity-company');
  const status = filters.querySelector('#equity-status');
  const message = panel.querySelector('#equity-filter-status');
  const table = panel.querySelector('.equity-table-wrap');
  const rows = [...table.querySelectorAll('tbody tr')];

  function update() {
    let count = 0;
    for (const row of rows) {
      const matches = (company.value === 'all' || row.dataset.company === company.value) &&
        (status.value === 'all' || row.dataset.status === status.value);
      row.hidden = !matches;
      if (matches) count++;
    }
    table.hidden = count === 0;
    message.textContent = count ? `显示 ${count} 条年度记录` : '当前筛选下无记录。';
    table.scrollTop = 0;
  }

  filters.addEventListener('change', update);
  filters.hidden = false;
  message.hidden = false;
  update();
})();
