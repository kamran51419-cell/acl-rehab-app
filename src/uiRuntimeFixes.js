import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { createLibraryExercise, EXERCISE_TYPE } from "./lib/domain/plans";
import { saveExerciseDefinition } from "./lib/firebase/planRepository";

const CATEGORY_LABELS = ["Strength", "Cardio", "Balance", "Mobility / Stretch", "Other"];

const STARTER_EXERCISES = [
  ["Leg press", EXERCISE_TYPE.STRENGTH],
  ["Leg extension", EXERCISE_TYPE.STRENGTH],
  ["Hamstring curl", EXERCISE_TYPE.STRENGTH],
  ["Squat", EXERCISE_TYPE.STRENGTH],
  ["Bulgarian split squat", EXERCISE_TYPE.STRENGTH],
  ["Romanian deadlift", EXERCISE_TYPE.STRENGTH],
  ["Hip thrust", EXERCISE_TYPE.STRENGTH],
  ["Glute bridge", EXERCISE_TYPE.STRENGTH],
  ["Step up", EXERCISE_TYPE.STRENGTH],
  ["Calf raise", EXERCISE_TYPE.STRENGTH],
  ["Bench press", EXERCISE_TYPE.STRENGTH],
  ["Incline dumbbell press", EXERCISE_TYPE.STRENGTH],
  ["Shoulder press", EXERCISE_TYPE.STRENGTH],
  ["Lat pulldown", EXERCISE_TYPE.STRENGTH],
  ["Cable row", EXERCISE_TYPE.STRENGTH],
  ["Face pull", EXERCISE_TYPE.STRENGTH],
  ["Bicep curl", EXERCISE_TYPE.STRENGTH],
  ["Tricep pushdown", EXERCISE_TYPE.STRENGTH],
  ["Bike", EXERCISE_TYPE.CARDIO],
  ["Treadmill", EXERCISE_TYPE.CARDIO],
  ["Walk", EXERCISE_TYPE.CARDIO],
  ["Run", EXERCISE_TYPE.CARDIO],
  ["Cross trainer", EXERCISE_TYPE.CARDIO],
  ["Rowing machine", EXERCISE_TYPE.CARDIO],
  ["Single-leg balance", EXERCISE_TYPE.BALANCE],
  ["BOSU balance", EXERCISE_TYPE.BALANCE],
  ["Knee flexion mobility", EXERCISE_TYPE.MOBILITY],
  ["Knee extension mobility", EXERCISE_TYPE.MOBILITY],
  ["Hip mobility", EXERCISE_TYPE.MOBILITY],
  ["Ankle mobility", EXERCISE_TYPE.MOBILITY],
  ["Hamstring stretch", EXERCISE_TYPE.MOBILITY],
  ["Quad stretch", EXERCISE_TYPE.MOBILITY],
  ["Calf stretch", EXERCISE_TYPE.MOBILITY],
  ["Hip flexor stretch", EXERCISE_TYPE.MOBILITY],
];

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function seedStarterExercises(user) {
  if (!user?.uid) return;

  await Promise.all(
    STARTER_EXERCISES.map(async ([name, exerciseType]) => {
      const id = `built-in-${slug(name)}`;
      const reference = doc(db, "users", user.uid, "exercises", id);
      const existing = await getDoc(reference);
      if (existing.exists()) return;

      const exercise = createLibraryExercise({
        id,
        userId: user.uid,
        name,
        exerciseType,
      });

      await saveExerciseDefinition(db, user.uid, { ...exercise, isBuiltIn: true }, { updatedAtToken: `starter-${id}` });
    })
  );
}

function directChildren(element) {
  return Array.from(element.children);
}

function addProgrammeSessionCollapseControls() {
  document.querySelectorAll('[id^="programme-session-"]').forEach((sessionCard) => {
    if (sessionCard.dataset.collapseReady === "true") return;

    const header = directChildren(sessionCard)[0];
    if (!header) return;

    const dragHandle = header.querySelector('button[aria-label^="Drag "]');
    if (!dragHandle) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "mt-6 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-800";
    button.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    button.setAttribute("aria-label", "Collapse session");
    button.setAttribute("aria-expanded", "true");

    const setCollapsed = (collapsed) => {
      directChildren(sessionCard).slice(1).forEach((child) => {
        child.hidden = collapsed;
      });
      sessionCard.dataset.collapsed = collapsed ? "true" : "false";
      button.style.transform = collapsed ? "rotate(-90deg)" : "rotate(0deg)";
      button.setAttribute("aria-label", collapsed ? "Expand session" : "Collapse session");
      button.setAttribute("aria-expanded", String(!collapsed));
    };

    button.addEventListener("click", () => setCollapsed(sessionCard.dataset.collapsed !== "true"));
    dragHandle.before(button);
    sessionCard.dataset.collapseReady = "true";
    setCollapsed(false);
  });
}

function removeRightExerciseCollapseControls() {
  document.querySelectorAll('[id^="programme-session-"]').forEach((sessionCard) => {
    const exerciseList = directChildren(sessionCard)[1];
    if (!exerciseList) return;

    directChildren(exerciseList).forEach((exerciseCard) => {
      const collapseButtons = Array.from(exerciseCard.querySelectorAll('button[aria-expanded]'))
        .filter((button) => /exercise/i.test(button.getAttribute("aria-label") || ""));
      if (collapseButtons.length > 1) collapseButtons.at(-1)?.remove();
    });
  });
}

function reactPropsKey(element) {
  return Object.keys(element).find((key) => key.startsWith("__reactProps$"));
}

function makeDuplicateAddButtonFunctional(button, primaryClassName) {
  const key = reactPropsKey(button);
  const props = key ? button[key] : null;
  if (key && props?.disabled) button[key] = { ...props, disabled: false, children: "Add" };

  button.disabled = false;
  button.removeAttribute("disabled");
  button.removeAttribute("aria-disabled");
  button.textContent = "Add";
  button.dataset.duplicateExerciseAdd = "true";
  button.className = primaryClassName || "inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700";
  button.style.setProperty("background", "#2563eb", "important");
  button.style.setProperty("background-image", "none", "important");
  button.style.setProperty("border-color", "#2563eb", "important");
  button.style.setProperty("color", "#ffffff", "important");
}

function allowDuplicateProgrammeExercises() {
  document.querySelectorAll('[id^="programme-session-"] .rounded-xl.border-dashed').forEach((picker) => {
    const buttons = Array.from(picker.querySelectorAll("button"));
    const primaryAdd = buttons.find((button) => button.textContent?.trim() === "Add" && !button.disabled && button.dataset.duplicateExerciseAdd !== "true");
    const selectedButtons = buttons.filter((button) => button.textContent?.trim() === "Selected");
    selectedButtons.forEach((button) => makeDuplicateAddButtonFunctional(button, primaryAdd?.className));
  });
}

function prepareDuplicateExerciseClick(event) {
  const button = event.target?.closest?.('button[data-duplicate-exercise-add="true"]');
  if (!button) return;
  const key = reactPropsKey(button);
  const props = key ? button[key] : null;
  if (key && props?.disabled) button[key] = { ...props, disabled: false, children: "Add" };
  button.disabled = false;
}

function removeRedundantExerciseLibraryCopy() {
  document.querySelectorAll("h1").forEach((heading) => {
    if (heading.textContent?.trim() !== "Manage Exercises") return;
    const intro = heading.parentElement;
    if (intro) intro.hidden = true;
  });

  document.querySelectorAll("h2").forEach((heading) => {
    if (heading.textContent?.trim() !== "Exercise library") return;
    const header = heading.parentElement?.parentElement;
    if (!header || header.dataset.libraryCopyCleaned === "true") return;

    const description = heading.parentElement?.querySelector("p");
    if (description) description.remove();

    const badge = Array.from(header.children).find((child) => /active/i.test(child.textContent || ""));
    if (badge) badge.remove();

    header.dataset.libraryCopyCleaned = "true";
  });
}

function categoryForCard(card) {
  const text = card.textContent || "";
  return CATEGORY_LABELS.find((label) => text.includes(label)) || "";
}

function applyCategoryFilter(scope, value) {
  scope.dataset.exerciseCategory = value;
  scope.querySelectorAll("[data-category-filter-card]").forEach((card) => {
    const category = categoryForCard(card);
    card.hidden = value !== "all" && category !== value;
  });
}

function markFilterCards(scope) {
  scope.querySelectorAll("button").forEach((button) => {
    const label = button.textContent?.trim();
    if (!["Add", "Use", "Edit", "Selected"].includes(label)) return;
    const card = button.closest(".rounded-xl, .rounded-2xl");
    if (card) card.dataset.categoryFilterCard = "true";
  });
}

function addCategoryFilter(searchLabel) {
  const scope = searchLabel.closest(".rounded-3xl, .rounded-xl") || searchLabel.parentElement?.parentElement;
  if (!scope || scope.dataset.categoryFilterReady === "true") return;

  markFilterCards(scope);

  const wrapper = document.createElement("label");
  wrapper.className = "block min-w-[190px] space-y-1 text-sm font-medium text-slate-700";
  wrapper.innerHTML = '<span>Category</span><select class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="all">All categories</option><option value="Strength">Strength</option><option value="Cardio">Cardio</option><option value="Balance">Balance</option><option value="Mobility / Stretch">Mobility / Stretch</option><option value="Other">Other</option></select>';

  const select = wrapper.querySelector("select");
  select.addEventListener("change", () => applyCategoryFilter(scope, select.value));

  const searchContainer = searchLabel.parentElement;
  if (searchContainer?.parentElement) searchContainer.parentElement.append(wrapper);
  else searchLabel.after(wrapper);

  scope.dataset.categoryFilterReady = "true";
  applyCategoryFilter(scope, "all");
}

function installExerciseCategoryFilters() {
  document.querySelectorAll("label").forEach((label) => {
    const heading = label.querySelector("span")?.textContent?.trim() || label.childNodes[0]?.textContent?.trim();
    if (heading === "Search exercises") addCategoryFilter(label);
  });

  document.querySelectorAll('[data-category-filter-ready="true"]').forEach((scope) => {
    markFilterCards(scope);
    applyCategoryFilter(scope, scope.dataset.exerciseCategory || "all");
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
  removeRightExerciseCollapseControls();
  allowDuplicateProgrammeExercises();
  removeProgrammePageHeading();
  removeRedundantExerciseLibraryCopy();
  installExerciseCategoryFilters();
}

export function installUiRuntimeFixes() {
  if (typeof window === "undefined" || typeof MutationObserver === "undefined") return () => {};

  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    if (user) seedStarterExercises(user).catch((error) => console.error("Could not add starter exercises", error));
  });

  document.addEventListener("click", prepareDuplicateExerciseClick, true);
  applyFixes();
  const observer = new MutationObserver(applyFixes);
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    document.removeEventListener("click", prepareDuplicateExerciseClick, true);
    observer.disconnect();
    unsubscribeAuth();
  };
}
