import { mountCompanyTrend } from '../pharmacy/company-trend.js';

const format = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });

async function init() {
  const response = await fetch('trends.json');
  if (!response.ok) throw new Error('医保趋势数据无法加载');
  const data = await response.json();
  for (const figure of document.querySelectorAll('[data-insurance-chart]')) {
    const { rows, fields } = data[figure.dataset.insuranceChart];
    const visible = figure.dataset.series.split(' ');
    const selected = new Set(figure.dataset.selected.split(' '));
    const series = fields.filter(([key])=>visible.includes(key)).map(([code,name,unit])=>({code,name,unit}));
    const renderer = mountCompanyTrend(figure,series,rows.map(row=>row.period),{
      defaultCode: series[0].code,
      getPoints: ({code,unit})=>rows.map(row=>row[code] == null ? null : {count:row[code],unit}),
      labelTick: ()=>true,
      describe: point=>({value:point ? format.format(point.count)+' '+point.unit : '—'}),
      emptyMessage: '请选择指标',
    });
    for (const input of figure.querySelectorAll('input[type=checkbox]')) {
      input.checked = selected.has(input.value);
    }
    renderer?.refresh();
  }
}
init().catch(error=>console.error(error));
