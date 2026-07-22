const RETURN_KEY = "programme-library-return-session";
const VIEW_KEY = "programme-subview";
const TRANSITION_ID = "programme-return-transition";

let openingSessionKey = "";
let lastOpenAttempt = 0;

function text(element) {
  return (element?.textContent || "").trim();
}

function programmeSessions() {
  return [...document.querySelectorAll('[id^="programme-session-"]')];
}

function selectorInSession(session) {
  return [...(session?.querySelectorAll('[data-exercise-picker], div.rounded-xl.border-dashed') || [])]
    .find((item) => /Exercise (picker|selector)|Search exercises|Manage Exercise Library/i.test(text(item))) || null;
}

function shortenReturnTransition() {
  const cover = document.getElementById(TRANSITION_ID);
  if (!cover) return;
  cover.style.transition = "opacity 60ms ease";
}

function savedSession(state) {
  if (state?.sessionId) {
    const byId = document.getElementById(state.sessionId);
    if (byId) return byId;
  }
  const sessions = programmeSessions();
  return Number.isInteger(state?.sessionIndex) ? sessions[state.sessionIndex] || null : null;
}

function restoreReturnedSelector() {
  shortenReturnTransition();
  if (sessionStorage.getItem(VIEW_KEY)) return;

  const raw = sessionStorage.getItem(RETURN_KEY);
  if (!raw) {
    openingSessionKey = "";
    lastOpenAttempt = 0;
    return;
  }

  let state;
  try {
    state = JSON.parse(raw);
  } catch {
    return;
  }

  const session = savedSession(state);
  if (!session) return;

  const selector = selectorInSession(session);
  if (selector) {
    openingSessionKey = "";
    lastOpenAttempt = 0;
    selector.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    sessionStorage.removeItem(RETURN_KEY);
    return;
  }

  const expandSession = session.querySelector('button[aria-label="Expand session"][aria-expanded="false"]');
  if (expandSession) {
    HTMLElement.prototype.click.call(expandSession);
    openingSessionKey = "";
    lastOpenAttempt = 0;
    return;
  }

  const addExercise = [...session.querySelectorAll("button")].find((button) => text(button) === "Add exercise");
  if (!addExercise) return;

  const key = state.sessionId || String(state.sessionIndex ?? "");
  const now = Date.now();
  if (openingSessionKey === key && now - lastOpenAttempt < 80) return;

  openingSessionKey = key;
  lastOpenAttempt = now;
  HTMLElement.prototype.click.call(addExercise);
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

  const retry = window.setInterval(restoreReturnedSelector, 80);
  restoreReturnedSelector();
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "hidden", "aria-expanded"] });
  return () => {
    window.clearInterval(retry);
    observer.disconnect();
  };
}
