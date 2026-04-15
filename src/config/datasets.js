// DATASET_PRESETS and findPresetByPaths
// Extracted from apfusion_viewer.html (Phase 1)

export const DATASET_PRESETS = [
  {
    id: "1982dual_bestrecall_train_20260413",
    label: "1982 Dual BestRecall Train (20260413)",
    dataPath: "./prediction/1982dual_bestrecall_train_20260413/data.json",
    statsPath: "./prediction/1982dual_bestrecall_train_20260413/stats.json"
  },
  {
    id: "1982dual_newfusion_20260413",
    label: "1982 Dual NewFusion (20260413)",
    dataPath: "./prediction/1982dual_newfusion_20260413/data.json",
    statsPath: "./prediction/1982dual_newfusion_20260413/stats.json"
  },
  {
    id: "1982dual_existing_best",
    label: "1982 Dual Existing Best",
    dataPath: "./prediction/1982dual_existing_best/data.json",
    statsPath: "./prediction/1982dual_existing_best/stats.json"
  },
  {
    id: "APFusion31",
    label: "APFusion31",
    dataPath: "./prediction/APFusion31/data.json",
    statsPath: "./prediction/APFusion31/stats.json"
  },
  {
    id: "1475single",
    label: "1475 Single",
    dataPath: "./prediction/1475single/data.json",
    statsPath: "./prediction/1475single/stats.json"
  }
];


export function findPresetByPaths(dataPath, statsPath) {
  return DATASET_PRESETS.find(p => p.dataPath === dataPath && p.statsPath === statsPath) || null;
}

