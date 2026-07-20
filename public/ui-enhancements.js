const modalRootId = "acl-ui-confirmation";
let programmeEditor = null;
let previousBodyOverflow = "";
let bypassDiscardConfirmation = false;
let draggedWorkoutCard = null;

function buttonText(button) {
  return button?.textContent?.replace(/\s+/g, " ").trim() || "";
}

function normalisedText(element) {
  return element?.textContent?.replace(/\s+/g, " ").trim().toLowerCase() || "";
}

function normalisedName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[‐‑‒–—−-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findProgrammeEditor() {
  const heading = [...document.querySelectorAll("h2")].find((item) => {
    const text = item.textContent?.trim();
    return text === "Edit programme" || text === "Create programme";
  });
  if (!heading) return null;
  return heading.closest("div.rounded-3xl") || heading.parentElement?.parentElement || null;
}

function sizeProgrammeEditor(editor) {
  const mobile = window.matchMedia("(max-width: 639px)").matches;
  Object.assign(editor.style, {
    position: "fixed",
    inset: mobile ? "0" : "16px",
    zIndex: "80",
    width: mobile ? "100vw" : "auto",
    maxWidth: mobile ? "100vw" : "1120px",
    maxHeight: mobile ? "100dvh" : "calc(100vh - 32px)",
    margin: "0 auto",
    paddingBottom: mobile ? "max(20px, env(safe-area-inset-bottom))" : "",
    overflowX: "hidden",
    overflowY: "auto",
    borderRadius: mobile ? "0" : "24px",
    boxShadow: "0 0 0 100vmax rgba(15, 23, 42, 0.55), 0 24px 60px rgba(15, 23, 42, 0.25)",
    overscrollBehavior: "contain",
    WebkitOverflowScrolling: "touch",
  });
}

function raiseNativeDialogs() {
  document.querySelectorAll('div.fixed.inset-0 [role="dialog"]').forEach((dialog) => {
    const overlay = dialog.parentElement;
    if (overlay && !overlay.contains(programmeEditor)) overlay.style.zIndex = "120";
  });
}

function chevronSvg(collapsed) {
  return collapsed
    ? '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function setExerciseCollapsed(card, collapsed) {
  [...card.children].slice(1).forEach((child) => { child.hidden = collapsed; });
  card.dataset.exerciseCollapsed = collapsed ? "true" : "false";
  const button = card.querySelector("[data-collapse-exercise]");
  if (button) {
    button.innerHTML = chevronSvg(collapsed);
    button.setAttribute("aria-label", collapsed ? "Expand exercise" : "Collapse exercise");
    button.setAttribute("aria-expanded", collapsed ? "false" : "true");
  }
}

function tidyProgrammeExerciseCards(editor) {
  [...editor.querySelectorAll("button")]
    .filter((button) => buttonText(button) === "Change exercise")
    .forEach((changeButton) => {
      const card = changeButton.closest("div.rounded-xl.border.bg-white");
      if (!card) return;
      const actions = changeButton.parentElement;
      const header = actions?.parentElement;
      if (!actions || !header) return;

      [...actions.querySelectorAll("button")].forEach((button) => {
        if (buttonText(button) === "Duplicate") button.remove();
      });
      actions.style.display = "flex";
      actions.style.flexWrap = "nowrap";
      actions.style.gap = "6px";
      actions.style.marginLeft = "auto";
      [...actions.querySelectorAll("button")].forEach((button) => {
        button.style.whiteSpace = "nowrap";
        button.style.paddingLeft = "10px";
        button.style.paddingRight = "10px";
        button.style.fontSize = "0.75rem";
      });

      if (card.dataset.collapseReady !== "true") {
        const collapseButton = document.createElement("button");
        collapseButton.type = "button";
        collapseButton.dataset.collapseExercise = "true";
        collapseButton.className = "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100";
        collapseButton.innerHTML = chevronSvg(false);
        collapseButton.setAttribute("aria-label", "Collapse exercise");
        collapseButton.setAttribute("aria-expanded", "true");
        collapseButton.addEventListener("click", () => {
          setExerciseCollapsed(card, card.dataset.exerciseCollapsed !== "true");
        });
        header.insertBefore(collapseButton, actions);
        card.dataset.collapseReady = "true";
      }
    });
}

function allowRepeatedProgrammeExercises(editor) {
  [...editor.querySelectorAll("button")].forEach((button) => {
    if (buttonText(button) === "Selected") {
      button.disabled = false;
      button.textContent = "Add";
      button.classList.remove("opacity-50", "cursor-not-allowed");
    }
  });
}

function hideSingleLegBalance(root = document) {
  const candidates = [...root.querySelectorAll("div, article, li")].filter((element) => {
    const ownText = [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join(" ");
    const directText = normalisedName(ownText || element.firstElementChild?.textContent);
    return directText === "single leg balance";
  });

  candidates.forEach((nameElement) => {
    let row = nameElement;
    for (let depth = 0; depth < 5 && row; depth += 1, row = row.parentElement) {
      const action = [...row.querySelectorAll("button")].find((button) => ["Edit", "Add", "Selected", "Use"].includes(buttonText(button)));
      if (action) {
        row.style.display = "none";
        row.setAttribute("aria-hidden", "true");
        break;
      }
    }
  });
}

function removeStandardBothLabels(root = document) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const parent = node.parentElement;
    if (!parent || ["SCRIPT", "STYLE", "OPTION"].includes(parent.tagName)) return;
    const text = node.textContent || "";
    if (/^\s*\d+\s*[×x]\s*[^·]+\s+both\s*$/i.test(text)) {
      node.textContent = text.replace(/\s+both\s*$/i, "");
    }
  });
}

function preventPageZoom() {
  document.addEventListener("wheel", (event) => {
    if (event.ctrlKey) event.preventDefault();
  }, { passive: false });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && ["+", "=", "-", "0"].includes(event.key)) {
      event.preventDefault();
    }
  });

  ["gesturestart", "gesturechange", "gestureend"].forEach((type) => {
    document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
  });

  const style = document.createElement("style");
  style.textContent = `
    @media (max-width: 639px) {
      input, select, textarea { font-size: 16px !important; }
    }
    html, body { touch-action: pan-x pan-y; }
  `;
  document.head.appendChild(style);
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
    tidyProgrammeExerciseCards(editor);
    allowRepeatedProgrammeExercises(editor);
    hideSingleLegBalance(editor);
    removeStandardBothLabels(editor);
    raiseNativeDialogs();
  } else if (programmeEditor) {
    document.body.style.overflow = previousBodyOverflow;
    programmeEditor = null;
  }
  hideSingleLegBalance();
  removeStandardBothLabels();
  enhanceWorkoutDragging();
}

function closeConfirmation() {
  document.getElementById(modalRootId)?.remove();
}

function showDiscardConfirmation(discardButton) {
  closeConfirmation();
  const overlay = document.createElement("div");
  overlay.id = modalRootId;
  overlay.style.cssText = "position:fixed;inset:0;z-index:140;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.55);padding:16px";
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
  overlay.addEventListener("click", (event) => { if (event.target === overlay) closeConfirmation(); });
  confirm.addEventListener("click", () => {
    closeConfirmation();
    bypassDiscardConfirmation = true;
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    discardButton.click();
    window.setTimeout(() => {
      window.confirm = originalConfirm;
      bypassDiscardConfirmation = false;
    }, 0);
  });
  document.body.appendChild(overlay);
  cancel.focus();
}

function workoutTopLevelCards() {
  const heading = [...document.querySelectorAll("p")].find((item) => normalisedText(item).startsWith("workout in progress"));
  const workoutSection = heading?.closest("section.rounded-3xl");
  if (!workoutSection) return [];
  const notes = [...workoutSection.querySelectorAll("label")].find((label) => normalisedText(label).startsWith("workout notes"));
  const exerciseContainer = notes?.previousElementSibling;
  return exerciseContainer ? [...exerciseContainer.children] : [];
}

function workoutMoveButtons(card) {
  const header = card.firstElementChild;
  const buttons = header ? [...header.querySelectorAll(":scope button")] : [];
  return { up: buttons[0], down: buttons[1] };
}

function moveDraggedCardToward(targetCard) {
  const cards = workoutTopLevelCards();
  const from = cards.indexOf(draggedWorkoutCard);
  const to = cards.indexOf(targetCard);
  if (from < 0 || to < 0 || from === to) return;
  const direction = from < to ? "down" : "up";
  const steps = Math.abs(to - from);
  let remaining = steps;
  const advance = () => {
    if (!draggedWorkoutCard || remaining <= 0) return;
    const button = workoutMoveButtons(draggedWorkoutCard)[direction];
    if (!button || button.disabled) return;
    button.click();
    remaining -= 1;
    requestAnimationFrame(advance);
  };
  advance();
}

function enhanceWorkoutDragging() {
  workoutTopLevelCards().forEach((card) => {
    if (card.dataset.workoutDragReady === "true") return;
    const header = card.firstElementChild;
    const { up, down } = workoutMoveButtons(card);
    if (!header || !up || !down) return;

    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "mr-1 flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100";
    handle.setAttribute("aria-label", "Drag to reorder exercise");
    handle.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="9" cy="6" r="1.5" fill="currentColor"/><circle cx="15" cy="6" r="1.5" fill="currentColor"/><circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/><circle cx="9" cy="18" r="1.5" fill="currentColor"/><circle cx="15" cy="18" r="1.5" fill="currentColor"/></svg>';
    handle.draggable = true;
    handle.addEventListener("dragstart", (event) => {
      draggedWorkoutCard = card;
      card.style.opacity = "0.55";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", "workout-exercise");
    });
    handle.addEventListener("dragend", () => {
      card.style.opacity = "";
      draggedWorkoutCard = null;
    });
    card.addEventListener("dragover", (event) => {
      if (!draggedWorkoutCard) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    card.addEventListener("drop", (event) => {
      if (!draggedWorkoutCard) return;
      event.preventDefault();
      moveDraggedCardToward(card);
    });
    header.insertBefore(handle, header.firstChild);
    up.style.display = "none";
    down.style.display = "none";
    card.dataset.workoutDragReady = "true";
  });
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || buttonText(button) !== "Discard Workout") return;
  const overviewCard = button.closest("section.border-emerald-200");
  if (!overviewCard) return;
  if (bypassDiscardConfirmation) return;
  if (document.getElementById(modalRootId)) return;
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

preventPageZoom();
updateProgrammeEditorOverlay();