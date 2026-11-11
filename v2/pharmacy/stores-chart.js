(() => {
  const series = JSON.parse(document.querySelector('#stores-series').textContent);
  const figure = document.querySelector('#stores-trend');
  const canvas = document.querySelector('#stores-chart');
  const tooltip = document.querySelector('#plot-tooltip');
  const context = canvas.getContext('2d');
  if (!context) return;
  const controls = [...figure.querySelectorAll('[data-range]')];
  const colors = { exact: '#176d65', approx: '#176d65', derived: '#99682c', broker: '#506884' };
  let current = series;
  let points = [];
  let selected = -1;

  function draw() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const values = current.filter(row => row.count !== null).map(row => row.count / 10000);
    const step = Math.max(...values) - Math.min(...values) > 12 ? 5 : 1;
    const min = Math.floor(Math.min(...values) / step) * step;
    const max = Math.ceil(Math.max(...values) / step) * step;
    const left = 36, right = width - 25, top = 20, bottom = height - 34;
    const x = index => left + index * (right - left) / (current.length - 1);
    const y = value => bottom - (value / 10000 - min) * (bottom - top) / (max - min || 1);

    context.font = '12px system-ui, sans-serif';
    context.textBaseline = 'middle';
    context.textAlign = 'right';
    context.fillStyle = '#64747a';
    for (let tick = min; tick <= max; tick += step) {
      context.fillText(String(tick), left - 9, y(tick * 10000));
      context.strokeStyle = '#dce5e2';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(left, y(tick * 10000));
      context.lineTo(right, y(tick * 10000));
      context.stroke();
    }
    points = current.flatMap((row, index) => row.count === null ? [] :
      [{ ...row, index, x: x(index), y: y(row.count) }]);

    const first = points[0];
    const last = points.at(-1);
    const tickGap = width < 440 ? 61 : 70;
    let previousTick = first.x - tickGap;
    context.textAlign = 'center';
    for (const point of points) {
      const annual = point.quarter.endsWith(current === series ? 'Q4' : 'Q1');
      if (point === first || point === last ||
          annual && point.x - previousTick >= tickGap && last.x - point.x >= tickGap) {
        context.fillText(point.quarter, point.x, bottom + 19);
        previousTick = point.x;
      }
    }
    for (let index = 1; index < points.length; index++) {
      const previous = points[index - 1];
      const point = points[index];
      if (point.index !== previous.index + 1) continue;
      context.beginPath();
      context.strokeStyle = '#176d65';
      context.lineWidth = 2;
      context.setLineDash(point.kind === 'derived' || previous.kind === 'derived' ? [4, 4] : []);
      context.moveTo(previous.x, previous.y);
      context.lineTo(point.x, point.y);
      context.stroke();
    }
    context.setLineDash([]);
    for (const point of points) {
      context.save();
      context.translate(point.x, point.y);
      context.fillStyle = colors[point.kind];
      if (point.kind === 'derived' || point.kind === 'broker') {
        if (point.kind === 'broker') context.rotate(Math.PI / 4);
        context.fillRect(-3.5, -3.5, 7, 7);
      } else {
        context.beginPath();
        context.arc(0, 0, 4.2, 0, Math.PI * 2);
        if (point.kind === 'approx') {
          context.fillStyle = '#fff';
          context.strokeStyle = colors.approx;
          context.lineWidth = 1.7;
          context.fill();
          context.stroke();
        } else {
          context.fill();
        }
      }
      context.restore();
    }
    if (selected >= 0) show(selected);
  }

  function show(index) {
    const point = points[index];
    if (!point) return;
    selected = index;
    tooltip.textContent = `${point.quarter} · ${point.label} 家 · ${point.basis}`;
    tooltip.hidden = false;
    const maxLeft = Math.max(0, canvas.clientWidth - tooltip.offsetWidth);
    tooltip.style.left = Math.max(0, Math.min(maxLeft, point.x - tooltip.offsetWidth / 2)) + 'px';
    tooltip.style.top = Math.max(0, point.y - 35) + 'px';
  }

  function hide() {
    selected = -1;
    tooltip.hidden = true;
  }

  controls.forEach(button => button.addEventListener('click', () => {
    current = button.dataset.range === 'all' ? series :
      series.filter(row => Number(row.quarter.slice(0, 4)) >= 2024);
    controls.forEach(control => control.setAttribute('aria-pressed', String(button === control)));
    hide();
    draw();
  }));
  canvas.addEventListener('pointermove', event => {
    const x = event.clientX - canvas.getBoundingClientRect().left;
    const distances = points.map(point => Math.abs(point.x - x));
    const distance = Math.min(...distances);
    if (distance <= 11) show(distances.indexOf(distance));
    else hide();
  });
  canvas.addEventListener('pointerleave', hide);
  canvas.addEventListener('blur', hide);
  canvas.addEventListener('keydown', event => {
    if (event.key === 'Escape') hide();
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = selected < 0 ? 0 : selected + (event.key === 'ArrowRight' ? 1 : -1);
    show(Math.max(0, Math.min(next, points.length - 1)));
  });
  figure.hidden = false;
  new ResizeObserver(draw).observe(canvas);
  draw();
})();
