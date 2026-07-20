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
  document.querySelectorAll('button').forEach((changeButton) => {
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
    if (summary.textContent !== next) summary.textContent = next;
  });
}

function updateExerciseLibraryCount() {
  const heading = [...document.querySelectorAll("h2")].find((item) => cleanLabel(item.textContent).toLowerCase() === "exercise library");
  const container = heading?.closest("div.rounded-3xl");
  if (!container) return;

  const badge = [...container.querySelectorAll("div")].find((item) => /^\d+ exercises$/.test(cleanLabel(item.textContent)));
  if (!badge) return;

  const singleLegRows = [...container.querySelectorAll("div")].filter((row) => {
    const name = [...row.querySelectorAll("div")].find((item) => cleanLabel(item.textContent).toLowerCase().replace(/[-–—]/g, " ") === "single leg balance");
    return Boolean(name && row.querySelector("button"));
  });

  const hiddenSingleLegExists = singleLegRows.some((row) => row.style.display === "none" || row.getAttribute("aria-hidden") === "true");
  const shown = Number(cleanLabel(badge.textContent).match(/^\d+/)?.[0] || 0);
  const raw = Number(badge.dataset.rawExerciseCount || shown);

  if (!badge.dataset.rawExerciseCount || shown > raw) badge.dataset.rawExerciseCount = String(shown);
  const baseCount = Number(badge.dataset.rawExerciseCount || shown);
  const corrected = Math.max(0, baseCount - (hiddenSingleLegExists ? 1 : 0));
  const next = `${corrected} exercises`;
  if (badge.textContent !== next) badge.textContent = next;
}

function applySummaryAndCountFixes() {
  updateProgrammeSummarySides();
  updateExerciseLibraryCount();
}

new MutationObserver(applySummaryAndCountFixes).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
document.addEventListener("change", (event) => {
  if (event.target instanceof HTMLSelectElement) requestAnimationFrame(applySummaryAndCountFixes);
});
applySummaryAndCountFixes();
