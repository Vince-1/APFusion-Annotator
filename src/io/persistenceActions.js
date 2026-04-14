export async function saveCurrentRecordAction(deps) {
  const {
    saveCurrentRecordFlow,
    state,
    selectedPatient,
    checkBackendHealth,
    setSaveStatus,
    setPairStatus,
    getCoverageStatus,
    readForm,
    buildStatsPayload,
    clearDirty,
    saveStatsPayloadToBackend,
    refreshMetrics,
    renderViewers,
    documentRef = document,
    localStorageRef = localStorage,
    alertImpl = alert,
    consoleRef = console,
  } = deps;

  await saveCurrentRecordFlow({
    state,
    selectedPatient,
    checkBackendHealth,
    setSaveStatus,
    setPairStatus,
    getCoverageStatus,
    readForm,
    buildStatsPayload,
    clearDirty,
    saveStatsPayloadToBackend,
    refreshMetrics,
    renderViewers,
    documentRef,
    localStorageRef,
    alertImpl,
    consoleRef,
  });
}

export async function saveAllRecordsAction(deps) {
  const {
    saveAllRecordsFlow,
    state,
    checkBackendHealth,
    setSaveStatus,
    setPairStatus,
    getCoverageStatus,
    buildStatsPayload,
    saveStatsPayloadToBackend,
    renderPatientList,
    refreshMetrics,
    renderViewers,
    localStorageRef = localStorage,
    alertImpl = alert,
    consoleRef = console,
  } = deps;

  await saveAllRecordsFlow({
    state,
    checkBackendHealth,
    setSaveStatus,
    setPairStatus,
    getCoverageStatus,
    buildStatsPayload,
    saveStatsPayloadToBackend,
    renderPatientList,
    refreshMetrics,
    renderViewers,
    localStorageRef,
    alertImpl,
    consoleRef,
    clearAllDirty: () => {
      state.dirtyPatients = {};
    },
  });
}

export async function saveStatsPayloadToBackendAction(statsPath, payload, deps) {
  const { saveStatsPayloadToBackendIO, fetchImpl, windowRef = window } = deps;
  return saveStatsPayloadToBackendIO(statsPath, payload, {
    fetchImpl,
    win: windowRef,
  });
}

export async function checkBackendHealthAction(options = {}, deps) {
  const { checkBackendHealthIO, fetchImpl, documentRef = document, windowRef = window, setPairStatus } = deps;
  return checkBackendHealthIO(options, {
    fetchImpl,
    doc: documentRef,
    win: windowRef,
    setPairStatus,
  });
}

export function downloadJsonAction(deps) {
  const { buildStatsPayload } = deps;
  const json = JSON.stringify(buildStatsPayload(), null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "stats.json";
  a.click();
  URL.revokeObjectURL(a.href);
}
