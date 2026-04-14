export function makePointFromMouse(event, canvas, cssScale = null) {
  const rect = canvas.getBoundingClientRect();
  const scale = cssScale || canvas.width / rect.width;
  return {
    x: (event.clientX - rect.left) / scale,
    y: (event.clientY - rect.top) / scale,
  };
}

export function handleHoverEvent(params, deps) {
  const { event, canvas, key } = params;
  const {
    state,
    renderViewerCanvas,
    hideTooltip,
    documentRef = document,
  } = deps;

  const vs = state.viewerStates[key];
  if (!vs) return;
  const blocked = vs.nonSelectableKeys || new Set();
  const point = makePointFromMouse(event, canvas, vs.csScale || null);
  const x = point.x;
  const y = point.y;
  const boxHits = (vs.boxItems || []).filter(it => !blocked.has(it.key) && x >= it.x1 && x <= it.x2 && y >= it.y1 && y <= it.y2);
  const labelSource = vs.labelItems || [...(vs.gtLabels || []), ...(vs.prLabels || [])];
  const labelHits = labelSource
    .filter(lb => !blocked.has(lb.key) && lb.hitbox && x >= lb.hitbox.x1 && x <= lb.hitbox.x2 && y >= lb.hitbox.y1 && y <= lb.hitbox.y2)
    .map(lb => ({ key: lb.key, text: lb.text }));

  const hitMap = new Map();
  [...boxHits, ...labelHits].forEach(h => {
    if (!hitMap.has(h.key)) hitMap.set(h.key, h);
  });
  const hits = Array.from(hitMap.values());

  if (!hits.length) {
    vs.hoveredKeys = new Set();
    if (typeof vs.renderFn === "function") {
      vs.renderFn(vs.hoveredKeys);
    } else {
      renderViewerCanvas(vs, vs.hoveredKeys);
    }
    hideTooltip();
    return;
  }

  vs.hoveredKeys = new Set(hits.map(h => h.key));
  if (typeof vs.renderFn === "function") {
    vs.renderFn(vs.hoveredKeys);
  } else {
    renderViewerCanvas(vs, vs.hoveredKeys);
  }

  const t = documentRef.getElementById("tooltip");
  t.style.display = "block";
  t.textContent = hits.map(h => h.text).join("\n");
  t.style.left = `${event.clientX + 12}px`;
  t.style.top = `${event.clientY + 12}px`;
}

export function handleSelectEvent(params, deps) {
  const { event, canvas, key } = params;
  const {
    state,
    setDraftKeysUnified,
  } = deps;

  if (!state.editMode) return;
  const vs = state.viewerStates[key];
  if (!vs) return;
  const blocked = vs.nonSelectableKeys || new Set();
  const point = makePointFromMouse(event, canvas, vs.csScale || null);
  const x = point.x;
  const y = point.y;

  const boxHits = (vs.boxItems || [])
    .filter(it => !blocked.has(it.key) && x >= it.x1 && x <= it.x2 && y >= it.y1 && y <= it.y2)
    .map(it => it.key);
  const labelSource = vs.labelItems || [...(vs.gtLabels || []), ...(vs.prLabels || [])];
  const labelHits = labelSource
    .filter(lb => !blocked.has(lb.key) && lb.hitbox && x >= lb.hitbox.x1 && x <= lb.hitbox.x2 && y >= lb.hitbox.y1 && y <= lb.hitbox.y2)
    .map(lb => lb.key);

  const keys = Array.from(new Set([...boxHits, ...labelHits]));
  setDraftKeysUnified(keys);
}
