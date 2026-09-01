import { resolveWorkoutExerciseSide } from "./workoutDisplay.js";

function normalizedName(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function workoutTimestamp(workout) {
  const completed = workout?.completedAt;
  if (completed?.seconds) return Number(completed.seconds) * 1000;
  const parsed = Date.parse(completed || workout?.updatedAt || workout?.createdAt || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function orderedCompletedWorkouts(workouts = []) {
  return workouts
    .filter((workout) => workout?.status === "completed" || workout?.completed === true || Boolean(workout?.completedAt))
    .slice()
    .sort((a, b) => String(b.date || b.workoutDate || "").localeCompare(String(a.date || a.workoutDate || "")) || workoutTimestamp(b) - workoutTimestamp(a));
}

function recordedSets(exercise = {}) {
  if (exercise.recordedSets?.length) return exercise.recordedSets;
  return (exercise.prescriptionBlocks || exercise.prescription?.blocks || []).flatMap((block) => block?.actualSets || []);
}

function valueMap(sets, getter) {
  const entries = sets.flatMap((set, index) => {
    const value = getter(set);
    if (value === "" || value === undefined || value === null || !Number.isFinite(Number(value))) return [];
    return [[Number(set.setNumber || index + 1), Number(value)]];
  });
  return entries.length ? Object.fromEntries(entries) : {};
}

function exerciseCandidates(workout, target) {
  const targetId = String(target?.exerciseId || "");
  const targetName = normalizedName(target?.exerciseNameSnapshot);
  const all = workout?.exercises || [];
  const byId = targetId ? all.filter((exercise) => String(exercise?.exerciseId || "") === targetId) : [];
  const candidates = byId.length ? byId : targetName ? all.filter((exercise) => normalizedName(exercise?.exerciseNameSnapshot) === targetName) : [];
  if (!candidates.length) return [];

  const targetEquipment = target?.equipmentType || "standard";
  const sameEquipment = candidates.filter((exercise) => (exercise?.equipmentType || "standard") === targetEquipment);
  const equipmentCandidates = sameEquipment.length ? sameEquipment : candidates;

  const targetSide = resolveWorkoutExerciseSide(target);
  const sameSide = equipmentCandidates.filter((exercise) => resolveWorkoutExerciseSide(exercise) === targetSide);
  if (sameSide.length) return sameSide;
  if (targetSide !== undefined) {
    const legacySide = equipmentCandidates.filter((exercise) => resolveWorkoutExerciseSide(exercise) === undefined);
    if (legacySide.length) return legacySide;
  }
  return targetSide === undefined ? equipmentCandidates : [];
}

export function quickPreviousPerformanceForExercise(workouts = [], target = {}) {
  for (const workout of orderedCompletedWorkouts(workouts)) {
    for (const exercise of exerciseCandidates(workout, target)) {
      const sets = recordedSets(exercise);
      const weights = valueMap(sets, (set) => set.weight ?? set.rawWeight);
      const reps = valueMap(sets, (set) => set.actualReps ?? set.rawReps ?? set.reps);
      if (Object.keys(weights).length || Object.keys(reps).length) return { weights, reps };
    }
  }
  return { weights: {}, reps: {} };
}

export function hydrateQuickWorkoutPreviousPerformance(workout, completedWorkouts = []) {
  if (!workout || workout.sourceType !== "one_off") return workout;
  return {
    ...workout,
    exercises: (workout.exercises || []).map((exercise) => {
      const previous = quickPreviousPerformanceForExercise(completedWorkouts, exercise);
      return {
        ...exercise,
        recordedSets: (exercise.recordedSets || []).map((set) => ({
          ...set,
          previousWeight: previous.weights[set.setNumber] ?? "",
          previousReps: previous.reps[set.setNumber] ?? "",
        })),
      };
    }),
  };
}
