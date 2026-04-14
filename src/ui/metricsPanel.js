export function computePrecisionRecall(tp, fn, fp) {
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  return {
    precision,
    recall,
  };
}

export function formatRate(value) {
  return Number.isFinite(value) ? value.toFixed(4) : "0.0000";
}
