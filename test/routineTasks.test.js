import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { readFile } from "node:fs/promises";
import { createRoutineTask, mergeRoutineOccurrences, occurrenceId, ROUTINE_STATUS, scheduledRoutineTasks } from "../src/lib/domain/routineTasks.js";

const monday = new Date("2026-07-20T00:00:00");

test("programmes missing routine tasks remain compatible and weekday filtering is ordered", () => {
  assert.deepEqual(scheduledRoutineTasks({}, monday), []);
  const plan = { routineTasks: [
    createRoutineTask({ id: "any", name: "Any", days: ["monday"], timeOfDay: "anytime" }),
    createRoutineTask({ id: "eve", name: "Evening", days: ["monday"], timeOfDay: "evening" }),
    createRoutineTask({ id: "other", name: "Other day", days: ["tuesday"], timeOfDay: "morning" }),
    createRoutineTask({ id: "am", name: "Morning", days: ["monday"], timeOfDay: "morning" }),
  ] };
  assert.deepEqual(scheduledRoutineTasks(plan, monday).map((task) => task.id), ["am", "eve", "any"]);
});

test("routine definitions support create, edit and delete without changing occurrences", () => {
  const created = createRoutineTask({ id: "task", name: "Ice", days: ["monday"], notes: "10 min", createdAt: "created", updatedAt: "created" });
  const edited = { ...created, name: "Ice knee", updatedAt: "edited" };
  const tasks = [created].map((task) => task.id === edited.id ? edited : task);
  assert.equal(tasks[0].name, "Ice knee");
  assert.deepEqual(tasks.filter((task) => task.id !== edited.id), []);
  assert.equal(created.createdAt, "created");
});

test("completed and skipped occurrences persist independently for refresh/resubscription", () => {
  const tasks = [createRoutineTask({ id: "one", name: "One", days: ["monday"] }), createRoutineTask({ id: "two", name: "Two", days: ["monday"] })];
  const stored = [
    { id: occurrenceId("plan", "2026-07-20", "one"), taskId: "one", scheduledDate: "2026-07-20", status: ROUTINE_STATUS.COMPLETED, actionAt: "2026-07-20T08:00:00Z" },
    { id: occurrenceId("plan", "2026-07-20", "two"), taskId: "two", scheduledDate: "2026-07-20", status: ROUTINE_STATUS.SKIPPED, actionAt: "2026-07-20T09:00:00Z" },
  ];
  assert.deepEqual(mergeRoutineOccurrences(tasks, structuredClone(stored)).map((task) => task.status), ["completed", "skipped"]);
  assert.deepEqual(mergeRoutineOccurrences(tasks, structuredClone(stored)).map((task) => task.status), ["completed", "skipped"]);
});

test("today routine is compact, supports Show All and works in Gym and Rehab dashboards", async (context) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  context.after(() => vite.close());
  const { TodayRoutine, HomeDashboard } = await vite.ssrLoadModule("/src/features/home/HomeScreen.jsx");
  const tasks = Array.from({ length: 5 }, (_, index) => ({ id: `${index}`, name: `Task ${index}`, timeOfDay: "morning", status: "pending" }));
  const collapsed = renderToStaticMarkup(React.createElement(TodayRoutine, { tasks, onToggle() {}, onStatus() {} }));
  assert.match(collapsed, /Show All/); assert.match(collapsed, /Task 2/); assert.doesNotMatch(collapsed, /Task 3/);
  const expanded = renderToStaticMarkup(React.createElement(TodayRoutine, { tasks, expanded: true, onToggle() {}, onStatus() {} }));
  assert.match(expanded, /Show Less/); assert.match(expanded, /Task 4/);
  for (const trainingMode of ["gym", "rehab"]) {
    const dashboard = renderToStaticMarkup(React.createElement(HomeDashboard, { programme: { sessions: [] }, trainingMode, surgeryDate: "2026-01-01", today: "2026-07-20", routineTasks: tasks, onStart() {}, onContinue() {}, onChooseSession() {}, onToggleRoutine() {}, onRoutineStatus() {} }));
    assert.ok(dashboard.indexOf("Today’s Routine") < dashboard.indexOf("Start Workout"));
  }
});

test("global tracker header and redundant Progress page heading are removed", async () => {
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  const progress = await readFile(new URL("../src/features/progress/ProgressScreen.jsx", import.meta.url), "utf8");
  assert.equal(app.includes('{activeTab !== "home" ? <div className="flex items-start justify-between gap-4">'), false);
  assert.doesNotMatch(progress, /<h1[^>]*>Progress<\/h1>/);
  assert.match(progress, /Workout History/);
});
