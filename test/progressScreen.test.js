import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("Stats has a completed-workout empty state without a redundant Progress heading", async (context) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  context.after(() => vite.close());
  const { ProgressLayout } = await vite.ssrLoadModule("/src/features/progress/ProgressScreen.jsx");
  const markup = renderToStaticMarkup(React.createElement(ProgressLayout, { user: { uid: "user" }, workouts: [], trainingMode: "gym" }));
  assert.equal((markup.match(/>Progress</g) || []).length, 0);
  assert.match(markup, /Workout History/);
  assert.match(markup, /Stats/);
  assert.match(markup, /No completed workouts yet/);
});

test("non-weighted exercise stats omit graphs and personal bests", async (context) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  context.after(() => vite.close());
  const { ExerciseStats } = await vite.ssrLoadModule("/src/features/progress/ProgressScreen.jsx");
  const group = { name: "Stretch", performances: [{ date: "2026-07-19", displayDate: "19/07/26", exercise: { completed: true } }], weightedEntries: [] };
  const markup = renderToStaticMarkup(React.createElement(ExerciseStats, { group, trainingMode: "rehab" }));
  assert.match(markup, /not recorded with Reps \+ Weight/);
  assert.doesNotMatch(markup, /Weight progress|Personal bests|Symmetry/);
});

test("Stats opens as a searchable browser containing only completed exercises", async (context) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  context.after(() => vite.close());
  const { StatsView } = await vite.ssrLoadModule("/src/features/progress/ProgressScreen.jsx");
  const workouts = [
    { id: "done", status: "completed", date: "2026-07-19", exercises: [{ id: "press-copy", exerciseId: "press", exerciseNameSnapshot: "Leg Press", exerciseType: "strength", loggingMethod: "reps_weight", recordedSets: [{ id: "set", setNumber: 1, weight: 100, prescribedReps: { type: "fixed", value: 10 } }] }] },
    { id: "draft", status: "in_progress", date: "2026-07-20", exercises: [{ id: "ghost-copy", exerciseId: "ghost", exerciseNameSnapshot: "Never Completed", exerciseType: "strength", loggingMethod: "reps_weight", recordedSets: [{ id: "set", setNumber: 1, weight: 50 }] }] },
  ];
  const markup = renderToStaticMarkup(React.createElement(StatsView, { workouts, trainingMode: "gym" }));
  assert.match(markup, /Search exercises/);
  assert.match(markup, /Leg Press/);
  assert.match(markup, /Strength/);
  assert.doesNotMatch(markup, /Never Completed|All Exercises/);
});

test("strength graph uses the highest e1RM set from each workout and preserves separate same-day workouts", async (context) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  context.after(() => vite.close());
  const { estimatedOneRepMax, strengthGraphPoints } = await vite.ssrLoadModule("/src/features/progress/ProgressScreen.jsx");
  assert.equal(estimatedOneRepMax(20, 12), 28);
  const entries = [
    { workoutId: "w1", date: "2026-08-10", displayDate: "10/08/2026", weight: 20, reps: 12, sideMode: "standard" },
    { workoutId: "w1", date: "2026-08-10", displayDate: "10/08/2026", weight: 22.5, reps: 9, sideMode: "standard" },
    { workoutId: "w2", date: "2026-08-10", displayDate: "10/08/2026", weight: 25, reps: 6, sideMode: "standard" },
  ];
  const points = strengthGraphPoints(entries);
  assert.equal(points.length, 2);
  assert.equal(points[0].strength, estimatedOneRepMax(22.5, 9));
  assert.equal(points[0].strengthWeight, 22.5);
  assert.equal(points[0].strengthReps, 9);
  assert.equal(points[1].strength, estimatedOneRepMax(25, 6));
});

test("left and right strength graph values use their own best e1RM sets", async (context) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  context.after(() => vite.close());
  const { estimatedOneRepMax, strengthGraphPoints } = await vite.ssrLoadModule("/src/features/progress/ProgressScreen.jsx");
  const entries = [
    { workoutId: "w1", date: "2026-08-12", displayDate: "12/08/2026", weight: 20, reps: 12, sideMode: "left_right", side: "left" },
    { workoutId: "w1", date: "2026-08-12", displayDate: "12/08/2026", weight: 22.5, reps: 8, sideMode: "left_right", side: "left" },
    { workoutId: "w1", date: "2026-08-12", displayDate: "12/08/2026", weight: 20, reps: 10, sideMode: "left_right", side: "right" },
  ];
  const [point] = strengthGraphPoints(entries);
  assert.equal(point.left, estimatedOneRepMax(22.5, 8));
  assert.equal(point.leftWeight, 22.5);
  assert.equal(point.leftReps, 8);
  assert.equal(point.right, estimatedOneRepMax(20, 10));
});
