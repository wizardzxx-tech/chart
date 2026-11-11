const interpolationCompanies = new Set(['000028', '301408']);
const colors = ['#176d65', '#315e99', '#9b551f', '#86528f', '#64802d',
  '#a13c51', '#176f99', '#68543f', '#4f5a9b'];
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

function quarterPoints(company, quarters) {
  const reported = new Map(company.records.flatMap(([quarter, values]) =>
    Number.isFinite(values.total?.[0]) ? [[quarter, values.total[0]]] : []));
  return quarters.map((quarter, index) => {
    if (reported.has(quarter)) return { count: reported.get(quarter) };
    if (!interpolationCompanies.has(company.code) || !/[13]$/.test(quarter)) return null;
    const previous = quarters[index - 1];
    const next = quarters[index + 1];
    if (!reported.has(previous) || !reported.has(next)) return null;
    const left = reported.get(previous);
    const right = reported.get(next);
    return { count: (left + right) / 2, estimate: { previous, next, left, right } };
  });
}

function gridStep(max) {
  const target = max / 5;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  return [1, 2, 2.5, 5, 10].find(step => step * magnitude >= target) * magnitude;
}

export function mountCompanyTrend(figure, companies, quarters) {
  const canvas = figure.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const tooltip = figure.querySelector('.company-trend-tooltip');
  const controls = figure.querySelector('fieldset');
  let active = -1;
  let visible = [];
  let first = 0;
  let last = quarters.length - 1;
  let plot;
  const series = companies.map((company, i) => {
    const color = colors[i % colors.length];
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = company.code === '603939';
    checkbox.value = company.code;
    checkbox.style.accentColor = color;
    const swatch = document.createElement('span');
    swatch.className = 'company-series-swatch';
    swatch.style.backgroundColor = color;
    swatch.setAttribute('aria-hidden', 'true');
    label.append(checkbox, swatch, company.name);
    controls.append(label);
    return { company, color, checkbox, points: quarterPoints(company, quarters) };
  });

  function draw() {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.font = '12px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#64747a';
    if (!visible.length) {
      plot = null;
      ctx.textAlign = 'center';
      ctx.fillText('勾选公司后查看门店数', width / 2, height / 2);
      return;
    }

    const maximum = Math.max(1, ...visible.flatMap(row => row.points.map(point => point?.count ?? 0)));
    const step = gridStep(maximum);
    const topValue = Math.ceil(maximum / step) * step;
    const left = Math.ceil(ctx.measureText(number.format(topValue)).width) + 13;
    const right = width - 26;
    const top = 14;
    const bottom = height - 32;
    const x = index => left + (index - first) * (right - left) / Math.max(1, last - first);
    const y = count => bottom - count * (bottom - top) / topValue;
    plot = { left, right, x };
    ctx.textAlign = 'right';
    ctx.lineWidth = 1;
    for (let value = 0; value <= topValue; value += step) {
      const lineY = y(value);
      ctx.fillText(number.format(value), left - 8, lineY);
      ctx.strokeStyle = '#dce5e2';
      ctx.beginPath();
      ctx.moveTo(left, lineY);
      ctx.lineTo(right, lineY);
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.fillText(quarters[first], x(first), bottom + 19);
    let previousTick = x(first);
    for (let index = first + 1; index < last; index++) {
      if (!quarters[index].endsWith('Q4') || x(index) - previousTick < 66 || right - x(index) < 66) continue;
      ctx.fillText(quarters[index], x(index), bottom + 19);
      previousTick = x(index);
    }
    if (last > first) ctx.fillText(quarters[last], x(last), bottom + 19);

    if (active >= first && active <= last) {
      ctx.strokeStyle = '#9aabb1';
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(x(active), top);
      ctx.lineTo(x(active), bottom);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const { points, color } of visible) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.9;
      for (let index = first + 1; index <= last; index++) {
        const before = points[index - 1];
        const point = points[index];
        if (!before || !point) continue;
        ctx.setLineDash(before.estimate || point.estimate ? [5, 4] : []);
        ctx.beginPath();
        ctx.moveTo(x(index - 1), y(before.count));
        ctx.lineTo(x(index), y(point.count));
        ctx.stroke();
      }
      ctx.setLineDash([]);
      for (let index = first; index <= last; index++) {
        const point = points[index];
        if (!point) continue;
        ctx.beginPath();
        ctx.arc(x(index), y(point.count), index === active ? 4.6 : point.estimate ? 3.2 : 2.2, 0, Math.PI * 2);
        ctx.fillStyle = point.estimate ? '#fff' : color;
        ctx.fill();
        if (point.estimate || index === active) ctx.stroke();
      }
    }
  }

  function showQuarter(index) {
    if (!plot || index === active) return;
    active = index;
    draw();
    if (index < 0) {
      tooltip.hidden = true;
      return;
    }
    const heading = document.createElement('strong');
    heading.textContent = quarters[index];
    tooltip.replaceChildren(heading);
    for (const { company, points, color } of visible) {
      const point = points[index];
      const line = document.createElement('div');
      line.style.setProperty('--series-color', color);
      line.textContent = company.name + '　' + (point ? number.format(point.count) + ' 家' : '—');
      if (point?.estimate) {
        line.append('（估算）');
        const { previous, next, left, right } = point.estimate;
        const formula = document.createElement('small');
        formula.textContent = `(${previous} 的 ${number.format(left)} + ${next} 的 ${number.format(right)}) ÷ 2`;
        line.append(formula);
      }
      tooltip.append(line);
    }
    tooltip.hidden = false;
    const width = canvas.clientWidth;
    const cursor = plot.x(index);
    const offset = cursor + tooltip.offsetWidth + 18 < width ? cursor + 10 : cursor - tooltip.offsetWidth - 10;
    tooltip.style.left = Math.max(0, Math.min(width - tooltip.offsetWidth, offset)) + 'px';
  }

  function inspectPointer(event) {
    if (!plot) return;
    const ratio = (event.clientX - canvas.getBoundingClientRect().left - plot.left) / (plot.right - plot.left);
    showQuarter(first + Math.round(Math.min(1, Math.max(0, ratio)) * (last - first)));
  }
  canvas.addEventListener('pointermove', event => {
    if (event.pointerType !== 'touch') inspectPointer(event);
  });
  canvas.addEventListener('pointerup', inspectPointer);
  canvas.addEventListener('pointerleave', event => {
    if (event.pointerType !== 'touch') showQuarter(-1);
  });
  canvas.addEventListener('blur', () => showQuarter(-1));
  canvas.addEventListener('keydown', event => {
    const { key } = event;
    if (key === 'Escape') {
      showQuarter(-1);
    } else if (['Home', 'End', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      event.preventDefault();
      const next = key === 'Home' ? first : key === 'End' || active < 0 ? last :
        active + (key === 'ArrowLeft' ? -1 : 1);
      showQuarter(Math.min(last, Math.max(first, next)));
    }
  });
  function updateSelection() {
    visible = series.filter(row => row.checkbox.checked);
    const start = visible.map(row => row.points.findIndex(Boolean)).filter(index => index >= 0);
    first = start.length ? Math.min(...start) : 0;
    active = -1;
    tooltip.hidden = true;
    draw();
  }
  controls.addEventListener('change', updateSelection);
  figure.hidden = false;
  new ResizeObserver(() => {
    const index = active;
    active = -1;
    draw();
    if (index >= 0) showQuarter(index);
  }).observe(canvas);
  updateSelection();
}
