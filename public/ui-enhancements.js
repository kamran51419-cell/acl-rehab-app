const modalRootId = "acl-ui-confirmation";
let programmeEditor = null;
let previousBodyOverflow = "";

function buttonText(button) {
  return button?.textContent?.replace(/\s+/g, " ").trim() || "";
}

function findProgrammeEditor() {
  const heading = [...document.querySelectorAll("h2")].find((item) => {
    const text = item.textContent?.trim();
    return text === "Edit programme" || text === "Create programme";
  });
  if (!heading) return null;
  return heading.closest("div.space-y-5.rounded-3xl") || heading.parentElement?.parentElement || null;
}

function sizeProgrammeEditor(editor) {
  const mobile = window.innerWidth < 640;
  Object.assign(editor.style, {
    position: "fixed",
    top: mobile ? "0" : "16px",
    right: mobile ? "0" : "16px",
    bottom: mobile ? "0" : "16px",
    left: mobile ? "0" : "16px",
    zIndex: "60",
    maxWidth: mobile ? "none" : "1120px",
    margin: "0 auto",
    overflowY: "auto",
    borderRadius: mobile ? "0" : "24px",
    boxShadow: "0 0 0 100vmax rgba(15, 23, 42, 0.55), 0 24px 60px rgba(15, 23, 42, 0.25)",
  });
}

function updateProgrammeEditorOverlay() {
  const editor = findProgrammeEditor();
  if (editor) {
    if (programmeEditor !== editor) {
      programmeEditor = editor;
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      editor.setAttribute("role", "dialog");
      editor.setAttribute("aria-modal", "true");
      const heading = editor.querySelector("h2");
      if (heading) {
        if (!heading.id) heading.id = "programme-editor-title";
        editor.setAttribute("aria-labelledby", heading.id);
      }
    }
    sizeProgrammeEditor(editor);
  } else if (programmeEditor) {
    document.body.style.overflow = previousBodyOverflow;
    programmeEditor = null;
  }
}

function closeConfirmation() {
  document.getElementById(modalRootId)?.remove();
}

function showDiscardConfirmation(discardButton) {
  closeConfirmation();

  const overlay = document.createElement("div");
  overlay.id = modalRootId;
  overlay.style.cssText = "position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.55);padding:16px";
  overlay.innerHTML = `
    <div role="dialog" aria-modal="true" aria-labelledby="discard-overview-title" style="width:100%;max-width:440px;border-radius:16px;background:white;padding:20px;box-shadow:0 24px 60px rgba(15,23,42,.3)">
      <h2 id="discard-overview-title" style="margin:0;font-size:1.125rem;font-weight:600;color:#0f172a">Discard workout?</h2>
      <p style="margin:8px 0 0;color:#475569;font-size:.9rem;line-height:1.5">This permanently deletes this unfinished workout. This cannot be undone.</p>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px;flex-wrap:wrap">
        <button type="button" data-confirm-cancel style="min-height:40px;border:1px solid #cbd5e1;border-radius:12px;background:white;padding:8px 16px;font-weight:600;color:#334155">Cancel</button>
        <button type="button" data-confirm-discard style="min-height:40px;border:1px solid #fecaca;border-radius:12px;background:#fef2f2;padding:8px 16px;font-weight:600;color:#b91c1c">Discard Workout</button>
      </div>
    </div>`;

  const cancel = overlay.querySelector("[data-confirm-cancel]");
  const confirm = overlay.querySelector("[data-confirm-discard]");

  cancel.addEventListener("click", closeConfirmation);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeConfirmation();
  });
  confirm.addEventListener("click", () => {
    closeConfirmation();
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    try {
      discardButton.click();
    } finally {
      window.confirm = originalConfirm;
    }
  });

  document.body.appendChild(overlay);
  cancel.focus();
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || buttonText(button) !== "Discard Workout") return;
  const overviewCard = button.closest("section.border-emerald-200");
  if (!overviewCard || document.getElementById(modalRootId)) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  showDiscardConfirmation(button);
}, true);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.getElementById(modalRootId)) closeConfirmation();
});

window.addEventListener("resize", () => {
  if (programmeEditor) sizeProgrammeEditor(programmeEditor);
});

new MutationObserver(updateProgrammeEditorOverlay).observe(document.documentElement, {
  childList: true,
  subtree: true,
});

updateProgrammeEditorOverlay();
