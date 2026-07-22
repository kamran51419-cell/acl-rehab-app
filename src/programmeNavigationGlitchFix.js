const VIEW_KEY = "programme-subview";
const RETURN_KEY = "programme-library-return-session";
const SNAPSHOT_ID = "programme-return-snapshot";

function text(element) {
  return (element?.textContent || "").trim();
}

function programmeTab() {
  return [...document.querySelectorAll("button")].find((button) => text(button) === "Programme");
}

function renameExercisePicker() {
  [...document.querySelectorAll("strong")].forEach((heading) => {
    if (text(heading) === "Exercise picker") heading.textContent = "Exercise selector";
  });
}

function handleNavigation(event) {
  const button = event.target?.closest?.("button");
  if (!button) return;

  const label = text(button);

  if (label === "← Programme" && sessionStorage.getItem(VIEW_KEY) === "library") {
    event.preventDefault();
    event.stopImmediatePropagation();
    document.getElementById(SNAPSHOT_ID)?.remove();
    sessionStorage.removeItem(VIEW_KEY);
    programmeTab()?.click();
    return;
  }

  if (label === "Home") {
    document.getElementById(SNAPSHOT_ID)?.remove();
    sessionStorage.removeItem(VIEW_KEY);
    sessionStorage.removeItem(RETURN_KEY);
  }
}

export function installProgrammeNavigationGlitchFix() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};

  let scheduled = false;
  const scheduleRename = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      renameExercisePicker();
    });
  };

  document.addEventListener("click", handleNavigation, true);
  renameExercisePicker();

  const observer = new MutationObserver(scheduleRename);
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    document.removeEventListener("click", handleNavigation, true);
    observer.disconnect();
  };
}
