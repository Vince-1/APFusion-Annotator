export async function drawSingleViewer(drawImpl, args) {
  return drawImpl(args);
}

export async function drawViewerSingleScene(params, deps) {
  const {
    wrapId,
    imgRelPath,
    gtBoxes,
    prBoxes,
    reviewMode,
    mirror = false,
    showLabels = true,
    indexOffset = { gt: 0, pr: 0 },
  } = params;
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

  const wrap = documentRef.getElementById(wrapId);
  wrap.innerHTML = "";
  const key = wrapId.replace("Wrap", "");
  state.viewerStates[key] = null;
  if (!imgRelPath) return;

  const img = new Image();
  const resolvedSrc = resolveImageSrc(imgRelPath);
  img.src = resolvedSrc;
  await img.decode().catch(() => null);
  if (!img.width || !img.height) {
    wrap.textContent = `Image load failed: ${imgRelPath} -> ${resolvedSrc}`;
    return;
  }

  const vc = VIEWER_CONFIG;
  const labelBoxW = vc.labelBoxW;
  const labelBoxH = vc.labelBoxH;
  const labelStep = vc.labelStep;
  const topPad = vc.labelTopPad;
  const bottomPad = vc.labelBottomPad;
  const colGap = vc.labelColGap;
  const groupGap = vc.labelGroupGap;

  const usableH = Math.max(20, img.height - topPad - bottomPad);
  const rowsPerCol = Math.max(1, Math.floor(usableH / labelStep));
  const gtCols = Math.ceil((gtBoxes || []).length / rowsPerCol);
  const prCols = Math.ceil((prBoxes || []).length / rowsPerCol);

  const gtBaseX = img.width + 8;
  const prBaseX = gtBaseX + gtCols * (labelBoxW + colGap) + groupGap;
  const labelW = 8 + (gtCols + prCols) * (labelBoxW + colGap) + groupGap;

  const canvas = documentRef.createElement("canvas");
  canvas.width = img.width + Math.max(vc.labelMinWidth, labelW);
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");

  const rec = currentRecord();
  const fnIdx = reviewMode ? toIdxArray(rec?.fn_idx_front) : [];
  const fpIdx = reviewMode ? toIdxArray(rec?.fp_idx_front) : [];
  const aggGt = reviewMode ? parseGroups(Array.isArray(rec?.agg_gt_groups) ? JSON.stringify(rec.agg_gt_groups) : (rec?.agg_gt_groups || "")) : [];
  const aggPr = reviewMode ? parseGroups(Array.isArray(rec?.agg_pred_groups) ? JSON.stringify(rec.agg_pred_groups) : (rec?.agg_pred_groups || "")) : [];

  const gtLabels = [];
  const prLabels = [];
  const boxItems = [];

  (gtBoxes || []).forEach((b, i) => {
    const gi = indexOffset.gt + i;
    const bm = mirror ? { ...b, cx: 1 - b.cx } : b;
    const { x1, y1, x2, y2 } = boxToXYXY(bm, img.width, img.height);
    const hi = fnIdx.includes(gi);
    const boxKey = `GT-${gi}`;
    gtLabels.push({ key: boxKey, text: `GT#${gi}`, color: hi ? "#f59e0b" : "#1d4ed8", anchorX: mirror ? x1 : x2, anchorY: (y1 + y2) / 2 });
    boxItems.push({ key: boxKey, x1, y1, x2, y2, text: `GT#${gi}${hi ? " | FN" : ""}` });
  });

  (prBoxes || []).forEach((b, i) => {
    const pi = indexOffset.pr + i;
    const bm = mirror ? { ...b, cx: 1 - b.cx } : b;
    const { x1, y1, x2, y2 } = boxToXYXY(bm, img.width, img.height);
    const hi = fpIdx.includes(pi);
    const boxKey = `PR-${pi}`;
    prLabels.push({ key: boxKey, text: `PR#${pi}:${(b.conf ?? 0).toFixed(2)}`, color: hi ? "#f59e0b" : "#dc2626", anchorX: mirror ? x1 : x2, anchorY: (y1 + y2) / 2 });
    boxItems.push({ key: boxKey, x1, y1, x2, y2, text: `PR#${pi} conf=${(b.conf ?? 0).toFixed(2)}${hi ? " | FP" : ""}` });
  });

  const viewerState = {
    key,
    canvas,
    ctx,
    img,
    imgW: img.width,
    imgH: img.height,
    gtBoxes,
    prBoxes,
    gtOffset: indexOffset.gt,
    prOffset: indexOffset.pr,
    fnIdx,
    fpIdx,
    aggGt,
    aggPr,
    mirror,
    reviewMode,
    showLabels,
    gtLabels,
    prLabels,
    boxItems,
    rowsPerCol,
    labelStep,
    topPad,
    colGap,
    labelBoxW,
    labelBoxH,
    gtBaseX,
    prBaseX,
    hoveredKeys: new Set()
  };

  renderViewerCanvas(viewerState, new Set());
  state.viewerStates[key] = viewerState;

  canvas.onmousemove = (e) => handleHover(e, canvas, key);
  canvas.onclick = (e) => handleSelect(e, canvas, key);
  canvas.onmouseleave = () => {
    hideTooltip();
    const vs = state.viewerStates[key];
    if (!vs) return;
    vs.hoveredKeys = new Set();
    renderViewerCanvas(vs, vs.hoveredKeys);
  };

  wrap.appendChild(canvas);
}
