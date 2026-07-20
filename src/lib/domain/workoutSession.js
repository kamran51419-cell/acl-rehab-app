import { EXERCISE_LOGGING_METHOD } from "./plans.js";
import { SIDE, WORKOUT_STATUS } from "./v2Models";
import { resolveWorkoutExerciseSide } from "./workoutDisplay.js";

function ordered(items) {
  return (items || []).slice().sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

export function prescribedRepsSnapshot(targetReps = {}) {
  return targetReps.type === "range" ? { type: "range", min: targetReps.min, max: targetReps.max } : { type: "fixed", value: targetReps.value };
}

export function createWorkoutExerciseSnapshot(exercise, previousWeights = {}) {
  const setBased = [EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT, EXERCISE_LOGGING_METHOD.TIME, EXERCISE_LOGGING_METHOD.DISTANCE, EXERCISE_LOGGING_METHOD.TIME_DISTANCE].includes(exercise.loggingMethod);
  const count = setBased ? Math.max(1, Number(exercise.prescription?.targetSets || 1)) : 0;
  const prescribedReps = prescribedRepsSnapshot(
  exercise.prescription?.targetReps,
);

const initialReps =
  prescribedReps.type === "range"
    ? prescribedReps.min
    : prescribedReps.value ?? "";
  return {
    id: exercise.id,
    exerciseId: exercise.exerciseId,
    exerciseNameSnapshot: exercise.exerciseNameSnapshot,
    exerciseType: exercise.exerciseType,
    loggingMethod: exercise.loggingMethod,
    sideSnapshot: resolveWorkoutExerciseSide(exercise),
    programmeNoteSnapshot: exercise.notes || "",
    prescription: structuredClone(exercise.prescription || {}),
    sortOrder: exercise.sortOrder,
    completed: false,
    recordedSets: Array.from({ length: count }, (_, index) => ({
      id: `${exercise.id}-set-${index + 1}`,
      setNumber: index + 1,
      prescribedReps: prescribedRepsSnapshot(
  exercise.prescription?.targetReps,
),
actualReps:
  prescribedRepsSnapshot(
    exercise.prescription?.targetReps,
  ).type === "range"
    ? prescribedRepsSnapshot(
        exercise.prescription?.targetReps,
      ).min
    : prescribedRepsSnapshot(
        exercise.prescription?.targetReps,
      ).value ?? "",
rawReps: String(
  prescribedRepsSnapshot(
    exercise.prescription?.targetReps,
  ).type === "range"
    ? prescribedRepsSnapshot(
        exercise.prescription?.targetReps,
      ).min ?? ""
    : prescribedRepsSnapshot(
        exercise.prescription?.targetReps,
      ).value ?? "",
),
durationSeconds: "",
rawDuration: "",
distance: "",
rawDistance: "",
      weight: exercise.loggingMethod === EXERCISE_LOGGING_METHOD.REPS_WEIGHT ? previousWeights[index + 1] ?? "" : "",
      rawWeight: previousWeights[index + 1] === undefined ? "" : String(previousWeights[index + 1]),
      unit: "kg",
    })),
    intervalProgress: null,
    notes: "",
  };
}

export function createInProgressWorkout({
  id,
  userId,
  programme,
  session,
  date,
  previousWeightsByExercise = {},
  createdAt = null,
}) {
  return {
    id,
    userId,
    date,
    createdAt,
    updatedAt: null,
    completedAt: null,
    status: WORKOUT_STATUS.IN_PROGRESS,
    sourceType: "programme",
    name: session.name,
    startedAt: createdAt || new Date().toISOString(),
    planId: programme.id,
    programmeId: programme.id,
    planVersion: programme.version || 1,
    programmeNameSnapshot: programme.name,
    sessionId: session.id,
    sessionNameSnapshot: session.name,

    exercises: ordered(session.exercises).flatMap((exercise) => {
      const previousWeights =
        previousWeightsByExercise[exercise.id] ||
        previousWeightsByExercise[exercise.exerciseId] ||
        {};

      if (exercise.prescription?.side !== SIDE.SEPARATE) {
        return [createWorkoutExerciseSnapshot(exercise, previousWeights)];
      }

      const leftExercise = {
        ...exercise,
        id: `${exercise.id}-left`,
        prescription: {
          ...exercise.prescription,
          side: SIDE.LEFT,
        },
      };

      const rightExercise = {
        ...exercise,
        id: `${exercise.id}-right`,
        prescription: {
          ...exercise.prescription,
          side: SIDE.RIGHT,
        },
      };

      return [
        createWorkoutExerciseSnapshot(leftExercise, previousWeights),
        createWorkoutExerciseSnapshot(rightExercise, previousWeights),
      ];
    }),

    notes: "",
  };
}

export function createOneOffWorkout({ id, userId, name = "", exercises = [], date, startedAt = new Date().toISOString() }) {
  return { id, userId, date, createdAt: null, updatedAt: null, completedAt: null, startedAt, status: WORKOUT_STATUS.IN_PROGRESS, sourceType: "one_off", name: name.trim() || "One-off Workout", sessionNameSnapshot: name.trim() || "One-off Workout", exercises: exercises.map((definition, index) => createWorkoutExerciseSnapshot({ id: `${definition.id}-${index + 1}`, exerciseId: definition.id, exerciseNameSnapshot: definition.name, exerciseType: definition.exerciseType || "other", loggingMethod: definition.loggingMethod || EXERCISE_LOGGING_METHOD.REPS, sortOrder: index, prescription: {}, sideSnapshot: definition.defaultSideConfig }, {})), notes: "" };
}

export function isMeaningfulWorkout(workout) {
  return (workout?.exercises || []).some((exercise) => exercise.completed || (exercise.recordedSets || []).some((set) => [set.actualReps, set.weight, set.durationSeconds, set.distance].some((value) => value !== "" && value !== undefined && value !== null)));
}

export function updateRecordedSet(workout, exerciseId, setId, field, rawValue) {
  const rawField = { actualReps: "rawReps", weight: "rawWeight", durationSeconds: "rawDuration", distance: "rawDistance" }[field];
  const value = rawValue === "" || !Number.isFinite(Number(rawValue)) ? "" : Number(rawValue);
  return { ...workout, exercises: workout.exercises.map((exercise) => exercise.id !== exerciseId ? exercise : { ...exercise, recordedSets: exercise.recordedSets.map((set) => set.id !== setId ? set : { ...set, [field]: value, [rawField]: rawValue }) }) };
}

export function addRecordedSet(workout, exerciseId) { return { ...workout, exercises: workout.exercises.map((exercise) => { if (exercise.id !== exerciseId) return exercise; const setNumber = exercise.recordedSets.length + 1; return { ...exercise, recordedSets: [...exercise.recordedSets, { id: `${exercise.id}-set-${Date.now()}-${setNumber}`, setNumber, actualReps: "", rawReps: "", weight: "", rawWeight: "", durationSeconds: "", rawDuration: "", distance: "", rawDistance: "", unit: "kg" }] }; }) }; }
export function removeRecordedSet(workout, exerciseId, setId) { return { ...workout, exercises: workout.exercises.map((exercise) => exercise.id !== exerciseId ? exercise : { ...exercise, recordedSets: exercise.recordedSets.filter((set) => set.id !== setId).map((set, index) => ({ ...set, setNumber: index + 1 })) }) }; }

export function findInProgressWorkout(workouts, planId, sessionId, date) {
  return (workouts || []).find((workout) => workout.status === WORKOUT_STATUS.IN_PROGRESS && workout.planId === planId && workout.sessionId === sessionId && workout.date === date) || null;
}

export function resumeWorkout(existing, template) {
  if (!existing) return template;
  return {
    ...template,
    ...existing,
    exercises: template.exercises.map((fresh) => {
      const savedById = (existing.exercises || []).find((exercise) => exercise.id === fresh.id);
      const sameDefinition = (existing.exercises || []).filter((exercise) => exercise.exerciseId === fresh.exerciseId);
      const saved = savedById || (sameDefinition.length === 1 ? sameDefinition[0] : undefined);
      if (!saved) return fresh;
      const legacySets = (saved.prescriptionBlocks || []).flatMap((block) => block.actualSets || []);
      const savedSets = saved.recordedSets?.length ? saved.recordedSets : legacySets.length ? legacySets : saved.weight !== undefined ? [{ setNumber: 1, weight: saved.weight }] : [];
      return { ...fresh, ...saved, recordedSets: fresh.recordedSets.map((set) => { const previous = savedSets.find((savedSet) => savedSet.id === set.id || Number(savedSet.setNumber) === set.setNumber); if (!previous) return set; const weight = previous.weight ?? set.weight; return { ...set, ...previous, weight, rawWeight: previous.rawWeight !== undefined && previous.rawWeight !== "" ? previous.rawWeight : (weight !== undefined && weight !== "" ? String(weight) : set.rawWeight) }; }) };
    }),
  };
}

export function isWeightedExerciseComplete(exercise) {
  return Boolean(exercise.recordedSets?.length) && exercise.recordedSets.every((set) => set.weight !== "" && Number.isFinite(Number(set.weight)) && Number(set.weight) >= 0);
}

export function updateRecordedSetWeight(workout, exerciseId, setId, weight) {
  const numericWeight = weight === "" || !Number.isFinite(Number(weight)) ? "" : Number(weight);
  return { ...workout, exercises: workout.exercises.map((exercise) => exercise.id === exerciseId ? { ...exercise, recordedSets: exercise.recordedSets.map((set) => set.id === setId ? { ...set, weight: numericWeight, rawWeight: weight } : set) } : exercise) };
}

export function reorderExerciseSnapshots(exercises, fromIndex, toIndex) {
  const next = ordered(exercises);
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= next.length || toIndex >= next.length) return next;
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next.map((exercise, index) => ({ ...exercise, sortOrder: index }));
}

export function createDebouncedSaver(save, delay = 500, onStatus = () => {}) {
  let timer = null;
  let latest;
  let revision = 0;
  let queue = Promise.resolve();
  async function persist(value, currentRevision) {
    onStatus("saving");
    try {
      queue = queue.catch(() => {}).then(() => save(value));
      await queue;
      if (currentRevision === revision) onStatus("saved");
    } catch (error) {
      if (currentRevision === revision) onStatus("error", error);
      throw error;
    }
  }
  return {
    schedule(value) {
      latest = value;
      revision += 1;
      clearTimeout(timer);
      const current = revision;
      timer = setTimeout(() => { timer = null; persist(latest, current).catch(() => {}); }, delay);
    },
    async flush() {
      if (!timer) { await queue; return; }
      clearTimeout(timer);
      timer = null;
      const current = revision;
      await persist(latest, current);
    },
    async cancel() { clearTimeout(timer); timer = null; await queue.catch(() => {}); },
  };
}

export async function completeWorkout(workout, saver, finish) {
  await saver.flush();
  return finish(workout);
}
