// Geometry utility functions (pure, no side effects)
// Extracted from apfusion_viewer.html (Phase 1)

export function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}


export function computeBoxIoU(a, b) {
  const ax1 = (a.cx || 0) - (a.w || 0) / 2;
  const ay1 = (a.cy || 0) - (a.h || 0) / 2;
  const ax2 = (a.cx || 0) + (a.w || 0) / 2;
  const ay2 = (a.cy || 0) + (a.h || 0) / 2;
  const bx1 = (b.cx || 0) - (b.w || 0) / 2;
  const by1 = (b.cy || 0) - (b.h || 0) / 2;
  const bx2 = (b.cx || 0) + (b.w || 0) / 2;
  const by2 = (b.cy || 0) + (b.h || 0) / 2;

  const ix1 = Math.max(ax1, bx1);
  const iy1 = Math.max(ay1, by1);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  const areaA = Math.max(0, ax2 - ax1) * Math.max(0, ay2 - ay1);
  const areaB = Math.max(0, bx2 - bx1) * Math.max(0, by2 - by1);
  const union = areaA + areaB - inter;
  return union > 0 ? inter / union : 0;
}


export function computeCenterSimilarity(a, b) {
  const dx = (a.cx || 0) - (b.cx || 0);
  const dy = (a.cy || 0) - (b.cy || 0);
  const dist = Math.sqrt(dx * dx + dy * dy) / Math.SQRT2;
  return clamp01(1 - dist);
}


export function computeSizeSimilarity(a, b) {
  const areaA = Math.max(1e-6, (a.w || 0) * (a.h || 0));
  const areaB = Math.max(1e-6, (b.w || 0) * (b.h || 0));
  return clamp01(Math.exp(-Math.abs(Math.log(areaA / areaB))));
}


export function toCanonicalBox(box, side) {
  if (!box) return { cx: 0, cy: 0, w: 0, h: 0 };
  return {
    cx: side === "back" ? 1 - (box.cx || 0) : (box.cx || 0),
    cy: box.cy || 0,
    w: box.w || 0,
    h: box.h || 0
  };
}


export function averageBoxes(boxes) {
  const list = (boxes || []).filter(Boolean);
  if (!list.length) return { cx: 0, cy: 0, w: 0, h: 0 };
  const sum = list.reduce((acc, box) => {
    acc.cx += box.cx || 0;
    acc.cy += box.cy || 0;
    acc.w += box.w || 0;
    acc.h += box.h || 0;
    return acc;
  }, { cx: 0, cy: 0, w: 0, h: 0 });
  return {
    cx: sum.cx / list.length,
    cy: sum.cy / list.length,
    w: sum.w / list.length,
    h: sum.h / list.length
  };
}


export function clampBox01(box) {
  const cx = clamp01(box?.cx || 0);
  const cy = clamp01(box?.cy || 0);
  const w = Math.max(1e-6, Math.min(1, box?.w || 0));
  const h = Math.max(1e-6, Math.min(1, box?.h || 0));
  return { cx, cy, w, h };
}


export function expandBox(box, ratio = 1.0) {
  const safeRatio = Number.isFinite(ratio) ? Math.max(1, ratio) : 1;
  return clampBox01({
    cx: box?.cx || 0,
    cy: box?.cy || 0,
    w: (box?.w || 0) * safeRatio,
    h: (box?.h || 0) * safeRatio
  });
}


export function computeMinAreaOverlap(a, b) {
  const ax1 = (a.cx || 0) - (a.w || 0) / 2;
  const ay1 = (a.cy || 0) - (a.h || 0) / 2;
  const ax2 = (a.cx || 0) + (a.w || 0) / 2;
  const ay2 = (a.cy || 0) + (a.h || 0) / 2;
  const bx1 = (b.cx || 0) - (b.w || 0) / 2;
  const by1 = (b.cy || 0) - (b.h || 0) / 2;
  const bx2 = (b.cx || 0) + (b.w || 0) / 2;
  const by2 = (b.cy || 0) + (b.h || 0) / 2;
  const ix1 = Math.max(ax1, bx1);
  const iy1 = Math.max(ay1, by1);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);
  const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
  const areaA = Math.max(1e-6, (ax2 - ax1) * (ay2 - ay1));
  const areaB = Math.max(1e-6, (bx2 - bx1) * (by2 - by1));
  return inter / Math.min(areaA, areaB);
}

