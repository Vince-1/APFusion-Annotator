function backendNotReachableMessage(message) {
  return [
    `Backend not reachable: ${message}`,
    "Please start Flask backend on port 5000:",
    "python /home/wenhao/trains/web/apfusion/src/serving/server.py"
  ].join("\n");
}

function backendSaveFailedMessage(message) {
  return [
    `Backend save failed: ${message}`,
    "Please ensure Flask backend is running on port 5000:",
    "python /home/wenhao/trains/web/apfusion/src/serving/server.py"
  ].join("\n");
}

export async function saveCurrentRecordFlow(ctx) {
  const {
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
  } = ctx;

  const p = selectedPatient();
  if (!p) return false;

  setSaveStatus("Saving...", true);
  const health = await checkBackendHealth({ silent: true });
  if (!health.ok) {
    setSaveStatus(`Save failed: ${health.message}`, false);
    alertImpl(backendNotReachableMessage(health.message));
    return false;
  }

  const coverage = getCoverageStatus();
  if (!coverage.complete) {
    const msg = `Marking incomplete. Missing GT:[${coverage.missingGt.join(",")}] PR:[${coverage.missingPr.join(",")}]`;
    setPairStatus(msg);
    setSaveStatus(msg, false);
    alertImpl(msg);
    return false;
  }

  const form = readForm();
  state.records[p.patient_id] = {
    tp: form.tp,
    fn: form.fn,
    fp: form.fp
  };

  const payload = buildStatsPayload();
  localStorageRef.setItem("apfusion_records", JSON.stringify(payload));
  clearDirty(p.patient_id);

  try {
    const statsPath = documentRef.getElementById("statsPath").value.trim();
    const result = await saveStatsPayloadToBackend(statsPath, payload);
    consoleRef.log("JSON saved:", result.message);
  } catch (e) {
    consoleRef.warn("Backend save failed:", e.message);
    setSaveStatus(`Save failed: ${e.message}`, false);
    alertImpl(backendSaveFailedMessage(e.message));
    return false;
  }

  refreshMetrics();
  renderViewers();
  setSaveStatus(`Saved: ${p.patient_id} (${new Date().toLocaleTimeString()})`, true);
  return true;
}

export async function saveAllRecordsFlow(ctx) {
  const {
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
    documentRef = document,
    localStorageRef = localStorage,
    alertImpl = alert,
    consoleRef = console,
    clearAllDirty = () => {
      state.dirtyPatients = {};
    },
  } = ctx;

  const dirtyPids = Object.keys(state.dirtyPatients || {});
  if (!dirtyPids.length) {
    setSaveStatus("No unsaved changes", true);
    return false;
  }

  setSaveStatus(`Saving ${dirtyPids.length} dirty patients...`, true);
  const health = await checkBackendHealth({ silent: true });
  if (!health.ok) {
    setSaveStatus(`Save failed: ${health.message}`, false);
    alertImpl(backendNotReachableMessage(health.message));
    return false;
  }

  const incomplete = [];
  dirtyPids.forEach(pid => {
    const coverage = getCoverageStatus(pid);
    if (!coverage.complete) {
      incomplete.push({
        pid,
        missingGt: coverage.missingGt,
        missingPr: coverage.missingPr
      });
    }
  });

  if (incomplete.length) {
    const preview = incomplete.slice(0, 5).map(item =>
      `${item.pid}: GT[${item.missingGt.join(",")}] PR[${item.missingPr.join(",")}]`
    );
    const suffix = incomplete.length > 5 ? `\n... and ${incomplete.length - 5} more` : "";
    const msg = `Cannot save all: ${incomplete.length} patient(s) have incomplete markings.`;
    setSaveStatus(msg, false);
    setPairStatus(msg);
    alertImpl(`${msg}\n${preview.join("\n")}${suffix}`);
    return false;
  }

  const payload = buildStatsPayload();
  localStorageRef.setItem("apfusion_records", JSON.stringify(payload));

  try {
    const statsPath = documentRef.getElementById("statsPath").value.trim();
    await saveStatsPayloadToBackend(statsPath, payload);
  } catch (e) {
    consoleRef.warn("Backend save failed:", e.message);
    setSaveStatus(`Save failed: ${e.message}`, false);
    alertImpl(backendSaveFailedMessage(e.message));
    return false;
  }

  clearAllDirty();
  renderPatientList();
  refreshMetrics();
  renderViewers();
  setPairStatus(`Saved all dirty patients: ${dirtyPids.length}`);
  setSaveStatus(`Saved all (${dirtyPids.length}) (${new Date().toLocaleTimeString()})`, true);
  return true;
}
