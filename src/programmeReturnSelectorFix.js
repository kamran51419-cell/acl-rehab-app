const RETURN_STATE_KEY = "programme-return-selector-state-v2";
const TRANSITION_ID = "programme-return-transition";

let retryFrame = 0;
let lastOpenAttempt = 0;

function text(element) {
  return (element?.textContent || "").replace(/\u200b/g, "").trim();
}

function programmeEditor() {
  const heading = [...document.querySelectorAll("h2")].find((item) =>
    ["Edit programme", "Create programme"].includes(text(item)),
  );
  return heading?.closest?.('[data-final-programme-editor="true"], .space-y-5.rounded-3xl.border') || heading?.parentElement?.parentElement || null;
}

function sessionsInEditor(editor) {
  return [...(editor?.querySelectorAll('[id^="programme-session-"]') || [])];
}

function selectorInSession(session) {
  return [...(session?.querySelectorAll('[data-exercise-picker], div.rounded-xl.border-dashed') || [])]
    .find((item) => /Exercise (picker|selector)|Search exercises/i.test(text(item))) || null;
}

function readState() {
  try {
    return JSON.parse(sessionStorage.getItem(RETURN_STATE_KEY) || "null");
  } catch {
    sessionStorage.removeItem(RETURN_STATE_KEY);
    return null;
  }
}

function captureReturnState(event) {
  const button = event.target?.closest?.("button");
  if (!button || text(button) !== "Manage Exercise Library") return;

  const editor = programmeEditor();
  const session = button.closest('[id^="programme-session-"]');
  if (!editor || !session) return;

  const sessions = sessionsInEditor(editor);
  sessionStorage.setItem(RETURN_STATE_KEY, JSON.stringify({
    sessionId: session.id,
    sessionIndex: Math.max(0, sessions.indexOf(session)),
  }));
}

function removeReturnCover() {
  document.getElementById(TRANSITION_ID)?.remove();
}

function handleProgrammeReturn(event) {
  const button = event.target?.closest?.("button");
  if (!button || text(button) !== "← Programme") return;
  removeReturnCover();
  scheduleRestore();
}

function targetSession(editor, state) {
  const sessions = sessionsInEditor(editor);
  return document.getElementById(state.sessionId) || sessions[state.sessionIndex] || null;
}

function expandTargetSession(session) {
  const expand = [...session.querySelectorAll('button[aria-expanded="false"]')]
    .find((button) => /Expand session/i.test(button.getAttribute("aria-label") || ""));
  if (!expand) return false;
  expand.click();
  return true;
}

function finishRestore(selector) {
  selector.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  sessionStorage.removeItem(RETURN_STATE_KEY);
  lastOpenAttempt = 0;
  removeReturnCover();
}

function restoreSelector() {
  const state = readState();
  if (!state) return false;

  const editor = programmeEditor();
  if (!editor) return true;

  removeReturnCover();

  const session = targetSession(editor, state);
  if (!session) return true;

  const selector = selectorInSession(session);
  if (selector) {
    finishRestore(selector);
    return false;
  }

  if (expandTargetSession(session)) return true;

  const addExercise = [...session.querySelectorAll("button")].find((button) => text(button) === "Add exercise");
  if (!addExercise) return true;

  const now = performance.now();
  if (now - lastOpenAttempt >= 32) {
    lastOpenAttempt = now;
    addExercise.click();
  }

  return true;
}

function scheduleRestore() {
  if (retryFrame) return;

  const startedAt = performance.now();
  const run = () => {
    retryFrame = 0;
    const keepTrying = restoreSelector();
    if (keepTrying && performance.now() - startedAt < 3000) {
      retryFrame = requestAnimationFrame(run);
    }
  };

  retryFrame = requestAnimationFrame(run);
}

export function installProgrammeReturnSelectorFix() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};

  window.addEventListener("click", captureReturnState, true);
  window.addEventListener("click", handleProgrammeReturn, true);

  const observer = new MutationObserver(scheduleRestore);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "aria-expanded"],
  });

  scheduleRestore();
  return () => {
    if (retryFrame) cancelAnimationFrame(retryFrame);
    observer.disconnect();
    window.removeEventListener("click", captureReturnState, true);
    window.removeEventListener("click", handleProgrammeReturn, true);
  };
}
