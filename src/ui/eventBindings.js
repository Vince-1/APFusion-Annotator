export function bindUiEvents(deps) {
  const {
    documentRef = document,
    localStorageRef = localStorage,
    state,
    loadData,
    loadStats,
    applyDatasetPresetToInputs,
    loadSelectedDataset,
    checkBackendHealth,
    toggleInvertDisplay,
    saveCurrentRecord,
    saveAllRecords,
    downloadJson,
    setEditMode,
    toggleRecallSort,
    toggleFnSort,
    applyPatientFiltersFromInputs,
    clearDraft,
    confirmCurrentPair,
    deleteLastPair,
    resetAllPairs,
    autoPairCurrentPatient,
    autoPairAllPatients,
    undoLastAutoPair,
    resolveConflictMigrate,
    resolveConflictCancel,
    cycleEditMode,
    switchPatientByArrow,
    markCurrentDirty,
    refreshMetrics,
    applyStatsPayload,
    updateCursorModeIndicator,
    syncInvertDisplayUi,
    initDatasetPresetUi,
    renderSortButtons,
    alertImpl = alert,
    checkBackendHint = "python /home/wenhao/trains/web/apfusion/src/serving/server.py",
  } = deps;

  documentRef.getElementById("btnLoadData").onclick = async () => {
    try { await loadData(); } catch (e) { alertImpl(e.message); }
  };
  documentRef.getElementById("btnLoadStats").onclick = async () => {
    try { await loadStats(); } catch (e) { alertImpl(e.message); }
  };
  documentRef.getElementById("btnApplyDataset").onclick = () => {
    const presetId = documentRef.getElementById("datasetPreset").value;
    applyDatasetPresetToInputs(presetId);
  };
  documentRef.getElementById("btnLoadDataset").onclick = async () => {
    const presetId = documentRef.getElementById("datasetPreset").value;
    applyDatasetPresetToInputs(presetId);
    try {
      await loadSelectedDataset();
    } catch (e) {
      alertImpl(e.message);
    }
  };
  documentRef.getElementById("datasetPreset").addEventListener("change", () => {
    const presetId = documentRef.getElementById("datasetPreset").value;
    applyDatasetPresetToInputs(presetId);
  });
  documentRef.getElementById("btnCheckApi").onclick = async () => {
    const h = await checkBackendHealth();
    if (!h.ok) {
      alertImpl([
        `Backend not reachable: ${h.message}`,
        "Please start Flask backend:",
        checkBackendHint,
      ].join("\n"));
    }
  };
  documentRef.getElementById("btnInvert").onclick = toggleInvertDisplay;
  documentRef.getElementById("btnSave").onclick = async () => {
    try { await saveCurrentRecord(); } catch (e) { alertImpl(e.message); }
  };
  documentRef.getElementById("btnSaveAll").onclick = async () => {
    try { await saveAllRecords(); } catch (e) { alertImpl(e.message); }
  };
  documentRef.getElementById("btnDownload").onclick = downloadJson;
  documentRef.getElementById("btnModeTP").onclick = () => setEditMode("TP");
  documentRef.getElementById("btnModeFN").onclick = () => setEditMode("FN");
  documentRef.getElementById("btnModeFP").onclick = () => setEditMode("FP");
  documentRef.getElementById("btnRecallAsc").onclick = () => toggleRecallSort("asc");
  documentRef.getElementById("btnRecallDesc").onclick = () => toggleRecallSort("desc");
  documentRef.getElementById("btnFnAsc").onclick = () => toggleFnSort("asc");
  documentRef.getElementById("btnFnDesc").onclick = () => toggleFnSort("desc");

  const patientFilterEnterHandler = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    applyPatientFiltersFromInputs();
  };
  documentRef.getElementById("recallMin").addEventListener("keydown", patientFilterEnterHandler);
  documentRef.getElementById("recallMax").addEventListener("keydown", patientFilterEnterHandler);
  documentRef.getElementById("fnMinFilter").addEventListener("keydown", patientFilterEnterHandler);
  documentRef.getElementById("fnMaxFilter").addEventListener("keydown", patientFilterEnterHandler);
  documentRef.getElementById("btnClearDraft").onclick = clearDraft;
  documentRef.getElementById("btnConfirmPair").onclick = confirmCurrentPair;
  documentRef.getElementById("btnDeleteLastPair").onclick = deleteLastPair;
  documentRef.getElementById("btnResetAllPairs").onclick = resetAllPairs;
  documentRef.getElementById("btnAutoPair").onclick = async () => {
    try { await autoPairCurrentPatient(); } catch (e) { alertImpl(e.message); }
  };
  documentRef.getElementById("btnAutoPairAll").onclick = async () => {
    try { await autoPairAllPatients(); } catch (e) { alertImpl(e.message); }
  };
  documentRef.getElementById("btnUndoAutoPair").onclick = async () => {
    try { await undoLastAutoPair(); } catch (e) { alertImpl(e.message); }
  };
  documentRef.getElementById("btnConflictMigrate").onclick = resolveConflictMigrate;
  documentRef.getElementById("btnConflictCancel").onclick = resolveConflictCancel;

  documentRef.addEventListener("keydown", async (e) => {
    const tag = documentRef.activeElement?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "S" || e.key === "s")) {
      e.preventDefault();
      try { await saveAllRecords(); } catch (err) { alertImpl(err.message); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      try { await saveCurrentRecord(); } catch (err) { alertImpl(err.message); }
      return;
    }
    if (e.shiftKey && e.code === "Quote") {
      e.preventDefault();
      try { await saveCurrentRecord(); } catch (err) { alertImpl(err.message); }
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      cycleEditMode(-1);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      cycleEditMode(1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      await switchPatientByArrow(-1);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      await switchPatientByArrow(1);
      return;
    }
    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
      confirmCurrentPair();
      return;
    }
    if (e.key === "Escape") {
      clearDraft();
    }
  });

  ["tp", "fn", "fp"].forEach((id) => {
    documentRef.getElementById(id).addEventListener("input", () => {
      markCurrentDirty();
      refreshMetrics();
    });
  });

  const local = localStorageRef.getItem("apfusion_records");
  if (local) {
    try { applyStatsPayload(JSON.parse(local)); } catch { state.records = {}; }
  }

  documentRef.addEventListener("mousemove", (e) => {
    const el = documentRef.getElementById("cursorMode");
    if (el) { el.style.left = `${e.clientX}px`; el.style.top = `${e.clientY}px`; }
    const hline = documentRef.getElementById("cursorHline");
    if (hline) hline.style.top = `${e.clientY}px`;
  });

  updateCursorModeIndicator();
  syncInvertDisplayUi();
  initDatasetPresetUi();
  renderSortButtons();
  checkBackendHealth({ silent: true });
}
