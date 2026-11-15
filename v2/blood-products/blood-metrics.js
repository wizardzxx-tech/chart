export function plasmaPerStation(row, previous) {
  const {volume, volumeMark, active} = row.ops ?? {};
  const start = previous?.ops?.active;
  if (!(row.year === previous?.year + 1 && volume > 0 && start > 0 && active > 0)) return null;
  const average = (start + active) / 2;
  return {count: volume / average, average, start, end: active, volumeMark};
}

export function productRevenueShares(pnl, basis) {
  if (!(pnl?.total > 0)) return null;
  // Only a separately identified import stream can be adjusted.
  const deduction = basis === 'aligned' ? pnl.imported ?? 0 : 0;
  const denominator = pnl.total - deduction;
  if (!(denominator > 0)) return null;
  const share = (value, excluded = 0) =>
    Number.isFinite(value) && value >= excluded && value - excluded <= denominator
      ? (value - excluded) / denominator * 100 : null;
  return {
    alb: share(pnl.alb, deduction), ivig: share(pnl.ivig), other: share(pnl.other),
    denominator, deduction, importDisclosed: Number.isFinite(pnl.imported)
  };
}
