import { collection, doc, getDoc, getDocs, writeBatch } from "firebase/firestore";

const BATCH_LIMIT = 450;

function chunk(items, size = BATCH_LIMIT) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, stripUndefined(item)])
    );
  }
  return value;
}

function settingsRef(db, uid) {
  return doc(db, "users", uid, "settings", "main");
}

function exerciseRef(db, uid, exerciseId) {
  return doc(db, "users", uid, "exercises", exerciseId);
}

function workoutRef(db, uid, workoutId) {
  return doc(db, "users", uid, "workouts", workoutId);
}

function migrationRunRef(db, uid, runId) {
  return doc(db, "users", uid, "migrationRuns", runId);
}

export function v2Paths(uid) {
  return {
    settings: `users/${uid}/settings/main`,
    exercises: `users/${uid}/exercises/{exerciseId}`,
    workouts: `users/${uid}/workouts/{workoutId}`,
    migrationRuns: `users/${uid}/migrationRuns/{runId}`,
  };
}

export async function writeV2MigrationData(db, uid, transformedData, { sourceFingerprint, transformedFingerprint, migrationRunId, serverTimestamp }) {
  const settings = stripUndefined({
    ...transformedData.settings,
    schemaVersion: 2,
    migrationStatus: "running",
    legacySourceFingerprint: sourceFingerprint,
    sourceFingerprint,
    transformedFingerprint,
    migrationRunId,
    updatedAt: serverTimestamp(),
  });
  const operations = [
    { ref: settingsRef(db, uid), data: settings },
    ...transformedData.exercises.map((exercise) => ({ ref: exerciseRef(db, uid, exercise.id), data: stripUndefined(exercise) })),
    ...transformedData.workouts.map((workout) => ({ ref: workoutRef(db, uid, workout.id), data: stripUndefined(workout) })),
  ];
  const batches = chunk(operations);
  const report = {
    settings: 1,
    exercises: transformedData.exercises.length,
    workouts: transformedData.workouts.length,
    plannedBatches: batches.length,
    committedBatches: 0,
    failedBatchIndex: null,
    plannedOperations: operations.length,
    committedOperations: 0,
  };

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const batch = writeBatch(db);
    for (const operation of batches[batchIndex]) batch.set(operation.ref, operation.data, { merge: true });
    try {
      await batch.commit();
      report.committedBatches += 1;
      report.committedOperations += batches[batchIndex].length;
    } catch (error) {
      report.failedBatchIndex = batchIndex;
      error.writeReport = report;
      throw error;
    }
  }

  return report;
}

export async function finalizeMigrationSuccess(db, uid, runId, { sourceFingerprint, transformedFingerprint, migratedAt, writtenCounts, verification }) {
  const batch = writeBatch(db);
  batch.set(
    settingsRef(db, uid),
    stripUndefined({
      schemaVersion: 2,
      migrationStatus: "completed",
      legacySourceFingerprint: sourceFingerprint,
      sourceFingerprint,
      transformedFingerprint,
      migratedAt,
      migrationRunId: runId,
      updatedAt: migratedAt,
    }),
    { merge: true }
  );
  batch.set(
    migrationRunRef(db, uid, runId),
    stripUndefined({
      status: "completed",
      completedAt: migratedAt,
      writtenCounts,
      verification,
      errors: [],
      failureReason: "",
    }),
    { merge: true }
  );
  await batch.commit();
}

export async function finalizeMigrationFailure(db, uid, runId, { sourceFingerprint, transformedFingerprint, failedAt, failureReason, errors, writtenCounts, verification, partialWrite }) {
  const batch = writeBatch(db);
  batch.set(
    settingsRef(db, uid),
    stripUndefined({
      schemaVersion: 2,
      migrationStatus: "failed",
      legacySourceFingerprint: sourceFingerprint,
      sourceFingerprint,
      transformedFingerprint,
      migrationRunId: runId,
      failureReason,
      updatedAt: failedAt,
    }),
    { merge: true }
  );
  batch.set(
    migrationRunRef(db, uid, runId),
    stripUndefined({
      status: "failed",
      completedAt: failedAt,
      writtenCounts,
      verification,
      partialWrite,
      errors,
      failureReason,
    }),
    { merge: true }
  );
  await batch.commit();
}

export async function readV2MigrationSettings(db, uid) {
  const snap = await getDoc(settingsRef(db, uid));
  return snap.exists() ? snap.data() : null;
}

export async function readV2MigrationData(db, uid, expectedData = null) {
  if (expectedData) {
    const [exerciseSnaps, workoutSnaps] = await Promise.all([
      Promise.all(expectedData.exercises.map((exercise) => getDoc(exerciseRef(db, uid, exercise.id)))),
      Promise.all(expectedData.workouts.map((workout) => getDoc(workoutRef(db, uid, workout.id)))),
    ]);

    return {
      exercises: exerciseSnaps.filter((snap) => snap.exists()).map((item) => item.data()),
      workouts: workoutSnaps.filter((snap) => snap.exists()).map((item) => item.data()),
      missingExerciseIds: expectedData.exercises.filter((_, index) => !exerciseSnaps[index].exists()).map((exercise) => exercise.id),
      missingWorkoutIds: expectedData.workouts.filter((_, index) => !workoutSnaps[index].exists()).map((workout) => workout.id),
    };
  }

  const [exerciseSnap, workoutSnap] = await Promise.all([
    getDocs(collection(db, "users", uid, "exercises")),
    getDocs(collection(db, "users", uid, "workouts")),
  ]);

  return {
    exercises: exerciseSnap.docs.map((item) => item.data()),
    workouts: workoutSnap.docs.map((item) => item.data()),
    missingExerciseIds: [],
    missingWorkoutIds: [],
  };
}

export const __testables = { chunk, stripUndefined };
