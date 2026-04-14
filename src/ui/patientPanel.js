export function getDisplayPatients(state, deps) {
  const { getPatientRecall, getPatientFnCount, filterPatients, sortPatients } = deps;
  const list = [...state.patients];
  if (state.recallFilter) {
    const { min, max } = state.recallFilter;
    const filtered = filterPatients(list, (p) => {
      const r = getPatientRecall(p.patient_id);
      return r >= min && r <= max;
    });
    list.length = 0;
    list.push(...filtered);
  }
  if (state.fnFilter) {
    const { min, max } = state.fnFilter;
    const filtered = filterPatients(list, (p) => {
      const fn = getPatientFnCount(p.patient_id);
      return fn >= min && fn <= max;
    });
    list.length = 0;
    list.push(...filtered);
  }

  const hasSort = !!(state.recallSort || state.fnSort);
  if (!hasSort) return list;

  const indexMap = new Map(state.patients.map((p, i) => [p.patient_id, i]));
  return sortPatients(list, (a, b) => {
    if (state.recallSort) {
      const ra = getPatientRecall(a.patient_id);
      const rb = getPatientRecall(b.patient_id);
      if (ra !== rb) return state.recallSort === "asc" ? (ra - rb) : (rb - ra);
    }
    if (state.fnSort) {
      const fa = getPatientFnCount(a.patient_id);
      const fb = getPatientFnCount(b.patient_id);
      if (fa !== fb) return state.fnSort === "asc" ? (fa - fb) : (fb - fa);
    }
    return (indexMap.get(a.patient_id) || 0) - (indexMap.get(b.patient_id) || 0);
  });
}

export function renderSortButtons(state, documentRef = document) {
  const recallAsc = documentRef.getElementById("btnRecallAsc");
  const recallDesc = documentRef.getElementById("btnRecallDesc");
  const fnAsc = documentRef.getElementById("btnFnAsc");
  const fnDesc = documentRef.getElementById("btnFnDesc");
  if (recallAsc) recallAsc.classList.toggle("active", state.recallSort === "asc");
  if (recallDesc) recallDesc.classList.toggle("active", state.recallSort === "desc");
  if (fnAsc) fnAsc.classList.toggle("active", state.fnSort === "asc");
  if (fnDesc) fnDesc.classList.toggle("active", state.fnSort === "desc");
}

export function toggleRecallSort(state, order, deps) {
  const { renderSortButtonsFn, renderPatientListFn } = deps;
  state.recallSort = state.recallSort === order ? null : order;
  if (state.recallSort) state.fnSort = null;
  renderSortButtonsFn();
  renderPatientListFn();
}

export function toggleFnSort(state, order, deps) {
  const { renderSortButtonsFn, renderPatientListFn } = deps;
  state.fnSort = state.fnSort === order ? null : order;
  if (state.fnSort) state.recallSort = null;
  renderSortButtonsFn();
  renderPatientListFn();
}

export function applyPatientFiltersFromInputs(state, deps) {
  const { documentRef = document, setPairStatus, renderPatientListFn, refreshMetricsFn } = deps;
  const recallMinEl = documentRef.getElementById("recallMin");
  const recallMaxEl = documentRef.getElementById("recallMax");
  const fnMinEl = documentRef.getElementById("fnMinFilter");
  const fnMaxEl = documentRef.getElementById("fnMaxFilter");
  if (!recallMinEl || !recallMaxEl || !fnMinEl || !fnMaxEl) return;

  const recallMinText = (recallMinEl.value || "").trim();
  const recallMaxText = (recallMaxEl.value || "").trim();
  let nextRecallFilter = null;
  if (recallMinText || recallMaxText) {
    const min = recallMinText === "" ? 0 : Number(recallMinText);
    const max = recallMaxText === "" ? 1 : Number(recallMaxText);
    if (Number.isNaN(min) || Number.isNaN(max) || min < 0 || max > 1 || min > max) {
      setPairStatus("Recall filter invalid: use 0-1 and min <= max");
      return;
    }
    nextRecallFilter = { min, max };
  }

  const fnMinText = (fnMinEl.value || "").trim();
  const fnMaxText = (fnMaxEl.value || "").trim();
  let nextFnFilter = null;
  if (fnMinText || fnMaxText) {
    const min = fnMinText === "" ? Number(fnMaxText) : Number(fnMinText);
    const max = fnMaxText === "" ? Number(fnMinText) : Number(fnMaxText);
    const validInt = Number.isInteger(min) && Number.isInteger(max);
    if (!validInt || min < 0 || max < 0 || min > max) {
      setPairStatus("FN filter invalid: use natural numbers (>=0) and min <= max");
      return;
    }
    nextFnFilter = { min, max };
  }

  state.recallFilter = nextRecallFilter;
  state.fnFilter = nextFnFilter;
  renderPatientListFn();
  refreshMetricsFn();

  const parts = [];
  if (state.recallFilter) parts.push(`Recall ${state.recallFilter.min.toFixed(4)} ~ ${state.recallFilter.max.toFixed(4)}`);
  if (state.fnFilter) parts.push(`FN ${state.fnFilter.min} ~ ${state.fnFilter.max === Number.MAX_SAFE_INTEGER ? "inf" : state.fnFilter.max}`);
  setPairStatus(parts.length ? `Filters: ${parts.join(" | ")}` : "Filters cleared");
}

export function centerSelectedPatientInList(state, container, requestAnimationFrameRef = requestAnimationFrame) {
  if (!container || !state.selectedPid) return;
  const active = container.querySelector(`.patient-item.active[data-pid="${state.selectedPid}"]`);
  if (!active) return;
  requestAnimationFrameRef(() => {
    const target = active.offsetTop - (container.clientHeight - active.offsetHeight) / 2;
    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    container.scrollTop = Math.min(maxScroll, Math.max(0, target));
  });
}
