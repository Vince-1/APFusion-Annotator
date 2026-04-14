export function readForm(getPairRecord) {
  const pairRec = getPairRecord();
  return {
    tp: (pairRec.TP || []).length,
    fn: (pairRec.FN || []).length,
    fp: (pairRec.FP || []).length,
  };
}

export function fillFormFromRecord(state, rec, deps) {
  const { normalizePair, renderPairListFn, documentRef = document } = deps;
  if (!state.selectedPid) return;
  if (!state.pairRecords[state.selectedPid]) {
    state.pairRecords[state.selectedPid] = { TP: [], FN: [], FP: [] };
  }

  const r = rec || {};
  const hasNewSchema = Array.isArray(r.TP) || Array.isArray(r.FN) || Array.isArray(r.FP);
  const hasLegacySchema = r.tp_pairs != null || r.fn_pairs != null || r.fp_pairs != null;
  const parsePair = (k) => {
    const val = r[k];
    if (!val) return [];
    let arr = Array.isArray(val) ? val : (() => { try { return JSON.parse(val); } catch { return []; } })();
    if (!Array.isArray(arr)) return [];
    return arr.map((it) => normalizePair({ GT: it.GT || [], PR: it.PR || [] }));
  };

  if (hasNewSchema || hasLegacySchema) {
    state.pairRecords[state.selectedPid] = hasNewSchema
      ? {
          TP: (r.TP || []).map((it) => normalizePair({ GT: it.GT || [], PR: it.PR || [] })),
          FN: (r.FN || []).map((it) => normalizePair({ GT: it.GT || [], PR: it.PR || [] })),
          FP: (r.FP || []).map((it) => normalizePair({ GT: it.GT || [], PR: it.PR || [] })),
        }
      : {
          TP: parsePair("tp_pairs"),
          FN: parsePair("fn_pairs"),
          FP: parsePair("fp_pairs"),
        };
  }

  const pairs = state.pairRecords[state.selectedPid];
  documentRef.getElementById("tp").value = (pairs.TP || []).length;
  documentRef.getElementById("fn").value = (pairs.FN || []).length;
  documentRef.getElementById("fp").value = (pairs.FP || []).length;
  renderPairListFn();
}

export function renderUnselectedBoxes(state, deps) {
  const { documentRef = document, selectedPatient, getCoverageStatus } = deps;
  const el = documentRef.getElementById("unselectedBoxes");
  if (!el) return;
  const p = selectedPatient();
  if (!p) {
    el.innerHTML = '<div class="unselected-title">未选择标注框</div><div class="unselected-row">No patient selected</div>';
    return;
  }

  const cov = getCoverageStatus();
  const frontGtCount = (p.gt?.front || []).length;
  const frontPrCount = (p.pred?.front || []).length;
  const toFBGlobal = (list, split) => (list || []).map((i) => i < split ? `F${i}` : `B${i}`);
  const missingGt = toFBGlobal(cov.missingGt, frontGtCount);
  const missingPr = toFBGlobal(cov.missingPr, frontPrCount);

  if (!missingGt.length && !missingPr.length) {
    el.innerHTML = '<div class="unselected-title">未选择标注框</div><div class="unselected-row unselected-ok">All GT/PR boxes are selected into TP/FN/FP</div>';
    return;
  }

  el.innerHTML = [
    '<div class="unselected-title">未选择标注框（未进入 TP/FN/FP）</div>',
    `<div class="unselected-row">GT: ${missingGt.length ? missingGt.join(', ') : 'None'}</div>`,
    `<div class="unselected-row">PR: ${missingPr.length ? missingPr.join(', ') : 'None'}</div>`,
  ].join('');
}

export function refreshMetrics(state, deps) {
  const {
    computePrecisionRecall,
    formatRate,
    getDisplayPatients,
    getPairRecord,
    renderUnselectedBoxesFn,
    documentRef = document,
  } = deps;

  const cur = readForm(getPairRecord);
  const currentRates = computePrecisionRecall(cur.tp, cur.fn, cur.fp);
  documentRef.querySelector("#curPrecision .metric-value").textContent = formatRate(currentRates.precision);
  documentRef.querySelector("#curRecall .metric-value").textContent = formatRate(currentRates.recall);

  let ttp = 0;
  let tfn = 0;
  let tfp = 0;
  let countedPatients = 0;
  const hasPatientFilter = !!(state.recallFilter || state.fnFilter);
  const scopePatients = hasPatientFilter ? getDisplayPatients() : state.patients;
  scopePatients.forEach((p) => {
    const r = getPairRecord(p.patient_id);
    const tpN = (r.TP || []).length;
    const fnN = (r.FN || []).length;
    const fpN = (r.FP || []).length;
    ttp += tpN;
    tfn += fnN;
    tfp += fpN;
    if (tpN + fnN + fpN > 0) countedPatients += 1;
  });
  const totalRates = computePrecisionRecall(ttp, tfn, tfp);
  const countedEl = documentRef.getElementById("countedPatients");
  const totalTpEl = documentRef.getElementById("totalTP");
  const totalFnEl = documentRef.getElementById("totalFN");
  const totalFpEl = documentRef.getElementById("totalFP");
  if (countedEl) countedEl.textContent = String(countedPatients);
  if (totalTpEl) totalTpEl.textContent = String(ttp);
  if (totalFnEl) totalFnEl.textContent = String(tfn);
  if (totalFpEl) totalFpEl.textContent = String(tfp);
  documentRef.querySelector("#totPrecision .metric-value").textContent = formatRate(totalRates.precision);
  documentRef.querySelector("#totRecall .metric-value").textContent = formatRate(totalRates.recall);
  renderUnselectedBoxesFn();
}
