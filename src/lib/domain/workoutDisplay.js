import { EXERCISE_LOGGING_METHOD, EXERCISE_TYPE, inferDurationUnit, planPrescriptionSummary } from "./plans.js";

export const WORKOUT_BEHAVIOR = Object.freeze({ COMPLETION: "completion", WEIGHT: "weight", INTERVALS: "intervals" });

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

export function previousWeightForExercise(workouts = [], exerciseId) {
  const ordered = workouts.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  for (const workout of ordered) {
    const exercise = (workout.exercises || []).find((item) => item.exerciseId === exerciseId);
    const sets = (exercise?.prescriptionBlocks || []).flatMap((block) => block.actualSets || []);
    const weighted = sets.filter((set) => Number.isFinite(Number(set.weight)));
    if (weighted.length) return Number(weighted[weighted.length - 1].weight);
  }
  return "";
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
