export function setUndoButtonState(state, documentRef = document) {
  const btn = documentRef.getElementById("btnUndoAutoPair");
  if (!btn) return;
  const hasUndo = !!state.autoPairUndo;
  btn.disabled = !hasUndo;
  btn.title = hasUndo
    ? "恢复到上一次自动配对之前的状态"
    : "当前没有可撤销的自动配对";
}

export function renderAutoPairPreview(state, deps) {
  const { documentRef = document, escapeHtml, setUndoButtonStateFn } = deps;
  const el = documentRef.getElementById("autoPairPreview");
  if (!el) return;
  const preview = state.autoPairPreview;
  if (!preview) {
    el.classList.remove("show");
    el.innerHTML = "";
    setUndoButtonStateFn();
    return;
  }

  const current = preview.patients?.[state.selectedPid] || null;
  let html = `<div class="auto-pair-preview-title">${escapeHtml(preview.title || "最近一次自动配对预览")}</div>`;

  if (preview.totals) {
    html += `<div class="auto-pair-preview-summary">
      <span>TP ${preview.totals.tp}</span>
      <span>FN ${preview.totals.fn}</span>
      <span>FP ${preview.totals.fp}</span>
      ${typeof preview.totals.patients === "number" ? `<span>病人数 ${preview.totals.patients}</span>` : ""}
    </div>`;
  }

  if (current) {
    html += `<div class="auto-pair-preview-subtitle">当前病人：${escapeHtml(current.patientId)}</div>`;
    html += `<div class="auto-pair-preview-summary">
      <span>TP ${current.tp}</span>
      <span>FN ${current.fn}</span>
      <span>FP ${current.fp}</span>
    </div>`;
    const matches = current.matches || [];
    if (matches.length) {
      html += `<div class="auto-pair-preview-subtitle">TP 匹配详情</div>`;
      html += `<div class="auto-pair-preview-list">` + matches.slice(0, 10).map((m) => `
        <div class="auto-pair-preview-item">
          <strong>${escapeHtml(m.side || "聚合")}</strong> ${escapeHtml(m.gtText || `GT${m.gtGlobal + 1}`)} ↔ ${escapeHtml(m.prText || `PR${m.prGlobal + 1}`)}
          · 分数 ${m.score.toFixed(3)}
          <br />IoU ${m.iou.toFixed(3)} · 中心 ${m.center.toFixed(3)} · 尺寸 ${m.size.toFixed(3)} · 图像 ${m.patch.toFixed(3)}
        </div>
      `).join("") + `</div>`;
      if (matches.length > 10) {
        html += `<div class="auto-pair-preview-note">仅显示前 10 条 / 共 ${matches.length} 条 TP 匹配结果。</div>`;
      }
    } else {
      html += `<div class="auto-pair-preview-note">当前病人没有任何 TP 匹配达到阈值。</div>`;
    }

    const fnReasons = current.fnReasons || [];
    if (fnReasons.length) {
      html += `<div class="auto-pair-preview-subtitle">FN 原因说明</div>`;
      html += `<div class="auto-pair-preview-list">` + fnReasons.slice(0, 6).map((item) => `
        <div class="auto-pair-preview-item">
          <strong>${escapeHtml(item.side)} FN</strong>
          <br />${escapeHtml(item.text)}
        </div>
      `).join("") + `</div>`;
      if (fnReasons.length > 6) {
        html += `<div class="auto-pair-preview-note">仅显示前 6 条 / 共 ${fnReasons.length} 条 FN 原因。</div>`;
      }
    }

    const fpReasons = current.fpReasons || [];
    if (fpReasons.length) {
      html += `<div class="auto-pair-preview-subtitle">FP 原因说明</div>`;
      html += `<div class="auto-pair-preview-list">` + fpReasons.slice(0, 6).map((item) => `
        <div class="auto-pair-preview-item">
          <strong>${escapeHtml(item.side)} FP</strong>
          <br />${escapeHtml(item.text)}
        </div>
      `).join("") + `</div>`;
      if (fpReasons.length > 6) {
        html += `<div class="auto-pair-preview-note">仅显示前 6 条 / 共 ${fpReasons.length} 条 FP 原因。</div>`;
      }
    }
  } else if (preview.samples?.length) {
    html += `<div class="auto-pair-preview-subtitle">示例病人</div>`;
    html += `<div class="auto-pair-preview-list">` + preview.samples.map((item) => `
      <div class="auto-pair-preview-item">
        <strong>${escapeHtml(item.patientId)}</strong>
        · TP ${item.tp} · FN ${item.fn} · FP ${item.fp}
      </div>
    `).join("") + `</div>`;
  } else {
    html += `<div class="auto-pair-preview-note">请选择病人查看最近一次自动配对结果。</div>`;
  }

  el.classList.add("show");
  el.innerHTML = html;
  setUndoButtonStateFn();
}

export function toggleConflictActions(show, documentRef = document) {
  const el = documentRef.getElementById("conflictActions");
  if (!el) return;
  el.classList.toggle("show", !!show);
}

export function currentDisplayPair(state) {
  if (state.pendingConflict && state.previewPair.mode) return state.previewPair;
  return state.activePair;
}

export function renderConflictList(state, deps) {
  const { documentRef = document, focusConflictPair } = deps;
  const el = documentRef.getElementById("conflictList");
  if (!el) return;
  const pending = state.pendingConflict;
  if (!pending || !pending.conflicts || !pending.conflicts.length) {
    el.classList.remove("show");
    el.innerHTML = "";
    return;
  }
  const focus = state.previewPair;
  el.classList.add("show");
  el.innerHTML = "";
  pending.conflicts.forEach((c) => {
    const item = documentRef.createElement("div");
    const active = focus.mode === c.mode && focus.index === c.idx;
    item.className = "conflict-item" + (active ? " active" : "");
    item.textContent = `${c.mode}#${c.idx + 1} GT:[${c.gtOverlap.join(",")}] PR:[${c.prOverlap.join(",")}]`;
    item.onclick = () => focusConflictPair(c.mode, c.idx);
    el.appendChild(item);
  });
}

export function renderPairList(state, deps) {
  const { documentRef = document, getPairRecord, currentDisplayPairFn, selectPairAt, deletePairAt } = deps;
  const el = documentRef.getElementById("pairList");
  if (!el) return;
  if (!state.editMode) {
    el.innerHTML = '<div class="pair-item">Mode off</div>';
    return;
  }
  const rec = getPairRecord();
  const rows = rec[state.editMode] || [];
  if (!rows.length) {
    el.innerHTML = `<div class="pair-item">${state.editMode} list is empty</div>`;
    return;
  }
  el.innerHTML = "";
  const display = currentDisplayPairFn();
  rows.forEach((it, i) => {
    const row = documentRef.createElement("div");
    const isActive = display.mode === state.editMode && display.index === i;
    row.className = "pair-item" + (isActive ? " active" : "");
    const txt = documentRef.createElement("span");
    txt.textContent = `#${i + 1} GT:[${it.GT.join(",")}] PR:[${it.PR.join(",")}]`;
    const del = documentRef.createElement("button");
    del.textContent = "Delete";
    row.onclick = () => selectPairAt(i);
    del.onclick = (ev) => {
      ev.stopPropagation();
      deletePairAt(i);
    };
    row.appendChild(txt);
    row.appendChild(del);
    el.appendChild(row);
  });
}

export function draftKeySet(state) {
  const out = new Set();
  state.draft.gt.forEach((i) => out.add(`GT-${i}`));
  state.draft.pr.forEach((i) => out.add(`PR-${i}`));
  return out;
}

export function activePairKeySet(state, getPairRecord, currentDisplayPairFn) {
  const out = new Set();
  const display = currentDisplayPairFn();
  const mode = display.mode;
  const idx = display.index;
  if (!mode || idx < 0) return out;
  const rec = getPairRecord();
  const rows = rec[mode] || [];
  if (idx >= rows.length) return out;
  const item = rows[idx] || { GT: [], PR: [] };
  (item.GT || []).forEach((i) => out.add(`GT-${i}`));
  (item.PR || []).forEach((i) => out.add(`PR-${i}`));
  return out;
}
