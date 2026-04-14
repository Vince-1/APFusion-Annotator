export function fmtAutoPairMetric(v) {
  return Number.isFinite(v) ? v.toFixed(3) : "--";
}

export function formatGroupIndices(prefix, indices) {
  const arr = (indices || []).slice().sort((a, b) => a - b);
  return arr.length ? arr.map((i) => `${prefix}${i + 1}`).join("+") : `${prefix}∅`;
}
