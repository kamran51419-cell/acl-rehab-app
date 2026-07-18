import assert from "node:assert/strict";
import test from "node:test";

import { deterministicId, stableHash, stableStringify } from "../src/lib/domain/ids.js";
import { SET_TYPE, SIDE, V2_SCHEMA_VERSION } from "../src/lib/domain/v2Models.js";
import { transformLegacyDataToV2 } from "../src/migrations/legacyToV2.js";

const bilateralSession = {
  id: "bilateral-1",
  exerciseId: "squat",
  date: "2026-07-18",
  singleLeg: false,
  sets: [
    { reps: "5", weight: "100" },
    { reps: "", weight: "" },
  ],
  notes: "felt good",
};

const leftRightSession = {
  id: "single-1",
  exerciseId: "le",
  date: "2026-07-19",
  singleLeg: true,
  leftSets: [{ reps: "10", weight: "20" }],
  rightSets: [{ reps: "8", weight: "20" }],
  notes: "slow eccentric",
};

test("deterministic IDs and stable hashes are idempotent regardless of object key order", () => {
  assert.equal(stableStringify({ b: 2, a: 1 }), stableStringify({ a: 1, b: 2 }));
  assert.equal(stableHash({ b: 2, a: 1 }), stableHash({ a: 1, b: 2 }));
  assert.equal(deterministicId("legacy-workout", { b: 2, a: 1 }), deterministicId("legacy-workout", { a: 1, b: 2 }));
});

test("bilateral legacy sessions become one both-side working prescription block", () => {
  const result = transformLegacyDataToV2({
    weeks: [{ week: "4", sessions: [bilateralSession] }],
    customExercises: [{ id: "squat", label: "Squat", singleLeg: false, builtIn: false }],
    surgeryDate: "2026-06-20",
  });

  assert.equal(result.settings.schemaVersion, V2_SCHEMA_VERSION);
  assert.equal(result.settings.surgeryDate, "2026-06-20");
  assert.equal(result.workouts.length, 1);
  assert.equal(result.exercises.length, 1);
  assert.equal(result.exercises[0].id, "squat");
  assert.equal(result.exercises[0].name, "Squat");

  const workout = result.workouts[0];
  const exercise = workout.exercises[0];
  assert.equal(workout.date, "2026-07-18");
  assert.equal(workout.notes, "felt good");
  assert.equal(workout.legacy.legacyWeek, "4");
  assert.equal(workout.legacy.legacySessionId, "bilateral-1");
  assert.deepEqual(workout.legacy.raw, bilateralSession);
  assert.equal(exercise.exerciseId, "squat");
  assert.equal(exercise.progression.strategy, "manual");
  assert.equal(exercise.progression.enabled, false);

  assert.equal(exercise.prescriptionBlocks.length, 1);
  assert.equal(exercise.prescriptionBlocks[0].side, SIDE.BOTH);
  assert.equal(exercise.prescriptionBlocks[0].targetSets, 2);
  assert.equal(exercise.prescriptionBlocks[0].actualSets.length, 2);
  assert.equal(exercise.prescriptionBlocks[0].actualSets[0].setType, SET_TYPE.WORKING);
  assert.equal(exercise.prescriptionBlocks[0].actualSets[0].actualReps, 5);
  assert.equal(exercise.prescriptionBlocks[0].actualSets[0].weight, 100);
  assert.equal(exercise.prescriptionBlocks[0].actualSets[0].rawReps, "5");
  assert.equal(exercise.prescriptionBlocks[0].actualSets[0].rawWeight, "100");
  assert.equal(exercise.prescriptionBlocks[0].actualSets[1].completed, false);
  assert.equal(exercise.prescriptionBlocks[0].actualSets[1].rawReps, "");
  assert.equal(exercise.prescriptionBlocks[0].actualSets[1].rawWeight, "");
});

test("left/right legacy sessions become separate left and right prescription blocks", () => {
  const result = transformLegacyDataToV2({ weeks: [{ week: "5", sessions: [leftRightSession] }] });
  const workout = result.workouts[0];
  const blocks = workout.exercises[0].prescriptionBlocks;

  assert.equal(workout.legacy.singleLeg, true);
  assert.equal(workout.exercises[0].exerciseId, "le");
  assert.equal(workout.exercises[0].exerciseNameSnapshot, "Leg Extension");
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].side, SIDE.LEFT);
  assert.equal(blocks[1].side, SIDE.RIGHT);
  assert.equal(blocks[0].actualSets[0].rawReps, "10");
  assert.equal(blocks[0].actualSets[0].rawWeight, "20");
  assert.equal(blocks[1].actualSets[0].rawReps, "8");
  assert.equal(blocks[1].actualSets[0].rawWeight, "20");
});

test("unknown exercise IDs are migrated safely instead of discarded", () => {
  const session = { ...bilateralSession, exerciseId: "mystery", id: "unknown-1" };
  const result = transformLegacyDataToV2({ weeks: [{ week: "1", sessions: [session] }] });

  assert.equal(result.exercises.length, 1);
  assert.equal(result.exercises[0].id, "mystery");
  assert.equal(result.exercises[0].name, "Unknown legacy exercise (mystery)");
  assert.equal(result.exercises[0].legacy.source, "legacySessionReference");
  assert.equal(result.workouts[0].exercises[0].exerciseId, "mystery");
});

test("malformed legacy data and missing fields produce safe empty/default v2 output", () => {
  const result = transformLegacyDataToV2({ weeks: [{ sessions: [null, { id: "missing-fields" }] }], customExercises: null });

  assert.equal(result.migrationSummary.legacyWeekCount, 1);
  assert.equal(result.migrationSummary.legacySessionCount, 2);
  assert.equal(result.workouts.length, 2);
  assert.equal(result.workouts[0].date, "");
  assert.equal(result.workouts[0].notes, "");
  assert.equal(result.workouts[0].exercises[0].prescriptionBlocks[0].side, SIDE.BOTH);
  assert.deepEqual(result.workouts[0].exercises[0].prescriptionBlocks[0].actualSets, []);
  assert.match(result.workouts[0].exercises[0].exerciseId, /^unknown-/);
});

test("transforms are idempotent for the same legacy payload", () => {
  const legacyData = {
    weeks: [{ week: "1", sessions: [bilateralSession, leftRightSession] }],
    customExercises: [{ id: "squat", label: "Squat", singleLeg: false, builtIn: false }],
    surgeryDate: "2026-06-20",
  };

  assert.deepEqual(transformLegacyDataToV2(legacyData), transformLegacyDataToV2(legacyData));
});
