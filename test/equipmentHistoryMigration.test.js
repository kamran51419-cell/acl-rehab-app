import test from "node:test";
import assert from "node:assert/strict";
import { buildEquipmentHistoryMigration } from "../src/lib/domain/equipmentHistoryMigration.js";

function strength(id, exerciseId, name, equipmentType) {
  return { id, exerciseId, exerciseNameSnapshot: name, exerciseType: "strength", equipmentType };
}

const plan = {
  id: "plan-a",
  name: "Programme A",
  sessions: [
    { id: "session-a", name: "Session A", exercises: [strength("press-a", "press", "Leg Press", "machine")] },
    { id: "session-b", name: "Session B", exercises: [strength("press-b", "press", "Leg Press", "cable")] },
  ],
};

function workout(id, sessionId, date, exercise) {
  return { id, planId: "plan-a", programmeId: "plan-a", sessionId, sourceType: "programme", status: "completed", date, exercises: [exercise] };
}

test("migration uses programme + session + exercise occurrence, not exercise globally", () => {
  const result = buildEquipmentHistoryMigration(plan, [
    workout("w1", "session-a", "2026-08-10", strength("press-a", "press", "Leg Press")),
    workout("w2", "session-b", "2026-08-11", strength("press-b", "press", "Leg Press")),
  ]);

  assert.equal(result.workoutsChanged, 2);
  assert.equal(result.occurrencesChanged, 2);
  assert.equal(result.updatedWorkouts.find((item) => item.id === "w1").exercises[0].equipmentType, "machine");
  assert.equal(result.updatedWorkouts.find((item) => item.id === "w2").exercises[0].equipmentType, "cable");
});

test("migration updates both sides of a left/right programme exercise as one occurrence", () => {
  const bilateral = {
    id: "w3",
    planId: "plan-a",
    sessionId: "session-a",
    status: "completed",
    date: "2026-08-12",
    exercises: [
      strength("press-a-left", "press", "Leg Press"),
      strength("press-a-right", "press", "Leg Press"),
    ],
  };
  const result = buildEquipmentHistoryMigration(plan, [bilateral]);
  assert.equal(result.occurrencesChanged, 1);
  assert.equal(result.exerciseRecordsChanged, 2);
  assert.deepEqual(result.updatedWorkouts[0].exercises.map((exercise) => exercise.equipmentType), ["machine", "machine"]);
});

test("migration skips manual corrections, newer workouts, other programmes, and unmatched session entries", () => {
  const manual = { ...strength("press-a", "press", "Leg Press", "free_weight"), equipmentSource: "manual" };
  const result = buildEquipmentHistoryMigration(plan, [
    workout("manual", "session-a", "2026-08-10", manual),
    workout("new", "session-a", "2026-08-28", strength("press-a", "press", "Leg Press")),
    { ...workout("other", "session-a", "2026-08-10", strength("press-a", "press", "Leg Press")), planId: "plan-other", programmeId: "plan-other" },
    workout("unmatched", "missing-session", "2026-08-10", strength("press-a", "press", "Leg Press")),
  ]);

  assert.equal(result.workoutsChanged, 0);
  assert.equal(result.skippedManual, 1);
  assert.equal(result.unmatchedRecords, 1);
});

test("already-standard legacy history stays untouched while incorrect legacy tags can be normalized to Standard", () => {
  const standardPlan = {
    id: "plan-standard",
    sessions: [{ id: "session", name: "Session", exercises: [strength("row", "row", "Row", "standard")] }],
  };
  const result = buildEquipmentHistoryMigration(standardPlan, [
    { id: "clean", planId: "plan-standard", sessionId: "session", status: "completed", date: "2026-08-10", exercises: [strength("row", "row", "Row")] },
    { id: "wrong", planId: "plan-standard", sessionId: "session", status: "completed", date: "2026-08-11", exercises: [{ ...strength("row", "row", "Row", "machine"), equipmentSource: "programme" }] },
  ]);

  assert.equal(result.workoutsChanged, 1);
  assert.equal(result.updatedWorkouts[0].id, "wrong");
  assert.equal(result.updatedWorkouts[0].exercises[0].equipmentType, "standard");
  assert.equal(result.updatedWorkouts[0].exercises[0].equipmentSource, "manual");
});
