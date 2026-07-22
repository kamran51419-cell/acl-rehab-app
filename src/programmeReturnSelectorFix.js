const RETURN_KEY = "programme-library-return-session";
const VIEW_KEY = "programme-subview";
const TRANSITION_ID = "programme-return-transition";

let openingSessionId = "";
let lastOpenAttempt = 0;

function text(element) {
  return (element?.textContent || "").trim();
}

function selectorInSession(session) {
  return [...(session?.querySelectorAll('[data-exercise-picker], div.rounded-xl.border-dashed') || [])]
    .find((item) => /Exercise (picker|selector)|Search exercises|Manage Exercise Library/i.test(text(item))) || null;
}

function shortenReturnTransition() {
  const cover = document.getElementById(TRANSITION_ID);
  if (!cover) return;
  cover.style.transition = "opacity 90ms ease";
}

function restoreReturnedSelector() {
  shortenReturnTransition();
  if (sessionStorage.getItem(VIEW_KEY)) return;

  const raw = sessionStorage.getItem(RETURN_KEY);
  if (!raw) {
    openingSessionId = "";
    lastOpenAttempt = 0;
    return;
  }

  let state;
  try {
    state = JSON.parse(raw);
  } catch {
    return;
  }

  const session = state?.sessionId ? document.getElementById(state.sessionId) : null;
  if (!session) return;

  const selector = selectorInSession(session);
  if (selector) {
    openingSessionId = "";
    lastOpenAttempt = 0;
    selector.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    sessionStorage.removeItem(RETURN_KEY);
    return;
  }

  const expandSession = session.querySelector('button[aria-label="Expand session"][aria-expanded="false"]');
  if (expandSession) {
    expandSession.click();
    openingSessionId = "";
    lastOpenAttempt = 0;
    return;
  }

  const addExercise = [...session.querySelectorAll("button")].find((button) => text(button) === "Add exercise");
  if (!addExercise) return;

  const now = Date.now();
  if (openingSessionId === state.sessionId && now - lastOpenAttempt < 120) return;

  openingSessionId = state.sessionId;
  lastOpenAttempt = now;
  addExercise.click();
}

export function installProgrammeReturnSelectorFix() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      restoreReturnedSelector();
    });
  };

  const retry = window.setInterval(restoreReturnedSelector, 120);
  restoreReturnedSelector();
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "hidden", "aria-expanded"] });
  return () => {
    window.clearInterval(retry);
    observer.disconnect();
  };
}
