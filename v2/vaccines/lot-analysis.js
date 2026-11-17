const number = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 1 });
const signed = new Intl.NumberFormat('zh-CN', { signDisplay: 'exceptZero' });
const signedPercent = new Intl.NumberFormat('zh-CN', {
  style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero'
});
const collator = new Intl.Collator('zh-CN', { numeric: true });
const colors = ['#176d65', '#396498', '#98621e', '#79558a', '#447846', '#ab534e', '#899499'];
const otherSeries = '其他（图例合并）';
const featured = ['HPV', '流感', '狂犬病', '肺炎球菌', '水痘', '带状疱疹'];
const allVaccines = '全部人用疫苗';
const officialReport = 'https://www.nifdc.org.cn/directory/web/nifdc/images/uL28iAyMDE3xOrJ%2Bs7v1sbGt8X6x6m3osTqsagucGRm.pdf';
const external2025 = 'https://caifuhao.eastmoney.com/news/20260125202314367299440';
const hualanReport = 'https://static.cninfo.com.cn/finalpage/2026-03-28/1225045582.PDF';
const breakdown = {
  route: '价次／技术路线',
  form: '流感疫苗类型',
  product: '产品系列'
};

function byId(id) {
  return document.getElementById(id);
}

function element(tag, content, className) {
  const node = document.createElement(tag);
  if (content != null) node.textContent = content;
  if (className) node.className = className;
  return node;
}

function appendRow(body, cells) {
  const tr = document.createElement('tr');
  cells.forEach((cell, i) => {
    const td = element(i === 0 ? 'th' : 'td');
    if (i === 0) td.scope = 'row';
    if (cell instanceof Node) td.append(cell);
    else td.textContent = cell ?? '—';
    tr.append(td);
  });
  body.append(tr);
}

function link(label, href) {
  const anchor = element('a', label);
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noopener';
  return anchor;
}

function addOptions(select, values, format = String) {
  for (const value of values) select.add(new Option(format(value), value));
}

function sum(rows) {
  return rows.reduce((total, row) => total + row.count, 0);
}

function decodeRows(rows) {
  return rows.map(([year, month, quarter, , company, holder, category, product, origin, program, count]) => ({
    year, month, quarter, company, holder, category, product, origin, program, count
  }));
}

function cleanProduct(row) {
  return row.product.normalize('NFKC').replace(/\s+/g, '');
}

function productSeries(row) {
  const name = cleanProduct(row);
  // 湖北省药监局 2024 年第 16 期及 2025 年第 17 期，S20190047。
  if (row.holder === '厦门万泰沧海生物技术有限公司' &&
      /^双价人乳头瘤病毒疫苗\(大肠(?:杆菌|埃希菌)\)$/.test(name)) {
    return '万泰双价 HPV（S20190047）';
  }
  return name;
}

function fluForm(row) {
  const name = cleanProduct(row);
  if (name.includes('鼻喷')) return '鼻喷减毒活';
  if (name.includes('亚单位')) return '亚单位';
  if (name.includes('裂解')) return '裂解';
  if (name.includes('灭活')) return '其他灭活';
  return '类型未标注';
}

function route(row) {
  const name = cleanProduct(row);
  switch (row.category) {
    case 'HPV': {
      if (/双价|二价|2价/.test(name)) return '二价';
      if (/[四4]价/.test(name)) return '四价';
      if (/[九9]价/.test(name)) return '九价';
      return '价次未标注';
    }
    case '流感': {
      if (/H1N1|大流行/i.test(name)) return '大流行／H1N1';
      if (/[四4]价/.test(name)) return '四价';
      // 华兰疫苗 2025 年报的 2024、2025 年三价批次分别为 11、6，
      // 与这两个年份该持有人同名产品的采集批次一致。
      if (/[三3]价/.test(name) || (name === '流感病毒裂解疫苗' &&
          row.holder === '华兰生物疫苗股份有限公司' && ['2024', '2025'].includes(row.year))) return '三价';
      return '价次未标注';
    }
    case '狂犬病':
      if (/vero/i.test(name)) return 'Vero 细胞';
      if (name.includes('人二倍体')) return '人二倍体细胞';
      if (name.includes('地鼠肾')) return '地鼠肾细胞';
      if (name.includes('鸡胚')) return '鸡胚细胞';
      return '路线未标注';
    case '肺炎球菌':
      if (/13价.*结合/.test(name)) return 'PCV13';
      if (/23价.*多糖/.test(name)) return 'PPSV23';
      if (/[七7]价.*结合/.test(name)) return 'PCV7';
      return '其他／未标注';
    case '带状疱疹':
      if (name.includes('重组')) return '重组';
      if (name.includes('减毒活')) return '减毒活';
      return '路线未标注';
    case '水痘':
      if (name.includes('冻干')) return '冻干减毒活';
      if (name.includes('减毒活')) return '减毒活（名称未标冻干）';
      return '路线未标注';
    default:
      return productSeries(row);
  }
}

function grouped(rows, classify) {
  const counts = new Map();
  for (const row of rows) {
    const key = classify(row);
    counts.set(key, (counts.get(key) ?? 0) + row.count);
  }
  return [...counts].sort(([a, n], [b, m]) => m - n || collator.compare(a, b));
}

function company(row) {
  return row.company === '/' ? '公司未识别' : row.company;
}

function groupFor(mode) {
  if (mode === 'company') return company;
  if (mode === 'route') return route;
  if (mode === 'form') return fluForm;
  if (mode === 'product') return productSeries;
  return () => '已采集批次';
}

function isPartial(data, year) {
  return (year === data.start.slice(0, 4) && !data.start.endsWith('-01-01')) ||
    (year === data.end.slice(0, 4) && !data.end.endsWith('-12-31'));
}

function yearLabel(data, year) {
  return isPartial(data, year) ? year + '（部分年度）' : year;
}

function chartLimit(max) {
  const targetStep = max / 4;
  const base = 10 ** Math.max(0, Math.floor(Math.log10(targetStep || 1)));
  const step = [1, 2, 2.5, 5, 10].map(multiplier => Math.ceil(multiplier * base))
    .find(candidate => candidate >= targetStep);
  return 4 * step;
}

function renderChart(rows, years, data, mode, asShare) {
  const group = groupFor(mode);
  const byYear = years.map(year => grouped(rows.filter(row => row.year === year), group));
  const totals = byYear.map(groups => groups.reduce((total, [, count]) => total + count, 0));
  const axisMax = asShare ? 1 : chartLimit(Math.max(...totals));
  const labels = grouped(rows.filter(row => years.includes(row.year)), group).map(([label]) => label);
  const visible = labels.length >= colors.length ? [...labels.slice(0, colors.length - 1), otherSeries] : labels;

  const legend = byId('competition-legend');
  legend.replaceChildren(...visible.map((label, i) => {
    const item = element('li');
    const swatch = element('span', null, 'vaccine-swatch');
    swatch.style.backgroundColor = colors[i];
    item.append(swatch, label);
    return item;
  }));

  const axis = element('div', null, 'vaccine-chart-axis');
  const scale = asShare ? percent : number;
  for (const fraction of [1, .75, .5, .25, 0]) {
    axis.append(element('span', scale.format(fraction * axisMax)));
  }

  const series = element('div', null, 'vaccine-chart-series');
  years.forEach((year, i) => {
    const yearCell = element('div', null, 'vaccine-chart-year');
    const column = element('div', null, 'vaccine-chart-column');
    const total = totals[i];
    if (total) {
      const counts = new Map(byYear[i]);
      const stack = element('div', null, 'vaccine-chart-stack');
      stack.style.height = (asShare ? 100 : 100 * total / axisMax) + '%';
      const description = [];
      for (const [j, label] of visible.entries()) {
        const count = label === otherSeries
          ? byYear[i].filter(([name]) => !visible.includes(name)).reduce((n, [, count]) => n + count, 0)
          : counts.get(label);
        if (!count) continue;
        const segment = element('div', null, 'vaccine-chart-segment');
        segment.style.height = (100 * count / total) + '%';
        segment.style.backgroundColor = colors[j];
        segment.title = `${yearLabel(data, year)} · ${label} · ${number.format(count)} 批 · ${percent.format(count / total)}`;
        description.push(`${label} ${number.format(count)} 批`);
        stack.append(segment);
      }
      stack.setAttribute('role', 'img');
      stack.setAttribute('aria-label', `${yearLabel(data, year)}共 ${number.format(total)} 批，${description.join('，')}`);
      column.append(stack);
    } else {
      const missing = element('span', '—', 'vaccine-no-data');
      missing.setAttribute('aria-label', '当前筛选下未见记录');
      column.append(missing);
    }

    const time = element('time', year + (isPartial(data, year) ? '*' : ''));
    time.dateTime = year;
    time.title = yearLabel(data, year);
    if (isPartial(data, year)) time.className = 'partial-year';
    yearCell.append(column, time);
    series.append(yearCell);
  });
  byId('competition-chart').replaceChildren(axis, series);
}

function renderRanks(body, rows, classify) {
  body.replaceChildren();
  const total = sum(rows);
  if (!total) {
    appendRow(body, ['当前筛选下未见记录', null, null]);
    return;
  }
  for (const [name, count] of grouped(rows, classify)) {
    appendRow(body, [name, number.format(count), percent.format(count / total)]);
  }
}

function lastDay(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function comparableMonths(data, rows) {
  const [year, month, day] = data.end.split('-').map(Number);
  const lastComplete = month - Number(day < lastDay(year, month));
  const [firstYear, firstMonth, firstDay] = data.start.split('-').map(Number);
  const firstComplete = firstYear === year - 1 ? firstMonth + Number(firstDay > 1) : 1;
  const periods = new Set(rows.map(row => row.month));
  const months = [];
  for (let n = firstComplete; n <= lastComplete; n++) {
    const suffix = String(n).padStart(2, '0');
    if (periods.has(`${year}-${suffix}`) && periods.has(`${year - 1}-${suffix}`)) months.push(suffix);
  }
  return { year, months };
}

function renderSameMonths(eligible, rows) {
  const { year, months } = eligible;
  const body = byId('competition-yoy');
  const note = byId('competition-yoy-note');
  body.replaceChildren();
  const counts = [year - 1, year].map(y => {
    const annual = rows.filter(row => Number(row.year) === y);
    const comparable = sum(annual.filter(row => months.includes(row.month.slice(5)) && /^\d{4}-\d{2}$/.test(row.month)));
    const unassigned = sum(annual.filter(row => row.month === '跨月未归期'));
    appendRow(body, [String(y), comparable ? number.format(comparable) : null, number.format(unassigned)]);
    return comparable;
  });
  const numericMonths = months.map(Number);
  const contiguous = numericMonths.every((month, i) => month === numericMonths[0] + i);
  const list = numericMonths.length > 1 && contiguous
    ? numericMonths[0] + '–' + numericMonths.at(-1)
    : numericMonths.join('、');
  const change = counts.every(n => n > 0) ? `同期已采集批次变动 ${signedPercent.format(counts[1] / counts[0] - 1)}。` : '';
  note.textContent = months.length
    ? `比较 ${year - 1}、${year} 年两年均有公示记录的完整日历月（${list} 月）。跨月记录单列，公示覆盖可能变化。“—”为未见记录。${change}`
    : '两年暂无都观察到公示记录的完整日历月。';
}

function mountCompetition(data, rows, years, categories) {
  const category = byId('competition-category');
  const origin = byId('competition-origin');
  const program = byId('competition-program');
  const mode = byId('competition-mode');
  const scale = byId('competition-scale');
  const start = byId('competition-start');
  const rankYear = byId('competition-year');
  const fluOption = mode.querySelector('[value="form"]');
  addOptions(category, categories);
  addOptions(origin, [...new Set(rows.map(row => row.origin))].sort(collator.compare));
  addOptions(program, [...new Set(rows.map(row => row.program))].sort(collator.compare));
  addOptions(start, years);
  addOptions(rankYear, [...years].reverse(), year => yearLabel(data, year));
  start.value = years.at(-8) ?? years[0];
  rankYear.value = [...years].reverse().find(year => !isPartial(data, year)) ?? years.at(-1);
  byId('competition-range').textContent = `${data.start} 至 ${data.end} · 按公开批签发记录汇总`;
  const eligible = comparableMonths(data, rows);

  function render() {
    const selected = rows.filter(row => row.category === category.value &&
      (!origin.value || row.origin === origin.value) && (!program.value || row.program === program.value));
    const flu = category.value === '流感';
    const focusCategory = featured.includes(category.value);
    fluOption.hidden = !flu;
    fluOption.disabled = !flu;
    if (!flu && mode.value === 'form') mode.value = 'route';
    mode.querySelector('[value="route"]').textContent = focusCategory ? '按价次／技术路线' : '按产品名称';
    byId('competition-hpv').hidden = category.value !== 'HPV';
    byId('competition-flu').hidden = !flu;
    scale.disabled = mode.value === 'total';
    const asShare = !scale.disabled && scale.value === 'share';
    byId('competition-caption').textContent = `${category.value} · ${mode.selectedOptions[0].textContent} · ${asShare ? '已采集批次数份额' : '已采集批次数'}`;
    byId('competition-chart-note').textContent = '* 为部分年度。— 为当前筛选下未见记录。图例最多单列六组后合并其余，排名提供所选年份的完整明细。';
    renderChart(selected, years.filter(year => year >= start.value), data, mode.value, asShare);

    const annualRows = selected.filter(row => row.year === rankYear.value);
    const total = sum(annualRows);
    byId('competition-ranking-note').textContent = total
      ? `${yearLabel(data, rankYear.value)}共 ${number.format(total)} 批。原分组按公示持有人与已核实公司关系归集。`
      : `${yearLabel(data, rankYear.value)}在当前筛选下未见记录。`;
    renderRanks(byId('competition-ranking'), annualRows, company);
    const label = breakdown[mode.value];
    byId('competition-breakdown-wrap').hidden = !label;
    if (label) {
      byId('competition-breakdown-label').textContent = mode.value === 'route' && !focusCategory ? '产品名称' : label;
      renderRanks(byId('competition-breakdown'), annualRows, groupFor(mode.value));
    }
    renderSameMonths(eligible, selected);
  }

  for (const control of [category, origin, program, mode, scale, start, rankYear]) {
    control.addEventListener('change', render);
  }
  byId('competition-content').hidden = false;
  byId('competition-status').hidden = true;
  render();
  const scroll = byId('competition-chart').parentElement;
  scroll.scrollLeft = scroll.scrollWidth;
}

const thirdPartyTotals = {
  [allVaccines]: 3872, HPV: 186, '流感': 393, '狂犬病': 834, '肺炎球菌': 109
};

function auditSource(name, url, partial) {
  const cell = document.createDocumentFragment();
  if (url) cell.append(link(name, url));
  else cell.append(name);
  if (partial) cell.append(' · 部分年度');
  return cell;
}

function comparisonCells(observed, reference) {
  if (!reference) return [null, null];
  return [number.format(reference), observed ? signed.format(observed - reference) : null];
}

function referenceFor(data, category, year) {
  const official = category === allVaccines ? data.officialAnnual?.[year]
    : category === 'HPV' && year === '2017' ? 7 : undefined;
  if (official) return { count: official, label: '中检院 2017 年报', url: officialReport, official: true };
  if (year === '2025' && thirdPartyTotals[category]) {
    return { count: thirdPartyTotals[category], label: '第三方公示整理', url: external2025 };
  }
  return { label: '暂无对照' };
}

function mountCoverage(data, rows, years, categories) {
  const category = byId('coverage-category');
  const annualBody = byId('coverage-annual');
  const checkBody = byId('coverage-checks');
  addOptions(category, categories);

  function renderAnnual() {
    const choice = category.value || allVaccines;
    const selection = category.value ? rows.filter(row => row.category === category.value) : rows;
    annualBody.replaceChildren();
    for (const year of [...years].reverse()) {
      const annual = selection.filter(row => row.year === year);
      const observed = sum(annual);
      const reference = referenceFor(data, choice, year);
      const partial = isPartial(data, year);
      const crossMonth = sum(annual.filter(row => row.month === '跨月未归期'));
      const crossQuarter = sum(annual.filter(row => row.quarter === '跨季未归期'));
      appendRow(annualBody, [
        year, observed ? number.format(observed) : null,
        observed ? number.format(crossMonth) : null, observed ? number.format(crossQuarter) : null,
        ...comparisonCells(observed, reference.count),
        observed && reference.official && !partial ? percent.format(observed / reference.count) : null,
        auditSource(reference.label, reference.url, partial)
      ]);
    }
  }

  const recent = rows.filter(row => row.year === '2025');
  for (const [name, reference] of Object.entries(thirdPartyTotals)) {
    const observed = sum(recent.filter(row => name === allVaccines || row.category === name));
    appendRow(checkBody, [name, number.format(observed), ...comparisonCells(observed, reference),
      link('第三方公示整理', external2025)]);
  }
  const subsetChecks = [
    ['HPV · 二价', 'HPV', '二价', 159],
    ['HPV · 四价', 'HPV', '四价', 2],
    ['HPV · 九价', 'HPV', '九价', 25],
    ['流感 · 四价', '流感', '四价', 247],
    ['狂犬病 · Vero 细胞', '狂犬病', 'Vero 细胞', 742],
    ['狂犬病 · 人二倍体细胞', '狂犬病', '人二倍体细胞', 37],
    ['狂犬病 · 地鼠肾细胞', '狂犬病', '地鼠肾细胞', 55],
    ['肺炎球菌 · PCV13', '肺炎球菌', 'PCV13', 82],
    ['肺炎球菌 · PPSV23', '肺炎球菌', 'PPSV23', 27]
  ];
  for (const [label, type, group, reference] of subsetChecks) {
    const observed = sum(recent.filter(row => row.category === type && route(row) === group));
    appendRow(checkBody, [label, observed ? number.format(observed) : null, ...comparisonCells(observed, reference),
      link('第三方公示整理', external2025)]);
  }
  for (const [type, group, reference] of [['流感', '三价', 6], ['流感', '四价', 51], ['狂犬病', 'Vero 细胞', 6]]) {
    const observed = sum(recent.filter(row => row.company === '华兰疫苗（301207）' &&
      row.category === type && route(row) === group));
    appendRow(checkBody, [`华兰疫苗 · ${type} · ${group}`, observed ? number.format(observed) : null,
      ...comparisonCells(observed, reference), link('华兰疫苗年报摘要', hualanReport)]);
  }

  const crossMonth = sum(rows.filter(row => row.month === '跨月未归期'));
  const crossQuarter = sum(rows.filter(row => row.quarter === '跨季未归期'));
  const consistent = years.every(year => sum(rows.filter(row => row.year === year)) === data.annual?.[year]);
  const note = consistent ? '逐年加总与发布的年度汇总一致。' : '部分年份与发布的年度汇总存在差异。';
  byId('coverage-status').textContent = `${number.format(sum(rows))} 批可归年，${number.format(crossMonth)} 批跨月、${number.format(crossQuarter)} 批跨季。` +
    `${number.format(data.stats.boundaryExcluded)} 批跨年或跨覆盖截止日且日期未明，未计入。 ${note}`;
  category.addEventListener('change', renderAnnual);
  byId('coverage-content').hidden = false;
  renderAnnual();
}

export function mountLotAnalysis(data) {
  const rows = decodeRows(data.rows);
  const years = Object.keys(data.annual).sort();
  const categories = [...new Set(rows.map(row => row.category))].sort(collator.compare);
  const ordered = [...featured.filter(name => categories.includes(name)),
    ...categories.filter(name => !featured.includes(name))];
  mountCompetition(data, rows, years, ordered);
  mountCoverage(data, rows, years, ordered);
}

export function showLotAnalysisError() {
  for (const [id, message] of [
    ['competition-status', '竞争格局数据暂未加载，可查看下方的批签发查询及下载。'],
    ['coverage-status', '年度核验数据暂未加载。']
  ]) {
    byId(id).hidden = false;
    byId(id).textContent = message;
  }
}

export async function mountReleaseDoses() {
  const status = byId('doses-status');
  try {
    const response = await fetch('release-doses.json');
    if (!response.ok) throw new Error('剂数数据下载失败');
    const { records, sources } = await response.json();
    const company = byId('doses-company');
    const category = byId('doses-category');
    const period = byId('doses-period');
    const periodKey = row => `${row.year}-${row.period}`;
    const periodLabel = key => key.replace('-FY', ' 全年').replace('-H1', ' 上半年');
    addOptions(company, [...new Set(records.map(row => row.disclosure_company))].sort(collator.compare));
    addOptions(category, [...new Set(records.map(row => row.category))].sort(collator.compare));
    addOptions(period, [...new Set(records.map(periodKey))].sort().reverse(), periodLabel);
    period.value = '2025-FY';
    const body = byId('doses-rows');

    function render() {
      const rows = records.filter(row => (!company.value || row.disclosure_company === company.value) &&
        (!category.value || row.category === category.value) && (!period.value || periodKey(row) === period.value));
      rows.sort((a, b) => periodKey(b).localeCompare(periodKey(a)) || collator.compare(a.disclosure_company, b.disclosure_company));
      body.replaceChildren();
      for (const row of rows) {
        const source = sources[row.source];
        appendRow(body, [periodLabel(periodKey(row)), row.disclosure_company, row.product, row.manufacturer,
          row.commercial_role, row.release_doses == null ? null : number.format(row.release_doses), row.unit,
          link(source.title, source.url)]);
      }
      status.textContent = rows.length ? `${rows.length} 条披露记录` : '当前筛选暂无可用的公司披露。';
      byId('doses-table').hidden = !rows.length;
    }

    for (const control of [company, category, period]) control.addEventListener('change', render);
    byId('doses-controls').hidden = false;
    render();
  } catch (error) {
    status.textContent = '剂数暂未加载，可下载数据或稍后重试。';
    console.error(error);
  }
}
