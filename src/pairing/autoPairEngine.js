import { AUTO_PAIR_CONFIG } from '../config/constants.js';
import {
  computeBoxIoU,
  computeCenterSimilarity,
  computeMinAreaOverlap,
  computeSizeSimilarity,
  toCanonicalBox,
  averageBoxes,
  expandBox,
} from '../utils/geometry.js';
import { uniqueSorted } from '../utils/collections.js';

export function compareCandidates(a, b) {
  return (b.score - a.score) || (b.iou - a.iou) || (b.center - a.center) || (b.patch - a.patch);
}

export function rankCandidates(candidates = []) {
  return [...candidates].sort(compareCandidates);
}

export function normalizeEntryIndices(entry) {
  return {
    localIndices: Array.isArray(entry?.localIndices)
      ? uniqueSorted(entry.localIndices)
      : (Number.isInteger(entry?.localIndex) ? [entry.localIndex] : []),
    globalIndices: Array.isArray(entry?.globalIndices)
      ? uniqueSorted(entry.globalIndices)
      : (Number.isInteger(entry?.globalIndex) ? [entry.globalIndex] : [])
  };
}

export function buildSameViewEntries({ boxes = [], offset = 0, side = 'front', kind = 'GT', config = AUTO_PAIR_CONFIG }) {
  const allEntries = (boxes || []).map((box, localIndex) => ({
    side,
    localIndex,
    localIndices: [localIndex],
    globalIndex: offset + localIndex,
    globalIndices: [offset + localIndex],
    box,
    canonicalBox: toCanonicalBox(box, side)
  }));

  const baseEntries = kind === 'PR' && config.enableRecallFirstPreprocess
    ? allEntries.filter(entry => {
        const conf = Number.isFinite(Number(entry.box?.conf)) ? Number(entry.box.conf) : 1;
        return conf >= config.prMinConf;
      })
    : allEntries;

  if (kind !== 'PR' || baseEntries.length <= 1 || config.disableSameViewPrMerge) {
    return baseEntries;
  }

  const sameViewThreshold = Math.max(
    config.sameViewPrThresholdMin ?? AUTO_PAIR_CONFIG.sameViewPrThresholdMin,
    config.sameViewPrThreshold || AUTO_PAIR_CONFIG.sameViewPrThreshold
  );
  const sortedEntries = [...baseEntries].sort((a, b) => ((b.box?.conf || 0) - (a.box?.conf || 0)) || (a.globalIndex - b.globalIndex));
  const groups = [];

  sortedEntries.forEach(entry => {
    let bestGroupIndex = -1;
    let bestScore = -Infinity;

    groups.forEach((group, idx) => {
      const repBox = averageBoxes(group.map(item => item.canonicalBox));
      const iou = computeBoxIoU(entry.canonicalBox, repBox);
      const center = computeCenterSimilarity(entry.canonicalBox, repBox);
      const size = computeSizeSimilarity(entry.canonicalBox, repBox);
      const overlapMin = computeMinAreaOverlap(entry.canonicalBox, repBox);
      const smw = config.sameViewMergeWeights || AUTO_PAIR_CONFIG.sameViewMergeWeights;
      const score = smw.iou * iou + smw.center * center + smw.size * size;
      const shouldMerge =
        (score >= sameViewThreshold && iou >= (config.sameViewMergeIouGate ?? AUTO_PAIR_CONFIG.sameViewMergeIouGate)) ||
        overlapMin >= (config.sameViewMergeOverlapMinGate ?? AUTO_PAIR_CONFIG.sameViewMergeOverlapMinGate) ||
        (center >= (config.sameViewMergeCenterGate ?? AUTO_PAIR_CONFIG.sameViewMergeCenterGate) &&
          size >= (config.sameViewMergeSizeGate ?? AUTO_PAIR_CONFIG.sameViewMergeSizeGate));
      if (shouldMerge && score > bestScore) {
        bestScore = score;
        bestGroupIndex = idx;
      }
    });

    if (bestGroupIndex >= 0) {
      groups[bestGroupIndex].push(entry);
    } else {
      groups.push([entry]);
    }
  });

  return groups.map(group => {
    const localIndices = uniqueSorted(group.flatMap(item => normalizeEntryIndices(item).localIndices));
    const globalIndices = uniqueSorted(group.flatMap(item => normalizeEntryIndices(item).globalIndices));
    return {
      side,
      localIndex: localIndices[0] ?? -1,
      localIndices,
      globalIndex: globalIndices[0] ?? -1,
      globalIndices,
      box: averageBoxes(group.map(item => item.box)),
      canonicalBox: averageBoxes(group.map(item => item.canonicalBox))
    };
  }).sort((a, b) => (a.globalIndex - b.globalIndex));
}

export function makeCrossViewGroup(members, kind, config = AUTO_PAIR_CONFIG) {
  const globalIndices = uniqueSorted(members.flatMap(m => normalizeEntryIndices(m).globalIndices));
  const front = members.find(m => m.side === 'front') || null;
  const back = members.find(m => m.side === 'back') || null;
  const sides = [];
  if (front) sides.push('前位');
  if (back) sides.push('后位');
  const baseRepBox = averageBoxes(members.map(m => m.canonicalBox || m.repBox));
  const repBox = kind === 'PR' && config.enableRecallFirstPreprocess
    ? expandBox(baseRepBox, config.prExpandRatio)
    : baseRepBox;
  return {
    kind,
    members,
    front,
    back,
    globalIndices,
    baseRepBox,
    repBox,
    label: sides.length > 1 ? '前后聚合' : (sides[0] || '单侧')
  };
}

export function buildCrossViewGroups({ frontBoxes = [], backBoxes = [], frontOffset = 0, backOffset = 0, kind = 'GT', config = AUTO_PAIR_CONFIG }) {
  const frontEntries = buildSameViewEntries({ boxes: frontBoxes, offset: frontOffset, side: 'front', kind, config });
  const backEntries = buildSameViewEntries({ boxes: backBoxes, offset: backOffset, side: 'back', kind, config });

  if (config.disableCrossViewMerge) {
    return [
      ...frontEntries.map(entry => makeCrossViewGroup([entry], kind, config)),
      ...backEntries.map(entry => makeCrossViewGroup([entry], kind, config))
    ];
  }

  const candidates = [];
  frontEntries.forEach((frontItem, fi) => {
    backEntries.forEach((backItem, bi) => {
      const iou = computeBoxIoU(frontItem.canonicalBox, backItem.canonicalBox);
      const center = computeCenterSimilarity(frontItem.canonicalBox, backItem.canonicalBox);
      const size = computeSizeSimilarity(frontItem.canonicalBox, backItem.canonicalBox);
      const cvw = config.crossViewWeights || AUTO_PAIR_CONFIG.crossViewWeights;
      const score = cvw.iou * iou + cvw.center * center + cvw.size * size;
      if (score >= config.crossViewThreshold) {
        candidates.push({ fi, bi, iou, center, size, score });
      }
    });
  });
  candidates.sort((a, b) => (b.score - a.score) || (b.iou - a.iou) || (b.center - a.center));

  const usedFront = new Set();
  const usedBack = new Set();
  const groups = [];

  candidates.forEach(item => {
    if (usedFront.has(item.fi) || usedBack.has(item.bi)) return;
    usedFront.add(item.fi);
    usedBack.add(item.bi);
    groups.push(makeCrossViewGroup([frontEntries[item.fi], backEntries[item.bi]], kind, config));
  });

  frontEntries.forEach((entry, idx) => {
    if (!usedFront.has(idx)) groups.push(makeCrossViewGroup([entry], kind, config));
  });
  backEntries.forEach((entry, idx) => {
    if (!usedBack.has(idx)) groups.push(makeCrossViewGroup([entry], kind, config));
  });

  return groups;
}

export function computeGroupPatchSimilarity(gtGroup, prGroup, patchStats, computePatchSimilarity) {
  const scores = [];
  const gtFrontIdxs = gtGroup.front ? normalizeEntryIndices(gtGroup.front).localIndices : [];
  const prFrontIdxs = prGroup.front ? normalizeEntryIndices(prGroup.front).localIndices : [];
  const gtBackIdxs = gtGroup.back ? normalizeEntryIndices(gtGroup.back).localIndices : [];
  const prBackIdxs = prGroup.back ? normalizeEntryIndices(prGroup.back).localIndices : [];

  gtFrontIdxs.forEach(gi => {
    prFrontIdxs.forEach(pi => {
      scores.push(computePatchSimilarity(
        patchStats.gt?.front?.[gi],
        patchStats.pr?.front?.[pi]
      ));
    });
  });
  gtBackIdxs.forEach(gi => {
    prBackIdxs.forEach(pi => {
      scores.push(computePatchSimilarity(
        patchStats.gt?.back?.[gi],
        patchStats.pr?.back?.[pi]
      ));
    });
  });
  return scores.length ? Math.max(...scores) : 0.5;
}

export function buildGroupedFnReason({ group, relatedPairs, prGroups, gtGroups, config, matchedByPr, formatGroupIndices, fmtAutoPairMetric }) {
  const gtText = formatGroupIndices('GT', group.globalIndices);
  if (!prGroups.length) {
    return { type: 'FN', side: group.label, globalIndex: group.globalIndices[0] ?? -1, text: `${gtText}（${group.label}）：没有可用的 PR 候选病灶` };
  }
  const best = [...(relatedPairs || [])].sort(compareCandidates)[0];
  if (!best) {
    return { type: 'FN', side: group.label, globalIndex: group.globalIndices[0] ?? -1, text: `${gtText}（${group.label}）：没有形成有效的 PR 候选` };
  }
  const prGroup = prGroups[best.pi];
  const prText = formatGroupIndices('PR', prGroup?.globalIndices || []);
  if (!best.passesGate) {
    const gateReasons = [];
    if (best.iou < config.minIoU) gateReasons.push(`IoU ${fmtAutoPairMetric(best.iou)} < ${config.minIoU.toFixed(2)}`);
    if (best.center < config.centerGate) gateReasons.push(`中心 ${fmtAutoPairMetric(best.center)} < ${config.centerGate.toFixed(2)}`);
    return { type: 'FN', side: group.label, globalIndex: group.globalIndices[0] ?? -1, text: `${gtText}（${group.label}）：最佳候选 ${prText} 未通过门限（${gateReasons.join('，')}）` };
  }
  if (best.score < config.threshold) {
    return { type: 'FN', side: group.label, globalIndex: group.globalIndices[0] ?? -1, text: `${gtText}（${group.label}）：最佳候选 ${prText} 的分数 ${fmtAutoPairMetric(best.score)} < 阈值 ${config.threshold.toFixed(2)}` };
  }
  const occupant = matchedByPr.get(best.pi);
  if (occupant) {
    const occupiedGt = gtGroups[occupant.gi];
    return { type: 'FN', side: group.label, globalIndex: group.globalIndices[0] ?? -1, text: `${gtText}（${group.label}）：${prText} 已被 ${formatGroupIndices('GT', occupiedGt?.globalIndices || [])} 以更高分 ${fmtAutoPairMetric(occupant.score)} 占用` };
  }
  return { type: 'FN', side: group.label, globalIndex: group.globalIndices[0] ?? -1, text: `${gtText}（${group.label}）：一对一匹配后没有剩余 PR 可分配` };
}

export function buildGroupedFpReason({ group, relatedPairs, prGroups, gtGroups, config, matchedByGt, formatGroupIndices, fmtAutoPairMetric }) {
  const prText = formatGroupIndices('PR', group.globalIndices);
  if (!gtGroups.length) {
    return { type: 'FP', side: group.label, globalIndex: group.globalIndices[0] ?? -1, text: `${prText}（${group.label}）：没有可用的 GT 病灶` };
  }
  const best = [...(relatedPairs || [])].sort(compareCandidates)[0];
  if (!best) {
    return { type: 'FP', side: group.label, globalIndex: group.globalIndices[0] ?? -1, text: `${prText}（${group.label}）：没有形成有效的 GT 候选` };
  }
  const gtGroup = gtGroups[best.gi];
  const gtText = formatGroupIndices('GT', gtGroup?.globalIndices || []);
  if (!best.passesGate) {
    const gateReasons = [];
    if (best.iou < config.minIoU) gateReasons.push(`IoU ${fmtAutoPairMetric(best.iou)} < ${config.minIoU.toFixed(2)}`);
    if (best.center < config.centerGate) gateReasons.push(`中心 ${fmtAutoPairMetric(best.center)} < ${config.centerGate.toFixed(2)}`);
    return { type: 'FP', side: group.label, globalIndex: group.globalIndices[0] ?? -1, text: `${prText}（${group.label}）：最佳候选 ${gtText} 未通过门限（${gateReasons.join('，')}）` };
  }
  if (best.score < config.threshold) {
    return { type: 'FP', side: group.label, globalIndex: group.globalIndices[0] ?? -1, text: `${prText}（${group.label}）：最佳候选 ${gtText} 的分数 ${fmtAutoPairMetric(best.score)} < 阈值 ${config.threshold.toFixed(2)}` };
  }
  const occupant = matchedByGt.get(best.gi);
  if (occupant) {
    const occupiedPr = prGroups[occupant.pi];
    return { type: 'FP', side: group.label, globalIndex: group.globalIndices[0] ?? -1, text: `${prText}（${group.label}）：${gtText} 已被 ${formatGroupIndices('PR', occupiedPr?.globalIndices || [])} 以更高分 ${fmtAutoPairMetric(occupant.score)} 占用` };
  }
  return { type: 'FP', side: group.label, globalIndex: group.globalIndices[0] ?? -1, text: `${prText}（${group.label}）：一对一匹配后没有剩余 GT 可分配` };
}

export function buildFnReason({ sideLabel, gi, gtOffset, prOffset, prCount, relatedPairs, config, matchedByPr, fmtAutoPairMetric }) {
  const gtGlobal = gtOffset + gi;
  if (!prCount) {
    return { type: 'FN', side: sideLabel, globalIndex: gtGlobal, text: `GT${gtGlobal + 1}：该侧没有可用的 PR 框` };
  }
  const best = [...(relatedPairs || [])].sort(compareCandidates)[0];
  if (!best) {
    return { type: 'FN', side: sideLabel, globalIndex: gtGlobal, text: `GT${gtGlobal + 1}：没有生成有效候选 PR` };
  }
  const prGlobal = prOffset + best.pi;
  if (!best.passesGate) {
    const gateReasons = [];
    if (best.iou < config.minIoU) gateReasons.push(`IoU ${fmtAutoPairMetric(best.iou)} < ${config.minIoU.toFixed(2)}`);
    if (best.center < config.centerGate) gateReasons.push(`中心 ${fmtAutoPairMetric(best.center)} < ${config.centerGate.toFixed(2)}`);
    return {
      type: 'FN',
      side: sideLabel,
      globalIndex: gtGlobal,
      text: `GT${gtGlobal + 1}：最接近的 PR${prGlobal + 1} 未通过门限（${gateReasons.join('，')}）`
    };
  }
  if (best.score < config.threshold) {
    return {
      type: 'FN',
      side: sideLabel,
      globalIndex: gtGlobal,
      text: `GT${gtGlobal + 1}：最佳 PR${prGlobal + 1} 的综合分数 ${fmtAutoPairMetric(best.score)} < 阈值 ${config.threshold.toFixed(2)}（IoU ${fmtAutoPairMetric(best.iou)}，图像 ${fmtAutoPairMetric(best.patch)}）`
    };
  }
  const occupant = matchedByPr.get(best.pi);
  if (occupant) {
    return {
      type: 'FN',
      side: sideLabel,
      globalIndex: gtGlobal,
      text: `GT${gtGlobal + 1}：最佳 PR${prGlobal + 1} 已被 GT${occupant.gtGlobal + 1} 以更高分 ${fmtAutoPairMetric(occupant.score)} 占用`
    };
  }
  return { type: 'FN', side: sideLabel, globalIndex: gtGlobal, text: `GT${gtGlobal + 1}：一对一匹配后没有剩余 PR 可分配` };
}

export function buildFpReason({ sideLabel, pi, gtOffset, prOffset, gtCount, relatedPairs, config, matchedByGt, fmtAutoPairMetric }) {
  const prGlobal = prOffset + pi;
  if (!gtCount) {
    return { type: 'FP', side: sideLabel, globalIndex: prGlobal, text: `PR${prGlobal + 1}：该侧没有可用的 GT 框` };
  }
  const best = [...(relatedPairs || [])].sort(compareCandidates)[0];
  if (!best) {
    return { type: 'FP', side: sideLabel, globalIndex: prGlobal, text: `PR${prGlobal + 1}：没有生成有效候选 GT` };
  }
  const gtGlobal = gtOffset + best.gi;
  if (!best.passesGate) {
    const gateReasons = [];
    if (best.iou < config.minIoU) gateReasons.push(`IoU ${fmtAutoPairMetric(best.iou)} < ${config.minIoU.toFixed(2)}`);
    if (best.center < config.centerGate) gateReasons.push(`中心 ${fmtAutoPairMetric(best.center)} < ${config.centerGate.toFixed(2)}`);
    return {
      type: 'FP',
      side: sideLabel,
      globalIndex: prGlobal,
      text: `PR${prGlobal + 1}：最接近的 GT${gtGlobal + 1} 未通过门限（${gateReasons.join('，')}）`
    };
  }
  if (best.score < config.threshold) {
    return {
      type: 'FP',
      side: sideLabel,
      globalIndex: prGlobal,
      text: `PR${prGlobal + 1}：最佳 GT${gtGlobal + 1} 的综合分数 ${fmtAutoPairMetric(best.score)} < 阈值 ${config.threshold.toFixed(2)}（IoU ${fmtAutoPairMetric(best.iou)}，图像 ${fmtAutoPairMetric(best.patch)}）`
    };
  }
  const occupant = matchedByGt.get(best.gi);
  if (occupant) {
    return {
      type: 'FP',
      side: sideLabel,
      globalIndex: prGlobal,
      text: `PR${prGlobal + 1}：最佳 GT${gtGlobal + 1} 已被 PR${occupant.prGlobal + 1} 以更高分 ${fmtAutoPairMetric(occupant.score)} 占用`
    };
  }
  return { type: 'FP', side: sideLabel, globalIndex: prGlobal, text: `PR${prGlobal + 1}：一对一匹配后没有剩余 GT 可分配` };
}

export async function autoMatchSide(params, deps) {
  const { imgRelPath, gtBoxes, prBoxes, gtOffset = 0, prOffset = 0, sideLabel = 'Side', config = AUTO_PAIR_CONFIG } = params;
  const {
    loadImageForAutoPair,
    buildPatchStatsList,
    computePatchSimilarity,
    fmtAutoPairMetric,
  } = deps;

  const gtList = gtBoxes || [];
  const prList = prBoxes || [];
  const threshold = config.threshold;
  const img = await loadImageForAutoPair(imgRelPath);
  const gtPatchStats = buildPatchStatsList(img, gtList);
  const prPatchStats = buildPatchStatsList(img, prList);
  const candidates = [];
  const allPairs = [];
  const weights = config.weights;

  gtList.forEach((gt, gi) => {
    prList.forEach((pr, pi) => {
      const iou = computeBoxIoU(gt, pr);
      const center = computeCenterSimilarity(gt, pr);
      const size = computeSizeSimilarity(gt, pr);
      const patch = computePatchSimilarity(gtPatchStats[gi], prPatchStats[pi]);
      const score = weights.iou * iou + weights.center * center + weights.size * size + weights.patch * patch;
      const passesGate = iou >= config.minIoU || center >= config.centerGate;
      const pair = { gi, pi, iou, center, size, patch, score, passesGate };
      allPairs.push(pair);
      if (passesGate && score >= threshold) {
        candidates.push(pair);
      }
    });
  });

  candidates.sort(compareCandidates);

  const usedGt = new Set();
  const usedPr = new Set();
  const TP = [];
  const FN = [];
  const FP = [];
  const matches = [];

  candidates.forEach(c => {
    if (usedGt.has(c.gi)) return;
    if (!config.allowPrOneToMany && usedPr.has(c.pi)) return;
    usedGt.add(c.gi);
    usedPr.add(c.pi);
    TP.push({ GT: [gtOffset + c.gi], PR: [prOffset + c.pi] });
    matches.push({
      side: sideLabel,
      gtLocal: c.gi,
      prLocal: c.pi,
      gtGlobal: gtOffset + c.gi,
      prGlobal: prOffset + c.pi,
      iou: c.iou,
      center: c.center,
      size: c.size,
      patch: c.patch,
      score: c.score
    });
  });

  const matchedByPr = config.allowPrOneToMany ? new Map() : new Map(matches.map(item => [item.prLocal, item]));
  const matchedByGt = new Map(matches.map(item => [item.gtLocal, item]));
  const fnReasons = [];
  const fpReasons = [];

  gtList.forEach((_, gi) => {
    if (!usedGt.has(gi)) {
      FN.push({ GT: [gtOffset + gi], PR: [] });
      fnReasons.push(buildFnReason({
        sideLabel,
        gi,
        gtOffset,
        prOffset,
        prCount: prList.length,
        relatedPairs: allPairs.filter(item => item.gi === gi),
        config,
        matchedByPr,
        fmtAutoPairMetric,
      }));
    }
  });
  prList.forEach((_, pi) => {
    if (!usedPr.has(pi)) {
      FP.push({ GT: [], PR: [prOffset + pi] });
      fpReasons.push(buildFpReason({
        sideLabel,
        pi,
        gtOffset,
        prOffset,
        gtCount: gtList.length,
        relatedPairs: allPairs.filter(item => item.pi === pi),
        config,
        matchedByGt,
        fmtAutoPairMetric,
      }));
    }
  });

  return { TP, FN, FP, matches, fnReasons, fpReasons };
}

export async function buildAutoPairRecordForPatient(p, config, deps) {
  const {
    loadImageForAutoPair,
    buildPatchStatsList,
    computePatchSimilarity,
    formatGroupIndices,
    fmtAutoPairMetric,
    countPairItems,
  } = deps;
  const frontGt = p.gt?.front || [];
  const backGt = p.gt?.back || [];
  const frontPr = p.pred?.front || [];
  const backPr = p.pred?.back || [];
  const frontGtCount = frontGt.length;
  const frontPrCount = frontPr.length;

  const [frontImg, backImg] = await Promise.all([
    loadImageForAutoPair(p.images?.front),
    loadImageForAutoPair(p.images?.back)
  ]);

  const patchStats = {
    gt: {
      front: buildPatchStatsList(frontImg, frontGt),
      back: buildPatchStatsList(backImg, backGt)
    },
    pr: {
      front: buildPatchStatsList(frontImg, frontPr),
      back: buildPatchStatsList(backImg, backPr)
    }
  };

  const gtGroups = buildCrossViewGroups({
    frontBoxes: frontGt,
    backBoxes: backGt,
    frontOffset: 0,
    backOffset: frontGtCount,
    kind: 'GT',
    config
  });
  const prGroups = buildCrossViewGroups({
    frontBoxes: frontPr,
    backBoxes: backPr,
    frontOffset: 0,
    backOffset: frontPrCount,
    kind: 'PR',
    config
  });

  const weights = config.weights;
  const allPairs = [];
  const candidates = [];

  gtGroups.forEach((gtGroup, gi) => {
    prGroups.forEach((prGroup, pi) => {
      const iou = computeBoxIoU(gtGroup.repBox, prGroup.repBox);
      const center = computeCenterSimilarity(gtGroup.repBox, prGroup.repBox);
      const size = computeSizeSimilarity(gtGroup.repBox, prGroup.repBox);
      const patch = computeGroupPatchSimilarity(gtGroup, prGroup, patchStats, computePatchSimilarity);
      const score = weights.iou * iou + weights.center * center + weights.size * size + weights.patch * patch;
      const passesGate = iou >= config.minIoU || center >= config.centerGate;
      const item = { gi, pi, iou, center, size, patch, score, passesGate };
      allPairs.push(item);
      if (passesGate && score >= config.threshold) {
        candidates.push(item);
      }
    });
  });

  candidates.sort(compareCandidates);

  const usedGt = new Set();
  const usedPr = new Set();
  const selectedPairs = [];
  const TP = [];
  const FN = [];
  const FP = [];
  const matches = [];
  const fnReasons = [];
  const fpReasons = [];

  candidates.forEach(item => {
    if (usedGt.has(item.gi)) return;
    if (!config.allowPrOneToMany && usedPr.has(item.pi)) return;
    usedGt.add(item.gi);
    usedPr.add(item.pi);
    selectedPairs.push(item);

    const gtGroup = gtGroups[item.gi];
    const prGroup = prGroups[item.pi];
    TP.push({ GT: [...gtGroup.globalIndices], PR: [...prGroup.globalIndices] });
    matches.push({
      side: gtGroup.label === prGroup.label ? gtGroup.label : `${gtGroup.label} / ${prGroup.label}`,
      gtText: formatGroupIndices('GT', gtGroup.globalIndices),
      prText: formatGroupIndices('PR', prGroup.globalIndices),
      iou: item.iou,
      center: item.center,
      size: item.size,
      patch: item.patch,
      score: item.score
    });
  });

  const matchedByPr = config.allowPrOneToMany ? new Map() : new Map(selectedPairs.map(item => [item.pi, item]));
  const matchedByGt = new Map(selectedPairs.map(item => [item.gi, item]));

  gtGroups.forEach((group, gi) => {
    if (usedGt.has(gi)) return;
    FN.push({ GT: [...group.globalIndices], PR: [] });
    fnReasons.push(buildGroupedFnReason({
      group,
      relatedPairs: allPairs.filter(item => item.gi === gi),
      prGroups,
      gtGroups,
      config,
      matchedByPr,
      formatGroupIndices,
      fmtAutoPairMetric,
    }));
  });

  prGroups.forEach((group, pi) => {
    if (usedPr.has(pi)) return;
    FP.push({ GT: [], PR: [...group.globalIndices] });
    fpReasons.push(buildGroupedFpReason({
      group,
      relatedPairs: allPairs.filter(item => item.pi === pi),
      prGroups,
      gtGroups,
      config,
      matchedByGt,
      formatGroupIndices,
      fmtAutoPairMetric,
    }));
  });

  const record = { TP, FN, FP };
  const counts = countPairItems(record);

  return {
    record,
    preview: {
      patientId: p.patient_id,
      tp: counts.tp,
      fn: counts.fn,
      fp: counts.fp,
      matches: matches.sort((a, b) => (b.score - a.score) || (b.iou - a.iou)),
      fnReasons,
      fpReasons
    }
  };
}
