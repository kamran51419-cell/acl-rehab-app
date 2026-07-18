import { stableHash } from "./ids.js";
import { PLAN_STATUS, SIDE, V2_SCHEMA_VERSION, createExerciseDefinition } from "./v2Models.js";

export const EXERCISE_TYPE = Object.freeze({
  STRENGTH: "strength",
  TIMED_HOLD: "timed_hold",
  CARDIO: "cardio",
  MOBILITY: "mobility",
  FOAM_ROLLING: "foam_rolling",
});

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
  targetWeight = { mode: TARGET_WEIGHT_MODE.PREVIOUS },
  unit = "kg",
  restSeconds = undefined,
  notes = "",
  sortOrder = 0,
} = {}) {
  return { id, side, targetSets: Number(targetSets), targetReps, targetWeight, unit, restSeconds, notes, sortOrder };
}

export function createTimedHoldPrescription({ side = SIDE.BOTH, targetSets = 3, targetDurationSeconds = 30, restSeconds = undefined, notes = "" } = {}) {
  return { side, targetSets: Number(targetSets), targetDurationSeconds: Number(targetDurationSeconds), restSeconds, notes };
}

export function createCardioPrescription({ targetDurationSeconds = 900, resistance = undefined, incline = undefined, distance = undefined, effortTarget = "", notes = "" } = {}) {
  return { targetDurationSeconds: Number(targetDurationSeconds), resistance, incline, distance, effortTarget, notes };
}

export function createListPrescription({ items = [""], notes = "" } = {}) {
  return {
    items: asArray(items).map((name, index) => ({ id: makeGeneratedId("item"), name, sortOrder: index })),
    notes,
  };
}

export function createDefaultPrescription(exerciseType = EXERCISE_TYPE.STRENGTH) {
  if (exerciseType === EXERCISE_TYPE.TIMED_HOLD) return createTimedHoldPrescription();
  if (exerciseType === EXERCISE_TYPE.CARDIO) return createCardioPrescription();
  if (exerciseType === EXERCISE_TYPE.MOBILITY || exerciseType === EXERCISE_TYPE.FOAM_ROLLING) return createListPrescription();
  return { blocks: [createStrengthBlock()] };
}

export function createPlanExercise({
  id = makeGeneratedId("plan-exercise"),
  exerciseId,
  exerciseNameSnapshot,
  exerciseType = EXERCISE_TYPE.STRENGTH,
  sortOrder = 0,
  prescription = createDefaultPrescription(exerciseType),
  notes = "",
} = {}) {
  return { id, exerciseId, exerciseNameSnapshot, exerciseType, sortOrder, prescription, notes };
}

export function createLibraryExercise({ id = makeGeneratedId("exercise"), userId = null, name, exerciseType = EXERCISE_TYPE.STRENGTH, defaultSideConfig = SIDE.BOTH, notes = "", isArchived = false, legacy = undefined } = {}) {
  return {
    ...createExerciseDefinition({ id, userId, name: normalizeName(name), defaultSideConfig, notes, isArchived, legacy }),
    exerciseType,
    trackingType: exerciseType,
  };
}

export function duplicatePlanExercise(exercise, { sortOrder = exercise?.sortOrder ?? 0 } = {}) {
  const duplicated = {
    ...structuredClone(exercise),
    id: makeGeneratedId("plan-exercise"),
    sortOrder,
  };

  if (exercise?.exerciseType === EXERCISE_TYPE.STRENGTH) {
    duplicated.prescription = {
      ...structuredClone(exercise.prescription),
      blocks: asArray(exercise.prescription?.blocks).map((block, index) => ({
        ...structuredClone(block),
        id: makeGeneratedId("block"),
        sortOrder: index,
      })),
    };
  } else if (exercise?.exerciseType === EXERCISE_TYPE.MOBILITY || exercise?.exerciseType === EXERCISE_TYPE.FOAM_ROLLING) {
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
    if (block.targetWeight?.mode === TARGET_WEIGHT_MODE.MANUAL && !nonNegativeNumber(block.targetWeight?.value)) errors.push(`${blockPath} manual weight must be non-negative.`);
    if (!nonNegativeNumber(block.restSeconds)) errors.push(`${blockPath} rest time must be non-negative.`);
  });
}

function validateTimedHold(exercise, path, errors) {
  const prescription = exercise.prescription || {};
  if (![SIDE.BOTH, SIDE.LEFT, SIDE.RIGHT].includes(prescription.side)) errors.push(`${path} has an invalid side.`);
  if (!positiveInt(prescription.targetSets)) errors.push(`${path} must have at least one set.`);
  if (!positiveInt(prescription.targetDurationSeconds)) errors.push(`${path} duration must be a positive whole number of seconds.`);
  if (!nonNegativeNumber(prescription.restSeconds)) errors.push(`${path} rest time must be non-negative.`);
}

function validateCardio(exercise, path, errors) {
  if (!positiveInt(exercise.prescription?.targetDurationSeconds)) errors.push(`${path} cardio duration must be a positive whole number of seconds.`);
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
      if (exercise.exerciseType === EXERCISE_TYPE.STRENGTH) validateStrength(exercise, path, errors);
      else if (exercise.exerciseType === EXERCISE_TYPE.TIMED_HOLD) validateTimedHold(exercise, path, errors);
      else if (exercise.exerciseType === EXERCISE_TYPE.CARDIO) validateCardio(exercise, path, errors);
      else if (exercise.exerciseType === EXERCISE_TYPE.MOBILITY || exercise.exerciseType === EXERCISE_TYPE.FOAM_ROLLING) validateListPrescription(exercise, path, errors);
      else errors.push(`${path} has an unsupported exercise type.`);
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
  if (type === EXERCISE_TYPE.STRENGTH) {
    return sortByOrder(exercise.prescription?.blocks).map((block) => {
      const side = block.side === SIDE.LEFT ? "left" : block.side === SIDE.RIGHT ? "right" : "both";
      const reps = block.targetReps?.type === REP_TARGET_TYPE.RANGE ? `${block.targetReps.min}–${block.targetReps.max}` : block.targetReps?.value || "?";
      return `${block.targetSets} × ${reps} ${side}`;
    }).join(" · ");
  }
  if (type === EXERCISE_TYPE.TIMED_HOLD) {
    const side = exercise.prescription?.side === SIDE.LEFT ? "left" : exercise.prescription?.side === SIDE.RIGHT ? "right" : "both";
    return `${exercise.prescription?.targetSets || 0} × ${exercise.prescription?.targetDurationSeconds || 0} sec ${side}`;
  }
  if (type === EXERCISE_TYPE.CARDIO) {
    const minutes = Math.round(Number(exercise.prescription?.targetDurationSeconds || 0) / 60);
    const resistance = exercise.prescription?.resistance ? ` · Resistance ${exercise.prescription.resistance}` : "";
    return `${minutes} min${resistance}`;
  }
  if (type === EXERCISE_TYPE.MOBILITY) return `${asArray(exercise.prescription?.items).length} stretches`;
  if (type === EXERCISE_TYPE.FOAM_ROLLING) return `${asArray(exercise.prescription?.items).length} areas`;
  return "No prescription";
}

export function filterExerciseLibrary(exercises, { query = "", includeArchived = false } = {}) {
  const term = query.trim().toLowerCase();
  return asArray(exercises)
    .filter((exercise) => includeArchived || !exercise.isArchived)
    .filter((exercise) => !term || String(exercise.name || "").toLowerCase().includes(term))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}
