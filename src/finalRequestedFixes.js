function text(element) {
  return (element?.textContent || "").trim();
}

function editorFor(element) {
  return element?.closest?.('[data-final-programme-editor="true"], .space-y-5.rounded-3xl.border') || null;
}

function directChildren(element) {
  return [...(element?.children || [])];
}

function addExerciseCollapseControls(editor) {
  editor.querySelectorAll('[id^="programme-session-"]').forEach((session) => {
    const exerciseArea = directChildren(session)[1];
    if (!exerciseArea) return;
    directChildren(exerciseArea).forEach((card) => {
      if (card.dataset.finalExerciseCollapse === "true") return;
      const change = [...card.querySelectorAll("button")].find((button) => text(button) === "Change exercise");
      const header = directChildren(card)[0];
      const drag = header?.querySelector('button[aria-label^="Drag "]');
      if (!change || !header || !drag) return;

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-800";
      toggle.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

      const setCollapsed = (collapsed) => {
        directChildren(card).slice(1).forEach((child) => { child.hidden = collapsed; });
        card.dataset.finalExerciseCollapsed = collapsed ? "true" : "false";
        toggle.style.transform = collapsed ? "rotate(-90deg)" : "rotate(0deg)";
        toggle.setAttribute("aria-label", collapsed ? "Expand exercise" : "Collapse exercise");
        toggle.setAttribute("aria-expanded", String(!collapsed));
      };

      toggle.addEventListener("click", () => setCollapsed(card.dataset.finalExerciseCollapsed !== "true"));
      drag.before(toggle);
      card.dataset.finalExerciseCollapse = "true";
      setCollapsed(true);
    });
  });
}

function collapseEditProgramme() {
  const heading = [...document.querySelectorAll("h2")].find((item) => text(item) === "Edit programme");
  const editor = editorFor(heading);
  if (!editor || editor.dataset.finalInitialCollapse === "true") return;
  addExerciseCollapseControls(editor);
  editor.querySelectorAll('button[aria-label="Collapse session"][aria-expanded="true"]').forEach((button) => button.click());
  editor.dataset.finalInitialCollapse = "true";
}

function selectorInSession(session) {
  return [...(session?.querySelectorAll('div.rounded-xl.border-dashed, [data-exercise-picker]') || [])]
    .find((item) => /Exercise (picker|selector)|Search exercises/i.test(text(item))) || null;
}

function renameExerciseSelector() {
  [...document.querySelectorAll("strong")].forEach((heading) => {
    if (text(heading) === "Exercise picker") heading.textContent = "Exercise selector";
  });
}

function smoothScrollToSelector(event) {
  const button = event.target?.closest?.("button");
  if (!button || !["Add exercise", "Change exercise"].includes(text(button))) return;
  const session = button.closest('[id^="programme-session-"]');
  if (!session) return;

  const scroll = () => {
    const selector = selectorInSession(session);
    if (!selector) return false;
    selector.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    return true;
  };

  if (scroll()) return;
  const observer = new MutationObserver(() => {
    if (!scroll()) return;
    observer.disconnect();
  });
  observer.observe(session, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 350);
}

function styleExerciseSaveButtons() {
  [...document.querySelectorAll('[role="dialog"]')].forEach((dialog) => {
    const heading = [...dialog.querySelectorAll("h1, h2, h3")].find((item) => ["Add exercise", "Edit exercise"].includes(text(item)));
    if (!heading) return;
    [...dialog.querySelectorAll("button")].forEach((button) => {
      if (!["Add exercise", "Save", "Saving…"].includes(text(button))) return;
      button.style.setProperty("background", "#2563eb", "important");
      button.style.setProperty("background-image", "none", "important");
      button.style.setProperty("color", "#ffffff", "important");
      button.style.setProperty("border-color", "#2563eb", "important");
    });
  });
}

function apply() {
  collapseEditProgramme();
  const heading = [...document.querySelectorAll("h2")].find((item) => text(item) === "Edit programme");
  const editor = editorFor(heading);
  if (editor) addExerciseCollapseControls(editor);
  renameExerciseSelector();
  styleExerciseSaveButtons();
}

export function installFinalRequestedFixes() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  };
  document.addEventListener("click", smoothScrollToSelector, false);
  apply();
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    document.removeEventListener("click", smoothScrollToSelector, false);
  };
}