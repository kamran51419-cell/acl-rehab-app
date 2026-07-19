import test from "node:test";
import assert from "node:assert/strict";
import { dailyHeaviest, EXERCISE_VARIANT, groupExerciseProgress, heaviestEntry, symmetryEntries, variantEntries } from "../src/lib/domain/exerciseProgress.js";

const exercise = (id, name, side, weights) => ({ id: `${id}-${side}`, exerciseId: id, exerciseNameSnapshot: name, loggingMethod: "reps_weight", sideSnapshot: side, recordedSets: weights.map(([weight, reps], index) => ({ id: `set-${index}`, setNumber: index + 1, weight, prescribedReps: { type: "fixed", value: reps } })) });
const workouts = [
  { id: "new", status: "completed", date: "2026-07-19", exercises: [exercise("press", "Leg Press", "both", [[100, 10], [120, 8]]), exercise("press", "Leg Press", "left", [[60, 10]]), exercise("press", "Leg Press", "right", [[55, 10]]), { ...exercise("row", "Row", "both", [[70, 8]]), loggingMethod: "reps" }] },
  { id: "old", status: "completed", date: "2026-07-15", exercises: [exercise("press", "Leg Press", "both", [[130, 4]])] },
];

test("progress includes only weighted exercises and sorts by latest workout", () => {
  const groups = groupExerciseProgress(workouts);
  assert.deepEqual(groups.map((group) => group.exerciseId), ["press"]);
  assert.equal(groups[0].latest.date, "2026-07-19");
});

test("variants retain every set while graph points use the daily heaviest", () => {
  const group = groupExerciseProgress(workouts)[0];
  const doubles = variantEntries(group, EXERCISE_VARIANT.DOUBLE);
  assert.equal(doubles.length, 3);
  assert.deepEqual(dailyHeaviest(doubles).map(({ weight }) => weight), [130, 120]);
  assert.equal(heaviestEntry(doubles).weight, 130);
});

test("symmetry requires comparable left and right entries on the same date", () => {
  const symmetry = symmetryEntries(groupExerciseProgress(workouts)[0]);
  assert.deepEqual(symmetry.map(({ date, symmetry: value }) => [date, value]), [["2026-07-19", 92]]);
});
