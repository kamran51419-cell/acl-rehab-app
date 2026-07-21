import { formatDate } from "./date.js";
import { EXERCISE_LOGGING_METHOD } from "./plans.js";
import { SIDE } from "./v2Models.js";
import { completedWorkoutHistory, resolveWorkoutExerciseSide } from "./workoutDisplay.js";

export const EXERCISE_VARIANT = Object.freeze({ DOUBLE: "double", SINGLE: "single", SYMMETRY: "symmetry" });
export const PROGRESS_SIDE_MODE = Object.freeze({
  STANDARD: "standard",
  LEFT_RIGHT: "left_right",
  LEFT_ONLY: "left_only",
  RIGHT_ONLY: "right_only",
});

function setReps(set = {}) {
  return Number(set.actualReps ?? set.reps ?? set.rawReps ?? set.prescribedReps?.value ?? set.prescribedReps?.max ?? 0);
}

function completedSets(exercise) {
  return (exercise.recordedSets || []).filter((set) => Number.isFinite(Number(set.weight)) && Number(set.weight) >= 0).map((set) => ({ ...set, weight: Number(set.weight), reps: setReps(set) }));
}

function variantForSide(side) { return side === SIDE.LEFT || side === SIDE.RIGHT ? EXERCISE_VARIANT.SINGLE : EXERCISE_VARIANT.DOUBLE; }
function exerciseDate(workout, exercise) { return exercise.completedDate || workout.date || workout.workoutDate || ""; }
function pairedIdentity(exercise = {}) { return String(exercise.id || "").replace(/-(left|right)$/, ""); }

function progressSideMode(exercise, weightedExercises) {
  const side = resolveWorkoutExerciseSide(exercise);
  if (side === SIDE.BOTH || side === SIDE.SEPARATE || !side) return PROGRESS_SIDE_MODE.STANDARD;
  if (side !== SIDE.LEFT && side !== SIDE.RIGHT) return PROGRESS_SIDE_MODE.STANDARD;
  const opposite = side === SIDE.LEFT ? SIDE.RIGHT : SIDE.LEFT;
  const paired = weightedExercises.some((candidate) => candidate !== exercise
    && candidate.exerciseId === exercise.exerciseId
    && pairedIdentity(candidate) === pairedIdentity(exercise)
    && resolveWorkoutExerciseSide(candidate) === opposite);
  if (paired) return PROGRESS_SIDE_MODE.LEFT_RIGHT;
  return side === SIDE.LEFT ? PROGRESS_SIDE_MODE.LEFT_ONLY : PROGRESS_SIDE_MODE.RIGHT_ONLY;
}

export function exerciseProgressEntries(workouts = []) {
  return completedWorkoutHistory(workouts).flatMap((workout) => {
    const weightedExercises = (workout.exercises || []).filter((exercise) => exercise.loggingMethod === EXERCISE_LOGGING_METHOD.REPS_WEIGHT);
    return weightedExercises.flatMap((exercise) => {
      const sets = completedSets(exercise);
      if (!sets.length) return [];
      const side = resolveWorkoutExerciseSide(exercise);
      const sideMode = progressSideMode(exercise, weightedExercises);
      const date = exerciseDate(workout, exercise);
      return sets.map((set) => ({ id: `${workout.id}:${exercise.id}:${set.id || set.setNumber}`, workoutId: workout.id, exerciseId: exercise.exerciseId, exerciseName: exercise.exerciseNameSnapshot || "Exercise", date, displayDate: formatDate(date).replaceAll("-", "/"), side, sideMode, variant: variantForSide(side), weight: set.weight, reps: set.reps, setNumber: Number(set.setNumber || 0) }));
    });
  });
}

function newestFirst(a, b) { return String(b.date).localeCompare(String(a.date)) || b.setNumber - a.setNumber; }

export function groupExerciseProgress(workouts = []) {
  const groups = new Map();
  exerciseProgressEntries(workouts).forEach((entry) => { if (!groups.has(entry.exerciseId)) groups.set(entry.exerciseId, { exerciseId: entry.exerciseId, name: entry.exerciseName, entries: [] }); groups.get(entry.exerciseId).entries.push(entry); });
  return [...groups.values()].map((group) => { group.entries.sort(newestFirst); group.latest = group.entries[0]; group.latestDate = group.latest.date; return group; }).sort((a, b) => String(b.latestDate).localeCompare(String(a.latestDate)) || a.name.localeCompare(b.name));
}

export function variantEntries(group, variant) { return (group?.entries || []).filter((entry) => entry.variant === variant).sort(newestFirst); }
export function sideModeEntries(group, sideMode) { return (group?.entries || []).filter((entry) => entry.sideMode === sideMode).sort(newestFirst); }
export function heaviestEntry(entries = []) { return entries.slice().sort((a, b) => b.weight - a.weight || String(b.date).localeCompare(String(a.date)) || b.reps - a.reps)[0] || null; }

export function dailyHeaviest(entries = []) {
  const byDateAndSide = new Map();
  entries.forEach((entry) => { const key = `${entry.date}:${entry.sideMode || "unknown"}:${entry.side || SIDE.BOTH}`; const current = byDateAndSide.get(key); if (!current || entry.weight > current.weight || (entry.weight === current.weight && entry.reps > current.reps)) byDateAndSide.set(key, entry); });
  return [...byDateAndSide.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function symmetryEntries(group) {
  const dates = new Map();
  dailyHeaviest(sideModeEntries(group, PROGRESS_SIDE_MODE.LEFT_RIGHT)).forEach((entry) => { if (!dates.has(entry.date)) dates.set(entry.date, {}); if (entry.side === SIDE.LEFT) dates.get(entry.date).left = entry; if (entry.side === SIDE.RIGHT) dates.get(entry.date).right = entry; });
  return [...dates.entries()].flatMap(([date, sides]) => { if (!sides.left || !sides.right || Math.max(sides.left.weight, sides.right.weight) <= 0) return []; return [{ date, displayDate: sides.left.displayDate, left: sides.left.weight, right: sides.right.weight, symmetry: Math.round((Math.min(sides.left.weight, sides.right.weight) / Math.max(sides.left.weight, sides.right.weight)) * 100) }]; }).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function resultLabel(entry) { return entry ? `${entry.weight} kg × ${entry.reps || "—"}` : "—"; }

export function completedExerciseGroups(workouts = []) {
  const groups = new Map();
  completedWorkoutHistory(workouts).forEach((workout) => {
    (workout.exercises || []).forEach((exercise) => {
      if (!exercise.exerciseId) return;
      if (!groups.has(exercise.exerciseId)) groups.set(exercise.exerciseId, { exerciseId: exercise.exerciseId, name: exercise.exerciseNameSnapshot || "Exercise", exerciseType: exercise.exerciseType || "other", performances: [], weightedEntries: [] });
      const date = exerciseDate(workout, exercise);
      groups.get(exercise.exerciseId).performances.push({ workoutId: workout.id, date, displayDate: formatDate(date).replaceAll("-", "/"), exercise });
    });
  });
  const weighted = new Map(groupExerciseProgress(workouts).map((group) => [group.exerciseId, group.entries]));
  return [...groups.values()].map((group) => { group.performances.sort((a, b) => String(b.date).localeCompare(String(a.date))); group.weightedEntries = weighted.get(group.exerciseId) || []; group.isRehabExercise = group.weightedEntries.some((entry) => entry.side === SIDE.LEFT || entry.side === SIDE.RIGHT); group.latestDate = group.performances[0]?.date || ""; return group; }).sort((a, b) => String(b.latestDate).localeCompare(String(a.latestDate)) || a.name.localeCompare(b.name));
}

export function weightedPersonalBests(entries = []) {
  if (!entries.length) return null;
  const heaviest = heaviestEntry(entries);
  const bestSet = entries.slice().sort((a, b) => (b.weight * b.reps) - (a.weight * a.reps) || b.weight - a.weight)[0];
  const workoutVolumes = new Map();
  entries.forEach((entry) => workoutVolumes.set(entry.workoutId, (workoutVolumes.get(entry.workoutId) || 0) + entry.weight * entry.reps));
  const highestVolume = [...workoutVolumes.entries()].map(([workoutId, volume]) => ({ workoutId, volume, date: entries.find((entry) => entry.workoutId === workoutId)?.date || "", displayDate: entries.find((entry) => entry.workoutId === workoutId)?.displayDate || "" })).sort((a, b) => b.volume - a.volume || String(b.date).localeCompare(String(a.date)))[0];
  return { heaviest, bestSet, highestVolume };
}

export function exerciseProgressSummary(group) {
  const chronological = (group?.performances || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const weightedChronological = (group?.weightedEntries || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const byDate = new Map();
  weightedChronological.forEach((entry) => { const current = byDate.get(entry.date); if (!current || entry.weight > current.weight || (entry.weight === current.weight && entry.reps > current.reps)) byDate.set(entry.date, entry); });
  const daily = [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const firstBest = daily[0] || null; const latestBest = daily.at(-1) || null;
  return { first: chronological[0] || null, latest: chronological.at(-1) || null, firstBest, latestBest, improvement: firstBest && latestBest ? latestBest.weight - firstBest.weight : null };
}
