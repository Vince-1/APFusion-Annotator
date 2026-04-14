export function applyDatasetPresetToInputsFlow(presetId, deps) {
  const { DATASET_PRESETS, documentRef = document, setPairStatus } = deps;
  const preset = DATASET_PRESETS.find((p) => p.id === presetId);
  if (!preset) return;
  documentRef.getElementById("dataPath").value = preset.dataPath;
  documentRef.getElementById("statsPath").value = preset.statsPath;
  setPairStatus(`Preset selected: ${preset.label}`);
}

export function initDatasetPresetUiFlow(deps) {
  const { DATASET_PRESETS, findPresetByPaths, documentRef = document } = deps;
  const select = documentRef.getElementById("datasetPreset");
  if (!select) return;

  select.innerHTML = "";
  DATASET_PRESETS.forEach((preset) => {
    const opt = documentRef.createElement("option");
    opt.value = preset.id;
    opt.textContent = preset.label;
    select.appendChild(opt);
  });

  const dataPath = documentRef.getElementById("dataPath").value.trim();
  const statsPath = documentRef.getElementById("statsPath").value.trim();
  const matched = findPresetByPaths(dataPath, statsPath);
  if (matched) {
    select.value = matched.id;
  } else if (DATASET_PRESETS.length) {
    select.value = DATASET_PRESETS[0].id;
  }
}

export async function loadSelectedDatasetFlow(deps) {
  const {
    documentRef = document,
    loadSelectedDatasetIO,
    fetchImpl,
    state,
    pickInitialPatientId,
    renderAll,
    applyStatsPayload,
    localStorageRef = localStorage,
    refreshMetrics,
  } = deps;

  const dataPath = documentRef.getElementById("dataPath").value.trim();
  const statsPath = documentRef.getElementById("statsPath").value.trim();
  await loadSelectedDatasetIO(dataPath, statsPath, {
    fetchImpl,
    onDataLoaded: async (data) => {
      state.dataset = data;
      state.patients = data.patients || [];
      state.selectedPid = pickInitialPatientId();
      state.autoPairPreview = null;
      state.autoPairUndo = null;
      await renderAll();
    },
    onStatsLoaded: (data) => {
      applyStatsPayload(data || {});
      state.dirtyPatients = {};
      state.autoPairPreview = null;
      state.autoPairUndo = null;
      if (state.patients.length) {
        state.selectedPid = pickInitialPatientId();
      }
      localStorageRef.setItem("apfusion_records", JSON.stringify(data || {}));
      refreshMetrics();
      renderAll();
    },
  });
}

export async function loadDataFlow(deps) {
  const {
    documentRef = document,
    loadDataIO,
    fetchImpl,
    state,
    pickInitialPatientId,
    renderAll,
  } = deps;

  const path = documentRef.getElementById("dataPath").value.trim();
  await loadDataIO(path, {
    fetchImpl,
    onDataLoaded: async (data) => {
      state.dataset = data;
      state.patients = data.patients || [];
      state.selectedPid = pickInitialPatientId();
      state.autoPairPreview = null;
      state.autoPairUndo = null;
      await renderAll();
    },
  });
}

export async function loadStatsFlow(deps) {
  const {
    documentRef = document,
    loadStatsIO,
    fetchImpl,
    applyStatsPayload,
    state,
    pickInitialPatientId,
    localStorageRef = localStorage,
    refreshMetrics,
    renderAll,
  } = deps;

  const path = documentRef.getElementById("statsPath").value.trim();
  await loadStatsIO(path, {
    fetchImpl,
    onStatsLoaded: (data) => {
      applyStatsPayload(data || {});
      state.dirtyPatients = {};
      state.autoPairPreview = null;
      state.autoPairUndo = null;
      if (state.patients.length) {
        state.selectedPid = pickInitialPatientId();
      }
      localStorageRef.setItem("apfusion_records", JSON.stringify(data || {}));
      refreshMetrics();
      renderAll();
    },
  });
}
