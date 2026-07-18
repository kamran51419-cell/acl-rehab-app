import assert from "node:assert/strict";
import test from "node:test";

import { createMigrationPreview, countLegacySource, countTransformedData, fingerprintLegacySource, validateMigrationPreview, verifyWrittenMigration, __testables as reportTestables } from "../src/migrations/migrationReport.js";
import { executeLegacyMigration, previewLegacyMigration } from "../src/migrations/migrationRunner.js";

const uid = "user-1";

const legacyData = {
  weeks: [
    {
      week: "4",
      sessions: [
        {
          id: "squat-1",
          exerciseId: "squat",
          date: "2026-07-18",
          singleLeg: false,
          sets: [{ reps: "5", weight: "100" }],
          notes: "good",
        },
        {
          id: "le-1",
          exerciseId: "le",
          date: "2026-07-18",
          singleLeg: true,
          leftSets: [{ reps: "10", weight: "20" }],
          rightSets: [{ reps: "8", weight: "20" }],
          notes: "slow",
        },
      ],
    },
  ],
  customExercises: [{ id: "squat", label: "Squat", singleLeg: false, builtIn: false }],
  surgeryDate: "2026-06-20",
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeFakeIo(source = legacyData, options = {}) {
  const state = {
    legacy: clone(source),
    settings: new Map(),
    exercises: new Map(),
    workouts: new Map(),
    migrationRuns: new Map(),
    writes: [],
    legacyWriteCount: 0,
  };

  return {
    state,
    now: () => "2026-07-18T00:00:00.000Z",
    readLegacyData: async () => clone(state.legacy),
    readMigrationSettings: async () => clone(state.settings.get("main") || null),
    writeV2Data: async (migrationUid, transformedData, writeOptions) => {
      if (options.failValidationBeforeWrites) throw new Error("validation failed before write");
      state.writes.push({ type: "v2", uid: migrationUid, options: writeOptions });
      state.settings.set("main", { migrationStatus: "running", legacySourceFingerprint: writeOptions.sourceFingerprint });
      for (const exercise of transformedData.exercises) state.exercises.set(exercise.id, clone(exercise));
      for (const workout of transformedData.workouts) state.workouts.set(workout.id, clone(workout));
      return { settings: 1, exercises: transformedData.exercises.length, workouts: transformedData.workouts.length };
    },
    readV2Data: async (migrationUid, expectedData) => {
      if (options.returnMismatchedReadback) {
        return { exercises: expectedData.exercises.map((exercise) => clone(state.exercises.get(exercise.id))).filter(Boolean), workouts: [] };
      }
      return {
        exercises: expectedData.exercises.map((exercise) => clone(state.exercises.get(exercise.id))).filter(Boolean),
        workouts: expectedData.workouts.map((workout) => clone(state.workouts.get(workout.id))).filter(Boolean),
      };
    },
    finalizeSuccess: async (migrationUid, runId, data) => {
      if (options.failFinalizeSuccess) throw new Error("finalize success failed");
      state.settings.set("main", { ...state.settings.get("main"), ...clone(data), migrationStatus: "completed" });
      state.migrationRuns.set(runId, { ...state.migrationRuns.get(runId), ...clone(data), status: "completed", errors: [] });
      state.writes.push({ type: "finalizeSuccess", uid: migrationUid, runId });
    },
    finalizeFailure: async (migrationUid, runId, data) => {
      if (options.failFinalizeFailure) throw new Error("finalize failure failed");
      state.settings.set("main", { ...state.settings.get("main"), ...clone(data), migrationStatus: "failed" });
      state.migrationRuns.set(runId, { ...state.migrationRuns.get(runId), ...clone(data), status: "failed" });
      state.writes.push({ type: "finalizeFailure", uid: migrationUid, runId });
    },
    writeMigrationRun: async (migrationUid, runId, data) => {
      state.migrationRuns.set(runId, { ...state.migrationRuns.get(runId), ...clone(data) });
      state.writes.push({ type: "migrationRun", uid: migrationUid, runId, status: data.status });
    },
  };
}

test("preview performs no writes and returns grouped migration report", async () => {
  const io = makeFakeIo();
  const preview = await previewLegacyMigration({ uid, io });

  assert.equal(io.state.writes.length, 0);
  assert.equal(preview.canMigrate, true);
  assert.equal(preview.sourceCounts.legacyExerciseLogCount, 2);
  assert.equal(preview.sourceCounts.totalLegacySetCount, 3);
  assert.equal(preview.sourceCounts.uniqueWorkoutDateCount, 1);
  assert.equal(preview.transformedCounts.workoutCount, 1);
  assert.equal(preview.transformedCounts.workoutExerciseCount, 2);
  assert.equal(preview.transformedCounts.workoutSetCount, 3);
});

test("fingerprints and transformed document IDs are deterministic", async () => {
  const io = makeFakeIo();
  const first = await previewLegacyMigration({ uid, io });
  const second = await previewLegacyMigration({ uid, io });

  assert.equal(first.sourceFingerprint, second.sourceFingerprint);
  assert.equal(first.sourceFingerprint, fingerprintLegacySource(legacyData));
  assert.deepEqual(first.transformedData.workouts.map((workout) => workout.id), second.transformedData.workouts.map((workout) => workout.id));
  assert.deepEqual(first.transformedData.exercises.map((exercise) => exercise.id), second.transformedData.exercises.map((exercise) => exercise.id));
});

test("execution requires explicit confirmation", async () => {
  const io = makeFakeIo();
  const preview = await previewLegacyMigration({ uid, io });
  const result = await executeLegacyMigration({ uid, expectedSourceFingerprint: preview.sourceFingerprint, confirm: false, io });

  assert.equal(result.status, "blocked");
  assert.match(result.errors[0], /confirmation/i);
  assert.equal(io.state.workouts.size, 0);
});

test("fingerprint mismatches block execution before v2 writes", async () => {
  const io = makeFakeIo();
  const result = await executeLegacyMigration({ uid, expectedSourceFingerprint: "stale", confirm: true, io });

  assert.equal(result.status, "blocked");
  assert.match(result.errors[0], /Legacy data changed/);
  assert.equal(io.state.workouts.size, 0);
  assert.equal(io.state.legacyWriteCount, 0);
});

test("validation/write failures prevent v2 writes and record failed migration", async () => {
  const io = makeFakeIo(legacyData, { failValidationBeforeWrites: true });
  const preview = await previewLegacyMigration({ uid, io });
  const result = await executeLegacyMigration({ uid, expectedSourceFingerprint: preview.sourceFingerprint, confirm: true, io });

  assert.equal(result.status, "failed");
  assert.equal(io.state.workouts.size, 0);
  assert.equal([...io.state.migrationRuns.values()].at(-1).status, "failed");
});

test("successful execution records completed migration and can be re-run without duplicates", async () => {
  const io = makeFakeIo();
  const preview = await previewLegacyMigration({ uid, io });
  const first = await executeLegacyMigration({ uid, expectedSourceFingerprint: preview.sourceFingerprint, confirm: true, io });
  const second = await executeLegacyMigration({ uid, expectedSourceFingerprint: preview.sourceFingerprint, confirm: true, io });

  assert.equal(first.status, "completed");
  assert.equal(second.status, "completed");
  assert.equal(io.state.workouts.size, preview.transformedData.workouts.length);
  assert.equal(io.state.exercises.size, preview.transformedData.exercises.length);
  assert.equal(io.state.settings.get("main").migrationStatus, "completed");
  assert.equal([...io.state.migrationRuns.values()].at(-1).status, "completed");
  assert.equal(io.state.legacyWriteCount, 0);
});

test("completed same-fingerprint migration can rerun idempotently", async () => {
  const io = makeFakeIo();
  const preview = await previewLegacyMigration({ uid, io });
  io.state.settings.set("main", {
    migrationStatus: "completed",
    sourceFingerprint: preview.sourceFingerprint,
    legacySourceFingerprint: preview.sourceFingerprint,
  });

  const result = await executeLegacyMigration({ uid, expectedSourceFingerprint: preview.sourceFingerprint, confirm: true, io });

  assert.equal(result.status, "completed");
  assert.equal(io.state.workouts.size, preview.transformedData.workouts.length);
  assert.equal(io.state.exercises.size, preview.transformedData.exercises.length);
});

test("completed different-fingerprint migration is blocked before v2 writes", async () => {
  const io = makeFakeIo();
  const preview = await previewLegacyMigration({ uid, io });
  const completedSettings = {
    migrationStatus: "completed",
    sourceFingerprint: "previous-source",
    legacySourceFingerprint: "previous-source",
  };
  io.state.settings.set("main", completedSettings);
  io.state.exercises.set("existing-exercise", { id: "existing-exercise" });
  io.state.workouts.set("existing-workout", { id: "existing-workout" });
  const existingSettings = clone(io.state.settings.get("main"));
  const existingExercises = clone([...io.state.exercises.entries()]);
  const existingWorkouts = clone([...io.state.workouts.entries()]);

  const result = await executeLegacyMigration({ uid, expectedSourceFingerprint: preview.sourceFingerprint, confirm: true, io });

  assert.equal(result.status, "blocked");
  assert.match(result.errors.join("\n"), /different legacy source fingerprint/i);
  assert.equal(result.existingSourceFingerprint, "previous-source");
  assert.equal(result.existingLegacySourceFingerprint, "previous-source");
  assert.deepEqual(io.state.settings.get("main"), existingSettings);
  assert.deepEqual([...io.state.exercises.entries()], existingExercises);
  assert.deepEqual([...io.state.workouts.entries()], existingWorkouts);
  assert.equal(io.state.writes.some((write) => write.type === "v2"), false);
  assert.equal(io.state.legacyWriteCount, 0);
});

test("completed migration metadata must include matching source and legacy fingerprints", async () => {
  const previewIo = makeFakeIo();
  const preview = await previewLegacyMigration({ uid, io: previewIo });
  const cases = [
    [
      "missing sourceFingerprint",
      { migrationStatus: "completed", legacySourceFingerprint: preview.sourceFingerprint },
      /fingerprint metadata is missing/i,
    ],
    [
      "missing legacySourceFingerprint",
      { migrationStatus: "completed", sourceFingerprint: preview.sourceFingerprint },
      /fingerprint metadata is missing/i,
    ],
    [
      "conflicting stored fingerprints",
      { migrationStatus: "completed", sourceFingerprint: preview.sourceFingerprint, legacySourceFingerprint: "other" },
      /internally inconsistent/i,
    ],
    [
      "matching stored fingerprints for different source",
      { migrationStatus: "completed", sourceFingerprint: "previous-source", legacySourceFingerprint: "previous-source" },
      /different legacy source fingerprint/i,
    ],
  ];

  for (const [label, settings, expectedMessage] of cases) {
    const io = makeFakeIo();
    io.state.settings.set("main", clone(settings));
    io.state.exercises.set("existing-exercise", { id: "existing-exercise" });
    io.state.workouts.set("existing-workout", { id: "existing-workout" });
    const existingSettings = clone(io.state.settings.get("main"));
    const existingExercises = clone([...io.state.exercises.entries()]);
    const existingWorkouts = clone([...io.state.workouts.entries()]);

    const result = await executeLegacyMigration({ uid, expectedSourceFingerprint: preview.sourceFingerprint, confirm: true, io });

    assert.equal(result.status, "blocked", label);
    assert.match(result.errors.join("\n"), expectedMessage, label);
    assert.deepEqual(io.state.settings.get("main"), existingSettings, label);
    assert.deepEqual([...io.state.exercises.entries()], existingExercises, label);
    assert.deepEqual([...io.state.workouts.entries()], existingWorkouts, label);
    assert.equal(io.state.writes.some((write) => write.type === "v2"), false, label);
    assert.equal(io.state.legacyWriteCount, 0, label);
  }
});

test("completed migration with conflicting legacy fingerprint blocks before writes", async () => {
  const io = makeFakeIo();
  const preview = await previewLegacyMigration({ uid, io });
  io.state.settings.set("main", {
    migrationStatus: "completed",
    sourceFingerprint: preview.sourceFingerprint,
    legacySourceFingerprint: "previous-source",
  });
  io.state.exercises.set("existing-exercise", { id: "existing-exercise" });
  io.state.workouts.set("existing-workout", { id: "existing-workout" });
  const existingExercises = clone([...io.state.exercises.entries()]);
  const existingWorkouts = clone([...io.state.workouts.entries()]);

  const result = await executeLegacyMigration({ uid, expectedSourceFingerprint: preview.sourceFingerprint, confirm: true, io });

  assert.equal(result.status, "blocked");
  assert.match(result.errors.join("\n"), /internally inconsistent/i);
  assert.deepEqual([...io.state.exercises.entries()], existingExercises);
  assert.deepEqual([...io.state.workouts.entries()], existingWorkouts);
  assert.equal(io.state.settings.get("main").migrationStatus, "completed");
  assert.equal(io.state.settings.get("main").sourceFingerprint, preview.sourceFingerprint);
  assert.equal(io.state.settings.get("main").legacySourceFingerprint, "previous-source");
  assert.equal(io.state.writes.some((write) => write.type === "v2"), false);
  assert.equal(io.state.legacyWriteCount, 0);
});

test("failed prior migration state may be retried deliberately", async () => {
  const io = makeFakeIo();
  const preview = await previewLegacyMigration({ uid, io });
  io.state.settings.set("main", { migrationStatus: "failed", sourceFingerprint: "previous-failed-source" });

  const result = await executeLegacyMigration({ uid, expectedSourceFingerprint: preview.sourceFingerprint, confirm: true, io });

  assert.equal(result.status, "completed");
  assert.equal(io.state.settings.get("main").migrationStatus, "completed");
  assert.equal(io.state.settings.get("main").sourceFingerprint, preview.sourceFingerprint);
});

test("running prior migration state blocks until manual recovery", async () => {
  const io = makeFakeIo();
  const preview = await previewLegacyMigration({ uid, io });
  io.state.settings.set("main", { migrationStatus: "running", sourceFingerprint: "in-progress-source" });

  const result = await executeLegacyMigration({ uid, expectedSourceFingerprint: preview.sourceFingerprint, confirm: true, io });

  assert.equal(result.status, "blocked");
  assert.match(result.errors.join("\n"), /already marked as running/i);
  assert.equal(io.state.workouts.size, 0);
  assert.equal(io.state.exercises.size, 0);
  assert.equal(io.state.settings.get("main").migrationStatus, "running");
});

test("post-write verification catches mismatches and does not mark settings completed", async () => {
  const io = makeFakeIo(legacyData, { returnMismatchedReadback: true });
  const preview = await previewLegacyMigration({ uid, io });
  const result = await executeLegacyMigration({ uid, expectedSourceFingerprint: preview.sourceFingerprint, confirm: true, io });

  assert.equal(result.status, "failed");
  assert.equal(result.verification.passed, false);
  assert.match(result.verification.errors.join("\n"), /workout/);
  assert.notEqual(io.state.settings.get("main").migrationStatus, "completed");
  assert.equal([...io.state.migrationRuns.values()].at(-1).status, "failed");
  assert.equal(io.state.legacyWriteCount, 0);
});


test("transformed settings preserve surgery date", async () => {
  const preview = await previewLegacyMigration({ uid, io: makeFakeIo() });
  assert.equal(preview.transformedData.settings.surgeryDate, "2026-06-20");
});

test("strict invalid date detection rejects impossible calendar dates without blocking migration", () => {
  assert.equal(reportTestables.isValidDateString("2026-02-30"), false);
  assert.equal(reportTestables.isValidDateString("2026-13-01"), false);
  assert.equal(reportTestables.isValidDateString("2026-00-10"), false);
  assert.equal(reportTestables.isValidDateString("2026-04-31"), false);
  const preview = createMigrationPreview({
    weeks: [{ week: "1", sessions: [{ ...legacyData.weeks[0].sessions[0], date: "2026-02-30" }] }],
    customExercises: legacyData.customExercises,
  });
  assert.equal(preview.canMigrate, true);
  assert.equal(preview.sourceCounts.invalidWorkoutDateCount, 1);
  assert.match(preview.warnings.join("\n"), /invalid workout date/);
});

test("duplicate and missing trace keys are detected by preview validation", () => {
  const preview = createMigrationPreview(legacyData);
  const duplicate = clone(preview.transformedData);
  duplicate.workouts[0].exercises[1].legacy.sourceTraceKey = clone(duplicate.workouts[0].exercises[0].legacy.sourceTraceKey);
  duplicate.workouts[0].exercises[1].legacy.sourceTraceId = duplicate.workouts[0].exercises[0].legacy.sourceTraceId;
  const duplicateValidation = validateMigrationPreview({
    sourceCounts: countLegacySource(legacyData),
    transformedCounts: countTransformedData(duplicate),
    transformedData: duplicate,
    legacyData,
  });
  assert.equal(duplicateValidation.canMigrate, false);
  assert.match(duplicateValidation.errors.join("\n"), /same source trace key/);

  const missing = clone(preview.transformedData);
  missing.workouts[0].exercises.pop();
  const missingValidation = validateMigrationPreview({
    sourceCounts: countLegacySource(legacyData),
    transformedCounts: countTransformedData(missing),
    transformedData: missing,
    legacyData,
  });
  assert.equal(missingValidation.canMigrate, false);
  assert.match(missingValidation.errors.join("\n"), /source trace key exists in transformed output|legacy exercise log count/);
});

test("trace validation rejects changed or missing trace-key integrity fields", () => {
  const preview = createMigrationPreview(legacyData);
  const sourceCounts = countLegacySource(legacyData);
  const cases = [
    ["changed key with stale id", (data) => { data.workouts[0].exercises[0].legacy.sourceTraceKey.date = "2026-07-19"; }, /source trace id matches|normalized source|source trace key exists/],
    ["changed id with correct key", (data) => { data.workouts[0].exercises[0].legacy.sourceTraceId = "wrong"; }, /source trace id matches|exactly one legacy/],
    ["missing id", (data) => { delete data.workouts[0].exercises[0].legacy.sourceTraceId; }, /source trace id/],
    ["missing key", (data) => { delete data.workouts[0].exercises[0].legacy.sourceTraceKey; }, /source trace key/],
    ["changed individual field", (data) => { data.workouts[0].exercises[0].legacy.sourceTraceKey.legacySessionIndex = 99; }, /source trace id matches|normalized source|source trace key exists/],
    ["duplicate canonical key", (data) => {
      data.workouts[0].exercises[1].legacy.sourceTraceKey = clone(data.workouts[0].exercises[0].legacy.sourceTraceKey);
      data.workouts[0].exercises[1].legacy.sourceTraceId = data.workouts[0].exercises[0].legacy.sourceTraceId;
    }, /same source trace key/],
  ];

  for (const [label, mutate, expectedMessage] of cases) {
    const transformedData = clone(preview.transformedData);
    mutate(transformedData);
    const validation = validateMigrationPreview({
      sourceCounts,
      transformedCounts: countTransformedData(transformedData),
      transformedData,
      legacyData,
    });
    assert.equal(validation.canMigrate, false, label);
    assert.match(validation.errors.join("\n"), expectedMessage, label);
  }
});

test("deep verification fails for changed raw reps, raw weights, dates, sides, and structure", async () => {
  const preview = await previewLegacyMigration({ uid, io: makeFakeIo() });
  const cases = [
    ["rawReps", (data) => { data.workouts[0].exercises[0].prescriptionBlocks[0].actualSets[0].rawReps = "6"; }],
    ["rawWeight", (data) => { data.workouts[0].exercises[0].prescriptionBlocks[0].actualSets[0].rawWeight = "101"; }],
    ["date", (data) => { data.workouts[0].date = "2026-07-19"; }],
    ["side", (data) => { data.workouts[0].exercises[0].prescriptionBlocks[0].actualSets[0].side = "left"; }],
    ["actualSets", (data) => { data.workouts[0].exercises[0].prescriptionBlocks[0].actualSets = []; }],
  ];

  for (const [label, mutate] of cases) {
    const written = clone(preview.transformedData);
    mutate(written);
    const verification = verifyWrittenMigration(preview, written);
    assert.equal(verification.passed, false, label);
    assert.match(verification.errors.join("\n"), new RegExp(label === "date" ? "date" : label));
  }
});

test("transformed fingerprints are deterministic and read-back fingerprint mismatches fail execution", async () => {
  const preview = await previewLegacyMigration({ uid, io: makeFakeIo() });
  const second = await previewLegacyMigration({ uid, io: makeFakeIo() });
  assert.equal(preview.transformedFingerprint, second.transformedFingerprint);

  const io = makeFakeIo(legacyData, { returnMismatchedReadback: true });
  const result = await executeLegacyMigration({ uid, expectedSourceFingerprint: preview.sourceFingerprint, confirm: true, io });
  assert.equal(result.status, "failed");
  assert.notEqual(result.verification.actualFingerprint, result.verification.expectedFingerprint);
});

test("unrelated pre-existing v2 documents do not affect expected-document verification", async () => {
  const io = makeFakeIo();
  io.state.exercises.set("unrelated", { id: "unrelated", name: "Ignore me" });
  io.state.workouts.set("unrelated", { id: "unrelated", date: "2020-01-01", exercises: [] });
  const preview = await previewLegacyMigration({ uid, io });
  const result = await executeLegacyMigration({ uid, expectedSourceFingerprint: preview.sourceFingerprint, confirm: true, io });
  assert.equal(result.status, "completed");
  assert.equal(result.verification.actualCounts.workoutCount, preview.transformedCounts.workoutCount);
});

test("partial batch write failure is reported and settings move from running to failed", async () => {
  const io = makeFakeIo();
  io.writeV2Data = async () => {
    io.state.settings.set("main", { migrationStatus: "running" });
    const error = new Error("batch failed");
    error.writeReport = { plannedBatches: 2, committedBatches: 1, failedBatchIndex: 1, plannedOperations: 3, committedOperations: 2 };
    throw error;
  };
  const preview = await previewLegacyMigration({ uid, io });
  const result = await executeLegacyMigration({ uid, expectedSourceFingerprint: preview.sourceFingerprint, confirm: true, io });
  assert.equal(result.status, "failed");
  assert.equal(result.partialWrite.committedBatches, 1);
  assert.equal(io.state.settings.get("main").migrationStatus, "failed");
});

test("success finalisation is atomic and finalisation failures do not mark settings completed", async () => {
  const failIo = makeFakeIo(legacyData, { failFinalizeSuccess: true });
  const preview = await previewLegacyMigration({ uid, io: failIo });
  const failed = await executeLegacyMigration({ uid, expectedSourceFingerprint: preview.sourceFingerprint, confirm: true, io: failIo });
  assert.equal(failed.status, "failed");
  assert.notEqual(failIo.state.settings.get("main").migrationStatus, "completed");

  const io = makeFakeIo();
  const okPreview = await previewLegacyMigration({ uid, io });
  const ok = await executeLegacyMigration({ uid, expectedSourceFingerprint: okPreview.sourceFingerprint, confirm: true, io });
  assert.equal(ok.status, "completed");
  assert.equal(io.state.settings.get("main").migrationStatus, "completed");
  assert.equal([...io.state.migrationRuns.values()].at(-1).status, "completed");
});

test("failure status recording errors are returned with the original error", async () => {
  const io = makeFakeIo(legacyData, { failFinalizeFailure: true });
  const preview = await previewLegacyMigration({ uid, io });
  io.writeV2Data = async () => { throw new Error("original write failure"); };
  const result = await executeLegacyMigration({ uid, expectedSourceFingerprint: preview.sourceFingerprint, confirm: true, io });
  assert.equal(result.status, "failed");
  assert.match(result.errors.join("\n"), /original write failure/);
  assert.match(result.errors.join("\n"), /Failed to record migration failure/);
});
