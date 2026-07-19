import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("completed workout history is ordered and renders snapshot details", async (context) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  context.after(() => vite.close());
  const { WorkoutHistoryView } = await vite.ssrLoadModule("/src/features/workout/WorkoutHistoryScreen.jsx");
  const { completedWorkoutHistory } = await import("../src/lib/domain/workoutDisplay.js");
  const older = { id: "older", status: "completed", date: "2026-07-17", sessionNameSnapshot: "Upper", exercises: [] };
  const latest = {
    id: "latest", status: "completed", date: "2026-07-18", completedAt: "2026-07-18T12:00:00Z",
    sessionNameSnapshot: "Lower", programmeNameSnapshot: "ACL Rehab", notes: "Felt strong",
    exercises: [{
      id: "press", exerciseId: "leg-press", exerciseNameSnapshot: "Leg Press", exerciseType: "strength",
      loggingMethod: "reps_weight", sideSnapshot: "left", programmeNoteSnapshot: "Slow lowering", completed: true,
      prescription: { targetSets: 1, targetReps: { type: "fixed", value: 10 } },
      recordedSets: [{ id: "set", setNumber: 1, weight: 85 }],
    }],
  };
  assert.deepEqual(completedWorkoutHistory([{ id: "draft", status: "in_progress" }, older, latest]).map((workout) => workout.id), ["latest", "older"]);
  const markup = renderToStaticMarkup(React.createElement(WorkoutHistoryView, { workouts: [older, latest], selectedId: "latest", onSelect() {}, onRequestDelete() {}, onCancelDelete() {}, onConfirmDelete() {} }));
  assert.match(markup, /18-07-26/);
  assert.match(markup, /ACL Rehab/);
  assert.match(markup, /Leg Press/);
  assert.match(markup, /Left only/);
  assert.match(markup, /Slow lowering/);
  assert.match(markup, /85 kg/);
  assert.match(markup, /Felt strong/);
});

test("workout deletion confirmation and error states render safely", async (context) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  context.after(() => vite.close());
  const { WorkoutHistoryView } = await vite.ssrLoadModule("/src/features/workout/WorkoutHistoryScreen.jsx");
  const workout = { id: "one", status: "completed", date: "2026-07-18", sessionNameSnapshot: "Lower", exercises: [] };
  const confirm = renderToStaticMarkup(React.createElement(WorkoutHistoryView, { workouts: [workout], selectedId: "one", deletingId: "one", onSelect() {}, onRequestDelete() {}, onCancelDelete() {}, onConfirmDelete() {} }));
  assert.match(confirm, /Delete workout\?/);
  assert.match(confirm, /permanently remove/);
  assert.match(confirm, /Cancel/);
  const deleting = renderToStaticMarkup(React.createElement(WorkoutHistoryView, { workouts: [workout], selectedId: "one", deletingId: "pending", onSelect() {}, onRequestDelete() {}, onCancelDelete() {}, onConfirmDelete() {} }));
  assert.match(deleting, /Deleting…/);
  const failed = renderToStaticMarkup(React.createElement(WorkoutHistoryView, { workouts: [workout], selectedId: "one", deleteError: "Could not delete workout", onSelect() {}, onRequestDelete() {}, onCancelDelete() {}, onConfirmDelete() {} }));
  assert.match(failed, /Could not delete workout/);
  assert.match(failed, /Lower/);
});
