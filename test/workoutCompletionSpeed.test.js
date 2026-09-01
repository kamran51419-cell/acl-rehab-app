import assert from "node:assert/strict";
import test from "node:test";

import { completeWorkout, createDebouncedSaver } from "../src/lib/domain/workoutSession.js";
import { finishWorkoutDocument } from "../src/lib/firebase/planRepository.js";

test("completing a workout cancels a pending debounce instead of waiting for a redundant draft write", async () => {
  let draftWrites = 0;
  const saver = createDebouncedSaver(async () => { draftWrites += 1; }, 60_000);
  const workout = { id: "workout", notes: "latest", exercises: [{ id: "press", completed: true }] };
  saver.schedule(workout);

  const completed = await completeWorkout(workout, saver, async (latest) => ({ ...latest, status: "completed" }));

  assert.equal(draftWrites, 0);
  assert.equal(completed.status, "completed");
  assert.equal(completed.notes, "latest");
});

test("finishing returns after the completion transaction without requiring a second verification read", async () => {
  let written;
  const run = async (_db, operation) => operation({
    get: async () => ({ exists: () => false }),
    set: (ref, data) => { written = { ref, data }; },
  });
  const workout = { id: "workout", date: "2026-09-01", status: "in_progress", notes: "done" };

  const completed = await finishWorkoutDocument({}, "uid", workout, {
    timestamp: "server-time",
    completedAtValue: "client-time",
    run,
    referenceFactory: () => "workout-ref",
  });

  assert.equal(written.ref, "workout-ref");
  assert.equal(written.data.status, "completed");
  assert.equal(written.data.notes, "done");
  assert.equal(completed.status, "completed");
  assert.equal(completed.completedAt, "client-time");
});
