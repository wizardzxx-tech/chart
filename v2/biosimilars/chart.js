const margins = {left: 51, right: 26, top: 15, bottom: 35};
export const colorPalette = ['#253b44','#217b69','#b36a21','#3861a3','#975882','#727b27','#167c90','#a24a48','#735295'];
export const isNumber = value => typeof value === 'number' && Number.isFinite(value);

export function drawLines(canvas, spec) {
  if (!spec || !canvas.clientWidth || !canvas.clientHeight) return;
  const {periods, series, selected, labels, formatY} = spec;
  const {clientWidth:width, clientHeight:height} = canvas;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio,ratio);
  const upper = Math.max(1,spec.upper || 0);
  const areaWidth = width-margins.left-margins.right;
  const areaHeight = height-margins.top-margins.bottom;
  const x = index => periods.length===1 ? margins.left+areaWidth/2 :
    margins.left+areaWidth*index/Math.max(1,periods.length-1);
  const y = n => margins.top+areaHeight*(1-n/upper);
  ctx.font = '11px system-ui';
  ctx.fillStyle = '#52646a';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i=0;i<=4;i++) {
    const n = upper*i/4;
    ctx.strokeStyle = '#dce7df';
    ctx.beginPath();
    ctx.moveTo(margins.left,y(n));
    ctx.lineTo(width-margins.right,y(n));
    ctx.stroke();
    ctx.fillText(formatY(n),margins.left-7,y(n));
  }
  const active = periods.indexOf(selected);
  if (active>=0) {
    ctx.strokeStyle='#93a49b';
    ctx.setLineDash([3,4]);
    ctx.beginPath();
    ctx.moveTo(x(active),margins.top);
    ctx.lineTo(x(active),height-margins.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.textAlign = 'center';
  const tick = Math.max(1,Math.ceil(periods.length/Math.max(2,Math.floor(areaWidth/62))));
  periods.forEach((id,i)=>{
    if (i && i!==periods.length-1 && (i%tick || periods.length-1-i<tick)) return;
    ctx.fillText(labels(id),x(i),height-12);
  });
  series.forEach(item=>{
    ctx.strokeStyle=item.color;
    ctx.fillStyle=item.color;
    ctx.lineWidth=item.strong?2.6:1.75;
    ctx.setLineDash(item.dash?[5,3]:[]);
    let connected=false;
    const points=[];
    ctx.beginPath();
    periods.forEach((id,i)=>{
      const value=item.values[id];
      if (!isNumber(value)) {connected=false;return;}
      const point=[x(i),y(value),i];
      if (connected) ctx.lineTo(point[0],point[1]); else ctx.moveTo(point[0],point[1]);
      points.push(point);
      connected=true;
    });
    ctx.stroke();
    ctx.setLineDash([]);
    points.forEach(([cx,cy,i])=>{
      ctx.beginPath();
      ctx.arc(cx,cy,active===i?3.5:2.3,0,Math.PI*2);
      ctx.fill();
    });
  });
}

export function closestPeriod(canvas, offsetX, periods) {
  if (!periods.length) return undefined;
  const usable = canvas.clientWidth-margins.left-margins.right;
  const index = Math.round((offsetX-margins.left)/Math.max(1,usable)*(periods.length-1));
  return periods[Math.max(0,Math.min(periods.length-1,index))];
}
