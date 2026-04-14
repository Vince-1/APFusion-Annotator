export async function loadData(path, deps = {}) {
  const {
    fetchImpl = fetch,
    onDataLoaded = () => {},
  } = deps;
  if (!path) return null;
  const res = await fetchImpl(path);
  if (!res.ok) throw new Error(`Load data failed: ${res.status}`);
  const data = await res.json();
  onDataLoaded(data);
  return data;
}

export async function loadStats(path, deps = {}) {
  const {
    fetchImpl = fetch,
    onStatsLoaded = () => {},
  } = deps;
  if (!path) return null;
  const res = await fetchImpl(path);
  if (!res.ok) throw new Error(`Load stats failed: ${res.status}`);
  const data = await res.json();
  onStatsLoaded(data || {});
  return data || {};
}

export async function loadSelectedDataset(dataPath, statsPath, deps = {}) {
  await loadData(dataPath, deps);
  await loadStats(statsPath, deps);
}
