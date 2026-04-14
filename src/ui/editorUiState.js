export function syncInvertDisplayUiFlow(state, documentRef = document) {
  const btn = documentRef.getElementById("btnInvert");
  const wrap = documentRef.getElementById("allWrap");
  if (btn) {
    btn.textContent = state.invertDisplay ? "Invert: On" : "Invert: Off";
    btn.classList.toggle("active", state.invertDisplay);
  }
  if (wrap) {
    wrap.classList.toggle("invert-on", state.invertDisplay);
    wrap.classList.toggle("invert-off", !state.invertDisplay);
  }
}

export function toggleInvertDisplayFlow(state, deps) {
  const { syncInvertDisplayUi, redrawAllViewers } = deps;
  state.invertDisplay = !state.invertDisplay;
  syncInvertDisplayUi();
  redrawAllViewers();
}

export function toggleDraftByKeyFlow(state, key, deps) {
  const { uniqueSorted, updateDraftPanel, redrawAllViewers } = deps;
  if (!state.editMode) return;
  const m = /^(GT|PR)-(\d+)$/.exec(key);
  if (!m) return;
  const group = m[1] === "GT" ? "gt" : "pr";
  const idx = parseInt(m[2], 10);
  const cur = new Set(state.draft[group]);
  if (cur.has(idx)) cur.delete(idx); else cur.add(idx);
  state.draft[group] = uniqueSorted([...cur]);
  updateDraftPanel();
  redrawAllViewers();
}

export function setDraftKeysUnifiedFlow(state, keys, deps) {
  const { draftKeySet, uniqueSorted, updateDraftPanel, redrawAllViewers } = deps;
  if (!state.editMode) return;
  const mode = state.editMode;
  const uniq = Array.from(new Set(keys || [])).filter(Boolean).filter((key) => {
    if (mode === "FN" && key.startsWith("PR-")) return false;
    if (mode === "FP" && key.startsWith("GT-")) return false;
    return true;
  });
  if (!uniq.length) return;

  const selected = new Set(draftKeySet());
  const allSelected = uniq.every((k) => selected.has(k));
  const targetSelected = !allSelected;

  uniq.forEach((key) => {
    const m = /^(GT|PR)-(\d+)$/.exec(key);
    if (!m) return;
    const group = m[1] === "GT" ? "gt" : "pr";
    const idx = parseInt(m[2], 10);
    const cur = new Set(state.draft[group]);
    if (targetSelected) cur.add(idx); else cur.delete(idx);
    state.draft[group] = uniqueSorted([...cur]);
  });

  updateDraftPanel();
  redrawAllViewers();
}

export function updateCursorModeIndicatorFlow(state, documentRef = document) {
  const el = documentRef.getElementById("cursorMode");
  if (!el) return;
  el.classList.remove("tp", "fn", "fp");
  const mode = state.editMode || "Off";
  el.textContent = `Mode: ${mode}`;
  if (mode === "TP") el.classList.add("tp");
  if (mode === "FN") el.classList.add("fn");
  if (mode === "FP") el.classList.add("fp");
}
