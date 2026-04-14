// ─── Imports (Phase 1) ──────────────────────────────────────────────────────
import { AUTO_PAIR_CONFIG, VIEWER_CONFIG } from './config/constants.js';
import { DATASET_PRESETS, findPresetByPaths } from './config/datasets.js';
import {
  checkBackendHealth as checkBackendHealthIO,
  saveStatsPayloadToBackend as saveStatsPayloadToBackendIO,
} from './io/backend.js';
import {
  loadData as loadDataIO,
  loadSelectedDataset as loadSelectedDatasetIO,
  loadStats as loadStatsIO,
} from './io/loaders.js';
import {
  applyDatasetPresetToInputsFlow,
  initDatasetPresetUiFlow,
  loadSelectedDatasetFlow,
  loadDataFlow,
  loadStatsFlow,
} from './io/datasetFlows.js';
import {
  saveAllRecordsFlow,
  saveCurrentRecordFlow,
} from './io/saveHandlers.js';
import {
  saveCurrentRecordAction,
  saveAllRecordsAction,
  saveStatsPayloadToBackendAction,
  checkBackendHealthAction,
  downloadJsonAction,
} from './io/persistenceActions.js';
import { resolveImageSrc } from './io/pathResolver.js';
import {
  buildAutoPairRecordForPatient as buildAutoPairRecordForPatientCore,
} from './pairing/autoPairEngine.js';
import {
  applyAutoPairRecordToState as applyAutoPairRecordToStateAction,
  buildAutoPairMergeModeText,
  buildAutoPairPreviewAll,
  buildAutoPairPreviewCurrent,
  buildAutoPairUndoSnapshot as buildAutoPairUndoSnapshotAction,
} from './pairing/pairActions.js';
import {
  undoLastAutoPairFlow,
  autoPairCurrentPatientFlow,
  autoPairAllPatientsFlow,
} from './pairing/autoPairWorkflows.js';
import { countPairItems, normalizePair } from './pairing/pairRecordUtils.js';
import {
  applyPairCommit as applyPairCommitCore,
  confirmCurrentPairFlow,
  resolveConflictMigrateFlow,
  resolveConflictCancelFlow,
  deletePairAtFlow,
  resetAllPairsFlow,
  deleteLastPairFlow,
  selectPairAtFlow,
} from './pairing/pairEditor.js';
import {
  loadImageForAutoPair as loadImageForAutoPairRuntime,
  buildPatchStatsList as buildPatchStatsListRuntime,
  computePatchSimilarity as computePatchSimilarityRuntime,
  getAutoPairConfigFromUi as getAutoPairConfigFromUiRuntime,
} from './pairing/autoPairRuntime.js';
import { state } from './state/store.js';
import {
  currentRecord as currentRecordSelector,
  selectedPatient as selectedPatientSelector,
  getPairRecord as getPairRecordSelector,
  hasSavedAnnotation as hasSavedAnnotationSelector,
  pickInitialPatientId as pickInitialPatientIdSelector,
  getPatientRecall as getPatientRecallSelector,
  getPatientFnCount as getPatientFnCountSelector,
} from './state/selectors.js';
import {
  applyStatsPayload as applyStatsPayloadState,
  buildStatsPayload as buildStatsPayloadState,
} from './state/statsPayload.js';
import {
  getCoverageStatusFlow,
  getPairedKeySetFlow,
  syncLegacyFieldsFromPairsFlow,
} from './state/pairCoverage.js';
import { computePrecisionRecall, formatRate } from './ui/metricsPanel.js';
import { filterPatients, sortPatients } from './ui/patientList.js';
import {
  getDisplayPatients as getDisplayPatientsCore,
  renderSortButtons as renderSortButtonsCore,
  toggleRecallSort as toggleRecallSortCore,
  toggleFnSort as toggleFnSortCore,
  applyPatientFiltersFromInputs as applyPatientFiltersFromInputsCore,
  centerSelectedPatientInList as centerSelectedPatientInListCore,
} from './ui/patientPanel.js';
import {
  selectPatientAndEnterTPFlow,
  cycleEditModeFlow,
  switchPatientByArrowFlow,
  renderPatientListFlow,
} from './ui/interactionFlows.js';
import {
  readForm as readFormCore,
  fillFormFromRecord as fillFormFromRecordCore,
  refreshMetrics as refreshMetricsCore,
  renderUnselectedBoxes as renderUnselectedBoxesCore,
} from './ui/reviewMetrics.js';
import {
  setUndoButtonState as setUndoButtonStateCore,
  renderAutoPairPreview as renderAutoPairPreviewCore,
  toggleConflictActions as toggleConflictActionsCore,
  renderConflictList as renderConflictListCore,
  currentDisplayPair as currentDisplayPairCore,
  renderPairList as renderPairListCore,
  draftKeySet as draftKeySetCore,
  activePairKeySet as activePairKeySetCore,
} from './ui/pairUi.js';
import {
  clearDraftFlow,
  setEditModeFlow,
  renderModeButtonsFlow,
  updateDraftPanelFlow,
  markCurrentDirtyFlow,
  clearDirtyFlow,
  resetPairUiStateFlow,
  redrawAllViewersFlow,
} from './ui/editSession.js';
import { bindUiEvents } from './ui/eventBindings.js';
import { setPairStatus as setPairStatusUI, setSaveStatus as setSaveStatusUI } from './ui/statusBar.js';
import { createSwitchDialogController } from './ui/switchDialog.js';
import { toIdxArray as toIdxArrayCollection, parseGroups as parseGroupsCollection } from './utils/collections.js';
import { fmtAutoPairMetric as fmtAutoPairMetricText, formatGroupIndices as formatGroupIndicesText } from './utils/formatters.js';
import { drawQuadViewer } from './viewer/drawQuad.js';
import { renderViewersFlow, renderAllFlow } from './viewer/renderOrchestrator.js';
import {
  renderViewerCanvasFlow,
  drawViewerFlow,
  buildViewerModelFlow,
  drawSideInPairFlow,
  drawViewerPairFlow,
  drawViewerQuadFlow,
  handleHoverFlow,
  handleSelectFlow,
  hideTooltipFlow,
} from './viewer/viewerFlows.js';
import {
  fillViewerBackground as fillViewerBackgroundCore,
  drawViewerImage as drawViewerImageCore,
  drawAggBoxes as drawAggBoxesCore,
  drawMergedPairBoxes as drawMergedPairBoxesCore,
  boxToXYXY as boxToXYXYCore,
  renderViewerCanvas as renderViewerCanvasCore,
} from './viewer/canvasRender.js';
import {
  syncInvertDisplayUiFlow,
  toggleInvertDisplayFlow,
  toggleDraftByKeyFlow,
  setDraftKeysUnifiedFlow,
  updateCursorModeIndicatorFlow,
} from './ui/editorUiState.js';
import {
  clamp01
} from './utils/geometry.js';
import { cloneJson, escapeHtml } from './utils/common.js';





    function applyDatasetPresetToInputs(presetId) {
      return applyDatasetPresetToInputsFlow(presetId, {
        DATASET_PRESETS,
        documentRef: document,
        setPairStatus,
      });
    }

    function initDatasetPresetUi() {
      return initDatasetPresetUiFlow({
        DATASET_PRESETS,
        findPresetByPaths,
        documentRef: document,
      });
    }

    async function loadSelectedDataset() {
      return loadSelectedDatasetFlow({
        documentRef: document,
        loadSelectedDatasetIO,
        fetchImpl: fetch,
        state,
        pickInitialPatientId,
        renderAll,
        applyStatsPayload,
        localStorageRef: localStorage,
        refreshMetrics,
      });
    }

    function clearDraft(options = {}) {
      return clearDraftFlow(state, options, {
        toggleConflictActions,
        renderConflictList,
        setPairStatus,
        updateDraftPanel,
        redrawAllViewers,
      });
    }

    function setEditMode(mode) {
      return setEditModeFlow(state, mode, {
        clearDraft,
        renderModeButtons,
        updateDraftPanel,
        updateCursorModeIndicator,
      });
    }

    function renderModeButtons() {
      return renderModeButtonsFlow(state, document);
    }

    function updateDraftPanel() {
      return updateDraftPanelFlow(state, {
        documentRef: document,
        renderPairList,
      });
    }

    function setPairStatus(msg) {
      setPairStatusUI(msg, document);
    }

    function setSaveStatus(msg, ok = true) {
      setSaveStatusUI(msg, ok, document);
    }


    function resetPairUiState() {
      return resetPairUiStateFlow(state, {
        toggleConflictActions,
        renderConflictList,
      });
    }

    function setUndoButtonState() {
      return setUndoButtonStateCore(state, document);
    }

    function renderAutoPairPreview() {
      return renderAutoPairPreviewCore(state, {
        documentRef: document,
        escapeHtml,
        setUndoButtonStateFn: setUndoButtonState,
      });
    }

    function markCurrentDirty() {
      return markCurrentDirtyFlow(state, renderPatientList);
    }

    function clearDirty(pid = state.selectedPid) {
      return clearDirtyFlow(state, pid, renderPatientList);
    }

    function toggleConflictActions(show) {
      return toggleConflictActionsCore(show, document);
    }

    function renderConflictList() {
      return renderConflictListCore(state, {
        documentRef: document,
        focusConflictPair,
      });
    }

    function focusConflictPair(mode, idx) {
      if (!state.pendingConflict) return;
      state.previewPair = { mode, index: idx };
      setPairStatus(`Focused conflict pair ${mode}#${idx + 1}`);
      renderConflictList();
      renderPairList();
      redrawAllViewers();
    }

    function currentDisplayPair() {
      return currentDisplayPairCore(state);
    }

    function getPairRecord(pid = state.selectedPid) {
      return getPairRecordSelector(state, pid);
    }

    function renderPairList() {
      return renderPairListCore(state, {
        documentRef: document,
        getPairRecord,
        currentDisplayPairFn: currentDisplayPair,
        selectPairAt,
        deletePairAt,
      });
    }

    function selectPairAt(idx) {
      return selectPairAtFlow(idx, {
        state,
        getPairRecord,
        setPairStatus,
        updateDraftPanel,
        renderPairList,
        redrawAllViewers,
      });
    }

    function activePairKeySet() {
      return activePairKeySetCore(state, getPairRecord, currentDisplayPair);
    }


    function getCoverageStatus(pid = state.selectedPid) {
      return getCoverageStatusFlow(state, pid, getPairRecord);
    }

    function getPairedKeySet() {
      return getPairedKeySetFlow(getPairRecord);
    }





    async function loadImageForAutoPair(imgRelPath) {
      return loadImageForAutoPairRuntime(imgRelPath, { resolveImageSrc, ImageCtor: Image });
    }

    function buildPatchStatsList(img, boxes) {
      return buildPatchStatsListRuntime(img, boxes, { documentRef: document });
    }

    function computePatchSimilarity(a, b) {
      return computePatchSimilarityRuntime(a, b, { clamp01 });
    }

    function fmtAutoPairMetric(v) {
      return fmtAutoPairMetricText(v);
    }

    function formatGroupIndices(prefix, indices) {
      return formatGroupIndicesText(prefix, indices);
    }

    function getAutoPairConfigFromUi() {
      return getAutoPairConfigFromUiRuntime(document, AUTO_PAIR_CONFIG);
    }

    async function buildAutoPairRecordForPatient(p, config) {
      return buildAutoPairRecordForPatientCore(p, config, {
        loadImageForAutoPair,
        buildPatchStatsList,
        computePatchSimilarity,
        formatGroupIndices,
        fmtAutoPairMetric,
        countPairItems,
      });
    }

    async function undoLastAutoPair() {
      return undoLastAutoPairFlow({
        state,
        cloneJson,
        countPairItems,
        resetPairUiState,
        renderAll,
        setSaveStatus,
        setPairStatus,
      });
    }

    async function autoPairCurrentPatient() {
      return autoPairCurrentPatientFlow({
        state,
        selectedPatient,
        setPairStatus,
        getAutoPairConfigFromUi,
        getPairRecord,
        windowRef: window,
        buildAutoPairUndoSnapshot: buildAutoPairUndoSnapshotAction,
        cloneJson,
        countPairItems,
        buildAutoPairRecordForPatient,
        buildAutoPairPreviewCurrent,
        applyAutoPairRecordToState: applyAutoPairRecordToStateAction,
        resetPairUiState,
        renderAll,
        buildAutoPairMergeModeText,
        setSaveStatus,
      });
    }

    async function autoPairAllPatients() {
      return autoPairAllPatientsFlow({
        state,
        setPairStatus,
        getAutoPairConfigFromUi,
        getPairRecord,
        windowRef: window,
        buildAutoPairUndoSnapshot: buildAutoPairUndoSnapshotAction,
        cloneJson,
        countPairItems,
        buildAutoPairRecordForPatient,
        applyAutoPairRecordToState: applyAutoPairRecordToStateAction,
        buildAutoPairPreviewAll,
        resetPairUiState,
        renderAll,
        buildAutoPairMergeModeText,
        setSaveStatus,
      });
    }

    function syncLegacyFieldsFromPairs() {
      return syncLegacyFieldsFromPairsFlow({
        getPairRecord,
        documentRef: document,
        markCurrentDirty,
        refreshMetrics,
        redrawAllViewers,
      });
    }

    function confirmCurrentPair() {
      return confirmCurrentPairFlow({
        state,
        getPairRecord,
        normalizePair,
        setPairStatus,
        toggleConflictActions,
        renderConflictList,
        renderPairList,
        redrawAllViewers,
        applyPairCommitFn: applyPairCommit,
      });
    }

    function applyPairCommit(payload) {
      return applyPairCommitCore(payload, {
        state,
        getPairRecord,
        setPairStatus,
        toggleConflictActions,
        renderConflictList,
        markCurrentDirty,
        syncLegacyFieldsFromPairs,
        updateDraftPanel,
        renderPairList,
      });
    }

    function resolveConflictMigrate() {
      return resolveConflictMigrateFlow(state, applyPairCommit);
    }

    function resolveConflictCancel() {
      return resolveConflictCancelFlow(state, {
        toggleConflictActions,
        renderConflictList,
        setPairStatus,
        renderPairList,
        redrawAllViewers,
      });
    }

    function deletePairAt(idx) {
      return deletePairAtFlow(idx, {
        state,
        getPairRecord,
        setPairStatus,
        syncLegacyFieldsFromPairs,
        renderPairList,
      });
    }

    function resetAllPairs() {
      return resetAllPairsFlow({
        state,
        setPairStatus,
        toggleConflictActions,
        renderConflictList,
        markCurrentDirty,
        syncLegacyFieldsFromPairs,
        updateDraftPanel,
        renderPairList,
      });
    }

    function deleteLastPair() {
      return deleteLastPairFlow({
        state,
        getPairRecord,
        setPairStatus,
        syncLegacyFieldsFromPairs,
        renderPairList,
      });
    }

    function draftKeySet() {
      return draftKeySetCore(state);
    }

    function redrawAllViewers() {
      return redrawAllViewersFlow(state, renderViewerCanvas);
    }

    function fillViewerBackground(ctx, width, height) {
      return fillViewerBackgroundCore(ctx, width, height, state);
    }

    function drawViewerImage(ctx, img, offsetX, imgW, imgH, mirror = false) {
      return drawViewerImageCore(ctx, img, offsetX, imgW, imgH, mirror, state);
    }

    function syncInvertDisplayUi() {
      return syncInvertDisplayUiFlow(state, document);
    }

    function toggleInvertDisplay() {
      return toggleInvertDisplayFlow(state, { syncInvertDisplayUi, redrawAllViewers });
    }

    function toggleDraftByKey(key) {
      return toggleDraftByKeyFlow(state, key, {
        uniqueSorted,
        updateDraftPanel,
        redrawAllViewers,
      });
    }

    function setDraftKeysUnified(keys) {
      return setDraftKeysUnifiedFlow(state, keys, {
        draftKeySet,
        uniqueSorted,
        updateDraftPanel,
        redrawAllViewers,
      });
    }

    function toIdxArray(val) {
      return toIdxArrayCollection(val);
    }

    function parseGroups(text) {
      return parseGroupsCollection(text);
    }

    function currentRecord() {
      return currentRecordSelector(state);
    }

    function buildStatsPayload() {
      return buildStatsPayloadState(state.patients, (pid) => getPairRecord(pid));
    }

    function applyStatsPayload(data) {
      const mapped = applyStatsPayloadState(data, normalizePair);
      state.records = mapped.records;
      state.pairRecords = mapped.pairRecords;
    }

    function selectedPatient() {
      return selectedPatientSelector(state);
    }

    function hasSavedAnnotation(pid) {
      return hasSavedAnnotationSelector(state, pid);
    }

    function pickInitialPatientId() {
      return pickInitialPatientIdSelector(state);
    }

    function getPatientRecall(pid) {
      return getPatientRecallSelector(state, pid);
    }

    function getPatientFnCount(pid) {
      return getPatientFnCountSelector(state, pid);
    }

    function getDisplayPatients() {
      return getDisplayPatientsCore(state, {
        getPatientRecall,
        getPatientFnCount,
        filterPatients,
        sortPatients,
      });
    }

    function renderSortButtons() {
      return renderSortButtonsCore(state, document);
    }

    function toggleRecallSort(order) {
      return toggleRecallSortCore(state, order, {
        renderSortButtonsFn: renderSortButtons,
        renderPatientListFn: renderPatientList,
      });
    }

    function toggleFnSort(order) {
      return toggleFnSortCore(state, order, {
        renderSortButtonsFn: renderSortButtons,
        renderPatientListFn: renderPatientList,
      });
    }

    function applyPatientFiltersFromInputs() {
      return applyPatientFiltersFromInputsCore(state, {
        documentRef: document,
        setPairStatus,
        renderPatientListFn: renderPatientList,
        refreshMetricsFn: refreshMetrics,
      });
    }

    function selectPatientAndEnterTP(pid) {
      return selectPatientAndEnterTPFlow(state, pid, {
        clearDraft,
        getPairRecord,
        updateCursorModeIndicator,
        renderAll,
      });
    }

    function cycleEditMode(direction) {
      return cycleEditModeFlow(state, direction, {
        clearDraft,
        renderModeButtons,
        updateDraftPanel,
        updateCursorModeIndicator,
        setPairStatus,
      });
    }

    function updateCursorModeIndicator() {
      return updateCursorModeIndicatorFlow(state, document);
    }

    async function switchPatientByArrow(delta) {
      return switchPatientByArrowFlow(state, delta, {
        getDisplayPatients,
        clearDraft,
        getPairRecord,
        renderAll,
        centerSelectedPatientInList,
        setPairStatus,
        setSaveStatus,
        documentRef: document,
      });
    }

    function renderPatientList() {
      return renderPatientListFlow(state, {
        getDisplayPatients,
        hasSavedAnnotation,
        showSwitchDialog,
        saveCurrentRecord,
        clearDirty,
        selectPatientAndEnterTP,
        documentRef: document,
      });
    }

    function centerSelectedPatientInList(container) {
      return centerSelectedPatientInListCore(state, container, requestAnimationFrame);
    }

    function readForm() {
      return readFormCore(getPairRecord);
    }

    function fillFormFromRecord(rec) {
      return fillFormFromRecordCore(state, rec, {
        normalizePair,
        renderPairListFn: renderPairList,
        documentRef: document,
      });
    }

    function refreshMetrics() {
      return refreshMetricsCore(state, {
        computePrecisionRecall,
        formatRate,
        getDisplayPatients,
        getPairRecord,
        renderUnselectedBoxesFn: renderUnselectedBoxes,
        documentRef: document,
      });
    }

    function renderUnselectedBoxes() {
      return renderUnselectedBoxesCore(state, {
        documentRef: document,
        selectedPatient,
        getCoverageStatus,
      });
    }

    function drawAggBoxes(ctx, boxes, groups, color, imgW, imgH) {
      return drawAggBoxesCore(ctx, boxes, groups, color, imgW, imgH, boxToXYXY);
    }

    function drawMergedPairBoxes(ctx, vs, imgW, imgH) {
      return drawMergedPairBoxesCore(ctx, { ...vs, imgW, imgH }, { state, getPairRecord, boxToXYXYFn: boxToXYXY });
    }

    function boxToXYXY(b, imgW, imgH) {
      return boxToXYXYCore(b, imgW, imgH);
    }

    function renderViewerCanvas(vs, hoveredKeys = new Set()) {
      return renderViewerCanvasFlow(vs, hoveredKeys, {
        renderViewerCanvasCore,
        state,
        draftKeySet,
        activePairKeySet,
        fillViewerBackground,
        drawViewerImage,
        boxToXYXY,
        drawMergedPairBoxes,
        drawAggBoxes,
      });
    }

    async function drawViewer({ wrapId, imgRelPath, gtBoxes, prBoxes, title, reviewMode, mirror = false, showLabels = true, indexOffset = { gt: 0, pr: 0 } }) {
      return drawViewerFlow(
        { wrapId, imgRelPath, gtBoxes, prBoxes, title, reviewMode, mirror, showLabels, indexOffset },
        {
          documentRef: document,
          state,
          currentRecord,
          toIdxArray,
          parseGroups,
          boxToXYXY,
          renderViewerCanvas,
          handleHover,
          handleSelect,
          hideTooltip,
          resolveImageSrc,
          VIEWER_CONFIG,
        }
      );
    }

    async function buildViewerModel({ imgRelPath, gtBoxes, prBoxes, reviewMode, mirror = false, showLabels = true, indexOffset = { gt: 0, pr: 0 } }) {
      return buildViewerModelFlow(
        { imgRelPath, gtBoxes, prBoxes, reviewMode, mirror, showLabels, indexOffset },
        {
          currentRecord,
          toIdxArray,
          parseGroups,
          boxToXYXY,
          resolveImageSrc,
        }
      );
    }

     function drawSideInPair(ctx, side, offsetX, hoveredKeys, dKeys, aKeys, nonSelectableKeys) {
      return drawSideInPairFlow(
        { ctx, side, offsetX, hoveredKeys, dKeys, aKeys, nonSelectableKeys },
        {
          drawViewerImage,
          boxToXYXY,
          drawMergedPairBoxes,
          drawAggBoxes,
        }
      );
    }

    async function drawViewerPair({
      wrapId,
      key,
      left,
      right,
      labelTitle = ""
    }) {
      return drawViewerPairFlow(
        { wrapId, key, left, right, labelTitle },
        {
          documentRef: document,
          state,
          buildViewerModel,
          draftKeySet,
          activePairKeySet,
          getCoverageStatus,
          getPairedKeySet,
          fillViewerBackground,
          drawSideInPair,
          handleHover,
          handleSelect,
          hideTooltip,
          renderViewerCanvas,
          VIEWER_CONFIG,
        }
      );
    }

    async function drawViewerQuad({ wrapId, key, s1, s2, s3, s4 }) {
      return drawViewerQuadFlow(
        { wrapId, key, s1, s2, s3, s4 },
        {
          documentRef: document,
          windowRef: window,
          state,
          buildViewerModel,
          draftKeySet,
          activePairKeySet,
          getCoverageStatus,
          getPairedKeySet,
          fillViewerBackground,
          drawSideInPair,
          handleHover,
          handleSelect,
          hideTooltip,
          VIEWER_CONFIG,
        }
      );
    }

    function handleHover(e, canvas, key) {
      return handleHoverFlow(
        { event: e, canvas, key },
        {
          state,
          renderViewerCanvas,
          hideTooltip,
          documentRef: document,
        }
      );
    }

    function handleSelect(e, canvas, key) {
      return handleSelectFlow(
        { event: e, canvas, key },
        {
          state,
          setDraftKeysUnified,
        }
      );
    }

    function hideTooltip() {
      return hideTooltipFlow(document);
    }

    async function renderViewers() {
      return renderViewersFlow({
        selectedPatient,
        drawQuadViewer,
        drawViewerQuad,
        documentRef: document,
      });
    }

    async function renderAll() {
      return renderAllFlow({
        renderPatientList,
        renderModeButtons,
        updateDraftPanel,
        fillFormFromRecord,
        currentRecord,
        refreshMetrics,
        renderAutoPairPreview,
        setUndoButtonState,
        renderViewers,
      });
    }

    async function saveCurrentRecord() {
      return saveCurrentRecordAction({
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
        documentRef: document,
        localStorageRef: localStorage,
        alertImpl: alert,
        consoleRef: console,
      });
    }

    async function saveAllRecords() {
      return saveAllRecordsAction({
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
        localStorageRef: localStorage,
        alertImpl: alert,
        consoleRef: console,
      });
    }

    async function saveStatsPayloadToBackend(statsPath, payload) {
      return saveStatsPayloadToBackendAction(statsPath, payload, {
        saveStatsPayloadToBackendIO,
        fetchImpl: fetch,
        windowRef: window,
      });
    }

    async function checkBackendHealth(options = {}) {
      return checkBackendHealthAction(options, {
        checkBackendHealthIO,
        fetchImpl: fetch,
        documentRef: document,
        windowRef: window,
        setPairStatus,
      });
    }

    function downloadJson() {
      return downloadJsonAction({ buildStatsPayload });
    }

    async function loadData() {
      return loadDataFlow({
        documentRef: document,
        loadDataIO,
        fetchImpl: fetch,
        state,
        pickInitialPatientId,
        renderAll,
      });
    }

    async function loadStats() {
      return loadStatsFlow({
        documentRef: document,
        loadStatsIO,
        fetchImpl: fetch,
        applyStatsPayload,
        state,
        pickInitialPatientId,
        localStorageRef: localStorage,
        refreshMetrics,
        renderAll,
      });
    }

    const switchDialog = createSwitchDialogController(document);
    function showSwitchDialog(pid, onSave, onDiscard, onCancel) {
      return switchDialog.show(pid, onSave, onDiscard, onCancel);
    }
    switchDialog.bind();

    bindUiEvents({
      documentRef: document,
      localStorageRef: localStorage,
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
      alertImpl: alert,
      checkBackendHint: "python /home/wenhao/trains/web/apfusion/src/serving/server.py",
    });
