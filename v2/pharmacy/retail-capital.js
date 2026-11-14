const days = new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const number = v => Number.isFinite(v) ? days.format(v) : '—';
const signed = v => (v > 0 ? '+' : '') + number(v);

function fill(table,rows) {
  table.replaceChildren(...rows.map(([name,...cells])=>{
    const tr = document.createElement('tr');
    [name,...cells].forEach((v,i)=>{
      const td = document.createElement(i===0?'th':'td');
      if (i===0) td.scope = 'row';
      td.textContent = v;
      tr.append(td);
    });
    return tr;
  }));
}

function drawScatter(canvas,points) {
  const {width,height} = canvas.getBoundingClientRect();
  if (!width || !height) return;
  const scale = window.devicePixelRatio || 1;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale,scale);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#52686e';
  if (!points.length) {
    ctx.fillText('该季度暂无匹配的散点数据',25,height/2);
    return;
  }
  const min = Math.min(0,...points.map(p=>p[2]));
  const max = Math.max(0,...points.map(p=>p[2]));
  const yStep = Math.max(1,Math.ceil((max-min)/5));
  const bottom = Math.floor(min/yStep)*yStep;
  const top = Math.max(bottom+yStep,Math.ceil(max/yStep)*yStep);
  const xMax = Math.max(10,Math.ceil(Math.max(...points.map(p=>p[1]))/10)*10);
  const x = v => 45 + v/xMax*(width-63);
  const y = v => height-35 - (v-bottom)/(top-bottom)*(height-52);
  ctx.textAlign = 'right';
  for (let v=bottom;v<=top;v+=yStep) {
    ctx.fillText(v,39,y(v)+4);
    ctx.strokeStyle = v===0 ? '#82969b' : '#dce5e2';
    ctx.beginPath();
    ctx.moveTo(x(0),y(v));
    ctx.lineTo(x(xMax),y(v));
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  for (let v=0;v<=xMax;v+=xMax>50&&width<460?20:10) ctx.fillText(v+'%',x(v),height-15);
  ctx.fillStyle = '#176d60';
  points.forEach(([,share,days],i)=>{
    ctx.beginPath();
    ctx.arc(x(share),y(days),5,0,Math.PI*2);
    ctx.fill();
    ctx.fillText(String(i+1),Math.max(42,x(share)-11),y(days)-9);
  });
}

export async function loadRetailCapital(section,companies,latest,mode) {
  const response = await fetch(new URL('retail-peers.json',import.meta.url));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const {peer,sources,franchise} = await response.json();
  const groups = new Map(Object.entries(peer).flatMap(([code,rows])=>rows.map(r=>[`${code}/${r[0]}`,r])));
  const franchiseByQuarter = new Map(franchise.map(([code,q,v])=>[`${code}/${q}`,v]));
  const get = id => section.querySelector('#'+id);
  const panel = get('capital-drivers');
  const period = get('driver-period'), first = get('driver-first'), second = get('driver-second');
  const scatter = get('franchise-scatter'), metric = get('scatter-metric'), canvas = scatter.querySelector('canvas');
  const periods = [...new Set(companies.flatMap(c=>[...c.periods.keys()]))].sort().reverse();
  for (const q of periods) period.add(new Option(q,q));
  period.value = latest;
  const byCode = new Map(companies.map(c=>[c.code,c]));
  second.add(new Option('不比较','none'));
  for (const c of companies) {
    first.add(new Option(c.name,c.code));
    second.add(new Option(c.name,c.code));
  }
  first.value = '603233';
  second.value = '603939';

  function breakdown(company,quarter) {
    const priorQuarter = (Number(quarter.slice(0,4))-1)+quarter.slice(4);
    const index = Number(mode.value);
    const old = company.periods.get(priorQuarter)?.[index][0] ?? [];
    const current = company.periods.get(quarter)?.[index][0] ?? [];
    if (old.length!==4 || current.length!==4 || ![...old,...current].every(Number.isFinite)) {
      return [company.name,old[3],current[3],null,null,null,null];
    }
    return [company.name,old[3],current[3],current[0]-old[0],current[2]-old[2],old[1]-current[1],current[3]-old[3]];
  }

  function render() {
    const quarter = period.value;
    const a = breakdown(byCode.get(first.value),quarter);
    const rows = [a];
    if (second.value !== 'none') {
      const b = breakdown(byCode.get(second.value),quarter);
      rows.push(b,['A－B',...a.slice(1).map((v,i)=>Number.isFinite(v)&&Number.isFinite(b[i+1])?v-b[i+1]:null)]);
    }
    fill(panel.querySelector('tbody'),rows.map(([name,b,c,...d])=>[name,number(b),number(c),...d.map(signed)]));
    const points = companies.flatMap(company=>{
      const x = franchiseByQuarter.get(`${company.code}/${quarter}`);
      const y = company.periods.get(quarter)?.[Number(mode.value)][0][Number(metric.value)];
      return Number.isFinite(x)&&Number.isFinite(y)?[[company.name,x,y]]:[];
    });
    fill(scatter.querySelector('tbody'),points.length?points.map(([name,x,y],i)=>[`${i+1}. ${name}`,number(x)+'%',number(y)]):[['暂无可比数据','—','—']]);
    drawScatter(canvas,points);
  }

  for (const control of [mode,period,first,second,metric]) control.addEventListener('change',render);
  scatter.addEventListener('toggle',render);
  new ResizeObserver(()=>{if(scatter.open)render();}).observe(canvas);
  panel.hidden = false;
  render();
  return {
    group:(code,q)=>groups.get(`${code}/${q}`),
    includes:(code,q,group)=>group==='all'||groups.get(`${code}/${q}`)?.[1]===group,
    source:index=>sources[index]
  };
}
