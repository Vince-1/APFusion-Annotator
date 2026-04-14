export async function drawQuadViewer(drawImpl, args) {
  return drawImpl(args);
}

export async function drawViewerQuadScene(params, deps) {
  const { wrapId, key, s1, s2, s3, s4 } = params;
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

  const wrap = documentRef.getElementById(wrapId);
  wrap.innerHTML = "";
  state.viewerStates[key] = null;

  const [m1, m2, m3, m4] = await Promise.all([
    buildViewerModel(s1), buildViewerModel(s2),
    buildViewerModel(s3), buildViewerModel(s4)
  ]);
  if (!m1 || !m2 || !m3 || !m4) { wrap.textContent = "Image load failed"; return; }

  const vc = VIEWER_CONFIG;
  const imgH = Math.max(m1.imgH, m2.imgH, m3.imgH, m4.imgH);
  const labelBoxW = vc.quadLabelBoxW;
  const labelBoxH = vc.labelBoxH;
  const labelStep = vc.labelStep;
  const topPad = vc.quadTopPad;
  const sidePad = vc.quadSidePad;
  const imgGap = vc.quadImgGap;
  const pairGap = vc.quadPairGap;
  const centerW = labelBoxW + sidePad * 2;

  // Compute label stack heights first; canvas must be tall enough to avoid clipping long GT/PR lists.
  const uniqueCount = list => new Set((list || []).map(lb => lb.key)).size;
  const frontGtCount = uniqueCount([...(m1.gtLabels || []), ...(m2.gtLabels || [])]);
  const frontPrCount = uniqueCount([...(m1.prLabels || []), ...(m2.prLabels || [])]);
  const backGtCount = uniqueCount([...(m3.gtLabels || []), ...(m4.gtLabels || [])]);
  const backPrCount = uniqueCount([...(m3.prLabels || []), ...(m4.prLabels || [])]);
  const frontNeedH = topPad + frontGtCount * labelStep + vc.quadLabelGroupGap + frontPrCount * labelStep + vc.quadTopPad;
  const backNeedH = topPad + backGtCount * labelStep + vc.quadLabelGroupGap + backPrCount * labelStep + vc.quadTopPad;
  const logicalH = Math.max(imgH, frontNeedH, backNeedH);

  // Layout: [s1] [frontLabels] [s2]  gap  [s3] [backLabels] [s4]
  const x1 = 0;
  const frontCenterX = x1 + m1.imgW + imgGap;
  const x2 = frontCenterX + centerW + imgGap;
  const x3 = x2 + m2.imgW + pairGap;
  const backCenterX = x3 + m3.imgW + imgGap;
  const x4 = backCenterX + centerW + imgGap;
  const totalW = x4 + m4.imgW;

  // Scale to fill container width — draw at display resolution (no CSS scaling = no blur)
  const dpr = windowRef.devicePixelRatio || 1;
  const displayW = wrap.clientWidth || totalW;
  const scale = displayW / totalW;
  const displayH = Math.round(logicalH * scale);

  const canvas = documentRef.createElement("canvas");
  canvas.width = Math.round(displayW * dpr);
  canvas.height = Math.round(displayH * dpr);
  canvas.style.width = displayW + "px";
  canvas.style.height = displayH + "px";
  const ctx = canvas.getContext("2d");
  ctx.scale(scale * dpr, scale * dpr);
  // store scale on quadState so hit detection can invert it
  const csScale = scale; // CSS-pixel -> logical-pixel factor: 1/csScale

  const quadState = {
    key, canvas, ctx,
    csScale,
    models: [m1, m2, m3, m4],
    offsets: [x1, x2, x3, x4],
    labelItems: [], boxItems: [],
    hoveredKeys: new Set(),
    nonSelectableKeys: new Set(),
    renderFn: null
  };

  const renderFn = (hoveredKeys = new Set()) => {
    const dKeys = draftKeySet();
    const aKeys = activePairKeySet();
    const coverage = getCoverageStatus();
    const nonSelectableKeys = !coverage.complete ? getPairedKeySet() : new Set();
    quadState.hoveredKeys = hoveredKeys;
    quadState.nonSelectableKeys = nonSelectableKeys;
    ctx.clearRect(0, 0, totalW, logicalH);
    fillViewerBackground(ctx, totalW, logicalH);

    drawSideInPair(ctx, m1, x1, hoveredKeys, dKeys, aKeys, nonSelectableKeys);
    drawSideInPair(ctx, m2, x2, hoveredKeys, dKeys, aKeys, nonSelectableKeys);
    drawSideInPair(ctx, m3, x3, hoveredKeys, dKeys, aKeys, nonSelectableKeys);
    drawSideInPair(ctx, m4, x4, hoveredKeys, dKeys, aKeys, nonSelectableKeys);

    const buildShared = (models, xOffsets) => {
      const dedupeGT = new Map(), dedupePR = new Map();
      models.forEach((m, mi) => {
        m.gtLabels.forEach(lb => {
          if (!dedupeGT.has(lb.key)) dedupeGT.set(lb.key, { ...lb, anchors: [] });
          dedupeGT.get(lb.key).anchors.push({ x: lb.anchorX + xOffsets[mi], y: lb.anchorY });
        });
        m.prLabels.forEach(lb => {
          if (!dedupePR.has(lb.key)) dedupePR.set(lb.key, { ...lb, anchors: [] });
          dedupePR.get(lb.key).anchors.push({ x: lb.anchorX + xOffsets[mi], y: lb.anchorY });
        });
      });
      const sort = m => Array.from(m.values()).sort((a, b) => parseInt(a.key.split("-")[1], 10) - parseInt(b.key.split("-")[1], 10));
      return { gt: sort(dedupeGT), pr: sort(dedupePR) };
    };

    const frontShared = buildShared([m1, m2], [x1, x2]);
    const backShared = buildShared([m3, m4], [x3, x4]);

    const drawStack = (list, xBase, yStart) => {
      const visible = nonSelectableKeys.size ? list.filter(lb => !nonSelectableKeys.has(lb.key)) : list;
      visible.forEach((lb, i) => {
        const y = yStart + i * labelStep;
        const boxY = y - Math.floor(labelBoxH / 2);
        const isHover = hoveredKeys.has(lb.key);
        const isDraft = dKeys.has(lb.key);
        const isActive = aKeys.has(lb.key);
        if (isHover || isDraft || isActive) {
          ctx.save();
          ctx.strokeStyle = isActive ? "#0284c7" : (isDraft ? "#22c55e" : lb.color);
          ctx.lineWidth = isActive ? 2.0 : (isDraft ? 1.6 : 1.1);
          (lb.anchors || []).forEach(a => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(xBase, y); ctx.stroke(); });
          ctx.restore();
        }
        ctx.fillStyle = isActive ? "#0284c7" : (isDraft ? "#22c55e" : lb.color);
        ctx.font = (isHover || isDraft || isActive) ? "bold 13px sans-serif" : "13px sans-serif";
        ctx.fillText(lb.text, xBase + 3, y + 4);
        lb.hitbox = { x1: xBase, y1: boxY, x2: xBase + labelBoxW, y2: boxY + labelBoxH };
      });
      return visible;
    };

    const fLabelX = frontCenterX + sidePad;
    const bLabelX = backCenterX + sidePad;
    const fgt = drawStack(frontShared.gt, fLabelX, topPad);
    const fpr = drawStack(frontShared.pr, fLabelX, topPad + frontShared.gt.length * labelStep + vc.quadLabelGroupGap);
    const bgt = drawStack(backShared.gt, bLabelX, topPad);
    const bpr = drawStack(backShared.pr, bLabelX, topPad + backShared.gt.length * labelStep + vc.quadLabelGroupGap);

    quadState.labelItems = [...fgt, ...fpr, ...bgt, ...bpr]
      .filter(lb => !(nonSelectableKeys.size && nonSelectableKeys.has(lb.key)));

    quadState.boxItems = [m1, m2, m3, m4].flatMap(m =>
      (m.boxItems || [])
        .filter(it => it.hitbox)
        .map(it => ({ key: it.key, text: it.text, x1: it.hitbox.x1, y1: it.hitbox.y1, x2: it.hitbox.x2, y2: it.hitbox.y2 }))
    ).filter(it => it.x1 != null && !(nonSelectableKeys.size && nonSelectableKeys.has(it.key)));
  };

  quadState.renderFn = renderFn;
  renderFn(new Set());
  state.viewerStates[key] = quadState;

  canvas.onmousemove = (e) => handleHover(e, canvas, key);
  canvas.onclick = (e) => handleSelect(e, canvas, key);
  canvas.onmouseleave = () => {
    hideTooltip();
    const vs = state.viewerStates[key];
    if (!vs) return;
    vs.hoveredKeys = new Set();
    vs.renderFn(vs.hoveredKeys);
  };

  wrap.appendChild(canvas);
}
