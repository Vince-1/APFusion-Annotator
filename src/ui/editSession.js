export function renderModeButtonsFlow(state, documentRef = document) {
  const map = {
    TP: documentRef.getElementById('btnModeTP'),
    FN: documentRef.getElementById('btnModeFN'),
    FP: documentRef.getElementById('btnModeFP'),
  };
  Object.entries(map).forEach(([k, btn]) => {
    if (!btn) return;
    btn.classList.toggle('active', state.editMode === k);
  });
}

export function updateDraftPanelFlow(state, deps) {
  const { documentRef = document, renderPairList } = deps;
  documentRef.getElementById('draftMode').textContent = `Mode: ${state.editMode || 'Off'}`;
  documentRef.getElementById('draftGT').textContent = `GT: [${state.draft.gt.join(',')}]`;
  documentRef.getElementById('draftPR').textContent = `PR: [${state.draft.pr.join(',')}]`;
  renderPairList();
}

export function clearDraftFlow(state, options = {}, deps) {
  const { keepStatus = false } = options;
  const {
    toggleConflictActions,
    renderConflictList,
    setPairStatus,
    updateDraftPanel,
    redrawAllViewers,
  } = deps;

  state.draft = { gt: [], pr: [] };
  state.pendingConflict = null;
  state.previewPair = { mode: null, index: -1 };
  toggleConflictActions(false);
  renderConflictList();
  if (!keepStatus) setPairStatus('');
  updateDraftPanel();
  redrawAllViewers();
}

export function setEditModeFlow(state, mode, deps) {
  const { clearDraft, renderModeButtons, updateDraftPanel, updateCursorModeIndicator } = deps;
  if (state.editMode === mode) {
    state.editMode = null;
  } else {
    state.editMode = mode;
  }
  state.activePair = { mode: null, index: -1 };
  state.previewPair = { mode: null, index: -1 };
  clearDraft();
  renderModeButtons();
  updateDraftPanel();
  updateCursorModeIndicator();
}

export function markCurrentDirtyFlow(state, renderPatientList) {
  if (!state.selectedPid) return;
  state.dirtyPatients[state.selectedPid] = true;
  renderPatientList();
}

export function clearDirtyFlow(state, pid, renderPatientList) {
  if (!pid) return;
  delete state.dirtyPatients[pid];
  renderPatientList();
}

export function resetPairUiStateFlow(state, deps) {
  const { toggleConflictActions, renderConflictList } = deps;
  state.activePair = { mode: null, index: -1 };
  state.draft = { gt: [], pr: [] };
  state.pendingConflict = null;
  state.previewPair = { mode: null, index: -1 };
  toggleConflictActions(false);
  renderConflictList();
}

export function redrawAllViewersFlow(state, renderViewerCanvas) {
  Object.values(state.viewerStates).forEach((vs) => {
    if (!vs) return;
    if (typeof vs.renderFn === 'function') {
      vs.renderFn(vs.hoveredKeys || new Set());
    } else {
      renderViewerCanvas(vs, vs.hoveredKeys || new Set());
    }
  });
}
