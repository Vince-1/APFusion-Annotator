export function setPairStatus(message, doc = document) {
  const el = doc.getElementById("pairStatus");
  if (!el) return;
  el.textContent = message || "";
}

export function setSaveStatus(message, ok = true, doc = document) {
  const el = doc.getElementById("saveStatus");
  if (!el) return;
  el.classList.remove("ok", "err");
  el.classList.add(ok ? "ok" : "err");
  el.textContent = message || "";
}
