function text(element) {
  return (element?.textContent || "").trim();
}

function programmeRoot() {
  const heading = [...document.querySelectorAll("h1")].find((item) => text(item) === "Programme");
  return heading?.closest(".space-y-6") || heading?.parentElement?.parentElement || null;
}

export function installProgrammeSaveTransitionFix() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};

  let savePending = false;
  let frame = 0;

  const handleClick = (event) => {
    const button = event.target.closest("button");
    if (button && text(button) === "Save programme") savePending = true;
  };

  const observer = new MutationObserver(() => {
    if (!savePending) return;
    const root = programmeRoot();
    if (!root) return;
    const editorStillOpen = [...root.querySelectorAll("button")].some((button) => ["Save programme", "Saving…"].includes(text(button)));
    if (editorStillOpen) return;

    savePending = false;
    root.style.visibility = "hidden";
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => requestAnimationFrame(() => {
      root.style.visibility = "";
      frame = 0;
    }));
  });

  document.addEventListener("click", handleClick, true);
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    document.removeEventListener("click", handleClick, true);
    observer.disconnect();
    cancelAnimationFrame(frame);
    const root = programmeRoot();
    if (root) root.style.visibility = "";
  };
}
