function text(element) {
  return (element?.textContent || "").trim();
}

function updateInactiveProgrammeCount() {
  const programmeHeading = [...document.querySelectorAll("h1")].find((heading) => text(heading) === "Programme");
  const root = programmeHeading?.closest(".space-y-6") || programmeHeading?.parentElement?.parentElement;
  if (!root) return;

  const inactiveSection = [...root.querySelectorAll("section")].find((section) => text(section.querySelector(":scope > h2")) === "Inactive");
  const inactiveRow = [...root.querySelectorAll("[data-programme-overview-row]")].find((row) => text(row).startsWith("Inactive programmes"));
  if (!inactiveSection || !inactiveRow) return;

  const count = inactiveSection.querySelectorAll(":scope > .grid > div").length;
  const countLabel = inactiveRow.querySelector("span > span:nth-child(2)");
  if (countLabel) countLabel.textContent = `${count} ${count === 1 ? "programme" : "programmes"}`;
}

export function installInactiveProgrammeCountFix() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};

  let frame = 0;
  const scheduleUpdate = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(updateInactiveProgrammeCount);
  };

  scheduleUpdate();
  const observer = new MutationObserver(scheduleUpdate);
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
  };
}
