export function selectPatientAndEnterTPFlow(state, pid, deps) {
  const { clearDraft, getPairRecord, updateCursorModeIndicator, renderAll } = deps;
  state.selectedPid = pid;
  state.editMode = "TP";
  state.activePair = { mode: null, index: -1 };
  clearDraft();
  getPairRecord(pid);
  updateCursorModeIndicator();
  renderAll();
}

export function cycleEditModeFlow(state, direction, deps) {
  const { clearDraft, renderModeButtons, updateDraftPanel, updateCursorModeIndicator, setPairStatus } = deps;
  const modes = ["TP", "FN", "FP"];
  let idx = modes.indexOf(state.editMode);
  if (idx < 0) idx = 0;
  idx = (idx + direction + modes.length) % modes.length;
  state.editMode = modes[idx];
  state.activePair = { mode: null, index: -1 };
  clearDraft();
  renderModeButtons();
  updateDraftPanel();
  updateCursorModeIndicator();
  setPairStatus(`Mode: ${state.editMode}`);
}

export async function switchPatientByArrowFlow(state, delta, deps) {
  const {
    getDisplayPatients,
    clearDraft,
    getPairRecord,
    renderAll,
    centerSelectedPatientInList,
    setPairStatus,
    setSaveStatus,
    documentRef = document,
  } = deps;
  const displayPatients = getDisplayPatients();
  if (!displayPatients.length || !state.selectedPid) return;
  const curIndex = displayPatients.findIndex((p) => p.patient_id === state.selectedPid);
  if (curIndex < 0) return;
  const nextIndex = Math.max(0, Math.min(displayPatients.length - 1, curIndex + delta));
  if (nextIndex === curIndex) return;

  const prevPid = state.selectedPid;
  const nextPid = displayPatients[nextIndex].patient_id;
  const hadUnsaved = !!state.dirtyPatients[prevPid];

  state.selectedPid = nextPid;
  state.activePair = { mode: null, index: -1 };
  clearDraft();
  getPairRecord(nextPid);
  await renderAll();

  centerSelectedPatientInList(documentRef.getElementById("patientList"));

  if (hadUnsaved) {
    const msg = `Patient ${prevPid} has unsaved changes (not saved).`;
    setPairStatus(msg);
    setSaveStatus(msg, false);
  }
}

export function renderPatientListFlow(state, deps) {
  const {
    getDisplayPatients,
    hasSavedAnnotation,
    showSwitchDialog,
    saveCurrentRecord,
    clearDirty,
    selectPatientAndEnterTP,
    documentRef = document,
  } = deps;

  const el = documentRef.getElementById("patientList");
  el.innerHTML = "";
  const displayPatients = getDisplayPatients();
  displayPatients.forEach((p, idx) => {
    const item = documentRef.createElement("div");
    const activeCls = p.patient_id === state.selectedPid ? " active" : "";
    const dirtyCls = state.dirtyPatients[p.patient_id] ? " dirty" : "";
    const annotatedCls = hasSavedAnnotation(p.patient_id) ? " annotated" : "";
    item.className = "patient-item" + activeCls + dirtyCls + annotatedCls;
    item.dataset.pid = p.patient_id;
    item.textContent = `${idx + 1}. ${p.patient_id}`;
    item.onclick = async () => {
      if (p.patient_id !== state.selectedPid && state.dirtyPatients[state.selectedPid]) {
        const prevPid = state.selectedPid;
        showSwitchDialog(
          prevPid,
          async () => {
            await saveCurrentRecord();
            selectPatientAndEnterTP(p.patient_id);
          },
          () => {
            clearDirty(prevPid);
            selectPatientAndEnterTP(p.patient_id);
          },
          () => {}
        );
        return;
      }
      selectPatientAndEnterTP(p.patient_id);
    };
    el.appendChild(item);
  });
}
