import { drawViewerSingleScene } from './drawSingle.js';
import { drawViewerPairScene, buildViewerModelScene, drawSideInPairScene } from './drawPair.js';
import { drawViewerQuadScene } from './drawQuad.js';
import { handleHoverEvent, handleSelectEvent } from './hoverSelect.js';

export function renderViewerCanvasFlow(vs, hoveredKeys = new Set(), deps) {
  const {
    renderViewerCanvasCore,
    state,
    draftKeySet,
    activePairKeySet,
    fillViewerBackground,
    drawViewerImage,
    boxToXYXY,
    drawMergedPairBoxes,
    drawAggBoxes,
  } = deps;

  return renderViewerCanvasCore(vs, hoveredKeys, {
    state,
    draftKeySet,
    activePairKeySet,
    fillViewerBackgroundFn: fillViewerBackground,
    drawViewerImageFn: drawViewerImage,
    boxToXYXYFn: boxToXYXY,
    drawMergedPairBoxesFn: (ctx, viewerState) => drawMergedPairBoxes(ctx, viewerState, viewerState.imgW, viewerState.imgH),
    drawAggBoxesFn: drawAggBoxes,
  });
}

export async function drawViewerFlow(args, deps) {
  const {
    documentRef = document,
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
  } = deps;

  return drawViewerSingleScene(args, {
    documentRef,
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
  });
}

export async function buildViewerModelFlow(args, deps) {
  const { currentRecord, toIdxArray, parseGroups, boxToXYXY, resolveImageSrc } = deps;
  return buildViewerModelScene(args, {
    currentRecord,
    toIdxArray,
    parseGroups,
    boxToXYXY,
    resolveImageSrc,
  });
}

export function drawSideInPairFlow(args, deps) {
  const { drawViewerImage, boxToXYXY, drawMergedPairBoxes, drawAggBoxes } = deps;
  return drawSideInPairScene(args, {
    drawViewerImage,
    boxToXYXY,
    drawMergedPairBoxes,
    drawAggBoxes,
  });
}

export async function drawViewerPairFlow(args, deps) {
  const {
    documentRef = document,
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
  } = deps;

  return drawViewerPairScene(args, {
    documentRef,
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
  });
}

export async function drawViewerQuadFlow(args, deps) {
  const {
    documentRef = document,
    windowRef = window,
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
  } = deps;

  return drawViewerQuadScene(args, {
    documentRef,
    windowRef,
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
  });
}

export function handleHoverFlow(args, deps) {
  const { state, renderViewerCanvas, hideTooltip, documentRef = document } = deps;
  return handleHoverEvent(args, {
    state,
    renderViewerCanvas,
    hideTooltip,
    documentRef,
  });
}

export function handleSelectFlow(args, deps) {
  const { state, setDraftKeysUnified } = deps;
  return handleSelectEvent(args, {
    state,
    setDraftKeysUnified,
  });
}

export function hideTooltipFlow(documentRef = document) {
  documentRef.getElementById('tooltip').style.display = 'none';
}
