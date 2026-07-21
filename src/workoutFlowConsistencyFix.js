function textOf(element) {
  return (element?.textContent || "").trim();
}

function headingWithText(text) {
  return [...document.querySelectorAll("h1, h2, h3")].find((heading) => textOf(heading) === text);
}

function closestCard(element) {
  if (!element) return null;
  const rounded = element.closest("[class*='rounded-xl'], [class*='rounded-2xl'], [class*='rounded-3xl']");
  if (rounded) return rounded;
  return element.closest("section.border, article.border, button.border");
}

function removeLeakedProgrammeCards() {
  const quickWorkoutOpen = Boolean(headingWithText("Quick Workout"));
  const workoutInProgress = Boolean(headingWithText("Workout in progress"));
  if (!quickWorkoutOpen && !workoutInProgress) return;

  document.querySelectorAll("[data-home-summary-cards]").forEach((element) => element.remove());
  [...document.querySelectorAll("h1, h2, h3, p, span, div")]
    .filter((element) => ["active programme", "last workout"].includes(textOf(element).toLowerCase()))
    .forEach((label) => {
      const card = closestCard(label);
      if (card && !card.querySelector("h1, h2, h3")?.textContent?.includes("Workout in progress")) card.remove();
    });
}

function removeSessionNotes() {
  document.querySelectorAll('[id^="programme-session-"]').forEach((session) => {
    const topGrid = session.querySelector(":scope > div > div.grid");
    if (!topGrid) return;
    [...topGrid.children].forEach((child) => {
      const label = child.querySelector("label") || (child.matches("label") ? child : null);
      if (!label) return;
      const caption = label.querySelector(":scope > span") || label.firstElementChild;
      if (["Notes", "Session notes"].includes(textOf(caption))) child.remove();
    });
    topGrid.classList.remove("md:grid-cols-[1fr_1fr_auto]");
    topGrid.classList.add("md:grid-cols-[minmax(0,1fr)_auto]");
  });
}

function manageWorkoutOptionsNavigation() {
  const optionsButton = [...document.querySelectorAll("button")].find((button) => textOf(button).includes("Workout options"));
  if (optionsButton && optionsButton.dataset.optionsFixInstalled !== "true") {
    optionsButton.dataset.optionsFixInstalled = "true";
    optionsButton.addEventListener("click", () => sessionStorage.setItem("workoutOptionsRequested", "true"));
  }

  const heading = headingWithText("Workout in progress");
  if (!heading) {
    sessionStorage.removeItem("workoutOptionsRequested");
    return;
  }
  const card = closestCard(heading);
  const continueButton = card && [...card.querySelectorAll("button")].find((button) => textOf(button) === "Continue Workout");
  if (!continueButton) return;
  if (continueButton.dataset.optionsFixInstalled !== "true") {
    continueButton.dataset.optionsFixInstalled = "true";
    continueButton.addEventListener("click", () => sessionStorage.removeItem("workoutOptionsRequested"));
  }
  if (sessionStorage.getItem("workoutOptionsRequested") === "true" || continueButton.dataset.autoContinueHandled === "true") return;
  continueButton.dataset.autoContinueHandled = "true";
  continueButton.click();
}

function allExactText(label) {
  return [...document.querySelectorAll("h1, h2, h3, h4, p, span, div")].filter((element) => textOf(element) === label);
}

function markCardsByExactText(label, variant = "soft") {
  const cards = new Set();
  allExactText(label).forEach((match) => {
    const card = closestCard(match);
    if (card) {
      card.dataset.appSurfaceCard = variant;
      cards.add(card);
    }
  });
  return [...cards];
}

function markFollowingCard(label, variant = "section") {
  const heading = headingWithText(label);
  if (!heading) return null;
  let candidate = heading.nextElementSibling;
  while (candidate && !candidate.matches("[class*='rounded-xl'], [class*='rounded-2xl'], [class*='rounded-3xl'], section.border, article.border")) candidate = candidate.nextElementSibling;
  if (candidate) candidate.dataset.appSurfaceCard = variant;
  return candidate;
}

function markQuickWorkoutBuilder() {
  document.querySelectorAll("[data-quick-workout-builder]").forEach((element) => element.removeAttribute("data-quick-workout-builder"));
  const heading = headingWithText("Quick Workout");
  if (!heading) return;
  const screen = heading.closest(".space-y-5, .space-y-6") || heading.parentElement;
  if (screen) screen.dataset.quickWorkoutBuilder = "true";
}

function markWorkoutStateCard() {
  document.querySelectorAll("[data-workout-state-card]").forEach((element) => element.removeAttribute("data-workout-state-card"));
  const heading = headingWithText("Workout in progress");
  const card = closestCard(heading);
  if (card) card.dataset.workoutStateCard = "progress";
}

function markTimelineCards() {
  [...document.querySelectorAll("div, p, span")]
    .filter((element) => /(?:days|weeks|months) post-op$/i.test(textOf(element)))
    .forEach((label) => {
      const card = closestCard(label);
      if (card) card.dataset.appSurfaceCard = "metric";
    });
}

function markQuickWorkoutButtons() {
  document.querySelectorAll("[data-quick-workout-action]").forEach((element) => element.removeAttribute("data-quick-workout-action"));
  [...document.querySelectorAll("button")]
    .filter((button) => textOf(button) === "Quick Workout")
    .forEach((button) => { button.dataset.quickWorkoutAction = "true"; });
}

function markProgrammeActiveCard() {
  document.querySelectorAll("[data-programme-active-heading], [data-programme-active-card]").forEach((element) => {
    element.removeAttribute("data-programme-active-heading");
    element.removeAttribute("data-programme-active-card");
  });
  const heading = headingWithText("Active");
  if (!heading) return;
  heading.dataset.programmeActiveHeading = "true";
  const card = markFollowingCard("Active", "active");
  if (!card) return;
  card.dataset.programmeActiveCard = "true";
  [...card.querySelectorAll("span, div, p")]
    .filter((element) => textOf(element) === "Active" && element.children.length === 0)
    .forEach((badge) => {
      if (badge !== heading) badge.dataset.hideActiveBadge = "true";
    });
}

function clearTabOverrides() {
  document.querySelectorAll("[data-app-tab-surface]").forEach((element) => element.removeAttribute("data-app-tab-surface"));
}

function markExerciseCards() {
  [...document.querySelectorAll("h2, h3")].forEach((heading) => {
    const card = closestCard(heading);
    if (!card || card.dataset.appSurfaceCard || card.dataset.workoutStateCard) return;
    const hasExerciseContent = card.querySelector("input, select, [class*='set'], [class*='exercise']") || heading.closest("[data-quick-workout-builder='true']");
    if (hasExerciseContent) card.dataset.appSurfaceCard = "exercise";
  });
}

function markConsistentSurfaceCards() {
  document.querySelectorAll("[data-app-surface-card]").forEach((element) => element.removeAttribute("data-app-surface-card"));

  ["Settings", "Inactive programmes", "Exercise Library", "Training mode", "Surgery date", "Account", "Today's Tasks", "Due tasks", "Needs attention"]
    .forEach((label) => markCardsByExactText(label, "section"));

  ["Improvement", "Latest performance", "Best set", "Last Workout"]
    .forEach((label) => markCardsByExactText(label, "metric"));

  ["New programme"]
    .forEach((label) => markCardsByExactText(label, "active"));

  ["Weight progress", "Stats", "Workout History"]
    .forEach((label) => markFollowingCard(label, "section"));

  markTimelineCards();
  markProgrammeActiveCard();
  markExerciseCards();
}

function markPageAndDialogSurfaces() {
  document.documentElement.dataset.appBlueTinge = "true";
  document.querySelectorAll("[data-app-dialog-panel]").forEach((element) => element.removeAttribute("data-app-dialog-panel"));
  document.querySelectorAll(".fixed.inset-0").forEach((overlay) => {
    const panel = [...overlay.children].find((child) => child.matches("[class*='rounded-xl'], [class*='rounded-2xl'], [class*='rounded-3xl']"));
    if (panel) panel.dataset.appDialogPanel = "true";
  });
}

function apply() {
  removeLeakedProgrammeCards();
  removeSessionNotes();
  manageWorkoutOptionsNavigation();
  markQuickWorkoutBuilder();
  markWorkoutStateCard();
  markQuickWorkoutButtons();
  clearTabOverrides();
  markConsistentSurfaceCards();
  markPageAndDialogSurfaces();
}

export function installWorkoutFlowConsistencyFix() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      apply();
    });
  };
  apply();
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}