function shortenProgrammeButtons() {
  const buttons = Array.from(document.querySelectorAll("button"));
  const editButton = buttons.find((button) => button.textContent?.trim() === "Open / edit");
  if (!editButton) return;

  const row = editButton.parentElement;
  if (!row) return;

  const replacements = new Map([
    ["Open / edit", "Edit"],
    ["Delete programme", "Delete"],
  ]);

  Array.from(row.querySelectorAll("button")).forEach((button) => {
    const current = button.textContent?.trim();
    if (replacements.has(current)) button.textContent = replacements.get(current);
    button.style.whiteSpace = "nowrap";
    button.style.paddingInline = "0.65rem";
    button.style.flexShrink = "1";
  });

  row.style.flexWrap = "nowrap";
  row.style.gap = "0.375rem";
}

export function installProgrammeButtonLabels() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};

  shortenProgrammeButtons();
  const observer = new MutationObserver(shortenProgrammeButtons);
  observer.observe(document.body, { childList: true, subtree: true });

  return () => observer.disconnect();
}
