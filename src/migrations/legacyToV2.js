import { deterministicId, stableHash } from "../lib/domain/ids.js";
import {
  SET_TYPE,
  SIDE,
  WORKOUT_STATUS,
  createExerciseDefinition,
  createPrescriptionBlock,
  createWorkout,
  createWorkoutSet,
  manualProgression,
  unknownTargetReps,
} from "../lib/domain/v2Models.js";

const LEGACY_BUILT_IN_EXERCISES = [
  { id: "lp", label: "Leg Press", singleLeg: true, builtIn: true },
  { id: "le", label: "Leg Extension", singleLeg: true, builtIn: true },
  { id: "hc", label: "Hamstring Curl", singleLeg: true, builtIn: true },
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value) {
  return typeof value === "string" ? value : "";
}

function parseOptionalNumber(value) {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function legacyExerciseId(rawExerciseId, fallbackParts) {
  return asString(rawExerciseId) || `unknown-${stableHash(fallbackParts)}`;
}

function legacyExerciseName(rawExerciseId, exerciseMap) {
  const exercise = exerciseMap.get(rawExerciseId);
  if (exercise?.label) return exercise.label;
  if (rawExerciseId) return `Unknown legacy exercise (${rawExerciseId})`;
  return "Unknown legacy exercise";
}

function sideConfigForLegacyExercise(exercise, fallbackSession) {
  if (exercise?.singleLeg || fallbackSession?.singleLeg) return "mixed";
  return SIDE.BOTH;
}

function createLegacyExerciseDefinition(rawExerciseId, exerciseMap, fallbackSession) {
  const id = legacyExerciseId(rawExerciseId, { rawExerciseId, fallbackSession });
  const exercise = exerciseMap.get(rawExerciseId);

  return createExerciseDefinition({
    id,
    name: legacyExerciseName(rawExerciseId, exerciseMap),
    defaultSideConfig: sideConfigForLegacyExercise(exercise, fallbackSession),
    category: exercise?.builtIn ? "rehab" : "other",
    notes: "",
    isArchived: false,
    legacy: {
      source: exercise ? "legacyExerciseCatalog" : "legacySessionReference",
      originalId: rawExerciseId ?? null,
      builtIn: Boolean(exercise?.builtIn),
      singleLeg: Boolean(exercise?.singleLeg ?? fallbackSession?.singleLeg),
      raw: exercise ?? null,
    },
  });
}

function legacySessionRef(entry) {
  return {
    legacyWeek: asString(entry.week?.week),
    legacySessionId: asString(entry.session?.id),
    legacySessionIndex: entry.sessionIndex,
    originalExerciseId: asString(entry.session?.exerciseId) || null,
    date: asString(entry.session?.date),
  };
}

function makeWorkoutId(date, entries) {
  return deterministicId("legacy-workout", {
    date,
    sessions: entries.map(legacySessionRef),
    rawSessions: entries.map((entry) => entry.session ?? null),
  });
}

function makeWorkoutExerciseId(workoutId, entry, exerciseId) {
  return deterministicId("legacy-workout-exercise", {
    workoutId,
    exerciseId,
    legacy: legacySessionRef(entry),
  });
}

function makeBlockId(workoutExerciseId, side) {
  return deterministicId("legacy-block", { workoutExerciseId, side });
}

function makeSetId(workoutExerciseId, side, setIndex, set) {
  return deterministicId("legacy-set", { workoutExerciseId, side, setIndex, set });
}

function transformSets(workoutExerciseId, side, sets) {
  return asArray(sets).map((set, index) => {
    const rawReps = asString(set?.reps);
    const rawWeight = asString(set?.weight);

    return createWorkoutSet({
      id: makeSetId(workoutExerciseId, side, index, set),
      setNumber: index + 1,
      side,
      setType: SET_TYPE.WORKING,
      targetReps: unknownTargetReps(),
      actualReps: parseOptionalNumber(rawReps),
      weight: parseOptionalNumber(rawWeight),
      unit: "kg",
      completed: Boolean(rawReps || rawWeight),
      rawReps,
      rawWeight,
    });
  });
}

function createLegacyBlock(workoutExerciseId, side, sets, sortOrder) {
  const actualSets = transformSets(workoutExerciseId, side, sets);

  return {
    ...createPrescriptionBlock({
      id: makeBlockId(workoutExerciseId, side),
      side,
      targetSets: actualSets.length,
      targetReps: unknownTargetReps(),
      targetWeight: { mode: "none" },
      notes: "",
      sortOrder,
    }),
    actualSets,
  };
}

function transformLegacySessionToWorkoutExercise({ workoutId, entry, exerciseMap, sortOrder }) {
  const { week, session, sessionIndex } = entry;
  const rawExerciseId = asString(session?.exerciseId);
  const exerciseId = legacyExerciseId(rawExerciseId, { week: week?.week, sessionIndex, session });
  const exerciseNameSnapshot = legacyExerciseName(rawExerciseId, exerciseMap);
  const workoutExerciseId = makeWorkoutExerciseId(workoutId, entry, exerciseId);
  const blocks = session?.singleLeg
    ? [
        createLegacyBlock(workoutExerciseId, SIDE.LEFT, session?.leftSets, 0),
        createLegacyBlock(workoutExerciseId, SIDE.RIGHT, session?.rightSets, 1),
      ]
    : [createLegacyBlock(workoutExerciseId, SIDE.BOTH, session?.sets, 0)];

  return {
    id: workoutExerciseId,
    exerciseId,
    exerciseNameSnapshot,
    sortOrder,
    progression: manualProgression(false),
    prescriptionBlocks: blocks,
    notes: asString(session?.notes),
    legacy: {
      migratedFrom: "rehabData.weeks.sessions",
      legacyWeek: asString(week?.week),
      legacySessionId: asString(session?.id),
      legacySessionIndex: sessionIndex,
      originalExerciseId: rawExerciseId || null,
      singleLeg: Boolean(session?.singleLeg),
      raw: session ?? null,
    },
  };
}

function transformLegacyDateGroupToWorkout({ date, entries, exerciseMap, userId = null }) {
  const workoutId = makeWorkoutId(date, entries);
  const exercises = entries.map((entry, index) =>
    transformLegacySessionToWorkoutExercise({ workoutId, entry, exerciseMap, sortOrder: index })
  );

  const notes = entries
    .map((entry) => asString(entry.session?.notes))
    .filter(Boolean)
    .join("\n");

  return createWorkout({
    id: workoutId,
    userId,
    date,
    startedAt: null,
    completedAt: date || null,
    status: WORKOUT_STATUS.COMPLETED,
    planId: null,
    planVersion: null,
    sessionId: null,
    sessionNameSnapshot: "Legacy log",
    notes,
    exercises,
    legacy: {
      migratedFrom: "rehabData.weeks.sessions.byDate",
      date,
      legacySessions: entries.map(legacySessionRef),
      rawSessions: entries.map((entry) => entry.session ?? null),
    },
  });
}

export function transformLegacyDataToV2(legacyData = {}, { userId = null } = {}) {
  const exerciseMap = new Map();

  for (const exercise of LEGACY_BUILT_IN_EXERCISES) {
    exerciseMap.set(exercise.id, exercise);
  }

  for (const exercise of asArray(legacyData.customExercises)) {
    const id = asString(exercise?.id);
    if (id) exerciseMap.set(id, exercise);
  }

  const groupedEntries = new Map();
  const referencedExerciseIds = new Set();
  let legacySessionCount = 0;

  for (const week of asArray(legacyData.weeks)) {
    asArray(week?.sessions).forEach((session, sessionIndex) => {
      const date = asString(session?.date);
      const entry = { week, session, sessionIndex };
      const rawExerciseId = asString(session?.exerciseId);
      const exerciseId = legacyExerciseId(rawExerciseId, { week: week?.week, sessionIndex, session });

      if (!groupedEntries.has(date)) groupedEntries.set(date, []);
      groupedEntries.get(date).push(entry);
      referencedExerciseIds.add(exerciseId);
      legacySessionCount += 1;
    });
  }

  const workouts = [...groupedEntries.entries()].map(([date, entries]) =>
    transformLegacyDateGroupToWorkout({ date, entries, exerciseMap, userId })
  );

  const exercises = [...referencedExerciseIds]
    .sort()
    .map((exerciseId) => createLegacyExerciseDefinition(exerciseId, exerciseMap, findFallbackSession(legacyData, exerciseId)));

  return {
    settings: {
      schemaVersion: 2,
      surgeryDate: asString(legacyData.surgeryDate),
      migration: {
        source: "rehabData",
        strategy: "pure-legacy-to-v2-preview",
      },
    },
    exercises,
    workouts,
    migrationSummary: {
      legacyWeekCount: asArray(legacyData.weeks).length,
      legacySessionCount,
      exerciseCount: exercises.length,
      workoutCount: workouts.length,
    },
  };
}

function findFallbackSession(legacyData, exerciseId) {
  for (const week of asArray(legacyData.weeks)) {
    const found = asArray(week?.sessions).find((session) => asString(session?.exerciseId) === exerciseId);
    if (found) return found;
  }
  return null;
}

export const __testables = {
  parseOptionalNumber,
  transformLegacyDateGroupToWorkout,
  transformLegacySessionToWorkoutExercise,
};
