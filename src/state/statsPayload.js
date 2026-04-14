export function isReservedStatsKey(key) {
  return key === "TP" || key === "FN" || key === "FP" || key === "Precision" || key === "Recall";
}

export function buildStatsPayload(patients = [], getPairRecord) {
  let totalTP = 0;
  let totalFN = 0;
  let totalFP = 0;
  const out = {};

  (patients || []).forEach((p) => {
    const pid = p.patient_id;
    const pairRec = getPairRecord(pid);
    const tp = (pairRec.TP || []).length;
    const fn = (pairRec.FN || []).length;
    const fp = (pairRec.FP || []).length;
    totalTP += tp;
    totalFN += fn;
    totalFP += fp;
    out[pid] = {
      TP: pairRec.TP || [],
      FN: pairRec.FN || [],
      FP: pairRec.FP || [],
    };
  });

  const precision = totalTP + totalFP > 0 ? totalTP / (totalTP + totalFP) : 0;
  const recall = totalTP + totalFN > 0 ? totalTP / (totalTP + totalFN) : 0;

  return {
    TP: totalTP,
    FN: totalFN,
    FP: totalFP,
    Precision: Number(precision.toFixed(4)),
    Recall: Number(recall.toFixed(4)),
    ...out,
  };
}

export function applyStatsPayload(data, normalizePair) {
  const records = {};
  const pairRecords = {};
  const src = data || {};

  Object.keys(src).forEach((key) => {
    if (isReservedStatsKey(key)) return;
    const r = src[key] || {};
    const parsePair = (val) => {
      if (!val) return [];
      const arr = Array.isArray(val) ? val : [];
      return arr.map((it) => normalizePair({ GT: it.GT || [], PR: it.PR || [] }));
    };

    pairRecords[key] = {
      TP: parsePair(r.TP),
      FN: parsePair(r.FN),
      FP: parsePair(r.FP),
    };

    records[key] = {
      tp: pairRecords[key].TP.length,
      fn: pairRecords[key].FN.length,
      fp: pairRecords[key].FP.length,
    };
  });

  return { records, pairRecords };
}
