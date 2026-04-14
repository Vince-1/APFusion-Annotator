export async function renderViewersFlow(deps) {
  const {
    selectedPatient,
    drawQuadViewer,
    drawViewerQuad,
    documentRef = document,
  } = deps;

  const p = selectedPatient();
  if (!p) return;

  const frontGtCount = (p.gt?.front || []).length;
  const frontPrCount = (p.pred?.front || []).length;

  await drawQuadViewer(drawViewerQuad, {
    wrapId: "allWrap",
    key: "all",
    s1: {
      imgRelPath: p.images?.front,
      gtBoxes: p.gt?.front || [],
      prBoxes: p.pred?.front || [],
      reviewMode: true,
      showLabels: false,
      indexOffset: { gt: 0, pr: 0 },
    },
    s2: {
      imgRelPath: p.images?.front,
      gtBoxes: p.gt?.front || [],
      prBoxes: p.pred?.front || [],
      reviewMode: false,
      showLabels: true,
      indexOffset: { gt: 0, pr: 0 },
    },
    s3: {
      imgRelPath: p.images?.back,
      gtBoxes: p.gt?.back || [],
      prBoxes: p.pred?.back || [],
      reviewMode: false,
      mirror: true,
      showLabels: true,
      indexOffset: { gt: frontGtCount, pr: frontPrCount },
    },
    s4: {
      imgRelPath: p.images?.back,
      gtBoxes: p.gt?.back || [],
      prBoxes: p.pred?.back || [],
      reviewMode: true,
      mirror: true,
      showLabels: false,
      indexOffset: { gt: frontGtCount, pr: frontPrCount },
    },
  });

  const reportBox = documentRef.getElementById("reportBox");
  reportBox.textContent = p.report?.text?.trim() || "(No report)";
}

export async function renderAllFlow(deps) {
  const {
    renderPatientList,
    renderModeButtons,
    updateDraftPanel,
    fillFormFromRecord,
    currentRecord,
    refreshMetrics,
    renderAutoPairPreview,
    setUndoButtonState,
    renderViewers,
  } = deps;

  renderPatientList();
  renderModeButtons();
  updateDraftPanel();
  fillFormFromRecord(currentRecord());
  refreshMetrics();
  renderAutoPairPreview();
  setUndoButtonState();
  await renderViewers();
}
