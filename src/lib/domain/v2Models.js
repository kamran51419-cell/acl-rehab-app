export const V2_SCHEMA_VERSION = 2;

export const SIDE = Object.freeze({
  BOTH: "both",
  SEPARATE: "separate",
  LEFT: "left",
  RIGHT: "right",
});

export const SET_TYPE = Object.freeze({
  WARMUP: "warmup",
  WORKING: "working",
});

export const PLAN_STATUS = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  ARCHIVED: "archived",
});

export const WORKOUT_STATUS = Object.freeze({
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
});

export const PROGRESSION_STRATEGY = Object.freeze({
  MANUAL: "manual",
  INCREASE_WEIGHT: "increase_weight",
  INCREASE_REPS: "increase_reps",
});

export function manualProgression(enabled = false) {
  return {
    strategy: PROGRESSION_STRATEGY.MANUAL,
    enabled,
  };
}

export function unknownTargetReps() {
  return { type: "unknown" };
}

export function createExerciseDefinition({
  id,
  userId = null,
  name,
  defaultSideConfig = SIDE.BOTH,
  category = "other",
  notes = "",
  isArchived = false,
  legacy = undefined,
}) {
  return {
    id,
    userId,
    name,
    defaultSideConfig,
    category,
    notes,
    isArchived,
    legacy,
  };
}

export function createPrescriptionBlock({
  id,
  side,
  targetSets = 0,
  targetReps = unknownTargetReps(),
  targetWeight = { mode: "none" },
  restSeconds = undefined,
  notes = "",
  sortOrder = 0,
}) {
  return {
    id,
    side,
    targetSets,
    targetReps,
    targetWeight,
    restSeconds,
    notes,
    sortOrder,
  };
}