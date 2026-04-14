// AUTO_PAIR_CONFIG and VIEWER_CONFIG
// Extracted from apfusion_viewer.html (Phase 1)

export const AUTO_PAIR_CONFIG = {
  enableRecallFirstPreprocess: true,
  prMinConf: 0.00,
  prExpandRatio: 1.12,
  threshold: 0.45,
  crossViewThreshold: 0.55,
  sameViewPrThreshold: 0.72,
  sameViewPrThresholdMin: 0.65,   // Math.max clamp floor for sameViewThreshold
  disableCrossViewMerge: false,
  disableSameViewPrMerge: false,
  allowPrOneToMany: false,
  weights: { iou: 0.40, center: 0.50, size: 0.10, patch: 0.0 },
  // Cross-view merge scoring weights
  crossViewWeights: { iou: 0.55, center: 0.30, size: 0.15 },
  // Same-view PR merge scoring weights
  sameViewMergeWeights: { iou: 0.60, center: 0.25, size: 0.15 },
  // Same-view PR merge hard gates (in addition to sameViewPrThreshold score)
  sameViewMergeIouGate: 0.45,      // score >= threshold && iou >= this → merge
  sameViewMergeOverlapMinGate: 0.75, // overlapMin >= this → always merge
  sameViewMergeCenterGate: 0.985,   // center >= this && size >= sameViewMergeSizeGate → always merge
  sameViewMergeSizeGate: 0.85,
  minIoU: 0.05,
  centerGate: 0.82
};

// ─── Viewer canvas rendering constants ────────────────────────────────────
export const VIEWER_CONFIG = {
  // Label column (used in single-canvas review mode via buildViewerModel)
  labelBoxW: 104,
  labelBoxH: 18,
  labelStep: 16,
  labelTopPad: 10,
  labelBottomPad: 10,
  labelColGap: 10,
  labelGroupGap: 16,
  labelMinWidth: 170,   // canvas.width = img.width + max(labelMinWidth, labelW)

  // Pair viewer (drawViewerPair)
  pairLabelBoxW: 110,
  pairTopPad: 24,
  pairCenterPad: 10,
  pairGroupGap: 20,
  pairSideGap: 14,

  // Quad viewer (drawViewerQuad)
  quadLabelBoxW: 110,
  quadTopPad: 24,
  quadSidePad: 8,
  quadImgGap: 8,
  quadPairGap: 28,
  quadLabelGroupGap: 14,  // gap between GT and PR stacks in quad center column
};

