export function currentRecord(state) {
  return state.records[state.selectedPid] || null;
}

export function selectedPatient(state) {
  return state.patients.find((p) => p.patient_id === state.selectedPid) || null;
}

export function getPairRecord(state, pid = state.selectedPid) {
  if (!pid) return { TP: [], FN: [], FP: [] };
  if (!state.pairRecords[pid]) {
    state.pairRecords[pid] = { TP: [], FN: [], FP: [] };
  }
  return state.pairRecords[pid];
}

export function hasSavedAnnotation(state, pid) {
  const rec = state.pairRecords[pid];
  if (!rec) return false;
  return (rec.TP || []).length > 0 || (rec.FN || []).length > 0 || (rec.FP || []).length > 0;
}

export function pickInitialPatientId(state) {
  if (!state.patients.length) return null;
  const firstUnannotated = state.patients.find((p) => !hasSavedAnnotation(state, p.patient_id));
  return firstUnannotated ? firstUnannotated.patient_id : state.patients[0].patient_id;
}

export function getPatientRecall(state, pid) {
  const rec = getPairRecord(state, pid);
  const tp = (rec.TP || []).length;
  const fn = (rec.FN || []).length;
  return tp + fn > 0 ? tp / (tp + fn) : 0;
}

export function getPatientFnCount(state, pid) {
  const rec = getPairRecord(state, pid);
  return (rec.FN || []).length;
}
