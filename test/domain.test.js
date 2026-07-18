import assert from "node:assert/strict";
import test from "node:test";

import { calculateWeekFromSurgeryDate, formatDate } from "../src/lib/domain/date.js";
import { bestSet, bestSetSym, setsSummaryLines, setVolume } from "../src/lib/domain/sets.js";
import { compactExerciseSummary, sessionSummary } from "../src/lib/domain/legacyWorkouts.js";
import { normalizeLegacyRehabData } from "../src/lib/firebase/legacyRehabRepository.js";
import { createWorkout, SIDE } from "../src/lib/domain/v2Models.js";
import { WORKOUT_BEHAVIOR, groupSessionExercises, previousWeightForExercise, previousWeightsForExercise, resolveWorkoutExerciseSide, workoutExerciseProgressKey, workoutExerciseSideLabel, workoutItem } from "../src/lib/domain/workoutDisplay.js";
import { EXERCISE_LOGGING_METHOD, EXERCISE_TYPE } from "../src/lib/domain/plans.js";
import { createDebouncedSaver, createInProgressWorkout, findInProgressWorkout, isWeightedExerciseComplete, reorderExerciseSnapshots, resumeWorkout, updateRecordedSetWeight } from "../src/lib/domain/workoutSession.js";
import { latestCompletedWorkout, nextRehabAgeMode, persistRehabAgeMode, readRehabAgeMode, rehabAgeLabel } from "../src/lib/domain/homeDashboard.js";

test("rehabilitation age cycles and persists its display preference", () => {
  assert.equal(rehabAgeLabel("2026-02-17", "months", "2026-07-18"), "5 months post-op");
  assert.equal(rehabAgeLabel("2026-02-17", "weeks", "2026-07-18"), "21 weeks post-op");
  assert.equal(rehabAgeLabel("2026-02-17", "days", "2026-07-18"), "151 days post-op");
  assert.equal(rehabAgeLabel("2026-02-17", "date", "2026-07-18"), "17 Feb 2026");
  assert.deepEqual(["months", "weeks", "days", "date"].map(nextRehabAgeMode), ["weeks", "days", "date", "months"]);
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(readRehabAgeMode(storage, "preference"), "months");
  persistRehabAgeMode(storage, "preference", "days");
  assert.equal(readRehabAgeMode(storage, "preference"), "days");
  assert.equal(rehabAgeLabel("", "months", "2026-07-18"), "");
});

test("latest completed workout ignores unfinished workouts", () => {
  const latest = latestCompletedWorkout([{ id: "draft", status: "in_progress", date: "2026-07-20" }, { id: "older", status: "completed", date: "2026-07-17" }, { id: "latest", status: "completed", date: "2026-07-18" }]);
  assert.equal(latest.id, "latest");
  assert.equal(latestCompletedWorkout([{ status: "in_progress" }]), null);
});

test("calculateWeekFromSurgeryDate returns 1-indexed rehab weeks", () => {
  assert.equal(calculateWeekFromSurgeryDate("2026-01-01", "2026-01-01"), "1");
  assert.equal(calculateWeekFromSurgeryDate("2026-01-01", "2026-01-07"), "1");
  assert.equal(calculateWeekFromSurgeryDate("2026-01-01", "2026-01-08"), "2");
  assert.equal(calculateWeekFromSurgeryDate("2026-01-10", "2026-01-01"), "");
});

test("formatDate preserves invalid or blank values safely", () => {
  assert.equal(formatDate("2026-07-18"), "18-07-26");
  assert.equal(formatDate(""), "—");
  assert.equal(formatDate("not-a-date"), "not-a-date");
});

test("workout date remains independent from creation time", () => {
  const workout = createWorkout({ id: "workout-1", date: "2026-07-18", createdAt: "2026-07-20T12:00:00Z" });
  assert.equal(workout.date, "2026-07-18");
  assert.equal(workout.createdAt, "2026-07-20T12:00:00Z");
});

test("workout display automatically groups mobility and tasks into checklists", () => {
  const mobility = { id: "stretch", exerciseNameSnapshot: "Hamstring stretch", exerciseType: EXERCISE_TYPE.MOBILITY, loggingMethod: EXERCISE_LOGGING_METHOD.TIME, prescription: { targetDurationSeconds: 30 } };
  const task = { id: "pogos", exerciseNameSnapshot: "Pogos", exerciseType: EXERCISE_TYPE.OTHER, loggingMethod: EXERCISE_LOGGING_METHOD.COMPLETED, prescription: {} };
  const strength = { id: "squat", exerciseNameSnapshot: "Squat", exerciseType: EXERCISE_TYPE.STRENGTH, loggingMethod: EXERCISE_LOGGING_METHOD.REPS, prescription: {} };
  const grouped = groupSessionExercises([strength, mobility, task]);
  assert.deepEqual(grouped.mobility.map((item) => item.id), ["stretch"]);
  assert.deepEqual(grouped.other.map((item) => item.id), ["pogos"]);
  assert.deepEqual(grouped.standard.map((item) => item.id), ["squat"]);
  assert.deepEqual(workoutItem(mobility), { id: "stretch", name: "Hamstring stretch", summary: "30 sec", behavior: WORKOUT_BEHAVIOR.COMPLETION });
  assert.deepEqual(workoutItem(task), { id: "pogos", name: "Pogos", summary: "", behavior: WORKOUT_BEHAVIOR.COMPLETION });
});

test("prescription methods determine completion, weight and interval workout behavior", () => {
  const base = { id: "item", exerciseId: "exercise", exerciseNameSnapshot: "Exercise", exerciseType: EXERCISE_TYPE.OTHER };
  for (const method of [EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.TIME, EXERCISE_LOGGING_METHOD.DISTANCE, EXERCISE_LOGGING_METHOD.COMPLETED]) assert.equal(workoutItem({ ...base, loggingMethod: method, prescription: method === EXERCISE_LOGGING_METHOD.REPS ? { targetSets: 3, targetReps: { type: "fixed", value: 20 } } : method === EXERCISE_LOGGING_METHOD.TIME ? { targetDurationSeconds: 60 } : { targetDistance: 2 } }).behavior, WORKOUT_BEHAVIOR.COMPLETION);
  assert.equal(workoutItem({ ...base, loggingMethod: EXERCISE_LOGGING_METHOD.REPS_WEIGHT, prescription: { targetSets: 3, targetReps: { type: "fixed", value: 10 } } }).behavior, WORKOUT_BEHAVIOR.WEIGHT);
  assert.equal(workoutItem({ ...base, loggingMethod: EXERCISE_LOGGING_METHOD.INTERVALS, prescription: { stages: [] } }).behavior, WORKOUT_BEHAVIOR.INTERVALS);
  assert.equal(previousWeightForExercise([{ date: "2026-01-01", exercises: [{ exerciseId: "exercise", prescriptionBlocks: [{ actualSets: [{ weight: 42.5 }] }] }] }], "exercise"), 42.5);
});

test("weighted workout drafts preserve multiple independent sets and resume", () => {
  const programme = { id: "plan", version: 2, name: "Programme" };
  const session = { id: "session", name: "Lower", exercises: [{ id: "press", exerciseId: "leg-press", exerciseNameSnapshot: "Leg Press", exerciseType: EXERCISE_TYPE.STRENGTH, loggingMethod: EXERCISE_LOGGING_METHOD.REPS_WEIGHT, sortOrder: 0, prescription: { targetSets: 2, targetReps: { type: "fixed", value: 10 } } }] };
  const draft = createInProgressWorkout({ id: "workout", userId: "uid", programme, session, date: "2026-07-18", previousWeightsByExercise: { "leg-press": { 1: 80, 2: 82.5 } } });
  assert.deepEqual(draft.exercises[0].recordedSets.map((set) => [set.id, set.setNumber, set.prescribedReps.value, set.weight, set.unit]), [["press-set-1", 1, 10, 80, "kg"], ["press-set-2", 2, 10, 82.5, "kg"]]);
  const changed = updateRecordedSetWeight(draft, "press", "press-set-2", "85");
  assert.equal(isWeightedExerciseComplete(changed.exercises[0]), true);
  const resumed = resumeWorkout({ ...changed, notes: "Saved", status: "in_progress" }, draft);
  assert.equal(resumed.notes, "Saved");
  assert.equal(resumed.exercises[0].recordedSets[1].weight, 85);
  assert.equal(resumed.exercises[0].recordedSets[1].rawWeight, "85");
  assert.equal(findInProgressWorkout([resumed], "plan", "session", "2026-07-18").id, "workout");
  const legacyResume = resumeWorkout({ ...draft, exercises: [{ ...draft.exercises[0], recordedSets: undefined, weight: 77.5 }] }, draft);
  assert.equal(legacyResume.exercises[0].recordedSets[0].weight, 77.5);
  assert.equal(legacyResume.exercises[0].recordedSets[0].rawWeight, "77.5");
});

test("resume restores every saved weight and derives only missing raw values", () => {
  const programme = { id: "plan", name: "Programme" };
  const session = { id: "session", name: "Lower", exercises: [{ id: "press", exerciseId: "leg-press", exerciseNameSnapshot: "Leg Press", exerciseType: EXERCISE_TYPE.STRENGTH, loggingMethod: EXERCISE_LOGGING_METHOD.REPS_WEIGHT, prescription: { side: SIDE.LEFT, targetSets: 2, targetReps: { type: "fixed", value: 10 } } }] };
  const fresh = createInProgressWorkout({ id: "fresh", userId: "uid", programme, session, date: "2026-07-18" });
  const saved = { ...fresh, id: "saved", exercises: [{ ...fresh.exercises[0], recordedSets: [{ ...fresh.exercises[0].recordedSets[0], weight: 12.5, rawWeight: "12.50" }, { ...fresh.exercises[0].recordedSets[1], weight: 13, rawWeight: "" }] }] };
  const resumed = resumeWorkout(saved, fresh);
  assert.deepEqual(resumed.exercises[0].recordedSets.map(({ weight, rawWeight }) => ({ weight, rawWeight })), [{ weight: 12.5, rawWeight: "12.50" }, { weight: 13, rawWeight: "13" }]);
});

test("workout snapshots preserve side and programme guidance independently", () => {
  const programme = { id: "plan", name: "Programme" };
  const exercises = [SIDE.BOTH, SIDE.LEFT, SIDE.RIGHT].map((side, index) => ({ id: `press-${side}`, exerciseId: "leg-press", exerciseNameSnapshot: "Leg Press", exerciseType: EXERCISE_TYPE.STRENGTH, loggingMethod: EXERCISE_LOGGING_METHOD.REPS, notes: `Guidance ${side}`, sortOrder: index, prescription: { side, targetSets: 2, targetReps: { type: "fixed", value: 10 } } }));
  const session = { id: "session", name: "Lower", exercises };
  const workout = createInProgressWorkout({ id: "workout", userId: "uid", programme, session, date: "2026-07-18" });
  assert.deepEqual(workout.exercises.map((exercise) => exercise.sideSnapshot), [SIDE.BOTH, SIDE.LEFT, SIDE.RIGHT]);
  assert.deepEqual(workout.exercises.map((exercise) => exercise.programmeNoteSnapshot), ["Guidance both", "Guidance left", "Guidance right"]);
  session.exercises[1].notes = "Changed later";
  session.exercises[1].prescription.side = SIDE.RIGHT;
  assert.equal(workout.exercises[1].programmeNoteSnapshot, "Guidance left");
  assert.equal(workout.exercises[1].sideSnapshot, SIDE.LEFT);
  assert.equal(workoutExerciseSideLabel({ ...workout.exercises[0], exerciseType: EXERCISE_TYPE.BALANCE }), "Both sides");
  assert.deepEqual(workout.exercises.map(workoutExerciseProgressKey), ["leg-press:both", "leg-press:left", "leg-press:right"]);
});

test("side resolution reads snapshots, prescriptions and legacy blocks safely", () => {
  assert.equal(resolveWorkoutExerciseSide({ sideSnapshot: SIDE.RIGHT, prescription: { side: SIDE.LEFT } }), SIDE.RIGHT);
  assert.equal(resolveWorkoutExerciseSide({ prescription: { side: SIDE.LEFT } }), SIDE.LEFT);
  assert.equal(resolveWorkoutExerciseSide({ prescriptionBlocks: [{ side: SIDE.BOTH }] }), SIDE.BOTH);
  assert.equal(resolveWorkoutExerciseSide({ exerciseId: "legacy" }), undefined);
  assert.equal(workoutExerciseProgressKey({ exerciseId: "legacy" }), "legacy:none");
});

test("previous weights match exercise identity, side and set number", () => {
  const set = (weight, setNumber = 1) => ({ id: `set-${setNumber}`, setNumber, weight });
  const workouts = [{ date: "2026-07-17", exercises: [
    { id: "both-copy", exerciseId: "extension", sideSnapshot: SIDE.BOTH, recordedSets: [set(30), set(32, 2)] },
    { id: "left-copy", exerciseId: "extension", sideSnapshot: SIDE.LEFT, recordedSets: [set(12), set(13, 2)] },
    { id: "right-copy", exerciseId: "extension", sideSnapshot: SIDE.RIGHT, recordedSets: [set(14), set(15, 2)] },
  ] }];
  assert.deepEqual(previousWeightsForExercise(workouts, { id: "left-copy", exerciseId: "extension", prescription: { side: SIDE.LEFT } }), { 1: 12, 2: 13 });
  assert.deepEqual(previousWeightsForExercise(workouts, { id: "right-copy", exerciseId: "extension", prescription: { side: SIDE.RIGHT } }), { 1: 14, 2: 15 });
  assert.deepEqual(previousWeightsForExercise(workouts, { id: "both-copy", exerciseId: "extension", prescription: { side: SIDE.BOTH } }), { 1: 30, 2: 32 });
  assert.deepEqual(previousWeightsForExercise([{ date: "2025-01-01", exercises: [{ exerciseId: "legacy", recordedSets: [set(9)] }] }], { id: "new", exerciseId: "legacy", prescription: { side: SIDE.LEFT } }), { 1: 9 });
});

test("repeated exercise copies keep weight updates independent", () => {
  const programme = { id: "plan", name: "Programme" };
  const base = { exerciseId: "extension", exerciseNameSnapshot: "Leg Extension", exerciseType: EXERCISE_TYPE.STRENGTH, loggingMethod: EXERCISE_LOGGING_METHOD.REPS_WEIGHT, prescription: { targetSets: 1, targetReps: { type: "fixed", value: 10 } } };
  const session = { id: "session", name: "Lower", exercises: [{ ...base, id: "both", notes: "Bilateral", prescription: { ...base.prescription, side: SIDE.BOTH } }, { ...base, id: "left", notes: "Unilateral", prescription: { ...base.prescription, side: SIDE.LEFT } }] };
  const draft = createInProgressWorkout({ id: "workout", userId: "uid", programme, session, date: "2026-07-18" });
  const changed = updateRecordedSetWeight(draft, "left", "left-set-1", "12");
  assert.equal(changed.exercises.find((exercise) => exercise.id === "both").recordedSets[0].weight, "");
  assert.equal(changed.exercises.find((exercise) => exercise.id === "left").recordedSets[0].weight, 12);
  assert.deepEqual(changed.exercises.map((exercise) => exercise.programmeNoteSnapshot), ["Bilateral", "Unilateral"]);
});

test("debounced autosave reuses the latest workout and flushes pending changes", async () => {
  const saved = [];
  const statuses = [];
  const saver = createDebouncedSaver(async (workout) => saved.push(workout), 20, (status) => statuses.push(status));
  saver.schedule({ id: "same", notes: "first" });
  saver.schedule({ id: "same", notes: "latest" });
  await saver.flush();
  assert.deepEqual(saved, [{ id: "same", notes: "latest" }]);
  assert.deepEqual(statuses, ["saving", "saved"]);
});

test("autosave flush waits for persistence and reports failures", async () => {
  const events = [];
  let release;
  const saver = createDebouncedSaver(() => new Promise((resolve) => { events.push("write-started"); release = resolve; }), 1000);
  saver.schedule({ id: "workout" });
  const flushing = saver.flush().then(() => events.push("navigation"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(events, ["write-started"]);
  release();
  await flushing;
  assert.deepEqual(events, ["write-started", "navigation"]);
  const failing = createDebouncedSaver(async () => { throw new Error("offline"); }, 1000);
  failing.schedule({ id: "workout" });
  await assert.rejects(failing.flush(), /offline/);
});

test("exercise snapshot ordering preserves ids and prescriptions", () => {
  const exercises = [{ id: "a", sortOrder: 0, prescription: { value: 1 } }, { id: "b", sortOrder: 1, prescription: { value: 2 } }];
  const reordered = reorderExerciseSnapshots(exercises, 0, 1);
  assert.deepEqual(reordered.map((item) => [item.id, item.sortOrder, item.prescription.value]), [["b", 0, 2], ["a", 1, 1]]);
});

test("set helpers calculate best sets and symmetry from legacy set values", () => {
  assert.equal(setVolume({ reps: "10", weight: "12.5" }), 125);
  assert.deepEqual(bestSet([{ reps: "5", weight: "10" }, { reps: "8", weight: "8" }]), {
    reps: "8",
    weight: "8",
    volume: 64,
  });
  assert.equal(bestSetSym([{ reps: "10", weight: "10" }], [{ reps: "8", weight: "10" }]), 80);
  assert.equal(bestSetSym([{ reps: "", weight: "" }], [{ reps: "8", weight: "10" }]), null);
});

test("setsSummaryLines formats empty and partially filled sets", () => {
  assert.deepEqual(setsSummaryLines([]), ["—"]);
  assert.deepEqual(setsSummaryLines([{ reps: "", weight: "" }]), ["—"]);
  assert.deepEqual(setsSummaryLines([{ reps: "10", weight: "" }]), ["1. 10 reps, ? kg"]);
});

test("legacy summaries preserve single-leg and bilateral output shapes", () => {
  const single = {
    id: "s1",
    exerciseId: "lp",
    date: "2026-07-18",
    singleLeg: true,
    leftSets: [{ reps: "10", weight: "10" }],
    rightSets: [{ reps: "8", weight: "10" }],
    notes: "steady",
  };
  const bilateral = {
    id: "s2",
    exerciseId: "squat",
    date: "2026-07-18",
    singleLeg: false,
    sets: [{ reps: "5", weight: "100" }],
    notes: "heavy",
  };

  assert.deepEqual(sessionSummary(single), {
    date: "18-07-26",
    notes: "steady",
    left: ["1. 10 reps, 10 kg"],
    right: ["1. 8 reps, 10 kg"],
    sets: [],
    symmetry: 80,
  });
  assert.deepEqual(sessionSummary(bilateral).sets, ["1. 5 reps, 100 kg"]);

  assert.deepEqual(compactExerciseSummary({ week: "1", sessions: [single] }, { id: "lp", singleLeg: true }), {
    type: "single",
    dates: "18-07-26",
    left: "10 × 10 kg",
    right: "8 × 10 kg",
    symmetry: 80,
  });
});


test("normalizeLegacyRehabData safely defaults malformed legacy snapshots", () => {
  assert.deepEqual(normalizeLegacyRehabData({ weeks: null, customExercises: {}, surgeryDate: 123 }), {
    weeks: [],
    customExercises: [],
    surgeryDate: "",
  });

  assert.deepEqual(
    normalizeLegacyRehabData({ weeks: [{ week: "1", sessions: [] }], customExercises: [], surgeryDate: "2026-07-18" }),
    { weeks: [{ week: "1", sessions: [] }], customExercises: [], surgeryDate: "2026-07-18" }
  );
});
