export function buildPair(mode, draft) {
  return {
    mode,
    GT: [...(draft?.gt || [])],
    PR: [...(draft?.pr || [])],
  };
}

export function buildAutoPairUndoSnapshot({
  scope,
  pids,
  state,
  cloneJson,
  getPairRecord,
  countPairItems,
}) {
  const uniquePids = Array.from(new Set((pids || []).filter(Boolean)));
  const pairRecords = {};
  const records = {};
  uniquePids.forEach((pid) => {
    pairRecords[pid] = cloneJson(getPairRecord(pid));
    records[pid] = cloneJson(state.records[pid] || countPairItems(pairRecords[pid]));
  });
  return {
    scope,
    pids: uniquePids,
    selectedPid: state.selectedPid,
    pairRecords,
    records,
    dirtyPatients: cloneJson(state.dirtyPatients || {}),
  };
}

export function applyAutoPairRecordToState(state, pid, nextRecord, cloneJson) {
  state.pairRecords[pid] = cloneJson(nextRecord);
  state.records[pid] = {
    tp: nextRecord.TP.length,
    fn: nextRecord.FN.length,
    fp: nextRecord.FP.length,
  };
  state.dirtyPatients[pid] = true;
}

export function buildAutoPairPreviewCurrent(pid, preview) {
  return {
    scope: 'current',
    title: `最近一次自动配对预览 · ${pid}`,
    totals: { patients: 1, tp: preview.tp, fn: preview.fn, fp: preview.fp },
    patients: { [pid]: preview },
    samples: [preview],
  };
}

export function buildAutoPairPreviewAll(patientsCount, totalTP, totalFN, totalFP, results) {
  return {
    scope: 'all',
    title: '最近一次自动配对预览 · 全部已加载病人',
    totals: { patients: patientsCount, tp: totalTP, fn: totalFN, fp: totalFP },
    patients: Object.fromEntries(results.map((item) => [item.pid, item.preview])),
    samples: results.slice(0, 6).map((item) => item.preview),
  };
}

export function buildAutoPairMergeModeText(config) {
  const prMergeText = config.disableSameViewPrMerge ? '未启用 PR 同视图聚合' : '已做 PR 同视图聚合';
  const fbMergeText = config.disableCrossViewMerge ? '未启用前后聚合' : '已做前后同灶聚合';
  return `${prMergeText}，${fbMergeText}`;
}
