function directChildren(element) {
  return Array.from(element.children);
}

function addProgrammeSessionCollapseControls() {
  document.querySelectorAll('[id^="programme-session-"]').forEach((sessionCard) => {
    if (sessionCard.dataset.collapseReady === "true") return;

    const children = directChildren(sessionCard);
    const header = children[0];
    if (!header) return;

    const actions = header.lastElementChild;
    if (!actions) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50";
    button.textContent = "Collapse";
    button.setAttribute("aria-expanded", "true");

    const setCollapsed = (collapsed) => {
      directChildren(sessionCard).slice(1).forEach((child) => {
        child.hidden = collapsed;
      });
      sessionCard.dataset.collapsed = collapsed ? "true" : "false";
      button.textContent = collapsed ? "Expand" : "Collapse";
      button.setAttribute("aria-expanded", String(!collapsed));
    };

    button.addEventListener("click", () => {
      setCollapsed(sessionCard.dataset.collapsed !== "true");
    });

    actions.prepend(button);
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
