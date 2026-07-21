function textOf(element) {
  return (element?.textContent || "").trim();
}

function headingWithText(text) {
  return [...document.querySelectorAll("h1, h2, h3")].find((heading) => textOf(heading) === text);
}

function closestCard(element) {
  return element?.closest("section, article, [class*='rounded-2xl'], [class*='rounded-3xl']") || null;
}

function removeLeakedProgrammeCards() {
  const quickWorkoutOpen = Boolean(headingWithText("Quick Workout"));
  const workoutInProgress = Boolean(headingWithText("Workout in progress"));
  if (!quickWorkoutOpen && !workoutInProgress) return;

  document.querySelectorAll("[data-home-summary-cards]").forEach((element) => element.remove());

  [...document.querySelectorAll("h1, h2, h3, p, span, div")]
    .filter((element) => {
      const text = textOf(element).toLowerCase();
      return text === "active programme" || text === "last workout";
    })
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
      if (textOf(caption) === "Notes" || textOf(caption) === "Session notes") child.remove();
    });

    topGrid.classList.remove("md:grid-cols-[1fr_1fr_auto]");
    topGrid.classList.add("md:grid-cols-[minmax(0,1fr)_auto]");
  });
}

function openActiveWorkoutDirectly() {
  const heading = headingWithText("Workout in progress");
  if (!heading) return;

  const card = closestCard(heading);
  if (!card) return;

  const continueButton = [...card.querySelectorAll("button")].find((button) => textOf(button) === "Continue Workout");
  if (!continueButton || continueButton.dataset.autoContinueHandled === "true") return;

  continueButton.dataset.autoContinueHandled = "true";
  continueButton.click();
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
  if (!heading) return;
  const card = closestCard(heading);
  if (card) card.dataset.workoutStateCard = "progress";
}

function markCardByExactText(label, variant = "soft") {
  const match = [...document.querySelectorAll("h1, h2, h3, h4, p, span, div")]
    .find((element) => textOf(element) === label);
  const card = closestCard(match);
  if (card) card.dataset.appSurfaceCard = variant;
}

function markConsistentSurfaceCards() {
  document.querySelectorAll("[data-app-surface-card]").forEach((element) => element.removeAttribute("data-app-surface-card"));

  [
    "Inactive programmes",
    "Exercise Library",
    "Stats",
    "Workout History",
    "Weight progress",
    "Training mode",
    "Surgery date",
    "Account",
  ].forEach((label) => markCardByExactText(label, "section"));

  ["Improvement", "Latest performance", "Best set"].forEach((label) => markCardByExactText(label, "metric"));

  [
    "Today's Tasks",
    "Active Programme",
    "Last Workout",
    "Rehab timeline",
    "Active",
  ].forEach((label) => markCardByExactText(label, "summary"));
}

function apply() {
  removeLeakedProgrammeCards();
  removeSessionNotes();
  openActiveWorkoutDirectly();
  markQuickWorkoutBuilder();
  markWorkoutStateCard();
  markConsistentSurfaceCards();
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
