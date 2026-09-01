import assert from "node:assert/strict";
import test from "node:test";

import { SIDE } from "../src/lib/domain/v2Models.js";
import { hydrateQuickWorkoutPreviousPerformance, quickPreviousPerformanceForExercise } from "../src/lib/domain/quickWorkoutHistory.js";

function completedWorkout(date, exercise) {
  return { status: "completed", completed: true, date, exercises: [exercise] };
}

function weightedExercise({ id, exerciseId, name = "Leg Press", side = SIDE.BOTH, equipmentType = "machine", reps = 10, weight = 80 }) {
  return {
    id,
    exerciseId,
    exerciseNameSnapshot: name,
    exerciseType: "strength",
    loggingMethod: "reps_weight",
    sideSnapshot: side,
    equipmentType,
    recordedSets: [{ setNumber: 1, actualReps: reps, weight }],
  };
}

test("Quick Workout previous performance follows exerciseId across programme/session instances", () => {
  const history = [completedWorkout("2026-08-31", weightedExercise({ id: "programme-session-a-leg-press", exerciseId: "exercise-leg-press", reps: 9, weight: 85 }))];
  const quick = weightedExercise({ id: "quick-random-instance", exerciseId: "exercise-leg-press", reps: "", weight: "" });
  assert.deepEqual(quickPreviousPerformanceForExercise(history, quick), { weights: { 1: 85 }, reps: { 1: 9 } });
});

test("Quick Workout uses the most recent completed performance for the exercise", () => {
  const history = [
    completedWorkout("2026-08-20", weightedExercise({ id: "old-session-copy", exerciseId: "exercise-leg-press", reps: 10, weight: 75 })),
    completedWorkout("2026-08-31", weightedExercise({ id: "new-session-copy", exerciseId: "exercise-leg-press", reps: 8, weight: 90 })),
  ];
  const quick = weightedExercise({ id: "quick-copy", exerciseId: "exercise-leg-press", reps: "", weight: "" });
  assert.deepEqual(quickPreviousPerformanceForExercise(history, quick), { weights: { 1: 90 }, reps: { 1: 8 } });
});

test("Quick Workout falls back to exercise name for legacy history with a different stored ID", () => {
  const history = [completedWorkout("2026-08-31", weightedExercise({ id: "legacy-session-copy", exerciseId: "legacy-leg-press-id", name: "Leg Press", reps: 11, weight: 82.5 }))];
  const quick = weightedExercise({ id: "quick-copy", exerciseId: "current-leg-press-id", name: "Leg Press", reps: "", weight: "" });
  assert.deepEqual(quickPreviousPerformanceForExercise(history, quick), { weights: { 1: 82.5 }, reps: { 1: 11 } });
});

test("Quick Workout preserves left/right history", () => {
  const workout = { status: "completed", date: "2026-08-31", exercises: [
    weightedExercise({ id: "left", exerciseId: "extension", side: SIDE.LEFT, reps: 10, weight: 35 }),
    weightedExercise({ id: "right", exerciseId: "extension", side: SIDE.RIGHT, reps: 12, weight: 40 }),
  ] };
  const target = weightedExercise({ id: "quick-left", exerciseId: "extension", side: SIDE.LEFT, reps: "", weight: "" });
  assert.deepEqual(quickPreviousPerformanceForExercise([workout], target), { weights: { 1: 35 }, reps: { 1: 10 } });
});

test("Quick Workout hydration writes previous values onto displayed sets", () => {
  const history = [completedWorkout("2026-08-31", weightedExercise({ id: "programme-copy", exerciseId: "exercise-leg-press", reps: 7, weight: 95 }))];
  const workout = {
    sourceType: "one_off",
    exercises: [{
      ...weightedExercise({ id: "quick-copy", exerciseId: "exercise-leg-press", reps: "", weight: "" }),
      recordedSets: [{ id: "quick-copy-set-1", setNumber: 1, actualReps: "", rawReps: "", weight: "", rawWeight: "" }],
    }],
  };
  const hydrated = hydrateQuickWorkoutPreviousPerformance(workout, history);
  assert.equal(hydrated.exercises[0].recordedSets[0].previousReps, 7);
  assert.equal(hydrated.exercises[0].recordedSets[0].previousWeight, 95);
});

test("exercise added during a programme workout gets previous performance", () => {
  const history = [completedWorkout("2026-08-31", weightedExercise({ id: "old-programme-copy", exerciseId: "exercise-leg-press", reps: 8, weight: 90 }))];
  const existing = weightedExercise({ id: "programme-existing", exerciseId: "another-exercise", name: "Another exercise", reps: "", weight: "" });
  const added = {
    ...weightedExercise({ id: "added-mid-workout", exerciseId: "exercise-leg-press", reps: "", weight: "" }),
    addedDuringWorkout: true,
    recordedSets: [{ id: "added-set-1", setNumber: 1, actualReps: "", rawReps: "", weight: "", rawWeight: "" }],
  };
  const workout = { sourceType: "programme", exercises: [existing, added] };
  const hydrated = hydrateQuickWorkoutPreviousPerformance(workout, history);
  assert.equal(hydrated.exercises[0], existing);
  assert.equal(hydrated.exercises[1].recordedSets[0].previousReps, 8);
  assert.equal(hydrated.exercises[1].recordedSets[0].previousWeight, 90);
});

test("previous performance is blank when selected equipment has no history", () => {
  const history = [completedWorkout("2026-08-31", weightedExercise({ id: "machine-copy", exerciseId: "exercise-leg-press", equipmentType: "machine", reps: 8, weight: 90 }))];
  const cable = weightedExercise({ id: "cable-copy", exerciseId: "exercise-leg-press", equipmentType: "cable", reps: "", weight: "" });
  assert.deepEqual(quickPreviousPerformanceForExercise(history, cable), { weights: {}, reps: {} });
});

test("previous performance follows the selected equipment type", () => {
  const history = [
    completedWorkout("2026-08-31", weightedExercise({ id: "machine-copy", exerciseId: "exercise-leg-press", equipmentType: "machine", reps: 8, weight: 90 })),
    completedWorkout("2026-08-30", weightedExercise({ id: "cable-copy", exerciseId: "exercise-leg-press", equipmentType: "cable", reps: 12, weight: 55 })),
  ];
  const cable = weightedExercise({ id: "current-cable", exerciseId: "exercise-leg-press", equipmentType: "cable", reps: "", weight: "" });
  assert.deepEqual(quickPreviousPerformanceForExercise(history, cable), { weights: { 1: 55 }, reps: { 1: 12 } });
});

test("changing equipment clears stale previous values when that equipment has no history", () => {
  const history = [completedWorkout("2026-08-31", weightedExercise({ id: "machine-copy", exerciseId: "exercise-leg-press", equipmentType: "machine", reps: 8, weight: 90 }))];
  const workout = {
    sourceType: "one_off",
    exercises: [{
      ...weightedExercise({ id: "current-cable", exerciseId: "exercise-leg-press", equipmentType: "cable", reps: "", weight: "" }),
      recordedSets: [{ id: "set-1", setNumber: 1, previousReps: 8, previousWeight: 90, actualReps: "", rawReps: "", weight: "", rawWeight: "" }],
    }],
  };
  const hydrated = hydrateQuickWorkoutPreviousPerformance(workout, history);
  assert.equal(hydrated.exercises[0].recordedSets[0].previousReps, "");
  assert.equal(hydrated.exercises[0].recordedSets[0].previousWeight, "");
});
