export function getBackendBase(win = window) {
  const hostname = win.location.hostname || "127.0.0.1";
  const protocol = win.location.protocol || "http:";
  return `${protocol}//${hostname}:5000`;
}

export function updateApiStatus(ok, text, doc = document) {
  const el = doc.getElementById("apiStatus");
  if (!el) return;
  el.classList.remove("online", "offline");
  el.classList.add(ok ? "online" : "offline");
  el.textContent = `API: ${text}`;
}

export async function checkBackendHealth(options = {}, deps = {}) {
  const {
    fetchImpl = fetch,
    doc = document,
    win = window,
    setPairStatus = () => {},
  } = deps;
  const { silent = false } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetchImpl(`${getBackendBase(win)}/api/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      updateApiStatus(false, `offline (${res.status})`, doc);
      return { ok: false, message: `HTTP ${res.status}` };
    }
    updateApiStatus(true, "online", doc);
    if (!silent) setPairStatus("Backend API is online");
    return { ok: true, message: "ok" };
  } catch (e) {
    clearTimeout(timer);
    updateApiStatus(false, "offline", doc);
    return { ok: false, message: e?.message || "unreachable" };
  }
}

export async function saveStatsPayloadToBackend(statsPath, payload, deps = {}) {
  const {
    fetchImpl = fetch,
    win = window,
  } = deps;
  const url = `${getBackendBase(win)}/api/save-json`;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      json_path: statsPath,
      stats: payload,
    }),
  });
  let result = {};
  try {
    result = await response.json();
  } catch {
    result = {};
  }
  if (!response.ok) {
    const msg = result.error || `HTTP ${response.status}`;
    throw new Error(msg);
  }
  return result;
}
