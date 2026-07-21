function textOf(element) {
  return (element?.textContent || "").trim();
}

function enableRepeatExerciseAdds() {
  document.querySelectorAll("button").forEach((button) => {
    if (textOf(button) !== "Selected") return;

    const row = button.closest("div.flex.items-center.justify-between");
    const picker = row?.closest("div.rounded-xl.border-dashed");
    if (!picker || !/Exercise picker/i.test(textOf(picker.querySelector("strong")))) return;

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
    wrapper.className = "rounded-2xl border border-slate-200 bg-white p-4";

    const heading = document.createElement("h2");
    heading.className = "font-semibold";
    heading.textContent = left.title;

    const grid = document.createElement("div");
    grid.className = "mt-3 grid grid-cols-2 gap-3";

    left.titleElement.remove();
    right.titleElement.remove();

    [...leftCard.querySelectorAll("p")].forEach((label) => {
      if (textOf(label) === "Left only") label.textContent = "Left";
    });
    [...rightCard.querySelectorAll("p")].forEach((label) => {
      if (textOf(label) === "Right only") label.textContent = "Right";
    });

    leftCard.className = "min-w-0 rounded-xl border border-slate-200 bg-white p-3";
    rightCard.className = "min-w-0 rounded-xl border border-slate-200 bg-white p-3";

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
  return () => observer.disconnect();
}
