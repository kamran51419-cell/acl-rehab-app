import { formatDate } from "./date.js";
import { EXERCISE_LOGGING_METHOD } from "./plans.js";
import { SIDE } from "./v2Models.js";
import { completedWorkoutHistory, resolveWorkoutExerciseSide } from "./workoutDisplay.js";

export const EXERCISE_VARIANT = Object.freeze({ DOUBLE: "double", SINGLE: "single", SYMMETRY: "symmetry" });

function setReps(set = {}) {
  return Number(set.actualReps ?? set.reps ?? set.rawReps ?? set.prescribedReps?.value ?? set.prescribedReps?.max ?? 0);
}

function completedSets(exercise) {
  return (exercise.recordedSets || []).filter((set) => Number.isFinite(Number(set.weight)) && Number(set.weight) >= 0).map((set) => ({ ...set, weight: Number(set.weight), reps: setReps(set) }));
}

function variantForSide(side) {
  return side === SIDE.LEFT || side === SIDE.RIGHT ? EXERCISE_VARIANT.SINGLE : EXERCISE_VARIANT.DOUBLE;
}

export function exerciseProgressEntries(workouts = []) {
  return completedWorkoutHistory(workouts).flatMap((workout) => (workout.exercises || []).flatMap((exercise) => {
    if (exercise.loggingMethod !== EXERCISE_LOGGING_METHOD.REPS_WEIGHT) return [];
    const sets = completedSets(exercise);
    if (!sets.length) return [];
    const side = resolveWorkoutExerciseSide(exercise);
    return sets.map((set) => ({
      id: `${workout.id}:${exercise.id}:${set.id || set.setNumber}`,
      workoutId: workout.id,
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseNameSnapshot || "Exercise",
      date: workout.date || workout.workoutDate || "",
      displayDate: formatDate(workout.date || workout.workoutDate).replaceAll("-", "/"),
      side,
      variant: variantForSide(side),
      weight: set.weight,
      reps: set.reps,
      setNumber: Number(set.setNumber || 0),
    }));
  }));
}

function newestFirst(a, b) {
  return String(b.date).localeCompare(String(a.date)) || b.setNumber - a.setNumber;
}

export function groupExerciseProgress(workouts = []) {
  const groups = new Map();
  exerciseProgressEntries(workouts).forEach((entry) => {
    if (!groups.has(entry.exerciseId)) groups.set(entry.exerciseId, { exerciseId: entry.exerciseId, name: entry.exerciseName, entries: [] });
    groups.get(entry.exerciseId).entries.push(entry);
  });
  return [...groups.values()].map((group) => {
    group.entries.sort(newestFirst);
    group.latest = group.entries[0];
    group.latestDate = group.latest.date;
    return group;
  }).sort((a, b) => String(b.latestDate).localeCompare(String(a.latestDate)) || a.name.localeCompare(b.name));
}

export function variantEntries(group, variant) {
  return (group?.entries || []).filter((entry) => entry.variant === variant).sort(newestFirst);
}

export function heaviestEntry(entries = []) {
  return entries.slice().sort((a, b) => b.weight - a.weight || String(b.date).localeCompare(String(a.date)) || b.reps - a.reps)[0] || null;
}

export function dailyHeaviest(entries = []) {
  const byDateAndSide = new Map();
  entries.forEach((entry) => {
    const key = `${entry.date}:${entry.side || SIDE.BOTH}`;
    const current = byDateAndSide.get(key);
    if (!current || entry.weight > current.weight || (entry.weight === current.weight && entry.reps > current.reps)) byDateAndSide.set(key, entry);
  });
  return [...byDateAndSide.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function symmetryEntries(group) {
  const singles = variantEntries(group, EXERCISE_VARIANT.SINGLE);
  const dates = new Map();
  dailyHeaviest(singles).forEach((entry) => {
    if (!dates.has(entry.date)) dates.set(entry.date, {});
    if (entry.side === SIDE.LEFT) dates.get(entry.date).left = entry;
    if (entry.side === SIDE.RIGHT) dates.get(entry.date).right = entry;
  });
  return [...dates.entries()].flatMap(([date, sides]) => {
    if (!sides.left || !sides.right || Math.max(sides.left.weight, sides.right.weight) <= 0) return [];
    return [{ date, displayDate: sides.left.displayDate, left: sides.left.weight, right: sides.right.weight, symmetry: Math.round((Math.min(sides.left.weight, sides.right.weight) / Math.max(sides.left.weight, sides.right.weight)) * 100) }];
  }).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function resultLabel(entry) {
  return entry ? `${entry.weight} kg × ${entry.reps || "—"}` : "—";
}
