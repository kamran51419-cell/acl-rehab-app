(() => {
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();

  function sideSuffix(select) {
    const value = select?.value;
    if (value === "separate") return "both";
    if (value === "left") return "left";
    if (value === "right") return "right";
    return "";
  }

  function fixProgrammeSummaries(root = document) {
    root.querySelectorAll("button").forEach((changeButton) => {
      if (clean(changeButton.textContent) !== "Change exercise") return;
      const card = changeButton.closest("div.rounded-xl.border.bg-white");
      if (!card) return;

      const sideSelect = [...card.querySelectorAll("label")]
        .find((label) => clean(label.textContent).startsWith("Side"))
        ?.querySelector("select");
      if (!sideSelect) return;

      const header = card.firstElementChild;
      const title = header?.querySelector(".font-semibold");
      const summary = title?.parentElement?.querySelector(".text-sm.text-slate-500");
      if (!summary) return;

      const base = clean(summary.textContent).replace(/\s+(both|left|right)$/i, "");
      const suffix = sideSuffix(sideSelect);
      const expected = suffix ? `${base} ${suffix}` : base;
      if (clean(summary.textContent) !== expected) summary.textContent = expected;
    });
  }

  function fixExerciseCount(root = document) {
    const heading = [...root.querySelectorAll("h2")]
      .find((item) => clean(item.textContent).toLowerCase() === "exercise library");
    const card = heading?.closest("div.rounded-3xl");
    if (!card) return;

    const badge = [...card.querySelectorAll("div")]
      .find((item) => /^\d+ exercises$/.test(clean(item.textContent)));
    if (!badge) return;

    const list = [...card.querySelectorAll("button")]
      .filter((button) => clean(button.textContent) === "Edit")
      .map((button) => button.closest("div.flex.items-center.justify-between"))
      .filter(Boolean)
      .filter((row) => row.style.display !== "none" && row.getAttribute("aria-hidden") !== "true");

    const expected = `${new Set(list).size} exercises`;
    if (clean(badge.textContent) !== expected) badge.textContent = expected;
  }

  let queued = false;
  function applyFixes() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fixProgrammeSummaries();
      fixExerciseCount();
    });
  }

  document.addEventListener("change", (event) => {
    if (event.target instanceof HTMLSelectElement) applyFixes();
  });
  document.addEventListener("click", () => setTimeout(applyFixes, 0));

  new MutationObserver(applyFixes).observe(document.getElementById("root") || document.body, {
    childList: true,
    subtree: true,
  });

  applyFixes();
})();