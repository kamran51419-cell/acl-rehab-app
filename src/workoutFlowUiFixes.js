let completingInlineDiscard = false;

function buttonByText(text) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === text
  );
}

function finishDiscardAfterPopup() {
  if (completingInlineDiscard) return;

  const confirmButton = buttonByText("Confirm discard");
  if (!confirmButton) return;

  completingInlineDiscard = true;
  const card = confirmButton.closest("section");
  if (card) card.style.display = "none";

  confirmButton.click();
  window.setTimeout(() => {
    completingInlineDiscard = false;
  }, 500);
}

function moveSessionChooserAboveQuickWorkout() {
  const quickButton = buttonByText("Quick Workout");
  if (!quickButton) return;

  const section = quickButton.closest("section");
  if (!section) return;

  const chooserHeading = Array.from(section.querySelectorAll("h2")).find(
    (heading) => heading.textContent?.trim() === "Choose a session"
  );
  const chooser = chooserHeading?.parentElement;
  if (!chooser || chooser.nextElementSibling === quickButton) return;

  section.insertBefore(chooser, quickButton);
}

function applyWorkoutFlowFixes() {
  finishDiscardAfterPopup();
  moveSessionChooserAboveQuickWorkout();
}

export function installWorkoutFlowUiFixes() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};

  applyWorkoutFlowFixes();
  const observer = new MutationObserver(() => window.requestAnimationFrame(applyWorkoutFlowFixes));
  observer.observe(document.body, { childList: true, subtree: true });

  return () => observer.disconnect();
}
