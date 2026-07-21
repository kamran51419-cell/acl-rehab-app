let resumeRequested = false;
let sourceButton = null;
let resetTimer = null;

function buttonText(button) {
  return button?.textContent?.trim() || "";
}

function isWorkoutOverviewContinue(button) {
  if (buttonText(button) !== "Continue Workout") return false;
  const section = button.closest("section");
  return Boolean(section && /Workout in progress/i.test(section.textContent || ""));
}

function openWorkoutFormWhenReady() {
  if (!resumeRequested) return;

  const overviewButton = Array.from(document.querySelectorAll("button")).find(
    (button) => button !== sourceButton && isWorkoutOverviewContinue(button)
  );

  if (!overviewButton) return;

  resumeRequested = false;
  sourceButton = null;
  if (resetTimer) window.clearTimeout(resetTimer);
  resetTimer = null;
  overviewButton.click();
}

export function installHomeWorkoutResumeFix() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};

  const onClick = (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (buttonText(button) !== "Continue Workout" || isWorkoutOverviewContinue(button)) return;

    resumeRequested = true;
    sourceButton = button;

    if (resetTimer) window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      resumeRequested = false;
      sourceButton = null;
      resetTimer = null;
    }, 5000);
  };

  document.addEventListener("click", onClick, true);

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(openWorkoutFormWhenReady);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    document.removeEventListener("click", onClick, true);
    observer.disconnect();
    if (resetTimer) window.clearTimeout(resetTimer);
  };
}
