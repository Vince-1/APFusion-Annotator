export function isPairValidByMode(mode, pair) {
  if (mode === "TP") return true;
  if (mode === "FN") return true;
  if (mode === "FP") return true;
  return false;
}

export function validateDraftByMode(mode, draft) {
  if (!mode) return { ok: false, reason: "Select mode first" };
  const gt = draft.gt || [];
  const pr = draft.pr || [];
  if (mode === "TP") {
    if (!gt.length) return { ok: false, reason: "TP mode: GT cannot be empty" };
    if (!pr.length) return { ok: false, reason: "TP mode: PR cannot be empty" };
  } else if (mode === "FN") {
    if (!gt.length) return { ok: false, reason: "FN mode: GT cannot be empty" };
    if (pr.length) return { ok: false, reason: "FN mode: PR must be empty" };
  } else if (mode === "FP") {
    if (gt.length) return { ok: false, reason: "FP mode: GT must be empty" };
    if (!pr.length) return { ok: false, reason: "FP mode: PR cannot be empty" };
  }
  return { ok: true, reason: "" };
}

export function intersect(a, b) {
  const s = new Set(b || []);
  return (a || []).filter((v) => s.has(v));
}

export function findConflicts(mode, draftPair, editingIndex, getPairRecord) {
  const rec = getPairRecord();
  const conflicts = [];
  ["TP", "FN", "FP"].forEach((m) => {
    const rows = rec[m] || [];
    rows.forEach((it, idx) => {
      if (m === mode && idx === editingIndex) return;
      const gtOverlap = intersect(draftPair.GT, it.GT || []);
      const prOverlap = intersect(draftPair.PR, it.PR || []);
      if (gtOverlap.length || prOverlap.length) {
        conflicts.push({ mode: m, idx, gtOverlap, prOverlap });
      }
    });
  });
  return conflicts;
}

export function applyPairCommit(payload, deps) {
  const {
    state,
    getPairRecord,
    setPairStatus,
    toggleConflictActions,
    renderConflictList,
    markCurrentDirty,
    syncLegacyFieldsFromPairs,
    updateDraftPanel,
    renderPairList,
  } = deps;
  const { mode, item, editing, editingIndex, conflicts, withMigration } = payload;
  const rec = getPairRecord();

  if (withMigration && conflicts.length) {
    conflicts.forEach((c) => {
      const src = rec[c.mode]?.[c.idx];
      if (!src) return;
      src.GT = (src.GT || []).filter((v) => !c.gtOverlap.includes(v));
      src.PR = (src.PR || []).filter((v) => !c.prOverlap.includes(v));
    });
    ["TP", "FN", "FP"].forEach((m) => {
      rec[m] = (rec[m] || []).filter((p, i) => {
        if (editing && m === mode && i === editingIndex) return true;
        return isPairValidByMode(m, p);
      });
    });
  }

  if (editing) {
    const rows = rec[mode];
    let safeIndex = Math.min(state.activePair.index, rows.length - 1);
    if (safeIndex < 0) {
      rows.push(item);
      safeIndex = rows.length - 1;
    } else {
      rows[safeIndex] = item;
    }
    setPairStatus(`${mode} pair updated`);
  } else {
    rec[mode].push(item);
    setPairStatus(`${mode} pair added`);
  }

  state.activePair = { mode: null, index: -1 };
  state.draft = { gt: [], pr: [] };
  state.pendingConflict = null;
  state.previewPair = { mode: null, index: -1 };
  toggleConflictActions(false);
  renderConflictList();
  markCurrentDirty();
  syncLegacyFieldsFromPairs();
  updateDraftPanel();
  renderPairList();
}

export function confirmCurrentPairFlow(deps) {
  const {
    state,
    getPairRecord,
    normalizePair,
    setPairStatus,
    toggleConflictActions,
    renderConflictList,
    renderPairList,
    redrawAllViewers,
    applyPairCommitFn,
  } = deps;

  const check = validateDraftByMode(state.editMode, state.draft);
  if (!check.ok) {
    setPairStatus(check.reason);
    return;
  }

  const item = normalizePair({ GT: state.draft.gt, PR: state.draft.pr });
  const editing = state.activePair.mode === state.editMode && state.activePair.index >= 0;
  const editingIndex = editing ? state.activePair.index : -1;
  const conflicts = findConflicts(state.editMode, item, editingIndex, getPairRecord);

  if (conflicts.length) {
    const conflictMsg = conflicts
      .map((c) => `${c.mode}#${c.idx + 1} GT:[${c.gtOverlap.join(",")}] PR:[${c.prOverlap.join(",")}]`)
      .join("; ");
    state.pendingConflict = { mode: state.editMode, item, editing, editingIndex, conflicts };
    state.previewPair = { mode: conflicts[0].mode, index: conflicts[0].idx };
    setPairStatus(`Conflict: ${conflictMsg}`);
    toggleConflictActions(true);
    renderConflictList();
    renderPairList();
    redrawAllViewers();
    return;
  }

  applyPairCommitFn({ mode: state.editMode, item, editing, editingIndex, conflicts: [], withMigration: false });
}

export function resolveConflictMigrateFlow(state, applyPairCommitFn) {
  if (!state.pendingConflict) return;
  applyPairCommitFn({ ...state.pendingConflict, withMigration: true });
}

export function resolveConflictCancelFlow(state, deps) {
  const { toggleConflictActions, renderConflictList, setPairStatus, renderPairList, redrawAllViewers } = deps;
  if (!state.pendingConflict) return;
  state.pendingConflict = null;
  state.previewPair = { mode: null, index: -1 };
  toggleConflictActions(false);
  renderConflictList();
  setPairStatus("Confirm canceled due to conflicts");
  renderPairList();
  redrawAllViewers();
}

export function deletePairAtFlow(idx, deps) {
  const { state, getPairRecord, setPairStatus, syncLegacyFieldsFromPairs, renderPairList } = deps;
  if (!state.editMode) return;
  const rec = getPairRecord();
  rec[state.editMode].splice(idx, 1);
  if (state.activePair.mode === state.editMode) {
    if (state.activePair.index === idx) {
      state.activePair = { mode: null, index: -1 };
    } else if (state.activePair.index > idx) {
      state.activePair = { mode: state.editMode, index: state.activePair.index - 1 };
    }
  }
  setPairStatus(`${state.editMode} pair deleted`);
  syncLegacyFieldsFromPairs();
  renderPairList();
}

export function resetAllPairsFlow(deps) {
  const {
    state,
    setPairStatus,
    toggleConflictActions,
    renderConflictList,
    markCurrentDirty,
    syncLegacyFieldsFromPairs,
    updateDraftPanel,
    renderPairList,
  } = deps;
  const pid = state.selectedPid;
  if (!pid) return;
  state.pairRecords[pid] = { TP: [], FN: [], FP: [] };
  state.activePair = { mode: null, index: -1 };
  state.draft = { gt: [], pr: [] };
  state.pendingConflict = null;
  state.previewPair = { mode: null, index: -1 };
  toggleConflictActions(false);
  renderConflictList();
  setPairStatus(`Current patient reset: ${pid}`);
  markCurrentDirty();
  syncLegacyFieldsFromPairs();
  updateDraftPanel();
  renderPairList();
}

export function deleteLastPairFlow(deps) {
  const { state, getPairRecord, setPairStatus, syncLegacyFieldsFromPairs, renderPairList } = deps;
  if (!state.editMode) {
    setPairStatus("Select mode first");
    return;
  }
  const rec = getPairRecord();
  const rows = rec[state.editMode] || [];
  if (!rows.length) {
    setPairStatus(`${state.editMode} list is empty`);
    return;
  }
  rows.pop();
  if (state.activePair.mode === state.editMode && state.activePair.index >= rows.length) {
    state.activePair = { mode: null, index: -1 };
  }
  setPairStatus(`${state.editMode} last pair deleted`);
  syncLegacyFieldsFromPairs();
  renderPairList();
}

export function selectPairAtFlow(idx, deps) {
  const { state, getPairRecord, setPairStatus, updateDraftPanel, renderPairList, redrawAllViewers } = deps;
  if (!state.editMode) return;
  state.previewPair = { mode: null, index: -1 };
  const same = state.activePair.mode === state.editMode && state.activePair.index === idx;
  state.activePair = same ? { mode: null, index: -1 } : { mode: state.editMode, index: idx };
  if (state.activePair.index >= 0) {
    const rec = getPairRecord();
    const item = rec[state.editMode][state.activePair.index] || { GT: [], PR: [] };
    state.draft = { gt: [...(item.GT || [])], pr: [...(item.PR || [])] };
    setPairStatus(`Editing #${state.activePair.index + 1} in ${state.editMode}`);
  } else {
    state.draft = { gt: [], pr: [] };
    setPairStatus("Selection cleared");
  }
  updateDraftPanel();
  renderPairList();
  redrawAllViewers();
}
