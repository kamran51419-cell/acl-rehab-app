import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { completedWorkoutHistory } from "../src/lib/domain/workoutDisplay.js";
import { deleteWorkoutDocument, finishWorkoutDocument, updateInProgressWorkoutDocument, workoutsFromSnapshot } from "../src/lib/firebase/planRepository.js";

function firestoreHarness(initial = {}) {
  const documents = new Map(Object.entries(initial));
  const transactionRunner = async (_db, operation) => operation({
    get: async (ref) => ({ exists: () => documents.has(ref), data: () => structuredClone(documents.get(ref)) }),
    set: (ref, data, options) => documents.set(ref, options?.merge ? { ...(documents.get(ref) || {}), ...structuredClone(data) } : structuredClone(data)),
  });
  const snapshot = () => ({ docs: [...documents.entries()].map(([id, data]) => ({ id, data: () => structuredClone(data) })) });
  return { documents, transactionRunner, snapshot };
}

test("full workout persistence flow survives subscriptions/reloads and permanent deletion", async (context) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  context.after(() => vite.close());
  const { WorkoutHistoryView } = await vite.ssrLoadModule("/src/features/workout/WorkoutHistoryScreen.jsx");
  const firestore = firestoreHarness({
    "workout-path-id": { id: "stale-payload-id", status: "in_progress", date: "2026-07-19", programmeNameSnapshot: "ACL Rehab", sessionNameSnapshot: "Lower", exercises: [] },
  });
  const referenceFactory = () => "workout-path-id";
  const entered = {
    id: "workout-path-id", status: "in_progress", date: "2026-07-19", programmeNameSnapshot: "ACL Rehab", sessionNameSnapshot: "Lower", notes: "Felt strong",
    exercises: [{ id: "press", exerciseId: "leg-press", exerciseNameSnapshot: "Leg Press", exerciseType: "strength", loggingMethod: "reps_weight", sideSnapshot: "left", notes: "No pain", completed: true, sortOrder: 0, recordedSets: [{ id: "set-1", setNumber: 1, prescribedReps: { type: "fixed", value: 10 }, weight: 85, unit: "kg" }] }],
  };

  assert.equal(await updateInProgressWorkoutDocument({}, "uid", entered, { transactionRunner: firestore.transactionRunner, referenceFactory, timestamp: "autosaved" }), true);
  const completed = await finishWorkoutDocument({}, "uid", entered, { transactionRunner: firestore.transactionRunner, referenceFactory, timestamp: { seconds: 100, nanoseconds: 0 }, completedAtValue: "client-time" });
  assert.equal(completed.status, "completed");
  assert.equal(firestore.documents.get("workout-path-id").status, "completed");

  // A delayed autosave arriving after completion is rejected by the persisted status.
  assert.equal(await updateInProgressWorkoutDocument({}, "uid", { ...entered, notes: "stale" }, { transactionRunner: firestore.transactionRunner, referenceFactory, timestamp: "late" }), false);
  assert.equal(firestore.documents.get("workout-path-id").notes, "Felt strong");

  // New snapshots model navigation, refresh, and a later app reopen. Path identity wins.
  for (let reload = 0; reload < 3; reload += 1) {
    const subscribed = workoutsFromSnapshot(firestore.snapshot());
    assert.equal(subscribed[0].id, "workout-path-id");
    assert.equal(completedWorkoutHistory(subscribed).length, 1);
    const markup = renderToStaticMarkup(React.createElement(WorkoutHistoryView, { workouts: subscribed, selectedId: "workout-path-id", onSelect() {}, onRequestDelete() {}, onCancelDelete() {}, onConfirmDelete() {} }));
    assert.match(markup, /ACL Rehab/);
    assert.match(markup, /Leg Press/);
    assert.match(markup, /10 reps/);
    assert.match(markup, /85 kg/);
    assert.match(markup, /Left only/);
    assert.match(markup, /Felt strong/);
    assert.match(markup, /No pain/);
  }

  await deleteWorkoutDocument({}, "uid", "workout-path-id", { referenceFactory, deleteDocument: async (ref) => firestore.documents.delete(ref) });
  assert.deepEqual(workoutsFromSnapshot(firestore.snapshot()), []);
  assert.deepEqual(completedWorkoutHistory(workoutsFromSnapshot(firestore.snapshot())), []);
});

test("completed history sorts Firestore timestamps without string coercion", () => {
  const workouts = [
    { id: "older", status: "completed", date: "2026-07-19", completedAt: { seconds: 10, nanoseconds: 0 } },
    { id: "newer", status: "completed", date: "2026-07-19", completedAt: { seconds: 20, nanoseconds: 0 } },
  ];
  assert.deepEqual(completedWorkoutHistory(workouts).map((workout) => workout.id), ["newer", "older"]);
});
