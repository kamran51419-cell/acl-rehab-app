import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

function visit(node, callback) {
  if (!node || typeof node !== "object") return;
  callback(node);
  React.Children.forEach(node.props?.children, (child) => visit(child, callback));
}

function buttons(element) {
  const found = [];
  visit(element, (node) => { if (node.type === "button" || node.type?.name === "Button") found.push(node); });
  return found;
}

test("Home dashboard starts a chosen session and continues without a picker", async (context) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  context.after(() => vite.close());
  const { HomeDashboard } = await vite.ssrLoadModule("/src/features/home/HomeScreen.jsx");
  const programme = { id: "plan", name: "ACL Rehab - 5 Months", sessions: [{ id: "press", name: "Press + Legs", sortOrder: 0 }, { id: "pull", name: "Pull + Legs", sortOrder: 1 }, { id: "full", name: "Full Body", sortOrder: 2 }] };
  let selected = null;
  let continuedWorkout = false;
  const base = { programme, completedWorkout: null, surgeryDate: "2026-02-17", rehabAgeMode: "months", today: "2026-07-18", onProgramme() {}, onCycleAge() {}, onContinue() { continuedWorkout = true; }, onStart() {}, onChooseSession(id) { selected = id; } };
  const initial = HomeDashboard({ ...base, unfinishedWorkout: null, showSessions: false });
  assert.match(renderToStaticMarkup(initial), /Start Workout/);
  assert.doesNotMatch(renderToStaticMarkup(initial), /Choose a session/);
  const picker = HomeDashboard({ ...base, unfinishedWorkout: null, showSessions: true });
  const markup = renderToStaticMarkup(picker);
  assert.match(markup, /Press \+ Legs/);
  assert.match(markup, /Pull \+ Legs/);
  assert.match(markup, /Full Body/);
  buttons(picker).find((button) => button.props.children === "Pull + Legs").props.onClick();
  assert.equal(selected, "pull");
  const continueDashboard = HomeDashboard({ ...base, unfinishedWorkout: { id: "draft" }, showSessions: true });
  const continued = renderToStaticMarkup(continueDashboard);
  assert.match(continued, /Continue Workout/);
  assert.doesNotMatch(continued, /Choose a session/);
  buttons(continueDashboard).find((button) => button.props.children === "Continue Workout").props.onClick();
  assert.equal(continuedWorkout, true);
});

test("Home dashboard renders programme, completed-workout and empty states", async (context) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  context.after(() => vite.close());
  const { HomeDashboard } = await vite.ssrLoadModule("/src/features/home/HomeScreen.jsx");
  const callbacks = { onStart() {}, onContinue() {}, onChooseSession() {}, onProgramme() {}, onCycleAge() {} };
  const active = renderToStaticMarkup(React.createElement(HomeDashboard, { ...callbacks, programme: { name: "ACL Rehab", sessions: [] }, completedWorkout: { date: "2026-07-18", sessionNameSnapshot: "Lower Body" }, rehabAgeMode: "months", today: "2026-07-18" }));
  assert.match(active, /ACL Rehab/);
  assert.match(active, /18 Jul 2026/);
  assert.match(active, /Lower Body/);
  const empty = renderToStaticMarkup(React.createElement(HomeDashboard, { ...callbacks, programme: null, completedWorkout: null, rehabAgeMode: "months", today: "2026-07-18" }));
  assert.match(empty, /No active programme/);
  assert.match(empty, /No completed workouts yet/);
  assert.match(empty, /Start Workout/);
  assert.match(empty, /disabled=""/);
  assert.doesNotMatch(empty, /post-op/);
});
