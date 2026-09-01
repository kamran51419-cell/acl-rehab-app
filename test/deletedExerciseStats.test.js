import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

test("Stats ignores exercises marked hidden while workout history data remains intact", async (context) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  context.after(() => vite.close());
  const { completedExerciseGroups, exerciseProgressEntries } = await vite.ssrLoadModule("/src/lib/domain/exerciseProgress.js");

  const weighted = (id, name, weight, hiddenFromStats = false) => ({
    id: `${id}-copy`,
    exerciseId: id,
    exerciseNameSnapshot: name,
    exerciseType: "strength",
    loggingMethod: "reps_weight",
    hiddenFromStats,
    recordedSets: [{ id: `${id}-set`, setNumber: 1, weight, actualReps: 10, rawReps: "10" }],
  });

  const workouts = [{
    id: "completed",
    status: "completed",
    completed: true,
    date: "2026-09-01",
    exercises: [
      weighted("kept", "Kept Exercise", 40),
      weighted("deleted", "Deleted Exercise", 50, true),
    ],
  }];

  const groups = completedExerciseGroups(workouts);
  const entries = exerciseProgressEntries(workouts);

  assert.deepEqual(groups.map((group) => group.exerciseId), ["kept"]);
  assert.deepEqual(entries.map((entry) => entry.exerciseId), ["kept"]);
  assert.equal(workouts[0].exercises[1].exerciseNameSnapshot, "Deleted Exercise");
  assert.equal(workouts[0].exercises[1].recordedSets[0].weight, 50);
});
