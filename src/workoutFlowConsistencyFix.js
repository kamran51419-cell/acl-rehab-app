function textOf(element) {
  return (element?.textContent || "").trim();
}

function headingWithText(text) {
  return [...document.querySelectorAll("h1, h2, h3")].find((heading) => textOf(heading) === text);
}

function closestCard(element) {
  if (!element) return null;
  return element.closest("section, article, [data-home-summary-cards], .rounded-3xl, .rounded-2xl") || element.parentElement;
}

function markLeakedHomeCards() {
  document.querySelectorAll("[data-workout-leaked-card]").forEach((element) => {
    element.removeAttribute("data-workout-leaked-card");
  });

  const quickWorkoutOpen = Boolean(headingWithText("Quick Workout"));
  const workoutInProgress = Boolean(headingWithText("Workout in progress"));
  if (!quickWorkoutOpen && !workoutInProgress) return;

  document.querySelectorAll("[data-home-summary-cards]").forEach((element) => {
    element.dataset.workoutLeakedCard = "true";
  });

  [...document.querySelectorAll("h1, h2, h3, h4, p, span")]
    .filter((element) => {
      const text = textOf(element).toLowerCase();
      return text === "active programme" || text === "last workout";
    })
    .forEach((element) => {
      const card = closestCard(element);
      if (card) card.dataset.workoutLeakedCard = "true";
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

function markQuickWorkoutBuilder() {
  document.querySelectorAll("[data-quick-workout-builder]").forEach((element) => element.removeAttribute("data-quick-workout-builder"));
  const heading = headingWithText("Quick Workout");
  if (!heading) return;

  const screen = heading.closest(".space-y-5, .space-y-6") || heading.parentElement;
  if (screen) screen.dataset.quickWorkoutBuilder = "true";
}

function markWorkoutStateCards() {
  document.querySelectorAll("[data-workout-state-card]").forEach((element) => element.removeAttribute("data-workout-state-card"));
  const heading = headingWithText("Workout in progress");
  if (!heading) return;
  const card = heading.closest("section");
  if (card) card.dataset.workoutStateCard = "progress";
}

function markWorkoutLanding() {
  document.querySelectorAll("[data-workout-landing]").forEach((element) => element.removeAttribute("data-workout-landing"));
  const quickButton = [...document.querySelectorAll("button")].find((button) => textOf(button) === "Quick Workout");
  if (!quickButton || headingWithText("Quick Workout") || headingWithText("Workout in progress")) return;
  const screen = quickButton.closest(".space-y-5") || quickButton.parentElement;
  if (screen) screen.dataset.workoutLanding = "true";
}

function apply() {
  markLeakedHomeCards();
  removeSessionNotes();
  markQuickWorkoutBuilder();
  markWorkoutStateCards();
  markWorkoutLanding();
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
