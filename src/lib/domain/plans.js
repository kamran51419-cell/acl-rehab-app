import { stableHash } from "./ids.js";
import { PLAN_STATUS, SIDE, V2_SCHEMA_VERSION } from "./v2Models.js";

export const EXERCISE_TYPE = Object.freeze({
  STRENGTH: "strength",
  CARDIO: "cardio",
  PLYOMETRIC: "plyometric",
  BALANCE: "balance",
  MOBILITY: "mobility",
  STRETCH: "stretch",
  OTHER: "other",
  TIMED_HOLD: "timed_hold",
  FOAM_ROLLING: "foam_rolling",
});

export const EXERCISE_TYPE_OPTIONS = Object.freeze([
  EXERCISE_TYPE.STRENGTH,
  EXERCISE_TYPE.CARDIO,
  EXERCISE_TYPE.PLYOMETRIC,
  EXERCISE_TYPE.BALANCE,
  EXERCISE_TYPE.MOBILITY,
  EXERCISE_TYPE.STRETCH,
  EXERCISE_TYPE.OTHER,
]);

export const LIBRARY_EXERCISE_TYPE_OPTIONS = Object.freeze([
  EXERCISE_TYPE.STRENGTH,
  EXERCISE_TYPE.CARDIO,
  EXERCISE_TYPE.BALANCE,
  EXERCISE_TYPE.MOBILITY,
  EXERCISE_TYPE.OTHER,
]);

export const EXERCISE_LOGGING_METHOD = Object.freeze({
  REPS: "reps",
  REPS_WEIGHT: "reps_weight",
  TIME: "time",
  DISTANCE: "distance",
  TIME_DISTANCE: "time_distance",
  COMPLETED: "completed",
  INTERVALS: "intervals",
});

export const DEFAULT_LOGGING_METHOD_BY_EXERCISE_TYPE = Object.freeze({
  [EXERCISE_TYPE.STRENGTH]: EXERCISE_LOGGING_METHOD.REPS_WEIGHT,
  [EXERCISE_TYPE.CARDIO]: EXERCISE_LOGGING_METHOD.TIME,
  [EXERCISE_TYPE.PLYOMETRIC]: EXERCISE_LOGGING_METHOD.COMPLETED,
  [EXERCISE_TYPE.BALANCE]: EXERCISE_LOGGING_METHOD.TIME,
  [EXERCISE_TYPE.MOBILITY]: EXERCISE_LOGGING_METHOD.TIME,
  [EXERCISE_TYPE.STRETCH]: EXERCISE_LOGGING_METHOD.TIME,
  [EXERCISE_TYPE.OTHER]: EXERCISE_LOGGING_METHOD.REPS,
  [EXERCISE_TYPE.TIMED_HOLD]: EXERCISE_LOGGING_METHOD.TIME,
  [EXERCISE_TYPE.FOAM_ROLLING]: EXERCISE_LOGGING_METHOD.TIME,
});

export function defaultLoggingMethodForExerciseType(exerciseType = EXERCISE_TYPE.STRENGTH) {
  return DEFAULT_LOGGING_METHOD_BY_EXERCISE_TYPE[exerciseType] || EXERCISE_LOGGING_METHOD.COMPLETED;
}

export function loggingMethodsForExerciseType(exerciseType) {
  if (exerciseType === EXERCISE_TYPE.STRENGTH) return [EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT];
  if (exerciseType === EXERCISE_TYPE.PLYOMETRIC) return [];
  if (exerciseType === EXERCISE_TYPE.CARDIO) return [EXERCISE_LOGGING_METHOD.TIME, EXERCISE_LOGGING_METHOD.DISTANCE, EXERCISE_LOGGING_METHOD.INTERVALS];
  if (exerciseType === EXERCISE_TYPE.BALANCE) return [EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.TIME];
  if ([EXERCISE_TYPE.MOBILITY, EXERCISE_TYPE.STRETCH, EXERCISE_TYPE.TIMED_HOLD, EXERCISE_TYPE.FOAM_ROLLING].includes(exerciseType)) {
    return [EXERCISE_LOGGING_METHOD.TIME];
  }
  if (exerciseType === EXERCISE_TYPE.OTHER) return [EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT, EXERCISE_LOGGING_METHOD.TIME, EXERCISE_LOGGING_METHOD.DISTANCE, EXERCISE_LOGGING_METHOD.INTERVALS];
  return [];
}

export const TARGET_WEIGHT_MODE = Object.freeze({
  PREVIOUS: "previous",
  MANUAL: "manual",
  NONE: "none",
});

export const REP_TARGET_TYPE = Object.freeze({
  FIXED: "fixed",
  RANGE: "range",
});

function makeGeneratedId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function sortByOrder(items) {
  return asArray(items).slice().sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));
}

function positiveInt(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

function nonNegativeNumber(value) {
  return value === undefined || value === "" || (Number.isFinite(Number(value)) && Number(value) >= 0);
}

function normalizeName(name) {
  return String(name || "").trim();
}

export function createBlankPlan({ id = makeGeneratedId("plan"), userId = null, name = "", description = "", isActive = false } = {}) {
  return {
    schemaVersion: V2_SCHEMA_VERSION,
    id,
    userId,
    name,
    description,
    status: isActive ? PLAN_STATUS.ACTIVE : PLAN_STATUS.DRAFT,
    isActive,
    isArchived: false,
    version: 1,
    sourcePlanId: null,
    routineTasks: [],
    sessions: [],
  };
}

export function createPlanSession({ id = makeGeneratedId("session"), name = "", notes = "", sortOrder = 0, exercises = [] } = {}) {
  return { id, name, notes, sortOrder, exercises };
}

export function fixedReps(value = 10) {
  return { type: REP_TARGET_TYPE.FIXED, value: Number(value) };
}

export function repRange(min = 8, max = 12) {
  return { type: REP_TARGET_TYPE.RANGE, min: Number(min), max: Number(max) };
}

export function createStrengthBlock({
  id = makeGeneratedId("block"),
  side = SIDE.BOTH,
  targetSets = 3,
  targetReps = fixedReps(10),
  notes = "",
  sortOrder = 0,
} = {}) {
  return { id, side, targetSets: Number(targetSets), targetReps, notes, sortOrder };
}

export function createStrengthPrescription({ side = SIDE.BOTH, targetSets = 3, targetReps = fixedReps(10), notes = "" } = {}) {
  return { side, targetSets: Number(targetSets), targetReps, notes };
}

export function inferDurationUnit(seconds) {
  return Number(seconds || 0) >= 60 && Number(seconds || 0) % 60 === 0 ? "minutes" : "seconds";
}

export function durationSummary(seconds, durationUnit) {
  const value = Number(seconds || 0);
  const unit = durationUnit || inferDurationUnit(value);
  return unit === "minutes" ? `${value / 60} min` : `${value} sec`;
}

export function createTimedHoldPrescription({ side = SIDE.BOTH, targetSets = 3, targetDurationSeconds = 30, durationUnit = "seconds", notes = "" } = {}) {
  return { side, targetSets: Number(targetSets), targetDurationSeconds: Number(targetDurationSeconds), durationUnit, notes };
}

export function createCardioPrescription({ targetDurationSeconds = 900, durationUnit = "minutes", targetDistance = undefined, distance = undefined, notes = "" } = {}) {
  return { targetDurationSeconds: Number(targetDurationSeconds), durationUnit, targetDistance: targetDistance ?? distance, notes };
}

export const INTERVAL_PHASE = Object.freeze({ WORK: "work", REST: "rest" });

export function createIntervalStage({ id = makeGeneratedId("interval"), phase = INTERVAL_PHASE.WORK, durationSeconds = 60, durationUnit = inferDurationUnit(durationSeconds), label = "", sortOrder = 0 } = {}) {
  return { id, phase, durationSeconds: Number(durationSeconds), durationUnit, label, sortOrder };
}

export function createIntervalPrescription({ stages } = {}) {
  return {
    stages: stages || [
      createIntervalStage({ phase: INTERVAL_PHASE.WORK, durationSeconds: 240, durationUnit: "minutes", sortOrder: 0 }),
      createIntervalStage({ phase: INTERVAL_PHASE.REST, durationSeconds: 60, durationUnit: "minutes", sortOrder: 1 }),
    ],
  };
}

export function createListPrescription({ items = [""], notes = "" } = {}) {
  return {
    items: asArray(items).map((name, index) => ({ id: makeGeneratedId("item"), name, sortOrder: index })),
    notes,
  };
}

export function createDefaultPrescription(exerciseType = EXERCISE_TYPE.STRENGTH, loggingMethod = defaultLoggingMethodForExerciseType(exerciseType)) {
  if ([EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT].includes(loggingMethod)) return createStrengthPrescription();
  if (loggingMethod === EXERCISE_LOGGING_METHOD.INTERVALS) return createIntervalPrescription();
  if (loggingMethod === EXERCISE_LOGGING_METHOD.DISTANCE) return createCardioPrescription({ targetDistance: 1 });
  if (loggingMethod === EXERCISE_LOGGING_METHOD.TIME && exerciseType === EXERCISE_TYPE.CARDIO) return createCardioPrescription();
  if (loggingMethod === EXERCISE_LOGGING_METHOD.TIME && [EXERCISE_TYPE.MOBILITY, EXERCISE_TYPE.STRETCH].includes(exerciseType)) return { targetDurationSeconds: 30, durationUnit: "seconds" };
  if (loggingMethod === EXERCISE_LOGGING_METHOD.TIME && ![EXERCISE_TYPE.BALANCE, EXERCISE_TYPE.TIMED_HOLD].includes(exerciseType)) return { targetDurationSeconds: 60, durationUnit: "seconds" };
  if (exerciseType === EXERCISE_TYPE.PLYOMETRIC || loggingMethod === EXERCISE_LOGGING_METHOD.COMPLETED) return {};
  if (exerciseType === EXERCISE_TYPE.TIMED_HOLD) return createTimedHoldPrescription();
  if (exerciseType === EXERCISE_TYPE.BALANCE) {
    if (loggingMethod === EXERCISE_LOGGING_METHOD.TIME) return createTimedHoldPrescription();
    if (loggingMethod === EXERCISE_LOGGING_METHOD.REPS) return createStrengthPrescription();
    return {};
  }
  if (exerciseType === EXERCISE_TYPE.CARDIO) return createCardioPrescription();
  if ([EXERCISE_TYPE.MOBILITY, EXERCISE_TYPE.STRETCH, EXERCISE_TYPE.FOAM_ROLLING].includes(exerciseType)) return { targetDurationSeconds: 30, durationUnit: "seconds" };
  return {};
}

export function createPlanExercise({
  id = makeGeneratedId("plan-exercise"),
  exerciseId,
  exerciseNameSnapshot,
  exerciseType = EXERCISE_TYPE.STRENGTH,
  sortOrder = 0,
  prescription = createDefaultPrescription(exerciseType),
  loggingMethod = defaultLoggingMethodForExerciseType(exerciseType),
  notes = "",
} = {}) {
  return { id, exerciseId, exerciseNameSnapshot, exerciseType, loggingMethod, sortOrder, prescription, notes };
}

export function createLibraryExercise({ id = makeGeneratedId("exercise"), userId = null, name, exerciseType = EXERCISE_TYPE.STRENGTH, isArchived = false, legacy = undefined } = {}) {
  if (!LIBRARY_EXERCISE_TYPE_OPTIONS.includes(exerciseType)) throw new Error("New exercises must use a supported exercise type.");
  return {
    id,
    userId,
    name: normalizeName(name),
    exerciseType,
    trackingType: exerciseType,
    isArchived,
    ...(legacy === undefined ? {} : { legacy }),
  };
}

export function duplicatePlanExercise(exercise, { sortOrder = exercise?.sortOrder ?? 0 } = {}) {
  const duplicated = {
    ...structuredClone(exercise),
    id: makeGeneratedId("plan-exercise"),
    sortOrder,
  };

  if ((exercise?.exerciseType === EXERCISE_TYPE.STRENGTH || exercise?.exerciseType === EXERCISE_TYPE.PLYOMETRIC) && exercise.prescription?.blocks) {
    duplicated.prescription = {
      ...structuredClone(exercise.prescription),
      blocks: asArray(exercise.prescription?.blocks).map((block, index) => ({
        ...structuredClone(block),
        id: makeGeneratedId("block"),
        sortOrder: index,
      })),
    };
  } else if ([EXERCISE_TYPE.MOBILITY, EXERCISE_TYPE.STRETCH, EXERCISE_TYPE.FOAM_ROLLING].includes(exercise?.exerciseType)) {
    duplicated.prescription = {
      ...structuredClone(exercise.prescription),
      items: asArray(exercise.prescription?.items).map((item, index) => ({
        ...structuredClone(item),
        id: makeGeneratedId("item"),
        sortOrder: index,
      })),
    };
  } else {
    duplicated.prescription = exercise?.prescription === undefined ? undefined : structuredClone(exercise.prescription);
  }

  return duplicated;
}

export function duplicatePlan(plan, { id = makeGeneratedId("plan"), userId = plan?.userId ?? null } = {}) {
  return {
    ...structuredClone(plan),
    id,
    userId,
    name: `${plan.name || "Workout Plan"} Copy`,
    version: 1,
    sourcePlanId: plan.id,
    status: PLAN_STATUS.DRAFT,
    isActive: false,
    isArchived: false,
    archivedAt: null,
    activatedAt: null,
    routineTasks: asArray(plan.routineTasks).map((task, index) => ({ ...structuredClone(task), id: makeGeneratedId("routine"), sortOrder: index })),
    sessions: sortByOrder(plan.sessions).map((session, sessionIndex) => ({
      ...structuredClone(session),
      id: makeGeneratedId("session"),
      sortOrder: sessionIndex,
      exercises: sortByOrder(session.exercises).map((exercise, exerciseIndex) => duplicatePlanExercise(exercise, { sortOrder: exerciseIndex })),
    })),
  };
}

export function reorderItems(items, fromIndex, toIndex) {
  const ordered = sortByOrder(items);
  if (fromIndex < 0 || fromIndex >= ordered.length || toIndex < 0 || toIndex >= ordered.length) return ordered;
  const [moved] = ordered.splice(fromIndex, 1);
  ordered.splice(toIndex, 0, moved);
  return ordered.map((item, index) => ({ ...item, sortOrder: index }));
}

export function insertItemAfter(items, afterIndex, item) {
  const ordered = sortByOrder(items);
  ordered.splice(afterIndex + 1, 0, item);
  return ordered.map((entry, index) => ({ ...entry, sortOrder: index }));
}

function pushDuplicateErrors(items, path, errors) {
  const seen = new Set();
  asArray(items).forEach((item, index) => {
    if (!item?.id) errors.push(`${path}[${index}] is missing an id.`);
    else if (seen.has(item.id)) errors.push(`${path}[${index}] duplicates id ${item.id}.`);
    else seen.add(item.id);
  });
}

function validateStrengthPrescription(prescription, path, errors) {
 if (![SIDE.BOTH, SIDE.SEPARATE, SIDE.LEFT, SIDE.RIGHT].includes(prescription.side)) {
  errors.push(`${path} has an invalid side.`);
}
  if (!positiveInt(prescription.targetSets)) errors.push(`${path} must have at least one target set.`);
  const reps = prescription.targetReps || {};
  if (reps.type === REP_TARGET_TYPE.FIXED) {
    if (!positiveInt(reps.value)) errors.push(`${path} fixed reps must be a positive whole number.`);
  } else if (reps.type === REP_TARGET_TYPE.RANGE) {
    if (!positiveInt(reps.min) || !positiveInt(reps.max) || Number(reps.min) > Number(reps.max)) errors.push(`${path} rep range is invalid.`);
  } else {
    errors.push(`${path} reps must be fixed or a range.`);
  }
}

function validateStrength(exercise, path, errors) {
  const blocks = asArray(exercise.prescription?.blocks);
  if (!blocks.length) {
    validateStrengthPrescription(exercise.prescription || {}, path, errors);
    return;
  }
  pushDuplicateErrors(blocks, `${path}.blocks`, errors);
  blocks.forEach((block, index) => {
    const blockPath = `${path}.blocks[${index}]`;
    validateStrengthPrescription(block, blockPath, errors);
  });
}

function validateTimedHold(exercise, path, errors) {
  const prescription = exercise.prescription || {};
 if (![SIDE.BOTH, SIDE.SEPARATE, SIDE.LEFT, SIDE.RIGHT].includes(prescription.side)) {
  errors.push(`${path} has an invalid side.`);
}
  if (!positiveInt(prescription.targetSets)) errors.push(`${path} must have at least one set.`);
  if (!positiveInt(prescription.targetDurationSeconds)) errors.push(`${path} duration must be a positive whole number of seconds.`);
}

function validateCardio(exercise, path, errors) {
  const method = exercise.loggingMethod || defaultLoggingMethodForExerciseType(EXERCISE_TYPE.CARDIO);
  if (method === EXERCISE_LOGGING_METHOD.INTERVALS) {
    const stages = asArray(exercise.prescription?.stages);
    if (!stages.length) errors.push(`${path} intervals must include at least one stage.`);
    pushDuplicateErrors(stages, `${path}.stages`, errors);
    stages.forEach((stage, index) => {
      if (![INTERVAL_PHASE.WORK, INTERVAL_PHASE.REST].includes(stage.phase)) errors.push(`${path}.stages[${index}] has an invalid phase.`);
      if (!positiveInt(stage.durationSeconds)) errors.push(`${path}.stages[${index}] must have a positive duration.`);
    });
  } else if (method === EXERCISE_LOGGING_METHOD.DISTANCE) {
    if (!nonNegativeNumber(exercise.prescription?.targetDistance) || Number(exercise.prescription?.targetDistance) <= 0) errors.push(`${path} cardio distance must be positive.`);
  } else if (!positiveInt(exercise.prescription?.targetDurationSeconds)) errors.push(`${path} cardio duration must be a positive whole number of seconds.`);
}

function validateListPrescription(exercise, path, errors) {
  const items = asArray(exercise.prescription?.items);
  if (!items.length) errors.push(`${path} must have at least one item.`);
  pushDuplicateErrors(items, `${path}.items`, errors);
  items.forEach((item, index) => {
    if (!normalizeName(item?.name)) errors.push(`${path}.items[${index}] needs a name.`);
  });
}

export function validatePlan(plan) {
  const errors = [];
  if (!normalizeName(plan?.name)) errors.push("Plan name is required.");
  pushDuplicateErrors(plan?.sessions, "sessions", errors);
  const sessions = asArray(plan?.sessions);
  if (plan?.isActive && !sessions.some((session) => normalizeName(session?.name))) errors.push("Active plans must include at least one valid session.");
  sessions.forEach((session, sessionIndex) => {
    const sessionPath = `sessions[${sessionIndex}]`;
    if (!normalizeName(session?.name)) errors.push(`${sessionPath} needs a name.`);
    pushDuplicateErrors(session?.exercises, `${sessionPath}.exercises`, errors);
    asArray(session?.exercises).forEach((exercise, exerciseIndex) => {
      const path = `${sessionPath}.exercises[${exerciseIndex}]`;
      if (!exercise.exerciseId) errors.push(`${path} needs an exercise.`);
      if (!normalizeName(exercise.exerciseNameSnapshot)) errors.push(`${path} needs an exercise name snapshot.`);
      const method = exercise.loggingMethod || defaultLoggingMethodForExerciseType(exercise.exerciseType);
      const allowedMethods = loggingMethodsForExerciseType(exercise.exerciseType);
      const isLegacyMethod = method === EXERCISE_LOGGING_METHOD.COMPLETED || method === EXERCISE_LOGGING_METHOD.TIME_DISTANCE || exercise.exerciseType === EXERCISE_TYPE.PLYOMETRIC;
      if (!allowedMethods.includes(method) && !isLegacyMethod) errors.push(`${path} has an unsupported prescription method.`);
      if (method === EXERCISE_LOGGING_METHOD.COMPLETED && exercise.exerciseType !== EXERCISE_TYPE.PLYOMETRIC) return;
      if (exercise.exerciseType === EXERCISE_TYPE.STRENGTH) validateStrength(exercise, path, errors);
      else if (exercise.exerciseType === EXERCISE_TYPE.PLYOMETRIC) { if (exercise.prescription?.blocks) validateStrength(exercise, path, errors); }
      else if (exercise.exerciseType === EXERCISE_TYPE.TIMED_HOLD) validateTimedHold(exercise, path, errors);
      else if (exercise.exerciseType === EXERCISE_TYPE.BALANCE && exercise.loggingMethod === EXERCISE_LOGGING_METHOD.TIME) validateTimedHold(exercise, path, errors);
      else if (exercise.exerciseType === EXERCISE_TYPE.BALANCE && exercise.loggingMethod === EXERCISE_LOGGING_METHOD.REPS) validateStrengthPrescription(exercise.prescription || {}, path, errors);
      else if (exercise.exerciseType === EXERCISE_TYPE.CARDIO) validateCardio(exercise, path, errors);
      else if (exercise.exerciseType === EXERCISE_TYPE.OTHER && [EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT].includes(method)) validateStrength(exercise, path, errors);
      else if (exercise.exerciseType === EXERCISE_TYPE.OTHER && [EXERCISE_LOGGING_METHOD.TIME, EXERCISE_LOGGING_METHOD.DISTANCE, EXERCISE_LOGGING_METHOD.INTERVALS].includes(method)) validateCardio(exercise, path, errors);
      else if ([EXERCISE_TYPE.MOBILITY, EXERCISE_TYPE.STRETCH].includes(exercise.exerciseType)) {
        if (exercise.prescription?.items) validateListPrescription(exercise, path, errors);
        else if (exercise.loggingMethod === EXERCISE_LOGGING_METHOD.TIME && !positiveInt(exercise.prescription?.targetDurationSeconds)) errors.push(`${path} duration must be positive.`);
      }
      else if (exercise.exerciseType === EXERCISE_TYPE.FOAM_ROLLING) validateListPrescription(exercise, path, errors);
      else if (exercise.exerciseType !== EXERCISE_TYPE.OTHER) errors.push(`${path} has an unsupported exercise type.`);
    });
  });
  return { valid: errors.length === 0, errors };
}

export function canonicalPlanContent(plan) {
  return {
    name: normalizeName(plan?.name),
    description: String(plan?.description || ""),
    routineTasks: sortByOrder(plan?.routineTasks).map((task) => ({
      id: task.id,
      name: normalizeName(task.name),
      notes: String(task.notes || ""),
      days: asArray(task.days),
      timeOfDay: task.timeOfDay,
      sortOrder: task.sortOrder,
    })),
    sessions: sortByOrder(plan?.sessions).map((session) => ({
      id: session.id,
      name: normalizeName(session.name),
      notes: String(session.notes || ""),
      sortOrder: session.sortOrder,
      exercises: sortByOrder(session.exercises).map((exercise) => ({
        id: exercise.id,
        exerciseId: exercise.exerciseId,
        exerciseNameSnapshot: exercise.exerciseNameSnapshot,
        exerciseType: exercise.exerciseType,
        loggingMethod: exercise.loggingMethod || defaultLoggingMethodForExerciseType(exercise.exerciseType),
        sortOrder: exercise.sortOrder,
        prescription: exercise.prescription,
        notes: String(exercise.notes || ""),
      })),
    })),
  };
}

export function isMeaningfulPlanChange(before, after) {
  return stableHash(canonicalPlanContent(before)) !== stableHash(canonicalPlanContent(after));
}

export function nextPlanForSave(original, draft) {
  const meaningful = original ? isMeaningfulPlanChange(original, draft) : true;
  return {
    ...draft,
    version: original && meaningful ? Number(original.version || 1) + 1 : Number(draft.version || 1),
    status: draft.isArchived ? PLAN_STATUS.ARCHIVED : draft.isActive ? PLAN_STATUS.ACTIVE : PLAN_STATUS.DRAFT,
  };
}

export function planPrescriptionSummary(exercise) {
  const type = exercise.exerciseType;
  if (type === EXERCISE_TYPE.STRENGTH || type === EXERCISE_TYPE.PLYOMETRIC) {
    const prescriptions = exercise.prescription?.blocks ? sortByOrder(exercise.prescription.blocks) : [exercise.prescription || {}];
    return prescriptions.map((block) => {
      const side = block.side === SIDE.LEFT ? "left" : block.side === SIDE.RIGHT ? "right" : "both";
      const reps = block.targetReps?.type === REP_TARGET_TYPE.RANGE ? `${block.targetReps.min}–${block.targetReps.max}` : block.targetReps?.value || "?";
      return `${block.targetSets} × ${reps} ${side}`;
    }).join(" · ");
  }
  if (type === EXERCISE_TYPE.TIMED_HOLD || type === EXERCISE_TYPE.BALANCE) {
    if (exercise.loggingMethod === EXERCISE_LOGGING_METHOD.COMPLETED) return "Complete";
    if (exercise.loggingMethod === EXERCISE_LOGGING_METHOD.REPS) {
      const reps = exercise.prescription?.targetReps?.type === REP_TARGET_TYPE.RANGE ? `${exercise.prescription.targetReps.min}–${exercise.prescription.targetReps.max}` : exercise.prescription?.targetReps?.value || "?";
      return `${exercise.prescription?.targetSets || 0} × ${reps}`;
    }
    const side = exercise.prescription?.side === SIDE.LEFT ? "left" : exercise.prescription?.side === SIDE.RIGHT ? "right" : "both";
    return `${exercise.prescription?.targetSets || 0} × ${durationSummary(exercise.prescription?.targetDurationSeconds, exercise.prescription?.durationUnit)} ${side}`;
  }
  if (type === EXERCISE_TYPE.CARDIO) {
    if (exercise.loggingMethod === EXERCISE_LOGGING_METHOD.INTERVALS) return `${asArray(exercise.prescription?.stages).length} intervals`;
    if (exercise.loggingMethod === EXERCISE_LOGGING_METHOD.DISTANCE) return `${exercise.prescription?.targetDistance || exercise.prescription?.distance || 0} km`;
    return durationSummary(exercise.prescription?.targetDurationSeconds, exercise.prescription?.durationUnit);
  }
  if (type === EXERCISE_TYPE.OTHER) {
    if (exercise.loggingMethod === EXERCISE_LOGGING_METHOD.COMPLETED) return "Complete";
    if ([EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT].includes(exercise.loggingMethod)) {
      const reps = exercise.prescription?.targetReps?.type === REP_TARGET_TYPE.RANGE ? `${exercise.prescription.targetReps.min}–${exercise.prescription.targetReps.max}` : exercise.prescription?.targetReps?.value || "?";
      return `${exercise.prescription?.targetSets || 0} × ${reps}`;
    }
    if (exercise.loggingMethod === EXERCISE_LOGGING_METHOD.TIME) return durationSummary(exercise.prescription?.targetDurationSeconds, exercise.prescription?.durationUnit);
    if (exercise.loggingMethod === EXERCISE_LOGGING_METHOD.DISTANCE) return `${exercise.prescription?.targetDistance || 0} km`;
    if (exercise.loggingMethod === EXERCISE_LOGGING_METHOD.INTERVALS) return `${asArray(exercise.prescription?.stages).length} intervals`;
  }
  if (type === EXERCISE_TYPE.MOBILITY || type === EXERCISE_TYPE.STRETCH) {
    if (exercise.prescription?.items) return `${asArray(exercise.prescription.items).length} stretches`;
    return exercise.loggingMethod === EXERCISE_LOGGING_METHOD.TIME ? durationSummary(exercise.prescription?.targetDurationSeconds, exercise.prescription?.durationUnit) : "Complete";
  }
  if (type === EXERCISE_TYPE.FOAM_ROLLING) return `${asArray(exercise.prescription?.items).length} areas`;
  if (type === EXERCISE_TYPE.OTHER) return "Complete as prescribed";
  return "No prescription";
}

export function filterExerciseLibrary(exercises, { query = "", includeArchived = false } = {}) {
  const term = query.trim().toLowerCase();
  return asArray(exercises)
    .filter((exercise) => includeArchived || !exercise.isArchived)
    .filter((exercise) => !term || String(exercise.name || "").toLowerCase().includes(term))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}
