import { uniqueSorted } from '../utils/collections.js';

export function countPairItems(record) {
  const rec = record || { TP: [], FN: [], FP: [] };
  return {
    tp: (rec.TP || []).length,
    fn: (rec.FN || []).length,
    fp: (rec.FP || []).length,
  };
}

export function normalizePair(pair) {
  return {
    GT: uniqueSorted(pair.GT || []),
    PR: uniqueSorted(pair.PR || []),
  };
}
