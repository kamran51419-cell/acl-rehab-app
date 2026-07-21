import { collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";

let stopPlans = null;
let stopWorkouts = null;
let currentUid = null;
let plans = [];
let workouts = [];

function textOf(element) {
  return (element?.textContent || "").trim();
}

function clickNavigation(label) {
  const button = [...document.querySelectorAll("button")].find((item) => textOf(item) === label);
  button?.click();
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function enteredWeight(set) {
  const value = set?.weight ?? set?.rawWeight;
  return value !== "" && value !== undefined && value !== null && Number.isFinite(Number(value));
}

function setCompleted(exercise, set) {
  if (exercise?.loggingMethod === "reps_weight") return enteredWeight(set);
  return Boolean(set?.completed);
}

function workoutProgress(workout) {
  const entries = (workout?.exercises || []).flatMap((exercise) => {
    if (exercise.recordedSets?.length) return exercise.recordedSets.map((set) => setCompleted(exercise, set));
    return [Boolean(exercise.completed || exercise.intervalProgress?.completed || exercise.intervalProgress?.completedBlocks?.length)];
  });
  return { completed: entries.filter(Boolean).length, total: entries.length };
}

function activeProgramme() {
  return plans
    .filter((plan) => plan.isActive && !plan.isArchived)
    .sort((a, b) => String(b.updatedAtToken || b.id).localeCompare(String(a.updatedAtToken || a.id)))[0] || null;
}

function lastWorkout() {
  return workouts
    .filter((workout) => workout.status === "completed" || workout.completed === true)
    .sort((a, b) => String(b.completedAt?.seconds || b.completedAt || b.date || b.workoutDate || "").localeCompare(String(a.completedAt?.seconds || a.completedAt || a.date || a.workoutDate || "")))[0] || null;
}

function summaryCard({ eyebrow, title, meta, detail, onClick }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:bg-slate-50";
  button.addEventListener("click", onClick);
  button.innerHTML = `<div class="text-xs font-semibold uppercase tracking-wide text-slate-500">${eyebrow}</div><div class="mt-1 flex items-start justify-between gap-3"><div class="min-w-0"><div class="truncate text-lg font-semibold text-slate-900">${title}</div><div class="mt-1 text-sm text-slate-600">${meta}</div>${detail ? `<div class="mt-1 text-xs text-slate-500">${detail}</div>` : ""}</div><span class="shrink-0 text-slate-400">›</span></div>`;
  return button;
}

function renderHomeCards() {
  const home = document.querySelector("main") || document.body;
  const startButton = [...home.querySelectorAll("button")].find((button) => ["Start Workout", "Continue Workout"].includes(textOf(button)));
  if (!startButton) return;
  const actionSection = startButton.closest("section");
  if (!actionSection || actionSection.parentElement?.querySelector(":scope > [data-home-summary-cards]")) return;

  const wrapper = document.createElement("section");
  wrapper.dataset.homeSummaryCards = "true";
  wrapper.className = "grid gap-3 sm:grid-cols-2";

  const programme = activeProgramme();
  if (programme) {
    const sessions = programme.sessions || [];
    const exerciseCount = sessions.reduce((total, session) => total + (session.exercises?.length || 0), 0);
    wrapper.append(summaryCard({
      eyebrow: "Active programme",
      title: programme.name || "Untitled programme",
      meta: `${sessions.length} session${sessions.length === 1 ? "" : "s"} · ${exerciseCount} exercise${exerciseCount === 1 ? "" : "s"}`,
      detail: "Open programme",
      onClick: () => clickNavigation("Programme"),
    }));
  }

  const workout = lastWorkout();
  if (workout) {
    const progress = workoutProgress(workout);
    const incomplete = progress.total > 0 && progress.completed < progress.total;
    wrapper.append(summaryCard({
      eyebrow: "Last workout",
      title: workout.sessionNameSnapshot || workout.name || "Workout",
      meta: `${formatDate(workout.date || workout.workoutDate)} · ${incomplete ? "Incomplete" : "Completed"}`,
      detail: progress.total ? `${progress.completed}/${progress.total} sets completed` : "View in workout history",
      onClick: () => {
        clickNavigation("Progress");
        requestAnimationFrame(() => setTimeout(() => clickNavigation("Workout History"), 50));
      },
    }));
  }

  if (wrapper.children.length) actionSection.parentElement.insertBefore(wrapper, actionSection);
}

function fixSurgeryDateLayout() {
  const label = [...document.querySelectorAll("label")].find((item) => textOf(item) === "Surgery date (optional)");
  if (!label) return;
  const container = label.parentElement;
  const input = container?.querySelector('input[type="date"]');
  const remove = [...(container?.querySelectorAll("button") || [])].find((button) => textOf(button) === "Remove");
  if (!input) return;

  input.classList.remove("w-full");
  input.classList.add("min-w-0", "flex-1");
  input.style.width = "auto";
  input.style.maxWidth = "100%";

  const dateRow = input.parentElement?.dataset.surgeryDateRow === "true" ? input.parentElement : null;
  if (!dateRow) {
    const row = document.createElement("div");
    row.dataset.surgeryDateRow = "true";
    row.className = "mt-1 flex w-full items-center gap-2";
    input.parentElement.insertBefore(row, input);
    row.append(input);
    if (remove) row.append(remove);
  } else if (remove && remove.parentElement !== dateRow) {
    dateRow.append(remove);
  }

  [...container.querySelectorAll("p")].forEach((paragraph) => {
    if (/^\d{2}\/\d{2}\/\d{2}$/.test(textOf(paragraph))) paragraph.remove();
  });
}

function subscribe(uid) {
  if (!uid || uid === currentUid) return;
  stopPlans?.();
  stopWorkouts?.();
  currentUid = uid;
  stopPlans = onSnapshot(collection(db, "users", uid, "plans"), (snapshot) => {
    plans = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    document.querySelector("[data-home-summary-cards]")?.remove();
    renderHomeCards();
  });
  stopWorkouts = onSnapshot(collection(db, "users", uid, "workouts"), (snapshot) => {
    workouts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    document.querySelector("[data-home-summary-cards]")?.remove();
    renderHomeCards();
  });
}

function apply() {
  subscribe(auth.currentUser?.uid);
  renderHomeCards();
  fixSurgeryDateLayout();
}

export function installHomeSummaryAndSettingsFix() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      apply();
    });
  };
  apply();
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    stopPlans?.();
    stopWorkouts?.();
  };
}
