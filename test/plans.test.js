import assert from "node:assert/strict";
import test from "node:test";

import {
  EXERCISE_TYPE,
  EXERCISE_LOGGING_METHOD,
  LIBRARY_EXERCISE_TYPE_OPTIONS,
  createBlankPlan,
  createCardioPrescription,
  createDefaultPrescription,
  createIntervalPrescription,
  createLibraryExercise,
  createPlanExercise,
  createPlanSession,
  createStrengthBlock,
  createStrengthPrescription,
  createTimedHoldPrescription,
  duplicatePlanExercise,
  duplicatePlan,
  filterExerciseLibrary,
  fixedReps,
  isMeaningfulPlanChange,
  loggingMethodsForExerciseType,
  nextPlanForSave,
  planPrescriptionSummary,
  reorderItems,
  insertItemAfter,
  repRange,
  validatePlan,
} from "../src/lib/domain/plans.js";
import { SIDE } from "../src/lib/domain/v2Models.js";
import { __testables as planRepoTestables, deleteExerciseDefinition, deletePlan, deleteWorkoutDocument, exclusiveActiveProgrammeStates, finishWorkoutDocument, mergeWorkoutSnapshots } from "../src/lib/firebase/planRepository.js";

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

  const cardio = createPlanExercise({ exerciseId: "bike", exerciseNameSnapshot: "Bike", exerciseType: EXERCISE_TYPE.CARDIO, prescription: createCardioPrescription({ targetDurationSeconds: 900 }) });
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

test("exercise definitions stay lean and recording methods are programme-specific", () => {
  const exercise = createLibraryExercise({ id: "squat", name: "Squat", exerciseType: EXERCISE_TYPE.STRENGTH });
  assert.deepEqual(exercise, {
    id: "squat",
    userId: null,
    name: "Squat",
    exerciseType: EXERCISE_TYPE.STRENGTH,
    trackingType: EXERCISE_TYPE.STRENGTH,
    isArchived: false,
  });
  assert.deepEqual(loggingMethodsForExerciseType(EXERCISE_TYPE.STRENGTH), [EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT]);
  assert.deepEqual(loggingMethodsForExerciseType(EXERCISE_TYPE.CARDIO), [EXERCISE_LOGGING_METHOD.TIME, EXERCISE_LOGGING_METHOD.DISTANCE, EXERCISE_LOGGING_METHOD.INTERVALS]);
  assert.equal(loggingMethodsForExerciseType(EXERCISE_TYPE.CARDIO).includes(EXERCISE_LOGGING_METHOD.TIME_DISTANCE), false);
  assert.equal(LIBRARY_EXERCISE_TYPE_OPTIONS.includes(EXERCISE_TYPE.PLYOMETRIC), false);
  assert.throws(() => createLibraryExercise({ name: "Pogos", exerciseType: EXERCISE_TYPE.PLYOMETRIC }), /supported exercise type/);
  for (const type of LIBRARY_EXERCISE_TYPE_OPTIONS) assert.equal(loggingMethodsForExerciseType(type).includes(EXERCISE_LOGGING_METHOD.COMPLETED), false);
  assert.deepEqual(loggingMethodsForExerciseType(EXERCISE_TYPE.OTHER), [EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT, EXERCISE_LOGGING_METHOD.TIME, EXERCISE_LOGGING_METHOD.DISTANCE, EXERCISE_LOGGING_METHOD.INTERVALS]);
});

test("cardio intervals use ordered work and rest stages", () => {
  const prescription = createIntervalPrescription();
  assert.deepEqual(prescription.stages.map((stage) => [stage.phase, stage.durationSeconds, stage.sortOrder]), [["work", 240, 0], ["rest", 60, 1]]);
  const plan = createBlankPlan({ name: "Running", isActive: true });
  plan.sessions = [createPlanSession({ name: "Intervals", exercises: [createPlanExercise({ exerciseId: "run", exerciseNameSnapshot: "Run", exerciseType: EXERCISE_TYPE.CARDIO, loggingMethod: EXERCISE_LOGGING_METHOD.INTERVALS, prescription })] })];
  assert.equal(validatePlan(plan).valid, true);
  assert.equal(planPrescriptionSummary(plan.sessions[0].exercises[0]), "2 intervals");
});

test("duration units and interval identities survive reordering", () => {
  const prescription = createIntervalPrescription();
  const firstId = prescription.stages[0].id;
  prescription.stages[0].durationSeconds = 90;
  prescription.stages[0].durationUnit = "minutes";
  const reordered = reorderItems(prescription.stages, 0, 1);
  assert.equal(reordered[1].id, firstId);
  assert.equal(reordered[1].durationSeconds, 90);
  assert.equal(reordered[1].durationUnit, "minutes");
  assert.deepEqual(reordered.map((stage) => stage.sortOrder), [0, 1]);
});

test("type-specific programme methods validate, including every Other method", () => {
  const cases = [
    [EXERCISE_TYPE.STRENGTH, EXERCISE_LOGGING_METHOD.REPS], [EXERCISE_TYPE.STRENGTH, EXERCISE_LOGGING_METHOD.REPS_WEIGHT],
    [EXERCISE_TYPE.CARDIO, EXERCISE_LOGGING_METHOD.TIME], [EXERCISE_TYPE.CARDIO, EXERCISE_LOGGING_METHOD.DISTANCE], [EXERCISE_TYPE.CARDIO, EXERCISE_LOGGING_METHOD.INTERVALS],
    [EXERCISE_TYPE.BALANCE, EXERCISE_LOGGING_METHOD.REPS], [EXERCISE_TYPE.BALANCE, EXERCISE_LOGGING_METHOD.TIME], [EXERCISE_TYPE.MOBILITY, EXERCISE_LOGGING_METHOD.TIME],
    ...loggingMethodsForExerciseType(EXERCISE_TYPE.OTHER).map((method) => [EXERCISE_TYPE.OTHER, method]),
  ];
  cases.forEach(([exerciseType, loggingMethod]) => {
    const plan = createBlankPlan({ name: "Methods", isActive: true });
    plan.sessions = [createPlanSession({ name: "Session", exercises: [createPlanExercise({ exerciseId: `${exerciseType}-${loggingMethod}`, exerciseNameSnapshot: "Exercise", exerciseType, loggingMethod, prescription: createDefaultPrescription(exerciseType, loggingMethod) })] })];
    assert.equal(validatePlan(plan).valid, true, `${exerciseType}/${loggingMethod}`);
  });
});

test("session insertion and exclusive activation preserve ordering", () => {
  const sessions = insertItemAfter([createPlanSession({ id: "one", name: "One", sortOrder: 0 }), createPlanSession({ id: "three", name: "Three", sortOrder: 1 })], 0, createPlanSession({ id: "two", name: "Two" }));
  assert.deepEqual(sessions.map((session) => [session.id, session.sortOrder]), [["one", 0], ["two", 1], ["three", 2]]);
  const states = exclusiveActiveProgrammeStates([{ id: "a", isActive: true }, { id: "b", isActive: true }], "b");
  assert.deepEqual(states.map((state) => [state.id, state.isActive]), [["a", false], ["b", true]]);
});

test("exercise deletion removes only the library document", async () => {
  const programme = mixedStrengthPlan();
  const before = structuredClone(programme);
  let deletedRef;
  await deleteExerciseDefinition({}, "uid", "le", { referenceFactory: (_db, uid, id) => `users/${uid}/exercises/${id}`, deleteDocument: async (ref) => { deletedRef = ref; } });
  assert.equal(deletedRef, "users/uid/exercises/le");
  assert.deepEqual(programme, before);
});

test("programme deletion removes only its document", async () => {
  let deletedRef;
  await deletePlan({}, "uid", "plan", { referenceFactory: (_db, uid, id) => `users/${uid}/plans/${id}`, deleteDocument: async (ref) => { deletedRef = ref; } });
  assert.equal(deletedRef, "users/uid/plans/plan");
});

test("finishing caches a completed snapshot and stale subscriptions cannot restore it", async () => {
  planRepoTestables.resetWorkoutCache();
  let written;
  const draft = { id: "workout", status: "in_progress", date: "2026-07-18", notes: "latest", exercises: [{ id: "press", completed: true, recordedSets: [{ id: "set-1", weight: 82.5 }] }] };
  const completed = await finishWorkoutDocument({}, "uid", draft, { timestamp: "server-time", completedAtValue: "client-time", referenceFactory: () => "workout-ref", setDocument: async (ref, data) => { written = { ref, data }; } });
  assert.equal(written.ref, "workout-ref");
  assert.equal(written.data.status, "completed");
  assert.equal(written.data.completedAt, "server-time");
  assert.equal(written.data.notes, "latest");
  assert.equal(written.data.exercises[0].recordedSets[0].weight, 82.5);
  assert.equal(completed.status, "completed");
  assert.equal(completed.completedAt, "client-time");
  assert.equal(mergeWorkoutSnapshots("uid", [{ ...draft }])[0].status, "completed");
});

test("workout deletion removes only its document and suppresses stale snapshots", async () => {
  planRepoTestables.resetWorkoutCache();
  let deleted;
  await deleteWorkoutDocument({}, "uid", "one", { referenceFactory: (_db, uid, id) => `users/${uid}/workouts/${id}`, deleteDocument: async (ref) => { deleted = ref; } });
  assert.equal(deleted, "users/uid/workouts/one");
  assert.deepEqual(mergeWorkoutSnapshots("uid", [{ id: "one", status: "completed" }, { id: "two", status: "completed" }]).map((workout) => workout.id), ["two"]);
});

test("prescription summaries are human readable", () => {
  const strength = mixedStrengthPlan().sessions[0].exercises[0];
  assert.match(planPrescriptionSummary(strength), /2 × 10 both/);
  const cardio = createPlanExercise({ exerciseId: "bike", exerciseNameSnapshot: "Bike", exerciseType: EXERCISE_TYPE.CARDIO, prescription: createCardioPrescription({ targetDurationSeconds: 900 }) });
  assert.equal(planPrescriptionSummary(cardio), "15 min");
  const mobility = createPlanExercise({ exerciseId: "mob", exerciseNameSnapshot: "Mobility", exerciseType: EXERCISE_TYPE.MOBILITY, prescription: createDefaultPrescription(EXERCISE_TYPE.MOBILITY) });
  assert.equal(planPrescriptionSummary(mobility), "30 sec");
});

test("new strength exercises use one prescription and can repeat in a session", () => {
  const first = createPlanExercise({ exerciseId: "press", exerciseNameSnapshot: "Leg Press", exerciseType: EXERCISE_TYPE.STRENGTH, prescription: createStrengthPrescription({ side: SIDE.BOTH, targetSets: 2, targetReps: fixedReps(10) }) });
  const second = duplicatePlanExercise(first, { sortOrder: 1 });
  second.prescription.side = SIDE.LEFT;
  assert.equal(first.prescription.blocks, undefined);
  assert.equal(second.exerciseId, first.exerciseId);
  assert.notEqual(second.id, first.id);
  assert.equal(planPrescriptionSummary(first), "2 × 10 both");
  assert.equal(planPrescriptionSummary(second), "2 × 10 left");
});

test("plan repository helpers strip undefined fields and use v2 paths only", () => {
  const cleaned = planRepoTestables.stripUndefined({ a: 1, b: undefined, nested: { c: undefined, d: 2 } });
  assert.deepEqual(cleaned, { a: 1, nested: { d: 2 } });
  class Sentinel { constructor() { this.value = "server"; } }
  const sentinel = new Sentinel();
  assert.equal(planRepoTestables.stripUndefined({ timestamp: sentinel }).timestamp, sentinel);
  const paths = planRepoTestables.planPaths("uid", "plan-1");
  assert.equal(paths.plan, "users/uid/plans/plan-1");
  assert.equal(planRepoTestables.exerciseCollectionPath("uid"), "users/uid/exercises");
  assert.equal(Object.values(paths).some((path) => path.includes("rehabData")), false);
  const write = planRepoTestables.preparePlanWrite({ id: "p", createdAt: undefined }, { created: true, timestamp: "server", updatedAtToken: "token" });
  assert.deepEqual(write, { id: "p", updatedAt: "server", updatedAtToken: "token", createdAt: "server" });
});
