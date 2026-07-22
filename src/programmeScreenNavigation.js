const VIEW_KEY = "programme-subview";
const RETURN_KEY = "programme-library-return-session";
const SNAPSHOT_ID = "programme-return-snapshot";

let programmeSnapshot = null;
let programmeScrollY = 0;
let restoreFrame = 0;

function text(element) {
  return (element?.textContent || "").trim();
}

function findTab(label) {
  return [...document.querySelectorAll("button")].find((button) => text(button) === label);
}

function goToTab(label) {
  findTab(label)?.click();
}

function makeChevronRow(label, count, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm hover:bg-slate-50";
  button.innerHTML = `<span><span class="block font-semibold text-slate-900">${label}</span>${Number.isFinite(count) ? `<span class="mt-0.5 block text-sm text-slate-500">${count} ${count === 1 ? "programme" : "programmes"}</span>` : ""}</span><span aria-hidden="true" class="text-2xl leading-none text-slate-400">›</span>`;
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
  const header = makeBackHeader("Inactive programmes", () => showProgrammeOverview(root));
  root.prepend(header);
  inactiveSection.hidden = false;
  inactiveSection.querySelector(":scope > h2")?.classList.add("hidden");
}

function captureProgrammeSnapshot() {
  const root = programmeRoot();
  if (!root) return;
  programmeSnapshot = root.cloneNode(true);
  programmeSnapshot.querySelectorAll("[id]").forEach((item) => item.removeAttribute("id"));
  programmeSnapshot.querySelectorAll("button, input, select, textarea, a").forEach((item) => {
    item.tabIndex = -1;
    item.setAttribute("aria-hidden", "true");
  });
  programmeScrollY = window.scrollY;
}

function showProgrammeSnapshot() {
  if (!programmeSnapshot || document.getElementById(SNAPSHOT_ID)) return;
  const cover = document.createElement("div");
  cover.id = SNAPSHOT_ID;
  cover.setAttribute("aria-hidden", "true");
  cover.style.cssText = "position:fixed;inset:0;z-index:2147483646;background:#f8fafc;overflow:auto;pointer-events:none";

  const shell = document.createElement("div");
  shell.className = "mx-auto w-full max-w-6xl px-4 pb-28 pt-4 md:px-6";
  shell.appendChild(programmeSnapshot.cloneNode(true));
  cover.appendChild(shell);
  document.body.appendChild(cover);
  cover.scrollTop = programmeScrollY;
}

function removeProgrammeSnapshot() {
  document.getElementById(SNAPSHOT_ID)?.remove();
}

function openExerciseLibrary() {
  captureProgrammeSnapshot();
  sessionStorage.setItem(VIEW_KEY, "library");
  goToTab("Home");
}

function enhanceProgramme() {
  const root = programmeRoot();
  if (!root || root.dataset.programmeNavigationEnhanced === "true") return;

  const activeSection = sectionByTitle(root, "Active");
  const inactiveSection = sectionByTitle(root, "Inactive");
  if (!activeSection || !inactiveSection) return;

  root.dataset.programmeNavigationEnhanced = "true";
  inactiveSection.dataset.programmeHiddenSection = "true";
  inactiveSection.hidden = true;

  const inactiveCount = inactiveSection.querySelectorAll(".grid > div").length;
  const inactiveRow = makeChevronRow("Inactive programmes", inactiveCount, () => showInactiveScreen(root, inactiveSection));
  inactiveRow.dataset.programmeOverviewRow = "true";
  activeSection.insertAdjacentElement("afterend", inactiveRow);

  const libraryRow = makeChevronRow("Exercise Library", undefined, openExerciseLibrary);
  libraryRow.dataset.programmeOverviewRow = "true";
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
      showProgrammeSnapshot();
      sessionStorage.removeItem(VIEW_KEY);
      goToTab("Programme");
      cancelAnimationFrame(restoreFrame);
      restoreFrame = requestAnimationFrame(() => restoreLibraryReturn());
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

function captureProgrammeLibraryButton(event) {
  const button = event.target.closest("button");
  if (!button || text(button) !== "Manage Exercise Library") return;
  captureProgrammeSnapshot();
  sessionStorage.setItem(VIEW_KEY, "library");
}

function selectorInSession(session) {
  return [...session.querySelectorAll('[data-exercise-picker], div.rounded-xl.border-dashed')]
    .find((item) => /Exercise (picker|selector)|Search exercises|Manage Exercise Library/i.test(text(item))) || null;
}

function restoreLibraryReturn(attempt = 0) {
  if (sessionStorage.getItem(VIEW_KEY)) return;
  const raw = sessionStorage.getItem(RETURN_KEY);
  if (!raw) {
    if (programmeRoot()) removeProgrammeSnapshot();
    return;
  }

  let state;
  try {
    state = JSON.parse(raw);
  } catch {
    sessionStorage.removeItem(RETURN_KEY);
    removeProgrammeSnapshot();
    return;
  }

  const sessions = [...document.querySelectorAll('[id^="programme-session-"]')];
  const session = (state.sessionId ? document.getElementById(state.sessionId) : null)
    || (Number.isInteger(state.sessionIndex) ? sessions[state.sessionIndex] : null);

  if (session) {
    const selector = selectorInSession(session);
    if (selector) {
      selector.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
      sessionStorage.removeItem(RETURN_KEY);
      removeProgrammeSnapshot();
      restoreFrame = 0;
      return;
    }

    const expand = session.querySelector('button[aria-label="Expand session"][aria-expanded="false"]');
    if (expand) HTMLElement.prototype.click.call(expand);
    else {
      const addExercise = [...session.querySelectorAll("button")].find((button) => text(button) === "Add exercise");
      if (addExercise) HTMLElement.prototype.click.call(addExercise);
    }
  }

  if (attempt < 240) restoreFrame = requestAnimationFrame(() => restoreLibraryReturn(attempt + 1));
  else removeProgrammeSnapshot();
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
}

function enhance() {
  enhanceProgramme();
  enhanceHomeLibrary();
  restoreNormalHome();
  restoreLibraryReturn();
}

export function installProgrammeScreenNavigation() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};
  document.addEventListener("click", captureProgrammeLibraryButton, true);
  document.addEventListener("click", captureLibraryReturn, true);
  enhance();
  const observer = new MutationObserver(() => requestAnimationFrame(enhance));
  observer.observe(document.body, { childList: true, subtree: true });
  return () => {
    document.removeEventListener("click", captureProgrammeLibraryButton, true);
    document.removeEventListener("click", captureLibraryReturn, true);
    cancelAnimationFrame(restoreFrame);
    removeProgrammeSnapshot();
    observer.disconnect();
  };
}