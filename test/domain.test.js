import assert from "node:assert/strict";
import test from "node:test";

import { calculateWeekFromSurgeryDate, formatDate } from "../src/lib/domain/date.js";
import { bestSet, bestSetSym, setsSummaryLines, setVolume } from "../src/lib/domain/sets.js";
import { compactExerciseSummary, sessionSummary } from "../src/lib/domain/legacyWorkouts.js";
import { normalizeLegacyRehabData } from "../src/lib/firebase/legacyRehabRepository.js";
import { createWorkout } from "../src/lib/domain/v2Models.js";
import { checklistItems, groupSessionExercises } from "../src/lib/domain/workoutDisplay.js";
import { EXERCISE_LOGGING_METHOD, EXERCISE_TYPE } from "../src/lib/domain/plans.js";

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
  assert.deepEqual(grouped.tasks.map((item) => item.id), ["pogos"]);
  assert.deepEqual(grouped.regular.map((item) => item.id), ["squat"]);
  assert.deepEqual(checklistItems(mobility), [{ id: "stretch", name: "Hamstring stretch", duration: "30 sec" }]);
  assert.deepEqual(checklistItems(task), [{ id: "pogos", name: "Pogos", duration: "" }]);
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
