export function createInitialState() {
  return {
    dataset: null,
    patients: [],
    selectedPid: null,
    invertDisplay: true,
    recallSort: null,
    fnSort: null,
    recallFilter: null,
    fnFilter: null,
    records: {},
    viewerStates: { all: null },
    editMode: null,
    draft: { gt: [], pr: [] },
    pairRecords: {},
    activePair: { mode: null, index: -1 },
    pendingConflict: null,
    previewPair: { mode: null, index: -1 },
    dirtyPatients: {},
    autoPairPreview: null,
    autoPairUndo: null,
  };
}

export const state = createInitialState();
