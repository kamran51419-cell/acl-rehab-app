import React from "react";
import { createRoot } from "react-dom/client";
import PlansScreen from "./features/plans/PlansScreen";
import { auth } from "./firebase";

const VIEW_KEY = "programme-subview";
const LIBRARY_OVERLAY_ID = "programme-exercise-library-overlay";

let libraryRoot = null;
let homeCloseFrame = 0;

function text(element) {
  return (element?.textContent || "").trim();
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
  return [...root.querySelectorAll("section")].find((section) => text(section.querySelector(":scope > h2")) === title);
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
  root.prepend(makeBackHeader("Inactive programmes", () => showProgrammeOverview(root)));
  inactiveSection.hidden = false;
  inactiveSection.querySelector(":scope > h2")?.classList.add("hidden");
}

function closeExerciseLibrary() {
  cancelAnimationFrame(homeCloseFrame);
  homeCloseFrame = 0;
  libraryRoot?.unmount();
  libraryRoot = null;
  document.getElementById(LIBRARY_OVERLAY_ID)?.remove();
  document.body.style.overflow = "";
}

function closeExerciseLibraryAfterHomeRender(attempt = 0) {
  if (!document.getElementById(LIBRARY_OVERLAY_ID)) return;

  const homeButton = [...document.querySelectorAll("button")].find((button) => text(button) === "Home");
  const homeIsActive = homeButton?.className?.includes("bg-slate-100") || !programmeRoot();

  if (homeIsActive || attempt >= 60) {
    closeExerciseLibrary();
    return;
  }

  homeCloseFrame = requestAnimationFrame(() => closeExerciseLibraryAfterHomeRender(attempt + 1));
}

function ExerciseLibraryOverlay() {
  return React.createElement(
    "div",
    { className: "min-h-screen bg-slate-50 p-4 pb-24 md:p-8 md:pb-8" },
    React.createElement(
      "div",
      { className: "mx-auto max-w-7xl space-y-6" },
      React.createElement(
        "button",
        {
          type: "button",
          onClick: closeExerciseLibrary,
          className: "text-sm font-medium text-slate-600 hover:text-slate-900",
        },
        "← Programme"
      ),
      React.createElement(PlansScreen, {
        user: auth.currentUser,
        view: "exercises",
      })
    )
  );
}

function openExerciseLibrary() {
  if (document.getElementById(LIBRARY_OVERLAY_ID) || !auth.currentUser) return;

  const host = document.createElement("div");
  host.id = LIBRARY_OVERLAY_ID;
  host.style.cssText = "position:fixed;inset:0;z-index:2147483646;overflow:auto;background:#f8fafc";
  document.body.appendChild(host);
  document.body.style.overflow = "hidden";

  libraryRoot = createRoot(host);
  libraryRoot.render(React.createElement(ExerciseLibraryOverlay));
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

function handleNavigation(event) {
  const button = event.target.closest("button");
  if (!button) return;

  const label = text(button);

  if (label === "Manage Exercise Library") {
    event.preventDefault();
    event.stopImmediatePropagation();
    openExerciseLibrary();
    return;
  }

  if (label === "Home" && document.getElementById(LIBRARY_OVERLAY_ID)) {
    cancelAnimationFrame(homeCloseFrame);
    homeCloseFrame = requestAnimationFrame(() => closeExerciseLibraryAfterHomeRender());
  }
}

function renamePicker() {
  [...document.querySelectorAll("strong")].forEach((heading) => {
    if (text(heading) === "Exercise picker") heading.textContent = "Exercise selector";
  });
}

function enhance() {
  renamePicker();
  enhanceProgramme();
}

export function installProgrammeScreenNavigation() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};

  document.addEventListener("click", handleNavigation, true);
  enhance();

  const observer = new MutationObserver(() => requestAnimationFrame(enhance));
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    document.removeEventListener("click", handleNavigation, true);
    closeExerciseLibrary();
    observer.disconnect();
  };
}
