import assert from "node:assert/strict";
import test from "node:test";

import {
  EXERCISE_TYPE,
  TARGET_WEIGHT_MODE,
  createBlankPlan,
  createCardioPrescription,
  createDefaultPrescription,
  createLibraryExercise,
  createPlanExercise,
  createPlanSession,
  createStrengthBlock,
  createTimedHoldPrescription,
  duplicatePlanExercise,
  duplicatePlan,
  filterExerciseLibrary,
  fixedReps,
  isMeaningfulPlanChange,
  nextPlanForSave,
  planPrescriptionSummary,
  reorderItems,
  repRange,
  validatePlan,
} from "../src/lib/domain/plans.js";
import { SIDE } from "../src/lib/domain/v2Models.js";
import { __testables as planRepoTestables } from "../src/lib/firebase/planRepository.js";

function mixedStrengthPlan() {
  const plan = createBlankPlan({ name: "ACL Rehab Plan", isActive: true });
  const session = createPlanSession({ name: "Lower A" });
  session.exercises = [
    createPlanExercise({
      exerciseId: "le",
      exerciseNameSnapshot: "Leg Extension",
      exerciseType: EXERCISE_TYPE.STRENGTH,
      prescription: {
        blocks: [
          createStrengthBlock({ side: SIDE.BOTH, targetSets: 2, targetReps: fixedReps(10), sortOrder: 0 }),
          createStrengthBlock({ side: SIDE.LEFT, targetSets: 2, targetReps: fixedReps(8), sortOrder: 1 }),
        ],
      },
    }),
  ];
  plan.sessions = [session];
  return plan;
}

test("new plan starts at version 1 with ids and valid defaults", () => {
  const plan = createBlankPlan({ name: "Gym Plan" });
  assert.equal(plan.version, 1);
  assert.ok(plan.id);
  assert.equal(plan.isActive, false);
  assert.equal(validatePlan(plan).valid, true);
});

test("plan validation catches missing names, ids and invalid active plans", () => {
  assert.equal(validatePlan(createBlankPlan({ name: "" })).valid, false);
  const active = createBlankPlan({ name: "Active", isActive: true });
  assert.equal(validatePlan(active).valid, false);
  active.sessions = [createPlanSession({ id: "dup", name: "Lower" }), createPlanSession({ id: "dup", name: "Upper" })];
  assert.equal(validatePlan(active).valid, false);
  active.sessions = [createPlanSession({ id: "", name: "" })];
  assert.equal(validatePlan(active).valid, false);
});

test("plan validation covers type-specific prescriptions", () => {
  assert.equal(validatePlan(mixedStrengthPlan()).valid, true);

  const badStrength = mixedStrengthPlan();
  badStrength.sessions[0].exercises[0].prescription.blocks[0].targetSets = 0;
  assert.equal(validatePlan(badStrength).valid, false);

  const badRange = mixedStrengthPlan();
  badRange.sessions[0].exercises[0].prescription.blocks[0].targetReps = repRange(12, 8);
  assert.equal(validatePlan(badRange).valid, false);

  const badWeight = mixedStrengthPlan();
  badWeight.sessions[0].exercises[0].prescription.blocks[0].targetWeight = { mode: TARGET_WEIGHT_MODE.MANUAL, value: -1 };
  assert.equal(validatePlan(badWeight).valid, false);

  const holdPlan = createBlankPlan({ name: "Hold", isActive: true });
  holdPlan.sessions = [createPlanSession({ name: "Balance", exercises: [createPlanExercise({ exerciseId: "bal", exerciseNameSnapshot: "Balance", exerciseType: EXERCISE_TYPE.TIMED_HOLD, prescription: createTimedHoldPrescription({ targetDurationSeconds: 0 }) })] })];
  assert.equal(validatePlan(holdPlan).valid, false);

  const cardioPlan = createBlankPlan({ name: "Cardio", isActive: true });
  cardioPlan.sessions = [createPlanSession({ name: "Bike", exercises: [createPlanExercise({ exerciseId: "bike", exerciseNameSnapshot: "Bike", exerciseType: EXERCISE_TYPE.CARDIO, prescription: createCardioPrescription({ targetDurationSeconds: 0 }) })] })];
  assert.equal(validatePlan(cardioPlan).valid, false);

  const mobilityPlan = createBlankPlan({ name: "Mobility", isActive: true });
  mobilityPlan.sessions = [createPlanSession({ name: "Mobility", exercises: [createPlanExercise({ exerciseId: "mob", exerciseNameSnapshot: "Mobility", exerciseType: EXERCISE_TYPE.MOBILITY, prescription: { items: [] } })] })];
  assert.equal(validatePlan(mobilityPlan).valid, false);

  const foamPlan = createBlankPlan({ name: "Foam", isActive: true });
  foamPlan.sessions = [createPlanSession({ name: "Foam", exercises: [createPlanExercise({ exerciseId: "foam", exerciseNameSnapshot: "Foam Rolling", exerciseType: EXERCISE_TYPE.FOAM_ROLLING, prescription: { items: [] } })] })];
  assert.equal(validatePlan(foamPlan).valid, false);
});

test("duplicating a plan creates fresh ids and resets version", () => {
  const original = mixedStrengthPlan();
  const before = structuredClone(original);
  const copy = duplicatePlan(original, { id: "plan-copy" });
  assert.equal(copy.id, "plan-copy");
  assert.equal(copy.sourcePlanId, original.id);
  assert.equal(copy.version, 1);
  assert.notEqual(copy.sessions[0].id, original.sessions[0].id);
  assert.notEqual(copy.sessions[0].exercises[0].id, original.sessions[0].exercises[0].id);
  assert.notEqual(copy.sessions[0].exercises[0].prescription.blocks[0].id, original.sessions[0].exercises[0].prescription.blocks[0].id);
  assert.deepEqual(original, before);
});

test("versioning increments only for meaningful changes", () => {
  const original = mixedStrengthPlan();
  const unchanged = structuredClone(original);
  unchanged.updatedAt = "later";
  assert.equal(isMeaningfulPlanChange(original, unchanged), false);
  assert.equal(nextPlanForSave(original, unchanged).version, original.version);

  const activeOnly = structuredClone(original);
  activeOnly.isActive = false;
  activeOnly.status = "draft";
  const savedActiveOnly = nextPlanForSave(original, activeOnly);
  assert.equal(isMeaningfulPlanChange(original, activeOnly), false);
  assert.equal(savedActiveOnly.version, original.version);
  assert.equal(savedActiveOnly.status, "draft");

  const archivedOnly = structuredClone(original);
  archivedOnly.isArchived = true;
  archivedOnly.isActive = false;
  archivedOnly.status = "archived";
  const savedArchivedOnly = nextPlanForSave(original, archivedOnly);
  assert.equal(isMeaningfulPlanChange(original, archivedOnly), false);
  assert.equal(savedArchivedOnly.version, original.version);
  assert.equal(savedArchivedOnly.status, "archived");

  const changed = structuredClone(original);
  changed.name = "Updated ACL Rehab";
  assert.equal(isMeaningfulPlanChange(original, changed), true);
  assert.equal(nextPlanForSave(original, changed).version, original.version + 1);

  const nestedChanged = structuredClone(original);
  nestedChanged.sessions[0].name = "Lower B";
  assert.equal(isMeaningfulPlanChange(original, nestedChanged), true);
  assert.equal(nextPlanForSave(original, nestedChanged).version, original.version + 1);

  const prescriptionChanged = structuredClone(original);
  prescriptionChanged.sessions[0].exercises[0].prescription.blocks[0].targetSets = 3;
  assert.equal(isMeaningfulPlanChange(original, prescriptionChanged), true);
  assert.equal(nextPlanForSave(original, prescriptionChanged).version, original.version + 1);
});

test("duplicating one plan exercise refreshes nested IDs and preserves values", () => {
  const strength = mixedStrengthPlan().sessions[0].exercises[0];
  const original = structuredClone(strength);
  const copy = duplicatePlanExercise(strength, { sortOrder: 9 });
  assert.notEqual(copy.id, strength.id);
  assert.equal(copy.sortOrder, 9);
  assert.equal(copy.exerciseId, strength.exerciseId);
  assert.equal(copy.exerciseNameSnapshot, strength.exerciseNameSnapshot);
  assert.equal(copy.exerciseType, strength.exerciseType);
  assert.equal(copy.notes, strength.notes);
  assert.deepEqual(
    copy.prescription.blocks.map((block) => ({ ...block, id: "fresh" })),
    strength.prescription.blocks.map((block) => ({ ...block, id: "fresh" }))
  );
  assert.notDeepEqual(copy.prescription.blocks.map((block) => block.id), strength.prescription.blocks.map((block) => block.id));
  assert.deepEqual(strength, original);

  const mobility = createPlanExercise({
    exerciseId: "mob",
    exerciseNameSnapshot: "Mobility",
    exerciseType: EXERCISE_TYPE.MOBILITY,
    prescription: { items: [{ id: "stretch-1", name: "Hamstring stretch", sortOrder: 0 }], notes: "easy" },
  });
  const mobilityCopy = duplicatePlanExercise(mobility, { sortOrder: 2 });
  assert.notEqual(mobilityCopy.id, mobility.id);
  assert.notEqual(mobilityCopy.prescription.items[0].id, mobility.prescription.items[0].id);
  assert.equal(mobilityCopy.prescription.items[0].name, "Hamstring stretch");
  assert.equal(mobilityCopy.sortOrder, 2);

  const foam = createPlanExercise({
    exerciseId: "foam",
    exerciseNameSnapshot: "Foam Rolling",
    exerciseType: EXERCISE_TYPE.FOAM_ROLLING,
    prescription: { items: [{ id: "area-1", name: "Quads", sortOrder: 0 }], notes: "" },
  });
  const foamCopy = duplicatePlanExercise(foam, { sortOrder: 3 });
  assert.notEqual(foamCopy.prescription.items[0].id, foam.prescription.items[0].id);
  assert.equal(foamCopy.prescription.items[0].name, "Quads");

  const hold = createPlanExercise({ exerciseId: "hold", exerciseNameSnapshot: "Hold", exerciseType: EXERCISE_TYPE.TIMED_HOLD, prescription: createTimedHoldPrescription({ targetDurationSeconds: 45 }) });
  const holdCopy = duplicatePlanExercise(hold, { sortOrder: 4 });
  assert.notEqual(holdCopy.id, hold.id);
  assert.deepEqual(holdCopy.prescription, hold.prescription);
  assert.notEqual(holdCopy.prescription, hold.prescription);

  const cardio = createPlanExercise({ exerciseId: "bike", exerciseNameSnapshot: "Bike", exerciseType: EXERCISE_TYPE.CARDIO, prescription: createCardioPrescription({ targetDurationSeconds: 900, resistance: 5 }) });
  const cardioCopy = duplicatePlanExercise(cardio, { sortOrder: 5 });
  assert.notEqual(cardioCopy.id, cardio.id);
  assert.deepEqual(cardioCopy.prescription, cardio.prescription);
  assert.notEqual(cardioCopy.prescription, cardio.prescription);
});

test("reordering sessions, exercises, blocks and list items preserves data", () => {
  const first = { id: "a", name: "A", sortOrder: 0 };
  const second = { id: "b", name: "B", sortOrder: 1 };
  assert.deepEqual(reorderItems([first, second], 0, 1).map((item) => [item.id, item.sortOrder]), [["b", 0], ["a", 1]]);
});

test("exercise archive filtering keeps archived references available when requested", () => {
  const active = createLibraryExercise({ id: "active", name: "Squat" });
  const archived = createLibraryExercise({ id: "archived", name: "Leg Extension", isArchived: true });
  assert.deepEqual(filterExerciseLibrary([archived, active]).map((exercise) => exercise.id), ["active"]);
  assert.deepEqual(filterExerciseLibrary([archived, active], { includeArchived: true }).map((exercise) => exercise.id), ["archived", "active"]);
});

test("prescription summaries are human readable", () => {
  const strength = mixedStrengthPlan().sessions[0].exercises[0];
  assert.match(planPrescriptionSummary(strength), /2 × 10 both/);
  const cardio = createPlanExercise({ exerciseId: "bike", exerciseNameSnapshot: "Bike", exerciseType: EXERCISE_TYPE.CARDIO, prescription: createCardioPrescription({ targetDurationSeconds: 900, resistance: 5 }) });
  assert.equal(planPrescriptionSummary(cardio), "15 min · Resistance 5");
  const mobility = createPlanExercise({ exerciseId: "mob", exerciseNameSnapshot: "Mobility", exerciseType: EXERCISE_TYPE.MOBILITY, prescription: createDefaultPrescription(EXERCISE_TYPE.MOBILITY) });
  assert.equal(planPrescriptionSummary(mobility), "1 stretches");
});

test("plan repository helpers strip undefined fields and use v2 paths only", () => {
  const cleaned = planRepoTestables.stripUndefined({ a: 1, b: undefined, nested: { c: undefined, d: 2 } });
  assert.deepEqual(cleaned, { a: 1, nested: { d: 2 } });
  const paths = planRepoTestables.planPaths("uid", "plan-1");
  assert.equal(paths.plan, "users/uid/plans/plan-1");
  assert.equal(planRepoTestables.exerciseCollectionPath("uid"), "users/uid/exercises");
  assert.equal(Object.values(paths).some((path) => path.includes("rehabData")), false);
  const write = planRepoTestables.preparePlanWrite({ id: "p", createdAt: undefined }, { created: true, timestamp: "server", updatedAtToken: "token" });
  assert.deepEqual(write, { id: "p", updatedAt: "server", updatedAtToken: "token", createdAt: "server" });
});
