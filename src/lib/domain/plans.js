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
  [EXERCISE_TYPE.PLYOMETRIC]: EXERCISE_LOGGING_METHOD.REPS,
  [EXERCISE_TYPE.BALANCE]: EXERCISE_LOGGING_METHOD.TIME,
  [EXERCISE_TYPE.MOBILITY]: EXERCISE_LOGGING_METHOD.TIME,
  [EXERCISE_TYPE.STRETCH]: EXERCISE_LOGGING_METHOD.TIME,
  [EXERCISE_TYPE.OTHER]: EXERCISE_LOGGING_METHOD.COMPLETED,
  [EXERCISE_TYPE.TIMED_HOLD]: EXERCISE_LOGGING_METHOD.TIME,
  [EXERCISE_TYPE.FOAM_ROLLING]: EXERCISE_LOGGING_METHOD.TIME,
});

export function defaultLoggingMethodForExerciseType(exerciseType = EXERCISE_TYPE.STRENGTH) {
  return DEFAULT_LOGGING_METHOD_BY_EXERCISE_TYPE[exerciseType] || EXERCISE_LOGGING_METHOD.COMPLETED;
}

export function loggingMethodsForExerciseType(exerciseType) {
  if (exerciseType === EXERCISE_TYPE.STRENGTH) return [EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT];
  if (exerciseType === EXERCISE_TYPE.PLYOMETRIC) return [EXERCISE_LOGGING_METHOD.REPS];
  if (exerciseType === EXERCISE_TYPE.CARDIO) return [EXERCISE_LOGGING_METHOD.TIME, EXERCISE_LOGGING_METHOD.DISTANCE, EXERCISE_LOGGING_METHOD.INTERVALS];
  if ([EXERCISE_TYPE.BALANCE, EXERCISE_TYPE.MOBILITY, EXERCISE_TYPE.STRETCH, EXERCISE_TYPE.TIMED_HOLD, EXERCISE_TYPE.FOAM_ROLLING].includes(exerciseType)) {
    return [EXERCISE_LOGGING_METHOD.TIME, EXERCISE_LOGGING_METHOD.COMPLETED];
  }
  return [EXERCISE_LOGGING_METHOD.COMPLETED];
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

export function createTimedHoldPrescription({ side = SIDE.BOTH, targetSets = 3, targetDurationSeconds = 30, notes = "" } = {}) {
  return { side, targetSets: Number(targetSets), targetDurationSeconds: Number(targetDurationSeconds), notes };
}

export function createCardioPrescription({ targetDurationSeconds = 900, targetDistance = undefined, distance = undefined, notes = "" } = {}) {
  return { targetDurationSeconds: Number(targetDurationSeconds), targetDistance: targetDistance ?? distance, notes };
}

export const INTERVAL_PHASE = Object.freeze({ WORK: "work", REST: "rest" });

export function createIntervalStage({ id = makeGeneratedId("interval"), phase = INTERVAL_PHASE.WORK, durationSeconds = 60, label = "", sortOrder = 0 } = {}) {
  return { id, phase, durationSeconds: Number(durationSeconds), label, sortOrder };
}

export function createIntervalPrescription({ stages } = {}) {
  return {
    stages: stages || [
      createIntervalStage({ phase: INTERVAL_PHASE.WORK, durationSeconds: 240, sortOrder: 0 }),
      createIntervalStage({ phase: INTERVAL_PHASE.REST, durationSeconds: 60, sortOrder: 1 }),
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
  if (exerciseType === EXERCISE_TYPE.TIMED_HOLD || exerciseType === EXERCISE_TYPE.BALANCE) return createTimedHoldPrescription();
  if (exerciseType === EXERCISE_TYPE.CARDIO) return loggingMethod === EXERCISE_LOGGING_METHOD.INTERVALS ? createIntervalPrescription() : createCardioPrescription();
  if ([EXERCISE_TYPE.MOBILITY, EXERCISE_TYPE.STRETCH, EXERCISE_TYPE.FOAM_ROLLING].includes(exerciseType)) return createListPrescription();
  if (exerciseType === EXERCISE_TYPE.OTHER) return {};
  return { blocks: [createStrengthBlock()] };
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

  if (exercise?.exerciseType === EXERCISE_TYPE.STRENGTH || exercise?.exerciseType === EXERCISE_TYPE.PLYOMETRIC) {
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

function pushDuplicateErrors(items, path, errors) {
  const seen = new Set();
  asArray(items).forEach((item, index) => {
    if (!item?.id) errors.push(`${path}[${index}] is missing an id.`);
    else if (seen.has(item.id)) errors.push(`${path}[${index}] duplicates id ${item.id}.`);
    else seen.add(item.id);
  });
}

function validateStrength(exercise, path, errors) {
  const blocks = asArray(exercise.prescription?.blocks);
  if (!blocks.length) errors.push(`${path} must have at least one block.`);
  pushDuplicateErrors(blocks, `${path}.blocks`, errors);
  blocks.forEach((block, index) => {
    const blockPath = `${path}.blocks[${index}]`;
    if (![SIDE.BOTH, SIDE.LEFT, SIDE.RIGHT].includes(block.side)) errors.push(`${blockPath} has an invalid side.`);
    if (!positiveInt(block.targetSets)) errors.push(`${blockPath} must have at least one target set.`);
    const reps = block.targetReps || {};
    if (reps.type === REP_TARGET_TYPE.FIXED) {
      if (!positiveInt(reps.value)) errors.push(`${blockPath} fixed reps must be a positive whole number.`);
    } else if (reps.type === REP_TARGET_TYPE.RANGE) {
      if (!positiveInt(reps.min) || !positiveInt(reps.max) || Number(reps.min) > Number(reps.max)) errors.push(`${blockPath} rep range is invalid.`);
    } else {
      errors.push(`${blockPath} reps must be fixed or a range.`);
    }
  });
}

function validateTimedHold(exercise, path, errors) {
  const prescription = exercise.prescription || {};
  if (![SIDE.BOTH, SIDE.LEFT, SIDE.RIGHT].includes(prescription.side)) errors.push(`${path} has an invalid side.`);
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
      if (exercise.exerciseType === EXERCISE_TYPE.STRENGTH || exercise.exerciseType === EXERCISE_TYPE.PLYOMETRIC) validateStrength(exercise, path, errors);
      else if (exercise.exerciseType === EXERCISE_TYPE.TIMED_HOLD || exercise.exerciseType === EXERCISE_TYPE.BALANCE) validateTimedHold(exercise, path, errors);
      else if (exercise.exerciseType === EXERCISE_TYPE.CARDIO) validateCardio(exercise, path, errors);
      else if ([EXERCISE_TYPE.MOBILITY, EXERCISE_TYPE.STRETCH, EXERCISE_TYPE.FOAM_ROLLING].includes(exercise.exerciseType)) validateListPrescription(exercise, path, errors);
      else if (exercise.exerciseType !== EXERCISE_TYPE.OTHER) errors.push(`${path} has an unsupported exercise type.`);
    });
  });
  return { valid: errors.length === 0, errors };
}

export function canonicalPlanContent(plan) {
  return {
    name: normalizeName(plan?.name),
    description: String(plan?.description || ""),
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
    return sortByOrder(exercise.prescription?.blocks).map((block) => {
      const side = block.side === SIDE.LEFT ? "left" : block.side === SIDE.RIGHT ? "right" : "both";
      const reps = block.targetReps?.type === REP_TARGET_TYPE.RANGE ? `${block.targetReps.min}–${block.targetReps.max}` : block.targetReps?.value || "?";
      return `${block.targetSets} × ${reps} ${side}`;
    }).join(" · ");
  }
  if (type === EXERCISE_TYPE.TIMED_HOLD || type === EXERCISE_TYPE.BALANCE) {
    const side = exercise.prescription?.side === SIDE.LEFT ? "left" : exercise.prescription?.side === SIDE.RIGHT ? "right" : "both";
    return `${exercise.prescription?.targetSets || 0} × ${exercise.prescription?.targetDurationSeconds || 0} sec ${side}`;
  }
  if (type === EXERCISE_TYPE.CARDIO) {
    if (exercise.loggingMethod === EXERCISE_LOGGING_METHOD.INTERVALS) return `${asArray(exercise.prescription?.stages).length} intervals`;
    if (exercise.loggingMethod === EXERCISE_LOGGING_METHOD.DISTANCE) return `${exercise.prescription?.targetDistance || exercise.prescription?.distance || 0} km`;
    const minutes = Math.round(Number(exercise.prescription?.targetDurationSeconds || 0) / 60);
    return `${minutes} min`;
  }
  if (type === EXERCISE_TYPE.MOBILITY || type === EXERCISE_TYPE.STRETCH) return `${asArray(exercise.prescription?.items).length} stretches`;
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
