const PICKER_RETURN_KEY = "programme-picker-return-final-v1";
let restoreOpening = false;

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

function capturePickerReturn(event) {
  const button = event.target?.closest?.("button");
  if (text(button) !== "Manage Exercise Library") return;
  const session = button.closest('[id^="programme-session-"]');
  if (session?.id) sessionStorage.setItem(PICKER_RETURN_KEY, session.id);
}

function restorePicker() {
  if (restoreOpening || sessionStorage.getItem("programme-subview")) return;
  const sessionId = sessionStorage.getItem(PICKER_RETURN_KEY);
  if (!sessionId) return;
  const session = document.getElementById(sessionId);
  if (!session) return;

  const sessionToggle = session.querySelector('button[aria-label="Expand session"][aria-expanded="false"]');
  sessionToggle?.click();

  const picker = [...session.querySelectorAll('div.rounded-xl.border-dashed, [data-exercise-picker]')]
    .find((item) => /Exercise picker|Search exercises/i.test(text(item)));
  if (picker) {
    sessionStorage.removeItem(PICKER_RETURN_KEY);
    picker.scrollIntoView({ behavior: "auto", block: "center" });
    return;
  }

  const addExercise = [...session.querySelectorAll("button")].find((button) => text(button) === "Add exercise");
  if (!addExercise) return;
  restoreOpening = true;
  addExercise.click();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const opened = [...session.querySelectorAll('div.rounded-xl.border-dashed, [data-exercise-picker]')]
      .find((item) => /Exercise picker|Search exercises/i.test(text(item)));
    opened?.scrollIntoView({ behavior: "auto", block: "center" });
    sessionStorage.removeItem(PICKER_RETURN_KEY);
    restoreOpening = false;
  }));
}

function apply() {
  collapseEditProgramme();
  const heading = [...document.querySelectorAll("h2")].find((item) => text(item) === "Edit programme");
  const editor = editorFor(heading);
  if (editor) addExerciseCollapseControls(editor);
  restorePicker();
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
  document.addEventListener("click", capturePickerReturn, true);
  apply();
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    document.removeEventListener("click", capturePickerReturn, true);
  };
}
