function directChildren(element) {
  return Array.from(element.children);
}

function chevronIcon(collapsed) {
  return collapsed
    ? '<svg viewBox="0 0 24 24" aria-hidden="true" class="h-5 w-5"><path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true" class="h-5 w-5"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function addProgrammeSessionCollapseControls() {
  document.querySelectorAll('[id^="programme-session-"]').forEach((sessionCard) => {
    if (sessionCard.dataset.collapseReady === "true") return;

    const children = directChildren(sessionCard);
    const header = children[0];
    const dragHandle = header?.firstElementChild;
    if (!header || !dragHandle) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "mt-6 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-800";
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-label", "Collapse session");

    const setCollapsed = (collapsed) => {
      directChildren(sessionCard).slice(1).forEach((child) => {
        child.hidden = collapsed;
      });
      sessionCard.dataset.collapsed = collapsed ? "true" : "false";
      button.innerHTML = chevronIcon(collapsed);
      button.setAttribute("aria-expanded", String(!collapsed));
      button.setAttribute("aria-label", collapsed ? "Expand session" : "Collapse session");
    };

    button.addEventListener("click", () => {
      setCollapsed(sessionCard.dataset.collapsed !== "true");
    });

    header.insertBefore(button, dragHandle);
    sessionCard.dataset.collapseReady = "true";
    setCollapsed(false);
  });
}

function removeProgrammePageHeading() {
  document.querySelectorAll("h1").forEach((heading) => {
    if (heading.textContent?.trim() !== "Programme") return;
    const intro = heading.parentElement;
    if (!intro || intro.dataset.compactProgrammeHeader === "true") return;
    heading.hidden = true;
    const description = intro.querySelector("p");
    if (description) description.hidden = true;
    intro.dataset.compactProgrammeHeader = "true";
  });
}

function applyFixes() {
  addProgrammeSessionCollapseControls();
  removeProgrammePageHeading();
}

export function installUiRuntimeFixes() {
  if (typeof window === "undefined" || typeof MutationObserver === "undefined") return () => {};

  applyFixes();
  const observer = new MutationObserver(applyFixes);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
