import { mountCompanyTrend } from '../pharmacy/company-trend.js';

const section = document.querySelector('#company-network');
const figure = section.querySelector('figure');
const metric = section.querySelector('#network-metric');
const range = section.querySelector('#network-range');
const caption = section.querySelector('figcaption');
const status = section.querySelector('#network-status');
const number = new Intl.NumberFormat('zh-CN');

async function start() {
  const response = await fetch(new URL('company-network.json',document.baseURI));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const companies = (await response.json()).map(company=>({
    ...company, records:new Map(company.records.map(record=>[record.end,record]))
  }));
  const dates = companies.flatMap(company=>[...company.records.keys()]);
  const firstYear = Math.min(...dates.map(date=>Number(date.slice(0,4))));
  const lastYear = Math.max(...dates.map(date=>Number(date.slice(0,4))));
  const latest = dates.reduce((a,b)=>a>b?a:b);
  const periodEnds = new Map();
  for (let year=firstYear; year<=lastYear; year++) {
    for (const end of ['06-30','12-31']) {
      const date = `${year}-${end}`;
      if (date<=latest) periodEnds.set(year+(end==='06-30'?'H1':'FY'),date);
    }
  }

  const chart = mountCompanyTrend(figure,companies,[...periodEnds.keys()],{
    defaultCode:'300015',
    getPoints:(company,periods)=>periods.map(period=>{
      const record = company.records.get(periodEnds.get(period));
      const count = record?.[metric.value];
      return count == null ? null : { count, detail: record.detail };
    }),
    describe:point=>point ? {value:number.format(point.count)+' 家', detail:point.detail} : {value:'—'},
    labelTick:period=>period.endsWith('FY'),
    getStart:periods=>range.value==='all'?0:Math.max(0,periods.length-Number(range.value)),
    emptyMessage:'请选择当前指标有披露数据的公司'
  });
  function update() {
    caption.textContent = metric.selectedOptions[0].textContent+' · 家';
    chart?.refresh();
  }
  for (const input of [metric,range]) input.addEventListener('change',update);
  section.querySelector('.eye-network-controls').hidden = false;
  update();
}

start().catch(()=>{status.textContent='图表暂时无法加载，可展开公司明细或下载 CSV。';});
