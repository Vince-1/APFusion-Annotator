export function getCoverageStatusFlow(state, pid, getPairRecord) {
  const p = state.patients.find((item) => item.patient_id === pid) || null;
  if (!p) {
    return { complete: false, totalGt: 0, totalPr: 0, usedGt: 0, usedPr: 0, missingGt: [], missingPr: [] };
  }

  const totalGt = (p.gt?.front || []).length + (p.gt?.back || []).length;
  const totalPr = (p.pred?.front || []).length + (p.pred?.back || []).length;

  const rec = getPairRecord(pid);
  const usedGt = new Set();
  const usedPr = new Set();
  ["TP", "FN", "FP"].forEach((mode) => {
    (rec[mode] || []).forEach((item) => {
      (item.GT || []).forEach((i) => usedGt.add(i));
      (item.PR || []).forEach((i) => usedPr.add(i));
    });
  });

  const missingGt = [];
  const missingPr = [];
  for (let i = 0; i < totalGt; i += 1) if (!usedGt.has(i)) missingGt.push(i);
  for (let i = 0; i < totalPr; i += 1) if (!usedPr.has(i)) missingPr.push(i);

  return {
    complete: missingGt.length === 0 && missingPr.length === 0,
    totalGt,
    totalPr,
    usedGt: usedGt.size,
    usedPr: usedPr.size,
    missingGt,
    missingPr,
  };
}

export function getPairedKeySetFlow(getPairRecord) {
  const rec = getPairRecord();
  const paired = new Set();
  ["TP", "FN", "FP"].forEach((mode) => {
    (rec[mode] || []).forEach((item) => {
      (item.GT || []).forEach((i) => paired.add(`GT-${i}`));
      (item.PR || []).forEach((i) => paired.add(`PR-${i}`));
    });
  });
  return paired;
}

export function syncLegacyFieldsFromPairsFlow(deps) {
  const {
    getPairRecord,
    documentRef = document,
    markCurrentDirty,
    refreshMetrics,
    redrawAllViewers,
  } = deps;

  const pairs = getPairRecord();
  documentRef.getElementById("tp").value = (pairs.TP || []).length;
  documentRef.getElementById("fn").value = (pairs.FN || []).length;
  documentRef.getElementById("fp").value = (pairs.FP || []).length;
  markCurrentDirty();
  refreshMetrics();
  redrawAllViewers();
}
