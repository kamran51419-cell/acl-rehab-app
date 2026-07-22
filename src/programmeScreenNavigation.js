const VIEW_KEY = "programme-subview";
const RETURN_KEY = "programme-library-return-session";
const TRANSITION_ID = "programme-library-transition";
let restoreFrame = 0;
let addRequestedAt = 0;

function text(element) {
  return (element?.textContent || "").trim();
}

function findTab(label) {
  return [...document.querySelectorAll("button")].find((button) => text(button) === label);
}

function goToTab(label) {
  findTab(label)?.click();
}

function showReturnTransition() {
  if (document.getElementById(TRANSITION_ID)) return;

  const cover = document.createElement("div");
  cover.id = TRANSITION_ID;
  cover.setAttribute("aria-hidden", "true");
  cover.style.cssText = "position:fixed;inset:0;z-index:2147483646;background:#f8fafc;pointer-events:none;overflow:hidden";

  const library = document.getElementById("exercise-library");
  const source = library?.parentElement;
  if (source) {
    const rect = source.getBoundingClientRect();
    const snapshot = source.cloneNode(true);
    snapshot.querySelectorAll("[id]").forEach((item) => item.removeAttribute("id"));
    snapshot.style.cssText = `position:absolute;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;margin:0;transform:none;background:#f8fafc`;
    cover.appendChild(snapshot);
  }

  document.body.appendChild(cover);
}

function hideReturnTransition() {
  document.getElementById(TRANSITION_ID)?.remove();
}

function countLabel(count) {
  return `${count} ${count === 1 ? "programme" : "programmes"}`;
}

function makeChevronRow(label, count, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm hover:bg-slate-50";
  button.innerHTML = `<span><span class="block font-semibold text-slate-900">${label}</span>${Number.isFinite(count) ? `<span data-programme-count class="mt-0.5 block text-sm text-slate-500">${countLabel(count)}</span>` : ""}</span><span aria-hidden="true" class="text-2xl leading-none text-slate-400">›</span>`;
  button.addEventListener("click", onClick);
  return button;
}

function makeBackHeader(title, onBack) {
  const header = document.createElement("div");
  header.dataset.programmeSubviewHeader = "true";
  header.className = "space-y-3";

  const back = document.createElement("button");
  back.type = "button";
  back.className = "text-sm font-medium text-slate-600 hover:text-slate-900";
  back.textContent = "← Programme";
  back.addEventListener("click", onBack);

  const heading = document.createElement("h1");
  heading.className = "text-2xl font-semibold tracking-tight";
  heading.textContent = title;

  header.append(back, heading);
  return header;
}

function programmeRoot() {
  const heading = [...document.querySelectorAll("h1")].find((item) => text(item) === "Programme");
  return heading?.closest(".space-y-6") || heading?.parentElement?.parentElement || null;
}

function sectionByTitle(root, title) {
  return [...root.querySelectorAll("section")].find((section) => {
    const heading = section.querySelector(":scope > h2");
    return text(heading) === title;
  });
}

function countProgrammeCards(section) {
  const grid = [...section.children].find((child) => child.matches?.(".grid"));
  if (grid) return grid.children.length;
  return [...section.querySelectorAll("button")].filter((button) => text(button) === "Open / edit").length;
}

function updateInactiveCount(root, inactiveSection) {
  const countElement = root.querySelector('[data-programme-overview-row="inactive"] [data-programme-count]');
  if (!countElement) return;
  const next = countLabel(countProgrammeCards(inactiveSection));
  if (countElement.textContent !== next) countElement.textContent = next;
}

function captureLibraryReturn(event) {
  const button = event.target.closest("button");
  if (!button || text(button) !== "Manage Exercise Library") return;
  const session = button.closest('[id^="programme-session-"]');
  const sessions = [...document.querySelectorAll('[id^="programme-session-"]')];
  if (session) {
    sessionStorage.setItem(RETURN_KEY, JSON.stringify({
      sessionId: session.id || "",
      sessionIndex: sessions.indexOf(session),
    }));
  }
  sessionStorage.setItem(VIEW_KEY, "library");
}

function selectorInSession(session) {
  return [...session.querySelectorAll('[data-exercise-picker], div.rounded-xl.border-dashed')]
    .find((item) => /Exercise (picker|selector)|Search exercises|Manage Exercise Library/i.test(text(item))) || null;
}

function stopRestoreLoop() {
  if (restoreFrame) cancelAnimationFrame(restoreFrame);
  restoreFrame = 0;
  addRequestedAt = 0;
}

function restoreLibraryReturn() {
  if (sessionStorage.getItem(VIEW_KEY)) return;
  const raw = sessionStorage.getItem(RETURN_KEY);
  if (!raw) {
    stopRestoreLoop();
    hideReturnTransition();
    return;
  }

  let state;
  try {
    state = JSON.parse(raw);
  } catch {
    sessionStorage.removeItem(RETURN_KEY);
    stopRestoreLoop();
    hideReturnTransition();
    return;
  }

  const attempt = () => {
    const sessions = [...document.querySelectorAll('[id^="programme-session-"]')];
    const session = (state.sessionId ? document.getElementById(state.sessionId) : null)
      || (Number.isInteger(state.sessionIndex) ? sessions[state.sessionIndex] : null);

    if (session) {
      const selector = selectorInSession(session);
      if (selector) {
        selector.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
        sessionStorage.removeItem(RETURN_KEY);
        stopRestoreLoop();
        hideReturnTransition();
        return;
      }

      const expandSession = session.querySelector('button[aria-label="Expand session"][aria-expanded="false"]');
      if (expandSession) HTMLElement.prototype.click.call(expandSession);

      const addExercise = [...session.querySelectorAll("button")].find((item) => text(item) === "Add exercise");
      const now = performance.now();
      if (addExercise && now - addRequestedAt > 120) {
        addRequestedAt = now;
        HTMLElement.prototype.click.call(addExercise);
      }
    }

    restoreFrame = requestAnimationFrame(attempt);
  };

  if (!restoreFrame) restoreFrame = requestAnimationFrame(attempt);
}

function showProgrammeOverview(root) {
  sessionStorage.removeItem(VIEW_KEY);
  root.querySelectorAll("[data-programme-subview-header]").forEach((item) => item.remove());
  [...root.children].forEach((child) => {
    child.hidden = child.dataset.programmeHiddenSection === "true";
  });
  root.querySelectorAll("[data-programme-overview-row]").forEach((row) => { row.hidden = false; });
}

function showInactiveScreen(root, inactiveSection) {
  sessionStorage.setItem(VIEW_KEY, "inactive");
  [...root.children].forEach((child) => { child.hidden = true; });
  root.querySelectorAll("[data-programme-subview-header]").forEach((item) => item.remove());
  const header = makeBackHeader("Inactive programmes", () => showProgrammeOverview(root));
  root.prepend(header);
  inactiveSection.hidden = false;
  inactiveSection.querySelector(":scope > h2")?.classList.add("hidden");
}

function openExerciseLibrary() {
  sessionStorage.setItem(VIEW_KEY, "library");
  goToTab("Home");
}

function enhanceProgramme() {
  const root = programmeRoot();
  if (!root) return;

  const activeSection = sectionByTitle(root, "Active");
  const inactiveSection = sectionByTitle(root, "Inactive");
  if (!activeSection || !inactiveSection) return;

  if (root.dataset.programmeNavigationEnhanced === "true") {
    updateInactiveCount(root, inactiveSection);
    return;
  }

  root.dataset.programmeNavigationEnhanced = "true";
  inactiveSection.dataset.programmeHiddenSection = "true";
  inactiveSection.hidden = true;

  const inactiveRow = makeChevronRow("Inactive programmes", countProgrammeCards(inactiveSection), () => showInactiveScreen(root, inactiveSection));
  inactiveRow.dataset.programmeOverviewRow = "inactive";
  activeSection.insertAdjacentElement("afterend", inactiveRow);

  const libraryRow = makeChevronRow("Exercise Library", undefined, openExerciseLibrary);
  libraryRow.dataset.programmeOverviewRow = "library";
  inactiveRow.insertAdjacentElement("afterend", libraryRow);

  if (sessionStorage.getItem(VIEW_KEY) === "inactive") showInactiveScreen(root, inactiveSection);
}

function enhanceHomeLibrary() {
  const library = document.getElementById("exercise-library");
  if (!library) return;

  const homeContainer = library.parentElement;
  const mode = sessionStorage.getItem(VIEW_KEY);

  if (mode !== "library") {
    library.hidden = true;
    return;
  }

  library.hidden = false;
  [...homeContainer.children].forEach((child) => {
    if (child !== library && child.dataset.programmeLibraryHeader !== "true") child.hidden = true;
  });

  const helper = [...library.querySelectorAll("p")].find((item) => text(item) === "Define what an exercise is. Configure it inside a programme.");
  helper?.remove();

  if (!homeContainer.querySelector("[data-programme-library-header]")) {
    const header = makeBackHeader("Exercise Library", () => {
      if (sessionStorage.getItem(RETURN_KEY)) showReturnTransition();
      sessionStorage.removeItem(VIEW_KEY);
      goToTab("Programme");
      restoreLibraryReturn();
    });
    header.dataset.programmeLibraryHeader = "true";
    homeContainer.prepend(header);
  }
}

function restoreNormalHome() {
  if (sessionStorage.getItem(VIEW_KEY) === "library") return;
  const library = document.getElementById("exercise-library");
  const container = library?.parentElement;
  if (!container) return;
  container.querySelectorAll("[data-programme-library-header]").forEach((item) => item.remove());
  [...container.children].forEach((child) => { child.hidden = child === library; });
}

function enhance() {
  enhanceProgramme();
  enhanceHomeLibrary();
  restoreNormalHome();
  restoreLibraryReturn();
}

export function installProgrammeScreenNavigation() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};
  let scheduled = false;
  const scheduleEnhance = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhance();
    });
  };

  document.addEventListener("click", captureLibraryReturn, true);
  enhance();
  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => {
    document.removeEventListener("click", captureLibraryReturn, true);
    observer.disconnect();
    stopRestoreLoop();
    hideReturnTransition();
  };
}
