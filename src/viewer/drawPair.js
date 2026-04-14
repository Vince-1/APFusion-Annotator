export async function drawPairViewer(drawImpl, args) {
  return drawImpl(args);
}

export async function buildViewerModelScene(params, deps) {
  const {
    imgRelPath,
    gtBoxes,
    prBoxes,
    reviewMode,
    mirror = false,
    showLabels = true,
    indexOffset = { gt: 0, pr: 0 },
  } = params;
  const {
    currentRecord,
    toIdxArray,
    parseGroups,
    boxToXYXY,
    resolveImageSrc,
  } = deps;

  if (!imgRelPath) return null;
  const img = new Image();
  img.src = resolveImageSrc(imgRelPath);
  await img.decode().catch(() => null);
  if (!img.width || !img.height) return null;

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
    gtLabels.push({ key: boxKey, text: `GT#${gi}`, color: hi ? "#f59e0b" : "#1d4ed8", anchorX: mirror ? x1 : x2, anchorY: (y1 + y2) / 2, group: "GT" });
    boxItems.push({ key: boxKey, x1, y1, x2, y2, text: `GT#${gi}${hi ? " | FN" : ""}` });
  });

  (prBoxes || []).forEach((b, i) => {
    const pi = indexOffset.pr + i;
    const bm = mirror ? { ...b, cx: 1 - b.cx } : b;
    const { x1, y1, x2, y2 } = boxToXYXY(bm, img.width, img.height);
    const hi = fpIdx.includes(pi);
    const boxKey = `PR-${pi}`;
    prLabels.push({ key: boxKey, text: `PR#${pi}:${(b.conf ?? 0).toFixed(2)}`, color: hi ? "#f59e0b" : "#dc2626", anchorX: mirror ? x1 : x2, anchorY: (y1 + y2) / 2, group: "PR" });
    boxItems.push({ key: boxKey, x1, y1, x2, y2, text: `PR#${pi} conf=${(b.conf ?? 0).toFixed(2)}${hi ? " | FP" : ""}` });
  });

  return {
    img,
    imgW: img.width,
    imgH: img.height,
    gtBoxes: gtBoxes || [],
    prBoxes: prBoxes || [],
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
    boxItems
  };
}

export function drawSideInPairScene(params, deps) {
  const {
    ctx,
    side,
    offsetX,
    hoveredKeys,
    dKeys,
    aKeys,
    nonSelectableKeys,
  } = params;
  const {
    drawViewerImage,
    boxToXYXY,
    drawMergedPairBoxes,
    drawAggBoxes,
  } = deps;

  if (!side) return;
  const imgW = side.imgW;
  const imgH = side.imgH;

  drawViewerImage(ctx, side.img, offsetX, imgW, imgH, side.mirror);

  if (!side.reviewMode) {
    side.gtBoxes.forEach((b, i) => {
      const gi = (side.gtOffset || 0) + i;
      const boxKey = `GT-${gi}`;
      if (nonSelectableKeys && nonSelectableKeys.has(boxKey)) return;
      const selected = dKeys.has(boxKey);
      const active = aKeys.has(boxKey);
      const bm = side.mirror ? { ...b, cx: 1 - b.cx } : b;
      const { x1, y1, x2, y2 } = boxToXYXY(bm, imgW, imgH);
      const hi = (side.fnIdx || []).includes(gi);
      ctx.save();
      ctx.strokeStyle = active ? "#0284c7" : (selected ? "#22c55e" : (hi ? "#f59e0b" : "#1d4ed8"));
      ctx.lineWidth = active ? 2.4 : (selected ? 2.1 : (hi ? 1.7 : 1.0));
      if (!hi) ctx.setLineDash([5, 3]);
      ctx.strokeRect(offsetX + x1, y1, x2 - x1, y2 - y1);
      ctx.restore();
    });

    side.prBoxes.forEach((b, i) => {
      const pi = (side.prOffset || 0) + i;
      const boxKey = `PR-${pi}`;
      if (nonSelectableKeys && nonSelectableKeys.has(boxKey)) return;
      const selected = dKeys.has(boxKey);
      const active = aKeys.has(boxKey);
      const bm = side.mirror ? { ...b, cx: 1 - b.cx } : b;
      const { x1, y1, x2, y2 } = boxToXYXY(bm, imgW, imgH);
      const hi = (side.fpIdx || []).includes(pi);
      ctx.save();
      ctx.strokeStyle = active ? "#0284c7" : (selected ? "#22c55e" : (hi ? "#f59e0b" : "#dc2626"));
      ctx.lineWidth = active ? 2.4 : (selected ? 2.1 : (hi ? 1.7 : 1.0));
      ctx.strokeRect(offsetX + x1, y1, x2 - x1, y2 - y1);
      ctx.restore();
    });
  }

  if (side.reviewMode) {
    ctx.save();
    ctx.translate(offsetX, 0);
    drawMergedPairBoxes(ctx, side, imgW, imgH);
    drawAggBoxes(ctx, side.gtBoxes, side.aggGt || [], "#f97316", imgW, imgH);
    drawAggBoxes(ctx, side.prBoxes, side.aggPr || [], "#a21caf", imgW, imgH);
    ctx.restore();
  }

  side.boxItems.forEach(it => {
    if (nonSelectableKeys && nonSelectableKeys.has(it.key)) {
      it.hitbox = null;
      return;
    }
    it.hitbox = { x1: offsetX + it.x1, y1: it.y1, x2: offsetX + it.x2, y2: it.y2 };
  });
}

export async function drawViewerPairScene(params, deps) {
  const {
    wrapId,
    key,
    left,
    right,
    labelTitle = "",
  } = params;
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

  const wrap = documentRef.getElementById(wrapId);
  wrap.innerHTML = "";
  state.viewerStates[key] = null;

  const leftModel = await buildViewerModel(left);
  const rightModel = await buildViewerModel(right);
  if (!leftModel || !rightModel) {
    wrap.textContent = "Image load failed";
    return;
  }

  const vc = VIEWER_CONFIG;
  const imgH = Math.max(leftModel.imgH, rightModel.imgH);
  const labelBoxW = vc.pairLabelBoxW;
  const labelBoxH = vc.labelBoxH;
  const labelStep = vc.labelStep;
  const topPad = vc.pairTopPad;
  const centerPad = vc.pairCenterPad;
  const groupGap = vc.pairGroupGap;
  const centerW = labelBoxW + centerPad * 2;
  const sideGap = vc.pairSideGap;

  // If there are too many labels, expand canvas height so users can scroll to see all text.
  const pairGtCount = new Set([
    ...(leftModel.gtLabels || []).map(lb => lb.key),
    ...(rightModel.gtLabels || []).map(lb => lb.key)
  ]).size;
  const pairPrCount = new Set([
    ...(leftModel.prLabels || []).map(lb => lb.key),
    ...(rightModel.prLabels || []).map(lb => lb.key)
  ]).size;
  const labelNeedH = topPad + pairGtCount * labelStep + groupGap + pairPrCount * labelStep + vc.pairTopPad;
  const logicalH = Math.max(imgH, labelNeedH);

  const leftX = 0;
  const centerX = leftModel.imgW + sideGap;
  const rightX = centerX + centerW + sideGap;

  const canvas = documentRef.createElement("canvas");
  canvas.width = leftModel.imgW + centerW + rightModel.imgW + sideGap * 2;
  canvas.height = logicalH;
  const ctx = canvas.getContext("2d");

  const pairState = {
    key,
    canvas,
    ctx,
    left: leftModel,
    right: rightModel,
    leftX,
    centerX,
    rightX,
    labelItems: [],
    boxItems: [],
    hoveredKeys: new Set(),
    renderFn: null,
    labelTitle
  };

  const renderFn = (hoveredKeys = new Set()) => {
    const dKeys = draftKeySet();
    const aKeys = activePairKeySet();
    const coverage = getCoverageStatus();
    const hidePaired = !coverage.complete;
    const nonSelectableKeys = hidePaired ? getPairedKeySet() : new Set();
    pairState.hoveredKeys = hoveredKeys;
    pairState.nonSelectableKeys = nonSelectableKeys;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fillViewerBackground(ctx, canvas.width, canvas.height);

    drawSideInPair(ctx, pairState.left, leftX, hoveredKeys, dKeys, aKeys, nonSelectableKeys);
    drawSideInPair(ctx, pairState.right, rightX, hoveredKeys, dKeys, aKeys, nonSelectableKeys);

    const allLabelSources = [
      ...(pairState.left.gtLabels || []),
      ...(pairState.left.prLabels || []),
      ...(pairState.right.gtLabels || []),
      ...(pairState.right.prLabels || [])
    ];

    const shared = new Map();
    allLabelSources.forEach(lb => {
      if (!shared.has(lb.key)) {
        shared.set(lb.key, { key: lb.key, text: lb.text, color: lb.color, group: lb.group, anchors: [] });
      }
      const row = shared.get(lb.key);
      row.anchors.push({ x: lb.anchorX + (pairState.left.gtLabels.includes(lb) || pairState.left.prLabels.includes(lb) ? leftX : rightX), y: lb.anchorY });
    });

    const gtShared = Array.from(shared.values())
      .filter(v => v.group === "GT")
      .sort((a, b) => parseInt(a.key.split("-")[1], 10) - parseInt(b.key.split("-")[1], 10));
    const prShared = Array.from(shared.values())
      .filter(v => v.group === "PR")
      .sort((a, b) => parseInt(a.key.split("-")[1], 10) - parseInt(b.key.split("-")[1], 10));

    const drawSharedCol = (list, xBase, yStart) => {
      const visibleList = (nonSelectableKeys && nonSelectableKeys.size)
        ? list.filter(lb => !nonSelectableKeys.has(lb.key))
        : list;
      visibleList.forEach((lb, i) => {
        const y = yStart + i * labelStep;
        const boxX = xBase;
        const boxY = y - Math.floor(labelBoxH / 2);
        const isHover = hoveredKeys.has(lb.key);
        const isDraft = dKeys.has(lb.key);
        const isActive = aKeys.has(lb.key);

        if (isHover || isDraft || isActive) {
          ctx.save();
          ctx.strokeStyle = isActive ? "#0284c7" : (isDraft ? "#22c55e" : lb.color);
          ctx.lineWidth = isActive ? 2.0 : (isDraft ? 1.6 : 1.1);
          lb.anchors.forEach(a => {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(boxX, y);
            ctx.stroke();
          });
          ctx.restore();
        }

        ctx.fillStyle = isActive ? "#0284c7" : (isDraft ? "#22c55e" : lb.color);
        ctx.font = (isHover || isDraft || isActive) ? "bold 13px sans-serif" : "13px sans-serif";
        ctx.fillText(lb.text, boxX + 3, y + 4);
        lb.hitbox = { x1: boxX, y1: boxY, x2: boxX + labelBoxW, y2: boxY + labelBoxH };
      });
    };

    const sharedX = centerX + centerPad;
    const gtStartY = topPad;
    const prStartY = gtStartY + gtShared.length * labelStep + groupGap;
    drawSharedCol(gtShared, sharedX, gtStartY);
    drawSharedCol(prShared, sharedX, prStartY);

    if (pairState.labelTitle) {
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "bold 12px sans-serif";
      const tW = ctx.measureText(pairState.labelTitle).width;
      const tx = centerX + (centerW - tW) / 2;
      ctx.fillText(pairState.labelTitle, tx, 14);
      ctx.restore();
    }

    pairState.labelItems = [...gtShared, ...prShared]
      .filter(lb => !(nonSelectableKeys && nonSelectableKeys.has(lb.key)));
    pairState.boxItems = [
      ...((pairState.left.boxItems || [])
        .filter(it => it.hitbox)
        .map(it => ({ key: it.key, text: it.text, x1: it.hitbox.x1, y1: it.hitbox.y1, x2: it.hitbox.x2, y2: it.hitbox.y2 }))),
      ...((pairState.right.boxItems || [])
        .filter(it => it.hitbox)
        .map(it => ({ key: it.key, text: it.text, x1: it.hitbox.x1, y1: it.hitbox.y1, x2: it.hitbox.x2, y2: it.hitbox.y2 })))
    ].filter(it => it.x1 != null && it.y1 != null && it.x2 != null && it.y2 != null)
     .filter(it => !(nonSelectableKeys && nonSelectableKeys.has(it.key)));
  };

  pairState.renderFn = renderFn;
  renderFn(new Set());
  state.viewerStates[key] = pairState;

  canvas.onmousemove = (e) => handleHover(e, canvas, key);
  canvas.onclick = (e) => handleSelect(e, canvas, key);
  canvas.onmouseleave = () => {
    hideTooltip();
    const vs = state.viewerStates[key];
    if (!vs) return;
    vs.hoveredKeys = new Set();
    if (typeof vs.renderFn === "function") {
      vs.renderFn(vs.hoveredKeys);
    } else {
      renderViewerCanvas(vs, vs.hoveredKeys);
    }
  };

  wrap.appendChild(canvas);
}
