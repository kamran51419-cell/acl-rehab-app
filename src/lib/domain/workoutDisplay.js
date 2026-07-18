import { EXERCISE_LOGGING_METHOD, EXERCISE_TYPE } from "./plans.js";

export function durationLabel(seconds) {
  const value = Number(seconds || 0);
  if (!value) return "";
  return value % 60 === 0 ? `${value / 60} min` : `${value} sec`;
}

export function checklistItems(exercise) {
  if (exercise.prescription?.items?.length) {
    return exercise.prescription.items.map((item) => ({ id: `${exercise.id}-${item.id}`, name: item.name, duration: "" }));
  }
  return [{ id: exercise.id, name: exercise.exerciseNameSnapshot, duration: exercise.loggingMethod === EXERCISE_LOGGING_METHOD.TIME ? durationLabel(exercise.prescription?.targetDurationSeconds) : "" }];
}

export function groupSessionExercises(exercises = []) {
  const mobility = exercises.filter((exercise) => [EXERCISE_TYPE.MOBILITY, EXERCISE_TYPE.STRETCH].includes(exercise.exerciseType));
  const tasks = exercises.filter((exercise) => exercise.exerciseType === EXERCISE_TYPE.OTHER || exercise.exerciseType === EXERCISE_TYPE.PLYOMETRIC || exercise.loggingMethod === EXERCISE_LOGGING_METHOD.COMPLETED).filter((exercise) => !mobility.includes(exercise));
  const regular = exercises.filter((exercise) => !mobility.includes(exercise) && !tasks.includes(exercise));
  return { mobility, tasks, regular };
}
