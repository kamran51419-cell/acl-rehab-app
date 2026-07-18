import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("selected workout session renders its form and Finish workout action", async (context) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  context.after(() => vite.close());
  const { WorkoutForm } = await vite.ssrLoadModule("/src/features/workout/WorkoutScreen.jsx");
  const workout = {
    id: "workout-1",
    date: "2026-07-18",
    sessionNameSnapshot: "Lower Body",
    notes: "",
    exercises: [
      { id: "check", exerciseId: "pogos", exerciseNameSnapshot: "Pogos", exerciseType: "other", loggingMethod: "reps", completed: false, prescription: { targetSets: 3, targetReps: { type: "fixed", value: 20 } }, sortOrder: 0 },
      { id: "press", exerciseId: "leg-press", exerciseNameSnapshot: "Leg Press", exerciseType: "strength", loggingMethod: "reps_weight", sideSnapshot: "left", programmeNoteSnapshot: "Slow lowering, pause at the top", prescription: { targetSets: 2, targetReps: { type: "fixed", value: 10 } }, recordedSets: [{ id: "set-1", setNumber: 1, prescribedReps: { type: "fixed", value: 10 }, weight: 80, rawWeight: "80", unit: "kg" }], sortOrder: 1 },
    ],
  };

  const markup = renderToStaticMarkup(React.createElement(WorkoutForm, {
    workout,
    onBack() {},
    onToggle() {},
    onWeight() {},
    onDate() {},
    onNotes() {},
    onFinish() {},
  }));

  assert.match(markup, /Workout in progress/);
  assert.match(markup, /Lower Body/);
  assert.match(markup, /type="checkbox"/);
  assert.match(markup, /Leg Press/);
  assert.match(markup, /Left only/);
  assert.match(markup, /Slow lowering, pause at the top/);
  assert.match(markup, /Workout notes/);
  assert.match(markup, /Workout date/);
  assert.match(markup, /Finish workout/);
});

test("workout form shows finishing and failure states", async (context) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  context.after(() => vite.close());
  const { WorkoutForm } = await vite.ssrLoadModule("/src/features/workout/WorkoutScreen.jsx");
  const workout = { id: "workout", date: "2026-07-18", sessionNameSnapshot: "Session", exercises: [] };
  const finishing = renderToStaticMarkup(React.createElement(WorkoutForm, { workout, finishing: true, onBack() {}, onToggle() {}, onWeight() {}, onDate() {}, onNotes() {}, onFinish() {} }));
  assert.match(finishing, /Finishing…/);
  assert.match(finishing, /disabled=""/);
  const failed = renderToStaticMarkup(React.createElement(WorkoutForm, { workout, finishError: "Could not finish workout. Please try again.", onBack() {}, onToggle() {}, onWeight() {}, onDate() {}, onNotes() {}, onFinish() {} }));
  assert.match(failed, /Could not finish workout/);
  assert.match(failed, /Finish workout/);
});
