import { EXERCISE_LOGGING_METHOD, EXERCISE_TYPE, inferDurationUnit, planPrescriptionSummary } from "./plans.js";
import { SIDE } from "./v2Models.js";

export const WORKOUT_BEHAVIOR = Object.freeze({ COMPLETION: "completion", WEIGHT: "weight", INTERVALS: "intervals" });

export function isCompletedWorkout(workout) {
  return workout?.status === "completed" || workout?.completed === true;
}

export function completedWorkoutHistory(workouts = []) {
  return workouts.filter(isCompletedWorkout).slice().sort((a, b) => String(b.date || b.workoutDate || "").localeCompare(String(a.date || a.workoutDate || "")) || String(b.completedAt?.seconds || b.completedAt || "").localeCompare(String(a.completedAt?.seconds || a.completedAt || "")));
}

export function sessionWorkoutStatus(programmeId, sessionId, workouts = [], today) {
  const unfinished = workouts.find((workout) => workout.status === "in_progress" && workout.planId === programmeId && workout.sessionId === sessionId);
  if (unfinished) return { kind: "continue", label: "Continue workout", count: 1, workout: unfinished };
  const current = new Date(`${today}T00:00:00Z`);
  const day = current.getUTCDay() || 7;
  const monday = new Date(current);
  monday.setUTCDate(current.getUTCDate() - day + 1);
  const weekStart = monday.toISOString().slice(0, 10);
  const count = workouts.filter((workout) => workout.status === "completed" && workout.planId === programmeId && workout.sessionId === sessionId && workout.date >= weekStart && workout.date <= today).length;
  if (!count) return { kind: "none", label: "", count: 0 };
  return { kind: "done", label: count === 1 ? "Done this week" : `Done ${count} times this week`, count };
}

export function durationLabel(seconds, unit) {
  const value = Number(seconds || 0);
  if (!value) return "";
  const displayUnit = unit || inferDurationUnit(value);
  return displayUnit === "minutes" ? `${value / 60} min` : `${value} sec`;
}

export function workoutBehaviorForExercise(exercise) {
  if (exercise.loggingMethod === EXERCISE_LOGGING_METHOD.REPS_WEIGHT) return WORKOUT_BEHAVIOR.WEIGHT;
  if (exercise.loggingMethod === EXERCISE_LOGGING_METHOD.INTERVALS) return WORKOUT_BEHAVIOR.INTERVALS;
  return WORKOUT_BEHAVIOR.COMPLETION;
}

export function workoutItem(exercise) {
  return {
    id: exercise.id,
    name: exercise.exerciseNameSnapshot,
    summary: exercise.loggingMethod === EXERCISE_LOGGING_METHOD.COMPLETED ? "" : planPrescriptionSummary(exercise),
    behavior: workoutBehaviorForExercise(exercise),
  };
}

export function resolveWorkoutExerciseSide(exercise = {}) {
  if (Object.values(SIDE).includes(exercise.sideSnapshot)) return exercise.sideSnapshot;
  if (Object.values(SIDE).includes(exercise.prescription?.side)) return exercise.prescription.side;
  const legacySide = (exercise.prescriptionBlocks || exercise.prescription?.blocks || []).find((block) => Object.values(SIDE).includes(block?.side))?.side;
  return legacySide;
}

export function workoutExerciseSideLabel(exercise) {
  if (![EXERCISE_TYPE.STRENGTH, EXERCISE_TYPE.BALANCE].includes(exercise?.exerciseType)) return "";
  const side = resolveWorkoutExerciseSide(exercise);
  if (side === SIDE.LEFT) return "Left only";
  if (side === SIDE.RIGHT) return "Right only";
  return "";
}

export function workoutExerciseProgressKey(exercise) {
  return `${exercise.exerciseId}:${resolveWorkoutExerciseSide(exercise) || "none"}`;
}

export function previousWeightForExercise(workouts = [], exerciseId) {
  const weights = previousWeightsForExercise(workouts, exerciseId);
  return weights[1] ?? Object.values(weights)[0] ?? "";
}

export function previousWeightsForExercise(workouts = [], target) {
  const exerciseId = typeof target === "string" ? target : target.exerciseId;
  const targetId = typeof target === "string" ? undefined : target.id;
  const targetSide = typeof target === "string" ? undefined : resolveWorkoutExerciseSide(target);
  const ordered = workouts.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const candidates = ordered.flatMap((workout) => (workout.exercises || []).filter((item) => item.exerciseId === exerciseId).map((exercise) => ({ exercise, sameIdentity: Boolean(targetId && exercise.id === targetId) })));
  const explicit = candidates.filter(({ exercise }) => resolveWorkoutExerciseSide(exercise) === targetSide && (targetSide !== undefined || resolveWorkoutExerciseSide(exercise) === undefined)).sort((a, b) => Number(b.sameIdentity) - Number(a.sameIdentity));
  const legacy = candidates.filter(({ exercise }) => resolveWorkoutExerciseSide(exercise) === undefined);
  const match = explicit[0] || (explicit.length === 0 && legacy.length === 1 ? legacy[0] : undefined);
  if (match) {
    const exercise = match.exercise;
    const sets = exercise?.recordedSets?.length ? exercise.recordedSets : (exercise?.prescriptionBlocks || []).flatMap((block) => block.actualSets || []);
    const weighted = sets.filter((set) => Number.isFinite(Number(set.weight)));
    if (weighted.length) return Object.fromEntries(weighted.map((set, index) => [Number(set.setNumber || index + 1), Number(set.weight)]));
  }
  return {};
}

export function groupSessionExercises(exercises = []) {
  const weighted = exercises.filter((exercise) => workoutBehaviorForExercise(exercise) === WORKOUT_BEHAVIOR.WEIGHT);
  const intervals = exercises.filter((exercise) => workoutBehaviorForExercise(exercise) === WORKOUT_BEHAVIOR.INTERVALS);
  const completion = exercises.filter((exercise) => workoutBehaviorForExercise(exercise) === WORKOUT_BEHAVIOR.COMPLETION);
  const mobility = completion.filter((exercise) => [EXERCISE_TYPE.MOBILITY, EXERCISE_TYPE.STRETCH].includes(exercise.exerciseType));
  const other = completion.filter((exercise) => exercise.exerciseType === EXERCISE_TYPE.OTHER || exercise.exerciseType === EXERCISE_TYPE.PLYOMETRIC || exercise.loggingMethod === EXERCISE_LOGGING_METHOD.COMPLETED).filter((exercise) => !mobility.includes(exercise));
  const standard = completion.filter((exercise) => !mobility.includes(exercise) && !other.includes(exercise));
  return { mobility, other, standard, weighted, intervals };
}
