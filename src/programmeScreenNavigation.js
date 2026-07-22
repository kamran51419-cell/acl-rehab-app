const VIEW_KEY = "programme-subview";
const RETURN_KEY = "programme-library-return";

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

function countProgrammeCards(section) {
  return [...section.children].reduce((total, child) => {
    if (child.matches("h2")) return total;
    return total + [...child.querySelectorAll("button")].filter((button) => text(button) === "Open / edit").length;
  }, 0);
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

function captureProgrammeReturnState(button) {
  const picker = button.closest('div.rounded-xl.border-dashed, [data-exercise-picker]');
  const session = picker?.closest('[id^="programme-session-"]');

  sessionStorage.setItem(RETURN_KEY, JSON.stringify({
    pageScrollY: window.scrollY,
    pickerSessionId: session?.id || "",
  }));
}

function openExerciseLibrary() {
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

  const inactiveCount = countProgrammeCards(inactiveSection);
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

  const session = state.pickerSessionId ? document.getElementById(state.pickerSessionId) : null;
  if (!session) return;

  const picker = [...session.querySelectorAll('div.rounded-xl.border-dashed, [data-exercise-picker]')]
    .find((item) => /Exercise picker|Change exercise|Search exercises/i.test(text(item)));
  if (!picker) return;

  requestAnimationFrame(() => requestAnimationFrame(() => {
    picker.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
    sessionStorage.removeItem(RETURN_KEY);
  }));
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
  return () => {
    document.removeEventListener("click", captureProgrammeLibraryButton, true);
    observer.disconnect();
  };
}
