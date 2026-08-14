import test from "node:test";
import assert from "node:assert/strict";
import { EXERCISE_LOGGING_METHOD, EXERCISE_TYPE, INTERVAL_PHASE, validatePlan } from "../src/lib/domain/plans.js";
import { previousRepsForExercise, previousWeightsForExercise } from "../src/lib/domain/workoutDisplay.js";
import { SIDE } from "../src/lib/domain/v2Models.js";

function intervalPlan(stage) {
  return {
    name: "Intervals",
    isActive: false,
    sessions: [{
      id: "session-1",
      name: "Cardio",
      exercises: [{
        id: "plan-exercise-1",
        exerciseId: "run",
        exerciseNameSnapshot: "Run",
        exerciseType: EXERCISE_TYPE.CARDIO,
        loggingMethod: EXERCISE_LOGGING_METHOD.INTERVALS,
        prescription: { stages: [{ id: "stage-1", phase: INTERVAL_PHASE.WORK, sortOrder: 0, ...stage }] },
      }],
    }],
  };
}

test("distance-based cardio interval stages validate", () => {
  assert.equal(validatePlan(intervalPlan({ distance: 400, distanceUnit: "m" })).valid, true);
  assert.equal(validatePlan(intervalPlan({ distance: 1, distanceUnit: "km" })).valid, true);
});

test("unilateral history resolves reps and weight by side", () => {
  const workouts = [{
    status: "completed",
    date: "2026-08-01",
    exercises: [
      { id: "split-left", exerciseId: "split", sideSnapshot: SIDE.LEFT, recordedSets: [{ setNumber: 1, actualReps: 8, weight: 20 }] },
      { id: "split-right", exerciseId: "split", sideSnapshot: SIDE.RIGHT, recordedSets: [{ setNumber: 1, actualReps: 10, weight: 25 }] },
    ],
  }];
  const left = { id: "split-left", exerciseId: "split", prescription: { side: SIDE.LEFT } };
  const right = { id: "split-right", exerciseId: "split", prescription: { side: SIDE.RIGHT } };
  assert.deepEqual(previousRepsForExercise(workouts, left), { 1: 8 });
  assert.deepEqual(previousWeightsForExercise(workouts, left), { 1: 20 });
  assert.deepEqual(previousRepsForExercise(workouts, right), { 1: 10 });
  assert.deepEqual(previousWeightsForExercise(workouts, right), { 1: 25 });
});
