function cleanLabel(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sideSuffix(label) {
  const value = cleanLabel(label).toLowerCase();
  if (value === "left & right") return "both";
  if (value === "left only") return "left";
  if (value === "right only") return "right";
  return "";
}

function updateProgrammeSummarySides() {
  document.querySelectorAll("button").forEach((changeButton) => {
    if (cleanLabel(changeButton.textContent) !== "Change exercise") return;
    const card = changeButton.closest("div.rounded-xl.border.bg-white");
    if (!card) return;

    const sideLabel = [...card.querySelectorAll("label")].find((label) => cleanLabel(label.firstChild?.textContent || label.textContent).startsWith("Side"));
    const sideSelect = sideLabel?.querySelector("select");
    if (!sideSelect) return;

    const header = card.firstElementChild;
    const titleBlock = header?.querySelector(".font-semibold")?.parentElement;
    const summary = titleBlock?.querySelector(".text-sm.text-slate-500");
    if (!summary) return;

    const base = cleanLabel(summary.textContent).replace(/\s+(both|left|right)$/i, "");
    const suffix = sideSuffix(sideSelect.options[sideSelect.selectedIndex]?.textContent);
    const next = suffix ? `${base} ${suffix}` : base;
    if (cleanLabel(summary.textContent) !== next) summary.textContent = next;
  });
}

function updateExerciseLibraryCount() {
  const heading = [...document.querySelectorAll("h2")].find((item) => cleanLabel(item.textContent).toLowerCase() === "exercise library");
  const container = heading?.closest("div.rounded-3xl");
  if (!container) return;

  const badge = [...container.querySelectorAll("div")].find((item) => /^\d+ exercises$/.test(cleanLabel(item.textContent)));
  if (!badge) return;

  const hiddenSingleLegExists = [...container.querySelectorAll("div, article, li")].some((row) => {
    const text = cleanLabel(row.textContent).toLowerCase().replace(/[-–—]/g, " ");
    return text.includes("single leg balance") && (row.style.display === "none" || row.getAttribute("aria-hidden") === "true");
  });

  const shown = Number(cleanLabel(badge.textContent).match(/^\d+/)?.[0] || 0);
  if (!badge.dataset.rawExerciseCount) badge.dataset.rawExerciseCount = String(shown);
  const raw = Math.max(Number(badge.dataset.rawExerciseCount || shown), shown);
  badge.dataset.rawExerciseCount = String(raw);
  const corrected = Math.max(0, raw - (hiddenSingleLegExists ? 1 : 0));
  const next = `${corrected} exercises`;
  if (cleanLabel(badge.textContent) !== next) badge.textContent = next;
}

function rememberProgrammeName() {
  const heading = [...document.querySelectorAll("h2")].find((item) => cleanLabel(item.textContent) === "Programme Workout");
  const name = cleanLabel(heading?.nextElementSibling?.textContent);
  if (name) localStorage.setItem("acl-current-programme-name", name);
}

function updateWorkoutProgrammeLabel() {
  const status = [...document.querySelectorAll("p")].find((item) => cleanLabel(item.textContent).startsWith("Workout in progress ·"));
  if (!status || !cleanLabel(status.textContent).endsWith("Programme Workout")) return;
  const programmeName = localStorage.getItem("acl-current-programme-name");
  if (programmeName) status.textContent = `Workout in progress · ${programmeName}`;
}

function workoutTabButton() {
  return [...document.querySelectorAll("button")].find((button) => cleanLabel(button.textContent) === "Workout");
}

function keepWorkoutTabAfterDiscard() {
  const confirm = document.querySelector("[data-confirm-discard]");
  if (confirm && confirm.dataset.keepWorkoutReady !== "true") {
    confirm.dataset.keepWorkoutReady = "true";
    confirm.addEventListener("click", () => {
      window.setTimeout(() => workoutTabButton()?.click(), 250);
    });
  }

  const nativeDialogButtons = [...document.querySelectorAll('[role="dialog"] button')];
  nativeDialogButtons.forEach((button) => {
    if (cleanLabel(button.textContent) !== "Discard Workout" || button.dataset.keepWorkoutReady === "true") return;
    button.dataset.keepWorkoutReady = "true";
    button.addEventListener("click", () => {
      window.setTimeout(() => workoutTabButton()?.click(), 250);
    });
  });
}

function applySummaryAndCountFixes() {
  updateProgrammeSummarySides();
  updateExerciseLibraryCount();
  rememberProgrammeName();
  updateWorkoutProgrammeLabel();
  keepWorkoutTabAfterDiscard();
}

new MutationObserver(applySummaryAndCountFixes).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
document.addEventListener("change", (event) => {
  if (event.target instanceof HTMLSelectElement) requestAnimationFrame(applySummaryAndCountFixes);
});
applySummaryAndCountFixes();
