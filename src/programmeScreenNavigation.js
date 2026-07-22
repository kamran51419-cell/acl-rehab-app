const VIEW_KEY = "programme-subview";
const RETURN_KEY = "programme-library-return-v3";
const LEGACY_RETURN_KEYS = ["programme-library-return-v2", "programme-editor-return-state-v1"];

function text(element) {
  return (element?.textContent || "").trim();
}

function findTab(label) {
  return [...document.querySelectorAll("button")].find((button) => text(button) === label);
}

function goToTab(label) {
  findTab(label)?.click();
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

  const badges = [...section.querySelectorAll("span")].filter((item) => text(item) === "Inactive");
  if (badges.length) return badges.length;

  return [...section.querySelectorAll("button")].filter((button) => text(button) === "Open / edit").length;
}

function updateInactiveCount(root, inactiveSection) {
  const row = root.querySelector('[data-programme-overview-row="inactive"]');
  const countElement = row?.querySelector("[data-programme-count]");
  if (countElement) countElement.textContent = countLabel(countProgrammeCards(inactiveSection));
}

function sessionDisclosureButton(session) {
  const header = session?.firstElementChild;
  return header?.querySelector('button[aria-expanded], button[aria-label*="session" i]') || null;
}

function editorForSession(session) {
  return session?.closest('[data-final-programme-editor="true"], .space-y-5.rounded-3xl.border') || null;
}

function captureProgrammeReturnState(button) {
  const picker = button.closest('div.rounded-xl.border-dashed, [data-exercise-picker]');
  const targetSession = picker?.closest('[id^="programme-session-"]');
  const editor = editorForSession(targetSession);
  const sessions = [...document.querySelectorAll('[id^="programme-session-"]')].map((session) => {
    const sessionDisclosure = sessionDisclosureButton(session);
    const disclosures = [...session.querySelectorAll('button[aria-expanded]')].filter((item) => item !== sessionDisclosure);
    return {
      id: session.id,
      sessionExpanded: sessionDisclosure?.getAttribute("aria-expanded") === "true",
      exerciseExpanded: disclosures.map((item) => item.getAttribute("aria-expanded") === "true"),
    };
  });

  sessionStorage.setItem(RETURN_KEY, JSON.stringify({
    targetSessionId: targetSession?.id || "",
    pageScrollY: window.scrollY,
    editorScrollTop: editor?.scrollTop || 0,
    sessions,
    phase: "waiting",
  }));

  LEGACY_RETURN_KEYS.forEach((key) => sessionStorage.removeItem(key));
}

function restoreDisclosureState(state) {
  state.sessions?.forEach((savedSession) => {
    const session = document.getElementById(savedSession.id);
    if (!session) return;

    const sessionDisclosure = sessionDisclosureButton(session);
    if (sessionDisclosure) {
      const current = sessionDisclosure.getAttribute("aria-expanded") === "true";
      if (current !== savedSession.sessionExpanded) sessionDisclosure.click();
    }

    const disclosures = [...session.querySelectorAll('button[aria-expanded]')].filter((item) => item !== sessionDisclosure);
    savedSession.exerciseExpanded?.forEach((expanded, index) => {
      const disclosure = disclosures[index];
      if (!disclosure) return;
      const current = disclosure.getAttribute("aria-expanded") === "true";
      if (current !== expanded) disclosure.click();
    });
  });
}

function revealRestoredEditor(editor) {
  if (!editor) return;
  editor.style.visibility = "";
  delete editor.dataset.programmeReturnRestoring;
}

function restoreProgrammeReturnState() {
  if (sessionStorage.getItem(VIEW_KEY)) return;
  const raw = sessionStorage.getItem(RETURN_KEY);
  if (!raw) return;

  let state;
  try {
    state = JSON.parse(raw);
  } catch {
    sessionStorage.removeItem(RETURN_KEY);
    return;
  }

  const targetSession = state.targetSessionId ? document.getElementById(state.targetSessionId) : null;
  if (!targetSession || !sessionDisclosureButton(targetSession)) return;

  const editor = editorForSession(targetSession);
  if (editor && editor.dataset.programmeReturnRestoring !== "true") {
    editor.dataset.programmeReturnRestoring = "true";
    editor.style.visibility = "hidden";
  }

  if (state.phase === "waiting") {
    restoreDisclosureState(state);
    const addExercise = [...targetSession.querySelectorAll("button")].find((item) => text(item) === "Add exercise");
    if (!addExercise) {
      revealRestoredEditor(editor);
      return;
    }

    state.phase = "opening";
    sessionStorage.setItem(RETURN_KEY, JSON.stringify(state));
    addExercise.click();
    return;
  }

  const picker = [...targetSession.querySelectorAll('div.rounded-xl.border-dashed, [data-exercise-picker]')]
    .find((item) => /Exercise picker|Change exercise|Search exercises/i.test(text(item)));
  if (!picker) return;

  state.phase = "finishing";
  sessionStorage.setItem(RETURN_KEY, JSON.stringify(state));

  requestAnimationFrame(() => requestAnimationFrame(() => {
    picker.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
    if (editor) editor.scrollTop = Math.max(editor.scrollTop, Number(state.editorScrollTop) || 0);

    setTimeout(() => {
      picker.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
      revealRestoredEditor(editor);
      sessionStorage.removeItem(RETURN_KEY);
      LEGACY_RETURN_KEYS.forEach((key) => sessionStorage.removeItem(key));
    }, 220);
  }));
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
      sessionStorage.removeItem(VIEW_KEY);
      goToTab("Programme");
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
  captureProgrammeReturnState(button);
  sessionStorage.setItem(VIEW_KEY, "library");
}

function enhance() {
  enhanceProgramme();
  enhanceHomeLibrary();
  restoreNormalHome();
  restoreProgrammeReturnState();
}

export function installProgrammeScreenNavigation() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};
  document.addEventListener("click", captureProgrammeLibraryButton, true);
  enhance();
  const observer = new MutationObserver(() => requestAnimationFrame(enhance));
  observer.observe(document.body, { childList: true, subtree: true });
  const countRefresh = window.setInterval(() => {
    const root = programmeRoot();
    const inactiveSection = root ? sectionByTitle(root, "Inactive") : null;
    if (root && inactiveSection) updateInactiveCount(root, inactiveSection);
  }, 250);
  return () => {
    document.removeEventListener("click", captureProgrammeLibraryButton, true);
    observer.disconnect();
    window.clearInterval(countRefresh);
  };
}