import { mountCompanyTrend } from '../pharmacy/company-trend.js';

const period = document.querySelector('#service-period');
const metric = document.querySelector('#service-metric');
const endMonth = document.querySelector('#service-end-month');
const tableGroup = document.querySelector('#service-table-group');
const fmt = new Intl.NumberFormat('zh-CN', {maximumFractionDigits: 2});

function calendar(first,last) {
  const monthId = date => Number(date.slice(0,4))*12+Number(date.slice(5,7))-1;
  const start = monthId(first);
  return Array.from({length:monthId(last)-start+1},(_,i)=>{
    const month=start+i;
    return Math.floor(month/12)+'-'+String(month%12+1).padStart(2,'0');
  });
}

async function init() {
  const res=await fetch('activity.json');
  if (!res.ok) throw new Error('医疗服务数据无法加载');
  const data=await res.json();
  const renderers=new Map();
  const categories=Object.entries(data.groups).map(([code,name])=>({code,name}));
  const months=[...new Set(data.cumulative.map(row=>row.period.slice(5)))].sort();
  endMonth.replaceChildren(...months.map(m=>new Option('1–'+Number(m)+' 月',m)));
  endMonth.value=data.cumulative.at(-1).period.slice(5);
  let activeMetric='visitsYoy';

  for (const mode of Object.keys(data.periods)) {
    const rows=data[mode];
    const dates=mode==='monthly' ? calendar(rows[0].period,rows.at(-1).period) :
      mode==='annual' ? rows.map(row=>row.period) :
      [...new Set(rows.map(row=>row.period.slice(0,4)))];
    const figure=document.querySelector('#service-trend-'+mode);
    const indexed=new Map(rows.map(row=>[row.period,row]));
    const findRow=x=>indexed.get(mode==='cumulative'?x+'-'+endMonth.value:x);
    const chart=mountCompanyTrend(figure,categories,dates,{
      defaultCode:'hospital',
      getPoints:({code},xs)=>xs.map(x=>{
        const row=findRow(x);
        const n=row?.data[code]?.[activeMetric];
        if (n==null) return null;
        return {count:n,detail:row.published ? '发布于 '+row.published : ''};
      }),
      getEnd:xs=>xs.findLastIndex(x=>Object.values(findRow(x)?.data ?? {}).some(cell=>cell[activeMetric]!=null)),
      labelTick:()=>true,
      describe:point=>{
        if (!point) return {value:'—'};
        const unit=data.metrics[activeMetric][1];
        return {value:(activeMetric.endsWith('Yoy') && point.count>0?'+':'')+fmt.format(point.count)+(unit==='%'?'%':' '+unit),detail:point.detail};
      },
      emptyMessage:'当前指标暂无已选机构数据',
    });
    for (const checkbox of figure.querySelectorAll('input[type=checkbox]')) {
      checkbox.checked=['hospital','public','private'].includes(checkbox.value);
    }
    renderers.set(mode,{figure,chart});
  }

  function update() {
    const mode=period.value;
    if (!data.fields[mode].includes(activeMetric)) {
      const equivalent={admissions:'discharges',admissionsYoy:'dischargesYoy',discharges:'admissions',dischargesYoy:'admissionsYoy'};
      activeMetric=data.fields[mode].includes(equivalent[activeMetric])?equivalent[activeMetric]:'visitsYoy';
    }
    metric.replaceChildren(...data.fields[mode].map(key=>new Option(data.metrics[key][0],key)));
    metric.value=activeMetric;
    document.querySelector('#service-year-control').hidden=mode!=='cumulative';
    for (const [key,{figure,chart}] of renderers) {
      figure.hidden=key!==mode;
      if (key===mode) {
        const [name,unit]=data.metrics[activeMetric];
        const label=mode==='cumulative'?'1–'+Number(endMonth.value)+' 月累计':data.periods[mode];
        figure.querySelector('figcaption').textContent=label+' · '+name+'（'+unit+'）';
        chart?.refresh();
      }
    }
  }
  period.addEventListener('change',update);
  endMonth.addEventListener('change',update);
  metric.addEventListener('change',()=>{activeMetric=metric.value;update();});
  tableGroup.addEventListener('change',()=>{
    for(const row of document.querySelectorAll('[data-service-table] [data-group]')) {
      row.hidden=Boolean(tableGroup.value && row.dataset.group!==tableGroup.value);
    }
  });
  update();
  document.querySelector('#service-controls').hidden=false;
  document.querySelector('#service-table-controls').hidden=false;
}
init().catch(error=>console.error(error));
