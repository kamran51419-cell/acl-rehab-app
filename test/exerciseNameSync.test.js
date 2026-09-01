import assert from "node:assert/strict";
import test from "node:test";

import { renameExerciseNameSnapshots } from "../src/lib/domain/exerciseNameSync.js";

test("exercise rename updates programme snapshots without changing prescription data", () => {
  const plan = {
    id: "plan",
    sessions: [{
      id: "session",
      exercises: [
        { id: "plan-leg-press", exerciseId: "leg-press", exerciseNameSnapshot: "Old Leg Press", equipmentType: "machine", prescription: { targetSets: 3 } },
        { id: "row", exerciseId: "row", exerciseNameSnapshot: "Row" },
      ],
    }],
  };
  const renamed = renameExerciseNameSnapshots(plan, "leg-press", "Leg Press");
  assert.equal(renamed.sessions[0].exercises[0].exerciseNameSnapshot, "Leg Press");
  assert.equal(renamed.sessions[0].exercises[0].equipmentType, "machine");
  assert.deepEqual(renamed.sessions[0].exercises[0].prescription, { targetSets: 3 });
  assert.equal(renamed.sessions[0].exercises[1], plan.sessions[0].exercises[1]);
});

test("exercise rename updates workout history and substitution labels by exercise id", () => {
  const workout = {
    id: "workout",
    status: "completed",
    exercises: [
      { exerciseId: "leg-press", exerciseNameSnapshot: "Old Leg Press", recordedSets: [{ weight: 80, actualReps: 10 }] },
      { exerciseId: "hack-squat", exerciseNameSnapshot: "Hack Squat", substitutedForExerciseId: "leg-press", substitutedForExerciseName: "Old Leg Press", recordedSets: [{ weight: 60, actualReps: 8 }] },
    ],
  };
  const renamed = renameExerciseNameSnapshots(workout, "leg-press", "Leg Press");
  assert.equal(renamed.exercises[0].exerciseNameSnapshot, "Leg Press");
  assert.deepEqual(renamed.exercises[0].recordedSets, workout.exercises[0].recordedSets);
  assert.equal(renamed.exercises[1].exerciseNameSnapshot, "Hack Squat");
  assert.equal(renamed.exercises[1].substitutedForExerciseName, "Leg Press");
});

test("unrelated records keep their original object identity", () => {
  const workout = { exercises: [{ exerciseId: "row", exerciseNameSnapshot: "Row" }] };
  assert.equal(renameExerciseNameSnapshots(workout, "leg-press", "Leg Press"), workout);
});
