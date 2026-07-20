import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("selected workout session renders prescribed and actual workout fields", async (context) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  context.after(() => vite.close());
  const { WorkoutForm } = await vite.ssrLoadModule("/src/features/workout/WorkoutScreen.jsx");
  const workout = {
    id: "workout-1",
    date: "2026-07-18",
    sessionNameSnapshot: "Lower Body",
    notes: "",
    exercises: [
      { id: "check", exerciseId: "pogos", exerciseNameSnapshot: "Pogos", exerciseType: "other", loggingMethod: "reps", completed: false, prescription: { targetSets: 3, targetReps: { type: "fixed", value: 20 } }, recordedSets: [{ id: "pogos-set-1", setNumber: 1, actualReps: "", rawReps: "" }], sortOrder: 0 },
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
  assert.match(markup, /Pogos set 1 reps/);
  assert.match(markup, /Leg Press/);
  assert.match(markup, /Left only/);
  assert.match(markup, /Slow lowering, pause at the top/);
  assert.match(markup, /Workout notes/);
  assert.match(markup, /Workout date/);
  assert.match(markup, /Complete Workout/);
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
  assert.match(failed, /Complete Workout/);
});

test("weight inputs select their current value on first focus", async (context) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  context.after(() => vite.close());
  const { WeightCard } = await vite.ssrLoadModule("/src/features/workout/WorkoutScreen.jsx");
  const workout = { id: "workout", date: "2026-07-19", sessionNameSnapshot: "Lower", exercises: [{ id: "press", exerciseId: "press", exerciseNameSnapshot: "Leg Press", exerciseType: "strength", loggingMethod: "reps_weight", prescription: {}, recordedSets: [{ id: "set", setNumber: 1, prescribedReps: { type: "fixed", value: 10 }, weight: 75, rawWeight: "75" }] }] };
  const element = WeightCard({ exercise: workout.exercises[0], onWeight() {} });
  let weightInput;
  function visit(node) { if (!node || typeof node !== "object") return; if (node.props?.["aria-label"]?.includes("weight")) weightInput = node; React.Children.forEach(node.props?.children, visit); }
  visit(element);
  let selected = false;
  weightInput.props.onFocus({ currentTarget: { select() { selected = true; } } });
  assert.equal(selected, true);
});

test("unfinished workout exposes a confirmed standalone discard action", async (context) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  context.after(() => vite.close());
  const { DiscardWorkoutDialog } = await vite.ssrLoadModule("/src/features/workout/WorkoutScreen.jsx");
  const markup = renderToStaticMarkup(React.createElement(DiscardWorkoutDialog, { onCancel() {}, onConfirm() {} }));
  assert.match(markup, /Discard Workout\?/);
  assert.match(markup, /Cancel/);
  assert.match(markup, /Completed workouts will not be affected/);
});

test("Workout programme list always shows all sessions with independent status", async (context) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  context.after(() => vite.close());
  const { ProgrammeSessionList } = await vite.ssrLoadModule("/src/features/workout/WorkoutScreen.jsx");
  const programme = { id: "plan", name: "Programme" };
  const sessions = [{ id: "press", name: "Press + Legs", exercises: [] }, { id: "pull", name: "Pull + Legs", exercises: [] }, { id: "full", name: "Full Body", exercises: [] }];
  const workouts = [{ status: "completed", planId: "plan", sessionId: "press", date: "2026-07-18" }, { status: "completed", planId: "plan", sessionId: "press", date: "2026-07-19" }, { status: "in_progress", planId: "plan", sessionId: "full", date: "2026-07-19" }];
  const markup = renderToStaticMarkup(React.createElement(ProgrammeSessionList, { programme, sessions, workouts, today: "2026-07-19", onSelect() {} }));
  assert.match(markup, /Press \+ Legs/);
  assert.match(markup, /Pull \+ Legs/);
  assert.match(markup, /Full Body/);
  assert.match(markup, /Done 2 times this week/);
  assert.match(markup, /Continue workout/);
});

test("selecting another session presents Continue, Discard and Cancel choices", async (context) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  context.after(() => vite.close());
  const { UnfinishedWorkoutDialog } = await vite.ssrLoadModule("/src/features/workout/WorkoutScreen.jsx");
  const choices = renderToStaticMarkup(React.createElement(UnfinishedWorkoutDialog, { unfinishedName: "Full Body", requestedName: "Press + Legs", onContinue() {}, onRequestDiscard() {}, onDiscard() {}, onBack() {}, onCancel() {} }));
  assert.match(choices, /Unfinished workout in progress/);
  assert.match(choices, /Full Body/);
  assert.match(choices, /Continue workout/);
  assert.match(choices, /Discard unfinished workout and start this session/);
  assert.match(choices, /Cancel/);
  const confirmation = renderToStaticMarkup(React.createElement(UnfinishedWorkoutDialog, { unfinishedName: "Full Body", requestedName: "Press + Legs", confirming: true, onContinue() {}, onRequestDiscard() {}, onDiscard() {}, onBack() {}, onCancel() {} }));
  assert.match(confirmation, /Permanently discard/);
  assert.match(confirmation, /Discard and start/);
});
