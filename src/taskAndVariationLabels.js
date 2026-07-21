const EXACT_TEXT_REPLACEMENTS = new Map([
  ["Routine Tasks", "Daily & Weekly Tasks"],
  ["No routine tasks.", "No tasks yet."],
  ["No routine tasks due today or overdue.", "No tasks due today or overdue."],
  ["Give every routine task a name and select at least one day.", "Give every task a name and select at least one day."],
]);

function textOf(element) {
  return (element?.textContent || "").trim();
}

function replaceExactText() {
  document.querySelectorAll("h1, h2, h3, p, div, span, label").forEach((element) => {
    if (element.children.length > 0) return;
    const replacement = EXACT_TEXT_REPLACEMENTS.get(textOf(element));
    if (replacement) element.textContent = replacement;
  });
}

function renameHomeHeading() {
  document.querySelectorAll("section").forEach((section) => {
    const heading = section.querySelector(":scope > h2");
    if (!heading || textOf(heading) !== "Routine") return;

    const containsTaskControls = Boolean(
      section.querySelector('button[aria-label^="Complete "]') ||
      [...section.querySelectorAll("p")].some((item) => /tasks? due today|overdue/i.test(textOf(item)))
    );

    if (containsTaskControls) heading.textContent = "Today's Tasks";
  });
}

function renameVariationFields() {
  document.querySelectorAll("label").forEach((label) => {
    const caption = label.querySelector(":scope > span");
    if (!caption || textOf(caption) !== "Side") return;

    const select = label.querySelector("select");
    if (!select) return;
    const options = [...select.options].map((option) => textOf(option));
    if (options.includes("Standard") && options.some((option) => /Left & right/i.test(option))) {
      caption.textContent = "Variation";
    }
  });
}

function applyLabels() {
  replaceExactText();
  renameHomeHeading();
  renameVariationFields();
}

export function installTaskAndVariationLabels() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      applyLabels();
    });
  };

  applyLabels();
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
