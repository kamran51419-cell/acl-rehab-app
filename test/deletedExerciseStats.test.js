import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("Stats hides completed history for exercises no longer in the library", async (context) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  context.after(() => vite.close());
  const { StatsView } = await vite.ssrLoadModule("/src/features/progress/ProgressScreen.jsx");

  const weighted = (id, name, weight) => ({
    id: `${id}-copy`,
    exerciseId: id,
    exerciseNameSnapshot: name,
    exerciseType: "strength",
    loggingMethod: "reps_weight",
    recordedSets: [{ id: `${id}-set`, setNumber: 1, weight, actualReps: 10, rawReps: "10" }],
  });

  const workouts = [{
    id: "completed",
    status: "completed",
    completed: true,
    date: "2026-09-01",
    exercises: [weighted("kept", "Kept Exercise", 40), weighted("deleted", "Deleted Exercise", 50)],
  }];

  const markup = renderToStaticMarkup(React.createElement(StatsView, {
    workouts,
    trainingMode: "gym",
    exerciseIds: new Set(["kept"]),
  }));

  assert.match(markup, /Kept Exercise/);
  assert.doesNotMatch(markup, /Deleted Exercise/);
});
