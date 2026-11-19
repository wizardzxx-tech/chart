import { mountCompanyTrend } from '../pharmacy/company-trend.js';

const section = document.querySelector('#industry');
const select = section.querySelector('#industry-metric');
const status = section.querySelector('#industry-status');
const figure = section.querySelector('figure');
const number = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });

async function start() {
  const response = await fetch('industry-series.json');
  if (!response.ok) throw new Error('行业数据下载失败');
  const rows = (await response.json()).filter(row => row.kind !== '当时预测');
  const metrics = [...new Set(rows.map(row => row.metric))];
  for (const name of metrics) select.add(new Option(name, name));
  select.value = '统计年鉴 · 眼科医院';
  const dates = rows.filter(row => /^\d{4}$/.test(row.year)).map(row => Number(row.year));
  const years = Array.from({ length: Math.max(...dates) - Math.min(...dates) + 1 }, (_, i) => String(Math.min(...dates) + i));
  const renderer = mountCompanyTrend(figure, [{ code: 'industry', name: '所选指标' }], years, {
    defaultCode: 'industry',
    labelTick: () => true,
    getStart: periods => Math.max(0, periods.indexOf(rows.find(row => row.metric === select.value)?.year)),
    getEnd: periods => {
      const available = rows.filter(row => row.metric === select.value && /^\d{4}$/.test(row.year)).map(row => row.year);
      return available.length ? periods.indexOf(available.sort().at(-1)) : periods.length - 1;
    },
    getPoints: (_company, periods) => periods.map(year => {
      const row = rows.find(row => row.metric === select.value && row.year === year);
      return row ? { count: row.value, detail: row.kind + ' · ' + row.source + '（' + row.published + ' 年版本）',
        lowerBound: row.kind.includes('超过') } : null;
    }),
    describe: point => point ? { value: (point.lowerBound ? '> ' : '') + number.format(point.count) + ' ' +
      rows.find(row => row.metric === select.value).unit, detail: point.detail } : { value: '—' },
    emptyMessage: '该指标缺少明确统计年份，详见原始数据'
  });
  figure.querySelector('fieldset').hidden = true;
  function render() {
    const selection = rows.filter(row => row.metric === select.value);
    section.querySelector('figcaption').textContent = select.value + ' · ' + selection[0].unit;
    status.textContent = selection.map(row => row.source + '（' + row.published + ' 年版本）').filter((v, i, a) => a.indexOf(v) === i).join('；') +
      '。' + (selection.some(row => !/^\d{4}$/.test(row.year)) ? '披露年未明确统计年份的记录请在原始数据中查看。' : '');
    renderer.refresh();
  }
  byId('industry-controls').hidden = false;
  figure.hidden = false;
  select.addEventListener('change', render);
  render();
}
const byId = id => document.getElementById(id);
start().catch(error => {
  status.textContent = '行业图表暂未加载，可展开原始历史数据或下载 CSV。';
  console.error(error);
});
