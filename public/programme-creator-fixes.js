(() => {
  const text = (value) => String(value || "").replace(/\s+/g, " ").trim();
  let keepWorkoutAfterDiscard = false;

  function programmeEditor() {
    const heading = [...document.querySelectorAll("h2")].find((item) => {
      const value = text(item.textContent);
      return value === "Edit programme" || value === "Create programme";
    });
    return heading?.closest("div.rounded-3xl") || null;
  }

  function sideSuffix(value) {
    if (value === "separate") return "both";
    if (value === "left") return "left";
    if (value === "right") return "right";
    return "";
  }

  function fixSummaryCard(card) {
    const sideField = [...card.querySelectorAll("label")].find((label) => text(label.textContent).startsWith("Side"));
    const select = sideField?.querySelector("select");
    if (!select) return;

    const title = card.querySelector(".font-semibold");
    const summary = title?.parentElement?.querySelector(".text-sm.text-slate-500");
    if (!summary) return;

    const base = text(summary.textContent).replace(/\s+(both|left|right)$/i, "");
    const suffix = sideSuffix(select.value);
    const expected = suffix ? `${base} ${suffix}` : base;
    if (text(summary.textContent) !== expected) summary.textContent = expected;
  }

  function fixProgrammeSummaries(root = programmeEditor()) {
    if (!root) return;
    [...root.querySelectorAll("button")]
      .filter((button) => text(button.textContent) === "Change exercise")
      .forEach((button) => {
        const card = button.closest("div.rounded-xl.border.bg-white");
        if (card) fixSummaryCard(card);
      });
  }

  function makeRepeatedAddsWork(root = programmeEditor()) {
    if (!root) return;
    const pickerButtons = [...root.querySelectorAll("button")];
    const normalAdd = pickerButtons.find((button) => text(button.textContent) === "Add" && !button.disabled);

    pickerButtons.forEach((button) => {
      if (text(button.textContent) !== "Selected") return;
      button.disabled = false;
      button.textContent = "Add";
      button.removeAttribute("aria-disabled");
      if (normalAdd) button.className = normalAdd.className;
      button.style.opacity = "";
      button.style.cursor = "";
    });
  }

  function fixExerciseCount() {
    const heading = [...document.querySelectorAll("h2")].find((item) => text(item.textContent).toLowerCase() === "exercise library");
    const container = heading?.closest("div.rounded-3xl");
    if (!container) return;

    const badge = [...container.querySelectorAll("div")].find((item) => /^\d+ exercises$/.test(text(item.textContent)));
    if (!badge) return;

    const visibleRows = [...container.querySelectorAll("button")]
      .filter((button) => text(button.textContent) === "Edit")
      .map((button) => button.closest("div.flex.items-center.justify-between"))
      .filter((row) => row && row.style.display !== "none" && row.getAttribute("aria-hidden") !== "true");

    const expected = `${new Set(visibleRows).size} exercises`;
    if (text(badge.textContent) !== expected) badge.textContent = expected;
  }

  function fixQuickWorkoutLabels() {
    const replacements = new Map([
      ["One-off Workout", "Quick Workout"],
      ["Build a One-off Workout", "Build a Quick Workout"],
      ["Start One-off Workout", "Start Quick Workout"],
      ["Workout in progress · One-off Workout", "Workout in progress · Quick Workout"],
    ]);

    const walker = document.createTreeWalker(document.getElementById("root") || document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const current = text(node.nodeValue);
      if (replacements.has(current)) node.nodeValue = node.nodeValue.replace(current, replacements.get(current));
    }

    document.querySelectorAll('input[placeholder="One-off Workout"]').forEach((input) => {
      input.placeholder = "Quick Workout";
    });
  }

  function dedupeSideOptions() {
    document.querySelectorAll("select").forEach((select) => {
      const options = [...select.options];
      const values = options.map((option) => option.value);
      if (!values.includes("both") || !values.includes("separate")) return;

      ["left", "right"].forEach((value) => {
        options.filter((option) => option.value === value).slice(1).forEach((option) => option.remove());
      });
    });
  }

  function workoutTabButton() {
    return [...document.querySelectorAll("button")].find((button) => text(button.textContent) === "Workout");
  }

  function retainWorkoutTabAfterDiscard() {
    if (!keepWorkoutAfterDiscard) return;
    if (document.querySelector('[role="dialog"]')) return;
    if ([...document.querySelectorAll("p")].some((item) => text(item.textContent).startsWith("Workout in progress ·"))) return;

    const workoutButton = workoutTabButton();
    if (!workoutButton) return;
    keepWorkoutAfterDiscard = false;
    workoutButton.click();
  }

  window.removeStandardBothLabels = fixProgrammeSummaries;
  window.allowRepeatedProgrammeExercises = makeRepeatedAddsWork;

  let queued = false;
  function apply() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fixProgrammeSummaries();
      makeRepeatedAddsWork();
      fixExerciseCount();
      fixQuickWorkoutLabels();
      dedupeSideOptions();
      retainWorkoutTabAfterDiscard();
    });
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const isCustomConfirmation = button.matches("[data-confirm-discard]");
    const isReactConfirmation = text(button.textContent) === "Discard Workout" && Boolean(button.closest('[role="dialog"]'));
    if (isCustomConfirmation || isReactConfirmation) keepWorkoutAfterDiscard = true;
    setTimeout(apply, 0);
  }, true);

  document.addEventListener("change", (event) => {
    if (event.target instanceof HTMLSelectElement) apply();
  });
  new MutationObserver(apply).observe(document.getElementById("root") || document.body, { childList: true, subtree: true });
  apply();
})();