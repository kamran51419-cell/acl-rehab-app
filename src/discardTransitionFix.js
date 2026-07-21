let discardInFlight = false;
let restoreTimer = null;

function isConfirmDiscardButton(target) {
  return target instanceof Element && target.closest("button")?.textContent?.trim() === "Confirm discard";
}

function hideStaleDiscardCard() {
  if (!discardInFlight) return;

  document.querySelectorAll("button").forEach((button) => {
    if (button.textContent?.trim() !== "Confirm discard") return;
    const card = button.closest("section");
    if (card) card.style.display = "none";
  });
}

function finishDiscardTransition() {
  const stillHasWorkout = Array.from(document.querySelectorAll("h2")).some(
    (heading) => heading.textContent?.trim() === "Workout in progress"
  );

  if (!stillHasWorkout) {
    discardInFlight = false;
    if (restoreTimer) window.clearTimeout(restoreTimer);
    restoreTimer = null;
  }
}

export function installDiscardTransitionFix() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};

  const onClick = (event) => {
    if (!isConfirmDiscardButton(event.target)) return;

    discardInFlight = true;
    hideStaleDiscardCard();

    if (restoreTimer) window.clearTimeout(restoreTimer);
    restoreTimer = window.setTimeout(() => {
      discardInFlight = false;
      restoreTimer = null;
      document.querySelectorAll("section[style*='display: none']").forEach((card) => {
        card.style.display = "";
      });
    }, 8000);
  };

  document.addEventListener("click", onClick, true);

  const observer = new MutationObserver(() => {
    hideStaleDiscardCard();
    finishDiscardTransition();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    document.removeEventListener("click", onClick, true);
    observer.disconnect();
    if (restoreTimer) window.clearTimeout(restoreTimer);
  };
}
