let discardConfirmed = false;
let originalConfirmButton = null;
let resetTimer = null;

function buttonText(button) {
  return button?.textContent?.trim() || "";
}

function visibleConfirmButtons() {
  return Array.from(document.querySelectorAll("button")).filter((button) => {
    if (buttonText(button) !== "Confirm discard") return false;
    const style = window.getComputedStyle(button);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

function hideRepeatedConfirmation(button) {
  const card = button.closest("section, [role='dialog'], .fixed");
  if (card) card.style.display = "none";
}

function finishRepeatedDiscard() {
  if (!discardConfirmed) return;

  const repeated = visibleConfirmButtons().find((button) => button !== originalConfirmButton);
  if (!repeated) return;

  hideRepeatedConfirmation(repeated);
  discardConfirmed = false;
  repeated.click();

  if (resetTimer) window.clearTimeout(resetTimer);
  resetTimer = null;
}

export function installDiscardTransitionFix() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};

  const onClick = (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (buttonText(button) !== "Confirm discard") return;

    if (!discardConfirmed) {
      discardConfirmed = true;
      originalConfirmButton = button;

      if (resetTimer) window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        discardConfirmed = false;
        originalConfirmButton = null;
        resetTimer = null;
      }, 5000);
      return;
    }

    discardConfirmed = false;
    originalConfirmButton = null;
  };

  document.addEventListener("click", onClick, true);

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(finishRepeatedDiscard);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    document.removeEventListener("click", onClick, true);
    observer.disconnect();
    if (resetTimer) window.clearTimeout(resetTimer);
  };
}
