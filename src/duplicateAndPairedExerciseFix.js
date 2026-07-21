function textOf(element) {
  return (element?.textContent || "").trim();
}

function reactClickHandler(button) {
  const propsKey = Object.keys(button).find((key) => key.startsWith("__reactProps$"));
  return propsKey ? button[propsKey]?.onClick : null;
}

function pickerFor(button) {
  const row = button.closest("div.flex.items-center.justify-between");
  const picker = row?.closest("div.rounded-xl.border-dashed");
  return picker && /Exercise picker/i.test(textOf(picker.querySelector("strong"))) ? picker : null;
}

function enableRepeatExerciseAdds() {
  document.querySelectorAll("button").forEach((button) => {
    if (textOf(button) !== "Selected") return;
    if (!pickerFor(button)) return;

    button.dataset.repeatExerciseAdd = "true";
    button.disabled = false;
    button.removeAttribute("disabled");
    button.textContent = "Add";
    button.classList.remove("opacity-50", "cursor-not-allowed");
  });
}

function exerciseCardInfo(section) {
  const title = section.querySelector(":scope > div:first-child h2");
  if (!title) return null;

  const labels = [...section.querySelectorAll(":scope > div:first-child p")].map(textOf);
  const side = labels.find((label) => label === "Left only" || label === "Right only");
  if (!side) return null;

  return { title: textOf(title), side, titleElement: title };
}

function compactSideCard(card) {
  card.className = "min-w-0 rounded-xl border border-slate-200 bg-white p-2 sm:p-3";
  card.querySelectorAll("div.rounded-xl.bg-slate-50.p-3").forEach((row) => {
    row.className = "grid min-w-0 grid-cols-1 gap-1 rounded-xl bg-slate-50 p-2";
    const setLabel = row.querySelector("span");
    if (setLabel) setLabel.className = "text-xs font-medium text-slate-600";
    row.querySelectorAll("label").forEach((label) => {
      label.className = "min-w-0 text-[11px] font-medium";
    });
    row.querySelectorAll("input, select").forEach((input) => {
      input.classList.add("min-w-0", "w-full");
    });
  });
}

function groupLeftRightExerciseCards() {
  const cards = [...document.querySelectorAll("section.rounded-2xl.border.border-slate-200.bg-white.p-4")]
    .filter((section) => !section.closest("[data-linked-side-exercise]"));

  for (let index = 0; index < cards.length - 1; index += 1) {
    const leftCard = cards[index];
    const rightCard = cards[index + 1];
    if (leftCard.parentElement !== rightCard.parentElement) continue;

    const left = exerciseCardInfo(leftCard);
    const right = exerciseCardInfo(rightCard);
    if (!left || !right || left.title !== right.title) continue;
    if (left.side !== "Left only" || right.side !== "Right only") continue;

    const wrapper = document.createElement("section");
    wrapper.dataset.linkedSideExercise = "true";
    wrapper.className = "min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4";

    const heading = document.createElement("h2");
    heading.className = "font-semibold";
    heading.textContent = left.title;

    const grid = document.createElement("div");
    grid.className = "mt-3 grid min-w-0 grid-cols-2 gap-2 sm:gap-3";

    left.titleElement.remove();
    right.titleElement.remove();

    [...leftCard.querySelectorAll("p")].forEach((label) => {
      if (textOf(label) === "Left only") label.textContent = "Left";
    });
    [...rightCard.querySelectorAll("p")].forEach((label) => {
      if (textOf(label) === "Right only") label.textContent = "Right";
    });

    compactSideCard(leftCard);
    compactSideCard(rightCard);

    leftCard.parentElement.insertBefore(wrapper, leftCard);
    wrapper.append(heading, grid);
    grid.append(leftCard, rightCard);
    index += 1;
  }
}

function applyFixes() {
  enableRepeatExerciseAdds();
  groupLeftRightExerciseCards();
}

export function installDuplicateAndPairedExerciseFix() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};

  const forceRepeatAdd = (event) => {
    const button = event.target.closest?.("button[data-repeat-exercise-add='true']");
    if (!button || !pickerFor(button)) return;
    const handler = reactClickHandler(button);
    if (typeof handler !== "function") return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    handler({ currentTarget: button, target: button, preventDefault() {}, stopPropagation() {} });
  };

  document.addEventListener("click", forceRepeatAdd, true);

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      applyFixes();
    });
  };

  applyFixes();
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled"] });
  return () => {
    observer.disconnect();
    document.removeEventListener("click", forceRepeatAdd, true);
  };
}
