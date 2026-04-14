export function getViewerBackgroundColor(state) {
  return state.invertDisplay ? "#f2f6fb" : "#000000";
}

export function getViewerImageFilter(state) {
  return state.invertDisplay ? "invert(1)" : "none";
}

export function fillViewerBackground(ctx, width, height, state) {
  ctx.save();
  ctx.fillStyle = getViewerBackgroundColor(state);
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export function drawViewerImage(ctx, img, offsetX, imgW, imgH, mirror, state) {
  ctx.save();
  ctx.filter = getViewerImageFilter(state);
  if (mirror) {
    ctx.translate(offsetX + imgW, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, imgW, imgH);
  } else {
    ctx.drawImage(img, offsetX, 0, imgW, imgH);
  }
  ctx.restore();
}

export function boxToXYXY(b, imgW, imgH) {
  const x1 = (b.cx - b.w / 2) * imgW;
  const y1 = (b.cy - b.h / 2) * imgH;
  const x2 = (b.cx + b.w / 2) * imgW;
  const y2 = (b.cy + b.h / 2) * imgH;
  return { x1, y1, x2, y2 };
}

export function drawAggBoxes(ctx, boxes, groups, color, imgW, imgH, boxToXYXYFn = boxToXYXY) {
  groups.forEach((g) => {
    const valid = g.filter((i) => i >= 0 && i < boxes.length).map((i) => boxes[i]);
    if (!valid.length) return;
    const xy = valid.map((b) => boxToXYXYFn(b, imgW, imgH));
    const x1 = Math.min(...xy.map((v) => v.x1));
    const y1 = Math.min(...xy.map((v) => v.y1));
    const x2 = Math.max(...xy.map((v) => v.x2));
    const y2 = Math.max(...xy.map((v) => v.y2));

    ctx.save();
    ctx.strokeStyle = color;
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    ctx.restore();
  });
}

export function drawMergedPairBoxes(ctx, vs, deps) {
  const { state, getPairRecord, boxToXYXYFn = boxToXYXY } = deps;
  const rec = getPairRecord();
  const rows = state.editMode ? (rec[state.editMode] || []) : [
    ...(rec.TP || []).map((p) => ({ mode: "TP", pair: p })),
    ...(rec.FN || []).map((p) => ({ mode: "FN", pair: p })),
    ...(rec.FP || []).map((p) => ({ mode: "FP", pair: p })),
  ];

  const mapped = state.editMode
    ? rows.map((p) => ({ mode: state.editMode, pair: p }))
    : rows;

  mapped.forEach((row) => {
    const item = row.pair || { GT: [], PR: [] };

    const gtBoxes = (item.GT || [])
      .map((idx) => idx - (vs.gtOffset || 0))
      .filter((idx) => idx >= 0 && idx < (vs.gtBoxes || []).length)
      .map((idx) => {
        const b = vs.gtBoxes[idx];
        const bm = vs.mirror ? { ...b, cx: 1 - b.cx } : b;
        return boxToXYXYFn(bm, vs.imgW, vs.imgH);
      });

    if (gtBoxes.length) {
      const x1 = Math.min(...gtBoxes.map((v) => v.x1));
      const y1 = Math.min(...gtBoxes.map((v) => v.y1));
      const x2 = Math.max(...gtBoxes.map((v) => v.x2));
      const y2 = Math.max(...gtBoxes.map((v) => v.y2));
      ctx.save();
      ctx.strokeStyle = "#2563eb";
      ctx.setLineDash([7, 4]);
      ctx.lineWidth = 2.2;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.restore();
    }

    const prBoxes = (item.PR || [])
      .map((idx) => idx - (vs.prOffset || 0))
      .filter((idx) => idx >= 0 && idx < (vs.prBoxes || []).length)
      .map((idx) => {
        const b = vs.prBoxes[idx];
        const bm = vs.mirror ? { ...b, cx: 1 - b.cx } : b;
        return boxToXYXYFn(bm, vs.imgW, vs.imgH);
      });

    if (prBoxes.length) {
      const x1 = Math.min(...prBoxes.map((v) => v.x1));
      const y1 = Math.min(...prBoxes.map((v) => v.y1));
      const x2 = Math.max(...prBoxes.map((v) => v.x2));
      const y2 = Math.max(...prBoxes.map((v) => v.y2));
      ctx.save();
      ctx.strokeStyle = "#dc2626";
      ctx.setLineDash([]);
      ctx.lineWidth = 2.2;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.restore();
    }
  });
}

export function renderViewerCanvas(vs, hoveredKeys = new Set(), deps) {
  const {
    state,
    draftKeySet,
    activePairKeySet,
    fillViewerBackgroundFn,
    drawViewerImageFn,
    boxToXYXYFn = boxToXYXY,
    drawMergedPairBoxesFn,
    drawAggBoxesFn,
  } = deps;

  const { ctx, img, imgW, imgH, gtBoxes, prBoxes, fnIdx, fpIdx, aggGt, aggPr, reviewMode, gtLabels, prLabels } = vs;
  const gtOff = vs.gtOffset || 0;
  const prOff = vs.prOffset || 0;
  const dKeys = draftKeySet();
  const aKeys = activePairKeySet();
  ctx.clearRect(0, 0, vs.canvas.width, vs.canvas.height);
  fillViewerBackgroundFn(ctx, vs.canvas.width, vs.canvas.height);
  drawViewerImageFn(ctx, img, 0, imgW, imgH, vs.mirror);

  if (!reviewMode) {
    gtBoxes.forEach((b, i) => {
      const gi = gtOff + i;
      const boxKey = `GT-${gi}`;
      const selected = dKeys.has(boxKey);
      const active = aKeys.has(boxKey);
      const bm = vs.mirror ? { ...b, cx: 1 - b.cx } : b;
      const { x1, y1, x2, y2 } = boxToXYXYFn(bm, imgW, imgH);
      const hi = fnIdx.includes(gi);
      ctx.save();
      ctx.strokeStyle = active ? "#0284c7" : (selected ? "#22c55e" : (hi ? "#f59e0b" : "#1d4ed8"));
      ctx.lineWidth = active ? 2.4 : (selected ? 2.1 : (hi ? 1.7 : 1.0));
      if (!hi) ctx.setLineDash([5, 3]);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.restore();
    });

    prBoxes.forEach((b, i) => {
      const pi = prOff + i;
      const boxKey = `PR-${pi}`;
      const selected = dKeys.has(boxKey);
      const active = aKeys.has(boxKey);
      const bm = vs.mirror ? { ...b, cx: 1 - b.cx } : b;
      const { x1, y1, x2, y2 } = boxToXYXYFn(bm, imgW, imgH);
      const hi = fpIdx.includes(pi);
      ctx.save();
      ctx.strokeStyle = active ? "#0284c7" : (selected ? "#22c55e" : (hi ? "#f59e0b" : "#dc2626"));
      ctx.lineWidth = active ? 2.4 : (selected ? 2.1 : (hi ? 1.7 : 1.0));
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.restore();
    });
  }

  if (reviewMode) {
    drawMergedPairBoxesFn(ctx, vs);
  }

  if (reviewMode) {
    drawAggBoxesFn(ctx, gtBoxes, aggGt, "#f97316", imgW, imgH);
    drawAggBoxesFn(ctx, prBoxes, aggPr, "#a21caf", imgW, imgH);
  }

  const drawLabelColumn = (labels, baseX) => {
    if (!labels.length) return;
    labels.sort((a, b) => a.anchorY - b.anchorY);

    const rowsPerCol = vs.rowsPerCol;
    const step = vs.labelStep;
    const topPad = vs.topPad;
    const colGap = vs.colGap;
    const boxW = vs.labelBoxW;
    const boxH = vs.labelBoxH;

    labels.forEach((lb, i) => {
      const col = Math.floor(i / rowsPerCol);
      const row = i % rowsPerCol;
      const y = topPad + row * step;
      const xText = baseX + col * (boxW + colGap) + 3;
      const isHover = hoveredKeys.has(lb.key);
      const isDraft = dKeys.has(lb.key);
      const isActive = aKeys.has(lb.key);
      const boxX = xText - 3;
      const boxY = y - Math.floor(boxH / 2);

      if (isHover || isDraft || isActive) {
        ctx.save();
        ctx.strokeStyle = isActive ? "#0284c7" : (isDraft ? "#22c55e" : lb.color);
        ctx.lineWidth = isActive ? 2.0 : (isDraft ? 1.6 : 1.1);
        ctx.beginPath();
        ctx.moveTo(lb.anchorX, lb.anchorY);
        ctx.lineTo(xText - 4, y);
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = isActive ? "#0284c7" : (isDraft ? "#22c55e" : lb.color);
      ctx.font = (isHover || isDraft || isActive) ? "bold 13px sans-serif" : "13px sans-serif";
      ctx.fillText(lb.text, xText, y + 4);

      lb.labelY = y;
      lb.hitbox = { x1: boxX, y1: boxY, x2: boxX + boxW, y2: boxY + boxH };
    });
  };

  if (vs.showLabels !== false) {
    drawLabelColumn(gtLabels, vs.gtBaseX);
    drawLabelColumn(prLabels, vs.prBaseX);
  }
}
