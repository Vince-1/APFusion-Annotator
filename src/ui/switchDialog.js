export function createSwitchDialogController(documentRef = document) {
  let switchCallback = null;

  function show(pid, onSave, onDiscard, onCancel) {
    documentRef.getElementById("switchDialogMsg").textContent =
      `Patient "${pid}" has unsaved changes. Choose an action:`;
    documentRef.getElementById("switchDialog").style.display = "flex";
    switchCallback = { onSave, onDiscard, onCancel };
  }

  function hide() {
    documentRef.getElementById("switchDialog").style.display = "none";
    switchCallback = null;
  }

  async function onSaveClick() {
    const cb = switchCallback;
    hide();
    if (cb?.onSave) await cb.onSave();
  }

  function onDiscardClick() {
    const cb = switchCallback;
    hide();
    if (cb?.onDiscard) cb.onDiscard();
  }

  function onCancelClick() {
    const cb = switchCallback;
    hide();
    if (cb?.onCancel) cb.onCancel();
  }

  function bind() {
    documentRef.getElementById("btnSwitchSave").onclick = onSaveClick;
    documentRef.getElementById("btnSwitchDiscard").onclick = onDiscardClick;
    documentRef.getElementById("btnSwitchCancel").onclick = onCancelClick;
  }

  return {
    show,
    hide,
    bind,
  };
}
