export async function undoLastAutoPairFlow(deps) {
  const {
    state,
    cloneJson,
    countPairItems,
    resetPairUiState,
    renderAll,
    setSaveStatus,
    setPairStatus,
  } = deps;

  const snapshot = state.autoPairUndo;
  if (!snapshot) {
    setPairStatus("当前没有可撤销的自动配对");
    return;
  }

  snapshot.pids.forEach((pid) => {
    state.pairRecords[pid] = cloneJson(snapshot.pairRecords[pid] || { TP: [], FN: [], FP: [] });
    state.records[pid] = cloneJson(snapshot.records[pid] || countPairItems(state.pairRecords[pid]));
  });
  state.dirtyPatients = cloneJson(snapshot.dirtyPatients || {});
  if (snapshot.selectedPid && state.patients.some((p) => p.patient_id === snapshot.selectedPid)) {
    state.selectedPid = snapshot.selectedPid;
  }

  state.autoPairUndo = null;
  state.autoPairPreview = null;
  resetPairUiState();
  await renderAll();
  const label = snapshot.scope === "all" ? `${snapshot.pids.length} 个病人` : (snapshot.pids[0] || "当前病人");
  setSaveStatus(`已恢复到上一次自动配对前的状态（${label}）。`, true);
  setPairStatus(`撤销完成：已恢复 ${label}`);
}

export async function autoPairCurrentPatientFlow(deps) {
  const {
    state,
    selectedPatient,
    setPairStatus,
    getAutoPairConfigFromUi,
    getPairRecord,
    windowRef = window,
    buildAutoPairUndoSnapshot,
    cloneJson,
    countPairItems,
    buildAutoPairRecordForPatient,
    buildAutoPairPreviewCurrent,
    applyAutoPairRecordToState,
    resetPairUiState,
    renderAll,
    buildAutoPairMergeModeText,
    setSaveStatus,
  } = deps;

  const p = selectedPatient();
  if (!p) {
    setPairStatus("No patient selected");
    return;
  }

  let config;
  try {
    config = getAutoPairConfigFromUi();
  } catch (err) {
    setPairStatus(err.message);
    return;
  }

  const existing = getPairRecord();
  const existingCount = (existing.TP || []).length + (existing.FN || []).length + (existing.FP || []).length;
  if (existingCount > 0) {
    const ok = windowRef.confirm(`将对 ${p.patient_id} 的当前 TP/FN/FP 结果进行覆盖，是否继续？`);
    if (!ok) return;
  }

  const undoSnapshot = buildAutoPairUndoSnapshot({
    scope: "current",
    pids: [state.selectedPid],
    state,
    cloneJson,
    getPairRecord,
    countPairItems,
  });
  setPairStatus(`正在自动配对：${p.patient_id} ...`);
  const { record: nextRecord, preview } = await buildAutoPairRecordForPatient(p, config);

  state.autoPairUndo = undoSnapshot;
  state.autoPairPreview = buildAutoPairPreviewCurrent(p.patient_id, preview);
  applyAutoPairRecordToState(state, state.selectedPid, nextRecord, cloneJson);

  resetPairUiState();
  await renderAll();
  const mergeModeText = buildAutoPairMergeModeText(config);
  setSaveStatus(`已为 ${p.patient_id} 生成自动配对结果（${mergeModeText}），请检查预览后再保存。`, true);
  setPairStatus(`自动配对完成（${mergeModeText}）：TP=${nextRecord.TP.length}，FN=${nextRecord.FN.length}，FP=${nextRecord.FP.length}（配对阈值 ${config.threshold.toFixed(2)}${config.disableCrossViewMerge ? "" : `，聚合阈值 ${config.crossViewThreshold.toFixed(2)}` }）`);
}

export async function autoPairAllPatientsFlow(deps) {
  const {
    state,
    setPairStatus,
    getAutoPairConfigFromUi,
    getPairRecord,
    windowRef = window,
    buildAutoPairUndoSnapshot,
    cloneJson,
    countPairItems,
    buildAutoPairRecordForPatient,
    applyAutoPairRecordToState,
    buildAutoPairPreviewAll,
    resetPairUiState,
    renderAll,
    buildAutoPairMergeModeText,
    setSaveStatus,
  } = deps;

  if (!state.patients.length) {
    setPairStatus("No patients loaded");
    return;
  }

  let config;
  try {
    config = getAutoPairConfigFromUi();
  } catch (err) {
    setPairStatus(err.message);
    return;
  }

  const hasExisting = state.patients.some((p) => {
    const rec = getPairRecord(p.patient_id);
    return (rec.TP || []).length + (rec.FN || []).length + (rec.FP || []).length > 0;
  });
  if (hasExisting) {
    const ok = windowRef.confirm(`将覆盖当前已加载的全部 ${state.patients.length} 个病人的 TP/FN/FP 结果，是否继续？`);
    if (!ok) return;
  }

  const undoSnapshot = buildAutoPairUndoSnapshot({
    scope: "all",
    pids: state.patients.map((p) => p.patient_id),
    state,
    cloneJson,
    getPairRecord,
    countPairItems,
  });
  const results = [];
  let totalTP = 0;
  let totalFN = 0;
  let totalFP = 0;
  for (let i = 0; i < state.patients.length; i += 1) {
    const p = state.patients[i];
    setPairStatus(`正在批量自动配对... ${i + 1}/${state.patients.length}（${p.patient_id}）`);
    const built = await buildAutoPairRecordForPatient(p, config);
    results.push({ pid: p.patient_id, ...built });
    totalTP += built.record.TP.length;
    totalFN += built.record.FN.length;
    totalFP += built.record.FP.length;
  }

  results.forEach((item) => applyAutoPairRecordToState(state, item.pid, item.record, cloneJson));
  state.autoPairUndo = undoSnapshot;
  state.autoPairPreview = buildAutoPairPreviewAll(
    state.patients.length,
    totalTP,
    totalFN,
    totalFP,
    results
  );

  resetPairUiState();
  await renderAll();
  const mergeModeText = buildAutoPairMergeModeText(config);
  setSaveStatus(`已完成 ${state.patients.length} 个病人的自动配对（${mergeModeText}），请检查预览后再保存。`, true);
  setPairStatus(`批量自动配对完成（${mergeModeText}）：病人=${state.patients.length}，TP=${totalTP}，FN=${totalFN}，FP=${totalFP}${config.disableCrossViewMerge ? "" : `（聚合阈值 ${config.crossViewThreshold.toFixed(2)}）`}`);
}
