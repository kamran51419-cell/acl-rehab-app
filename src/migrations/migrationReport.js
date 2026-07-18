import { stableHash, stableStringify } from "../lib/domain/ids.js";
import { transformLegacyDataToV2 } from "./legacyToV2.js";

const BUILT_IN_EXERCISE_IDS = new Set(["lp", "le", "hc"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TRACE_KEY_FIELDS = ["legacyWeekIndex", "legacySessionIndex", "legacySessionId", "originalExerciseId", "date"];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeLegacySource(legacyData = {}) {
  return {
    weeks: asArray(legacyData.weeks),
    customExercises: asArray(legacyData.customExercises),
    surgeryDate: typeof legacyData.surgeryDate === "string" ? legacyData.surgeryDate : "",
  };
}

export function fingerprintLegacySource(legacyData = {}) {
  return stableHash(normalizeLegacySource(legacyData));
}

function isValidDateString(date) {
  if (!date || !DATE_PATTERN.test(date)) return false;
  const [yearText, monthText, dayText] = date.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function legacySetsForSession(session) {
  if (!isPlainObject(session)) return [];
  if (session.singleLeg) return [...asArray(session.leftSets), ...asArray(session.rightSets)];
  return asArray(session.sets);
}

function legacySessionEntries(legacyData = {}) {
  return asArray(legacyData.weeks).flatMap((week, weekIndex) =>
    asArray(week?.sessions).map((session, sessionIndex) => ({ week, weekIndex, session, sessionIndex }))
  );
}

function legacyTraceKey(entry) {
  const session = isPlainObject(entry.session) ? entry.session : {};
  return {
    legacyWeekIndex: entry.weekIndex,
    legacySessionIndex: entry.sessionIndex,
    legacySessionId: typeof session.id === "string" ? session.id : "",
    originalExerciseId: typeof session.exerciseId === "string" ? session.exerciseId : "",
    date: typeof session.date === "string" ? session.date : "",
  };
}

function hasCompleteTraceKey(traceKey) {
  return Boolean(traceKey) && typeof traceKey === "object" && TRACE_KEY_FIELDS.every((field) => Object.hasOwn(traceKey, field));
}

function canonicalTraceKey(traceKey) {
  if (!hasCompleteTraceKey(traceKey)) return null;
  return TRACE_KEY_FIELDS.reduce((result, field) => ({ ...result, [field]: traceKey[field] }), {});
}

function canonicalTraceKeyText(traceKey) {
  const canonical = canonicalTraceKey(traceKey);
  return canonical ? stableStringify(canonical) : "";
}

function traceKeyId(traceKey) {
  const canonical = canonicalTraceKey(traceKey);
  return canonical ? stableHash(canonical) : "";
}

export function countLegacySource(legacyData = {}) {
  const normalized = normalizeLegacySource(legacyData);
  const entries = legacySessionEntries(normalized);
  const customExerciseIds = new Set(normalized.customExercises.map((exercise) => exercise?.id).filter(Boolean));
  const knownExerciseIds = new Set([...BUILT_IN_EXERCISE_IDS, ...customExerciseIds]);
  const workoutDates = new Set();
  const unknownExerciseReferences = new Set();
  let totalLegacySetCount = 0;
  let blankWorkoutDateCount = 0;
  let invalidWorkoutDateCount = 0;
  let malformedSessionCount = 0;

  for (const entry of entries) {
    const { session } = entry;
    if (!isPlainObject(session)) {
      malformedSessionCount += 1;
      blankWorkoutDateCount += 1;
      workoutDates.add("");
      continue;
    }

    const date = typeof session.date === "string" ? session.date : "";
    workoutDates.add(date);
    if (!date) blankWorkoutDateCount += 1;
    else if (!isValidDateString(date)) invalidWorkoutDateCount += 1;

    const exerciseId = typeof session.exerciseId === "string" ? session.exerciseId : "";
    if (exerciseId && !knownExerciseIds.has(exerciseId)) unknownExerciseReferences.add(exerciseId);

    totalLegacySetCount += legacySetsForSession(session).length;
  }

  return {
    legacyWeekCount: normalized.weeks.length,
    legacyExerciseLogCount: entries.length,
    legacyCustomExerciseCount: normalized.customExercises.length,
    totalLegacySetCount,
    uniqueWorkoutDateCount: workoutDates.size,
    blankWorkoutDateCount,
    invalidWorkoutDateCount,
    unknownExerciseReferences: [...unknownExerciseReferences].sort(),
    malformedNullSessionCount: malformedSessionCount,
  };
}

function countSets(workouts) {
  let workoutExerciseCount = 0;
  let prescriptionBlockCount = 0;
  let workoutSetCount = 0;
  let completedSetCount = 0;
  let incompleteSetCount = 0;

  for (const workout of workouts) {
    for (const exercise of asArray(workout.exercises)) {
      workoutExerciseCount += 1;
      for (const block of asArray(exercise.prescriptionBlocks)) {
        prescriptionBlockCount += 1;
        for (const set of asArray(block.actualSets)) {
          workoutSetCount += 1;
          if (set.completed) completedSetCount += 1;
          else incompleteSetCount += 1;
        }
      }
    }
  }

  return { workoutExerciseCount, prescriptionBlockCount, workoutSetCount, completedSetCount, incompleteSetCount };
}

export function countTransformedData(transformedData = {}) {
  const workouts = asArray(transformedData.workouts);
  return {
    exerciseDefinitionCount: asArray(transformedData.exercises).length,
    workoutCount: workouts.length,
    ...countSets(workouts),
  };
}

function check(name, passed, details = {}) {
  return { name, passed, details };
}

export function validateMigrationPreview({ sourceCounts, transformedCounts, transformedData, legacyData }) {
  const checks = [];
  const errors = [];
  const warnings = [];
  const sourceTraceKeyTexts = new Set();
  const duplicateSourceTraceKeys = new Set();

  for (const entry of legacySessionEntries(normalizeLegacySource(legacyData))) {
    const text = canonicalTraceKeyText(legacyTraceKey(entry));
    if (sourceTraceKeyTexts.has(text)) duplicateSourceTraceKeys.add(text);
    sourceTraceKeyTexts.add(text);
  }

  const transformedTraceKeyTexts = new Set();
  const duplicateTransformedTraceKeys = new Set();
  const invalidTraceKeyExercises = [];
  const mismatchedTraceIds = [];
  const missingTraceIds = [];
  let traceableWorkoutExercises = 0;
  let setsWithRawValues = 0;

  for (const workout of asArray(transformedData.workouts)) {
    for (const exercise of asArray(workout.exercises)) {
      const path = `workouts/${workout.id}/exercises/${exercise.id}/legacy`;
      const traceKey = exercise.legacy?.sourceTraceKey;
      const traceId = exercise.legacy?.sourceTraceId;
      const canonicalText = canonicalTraceKeyText(traceKey);
      const expectedTraceId = traceKeyId(traceKey);

      if (!hasCompleteTraceKey(traceKey)) invalidTraceKeyExercises.push(`${path}/sourceTraceKey`);
      if (!traceId) missingTraceIds.push(`${path}/sourceTraceId`);
      if (traceId && expectedTraceId && traceId !== expectedTraceId) {
        mismatchedTraceIds.push({ path: `${path}/sourceTraceId`, expected: expectedTraceId, actual: traceId });
      }
      if (canonicalText && sourceTraceKeyTexts.has(canonicalText) && traceId === expectedTraceId) traceableWorkoutExercises += 1;
      if (canonicalText) {
        if (transformedTraceKeyTexts.has(canonicalText)) duplicateTransformedTraceKeys.add(canonicalText);
        transformedTraceKeyTexts.add(canonicalText);
      }
      for (const block of asArray(exercise.prescriptionBlocks)) {
        for (const set of asArray(block.actualSets)) {
          if (typeof set.rawReps === "string" && typeof set.rawWeight === "string") setsWithRawValues += 1;
        }
      }
    }
  }

  const missingSourceTraceKeys = [...sourceTraceKeyTexts].filter((key) => !transformedTraceKeyTexts.has(key));
  const unexpectedTransformedTraceKeys = [...transformedTraceKeyTexts].filter((key) => !sourceTraceKeyTexts.has(key));

  checks.push(check("legacy exercise log count equals workout exercise count", sourceCounts.legacyExerciseLogCount === transformedCounts.workoutExerciseCount, {
    legacyExerciseLogCount: sourceCounts.legacyExerciseLogCount,
    workoutExerciseCount: transformedCounts.workoutExerciseCount,
  }));
  checks.push(check("legacy set count equals workout set count", sourceCounts.totalLegacySetCount === transformedCounts.workoutSetCount, {
    totalLegacySetCount: sourceCounts.totalLegacySetCount,
    workoutSetCount: transformedCounts.workoutSetCount,
  }));
  checks.push(check("workout count matches grouped workout dates", sourceCounts.uniqueWorkoutDateCount === transformedCounts.workoutCount, {
    uniqueWorkoutDateCount: sourceCounts.uniqueWorkoutDateCount,
    workoutCount: transformedCounts.workoutCount,
  }));
  checks.push(check("every source legacy exercise log has exactly one transformed workout exercise", missingSourceTraceKeys.length === 0 && transformedCounts.workoutExerciseCount === sourceCounts.legacyExerciseLogCount, {
    missingSourceTraceKeys,
  }));
  checks.push(check("no transformed workout exercise maps to more than one source log", unexpectedTransformedTraceKeys.length === 0, {
    unexpectedTransformedTraceKeys,
  }));
  checks.push(check("no two transformed workout exercises claim the same source trace key", duplicateTransformedTraceKeys.size === 0, {
    duplicateTransformedTraceKeys: [...duplicateTransformedTraceKeys],
  }));
  checks.push(check("every transformed trace key exists in normalized source", unexpectedTransformedTraceKeys.length === 0, {
    unexpectedTransformedTraceKeys,
  }));
  checks.push(check("every source trace key exists in transformed output", missingSourceTraceKeys.length === 0, {
    missingSourceTraceKeys,
  }));
  checks.push(check("every workout exercise has a complete source trace key", invalidTraceKeyExercises.length === 0, {
    invalidTraceKeyExercises,
  }));
  checks.push(check("every workout exercise has a source trace id", missingTraceIds.length === 0, {
    missingTraceIds,
  }));
  checks.push(check("every source trace id matches its source trace key", mismatchedTraceIds.length === 0, {
    mismatchedTraceIds,
  }));
  checks.push(check("every workout exercise traces to exactly one legacy exercise log", traceableWorkoutExercises === transformedCounts.workoutExerciseCount, {
    traceableWorkoutExercises,
    workoutExerciseCount: transformedCounts.workoutExerciseCount,
  }));
  checks.push(check("every migrated set preserves raw reps and raw weight", setsWithRawValues === transformedCounts.workoutSetCount, {
    setsWithRawValues,
    workoutSetCount: transformedCounts.workoutSetCount,
  }));
  checks.push(check("no legacy exercise log is silently discarded", transformedCounts.workoutExerciseCount === sourceCounts.legacyExerciseLogCount, {
    transformedWorkoutExercises: transformedCounts.workoutExerciseCount,
    legacyExerciseLogCount: sourceCounts.legacyExerciseLogCount,
  }));
  checks.push(check("source trace keys are unique", duplicateSourceTraceKeys.size === 0, {
    duplicateSourceTraceKeys: [...duplicateSourceTraceKeys],
  }));

  if (sourceCounts.blankWorkoutDateCount > 0) warnings.push(`${sourceCounts.blankWorkoutDateCount} legacy exercise log(s) have a blank workout date.`);
  if (sourceCounts.invalidWorkoutDateCount > 0) warnings.push(`${sourceCounts.invalidWorkoutDateCount} legacy exercise log(s) have an invalid workout date. Date warnings do not block migration; they preserve legacy data for review.`);
  if (sourceCounts.unknownExerciseReferences.length > 0) warnings.push("Unknown exercise references will be migrated as placeholder exercise definitions.");
  if (sourceCounts.malformedNullSessionCount > 0) warnings.push(`${sourceCounts.malformedNullSessionCount} malformed/null legacy session(s) will be migrated with safe defaults.`);

  for (const item of checks) {
    if (!item.passed) errors.push(`Failed check: ${item.name}`);
  }

  return {
    canMigrate: errors.length === 0,
    warnings,
    errors,
    checks,
  };
}

export function createMigrationPreview(legacyData = {}, options = {}) {
  const normalizedSource = normalizeLegacySource(legacyData);
  const transformedData = transformLegacyDataToV2(normalizedSource, options);
  const sourceCounts = countLegacySource(normalizedSource);
  const transformedCounts = countTransformedData(transformedData);
  const validation = validateMigrationPreview({ sourceCounts, transformedCounts, transformedData, legacyData: normalizedSource });

  return {
    canMigrate: validation.canMigrate,
    sourceFingerprint: fingerprintLegacySource(normalizedSource),
    transformedFingerprint: fingerprintTransformedData(transformedData),
    sourceCounts,
    transformedCounts,
    warnings: validation.warnings,
    errors: validation.errors,
    checks: validation.checks,
    transformedData,
  };
}

function sortById(items) {
  return asArray(items).slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

export function canonicalizeTransformedData(transformedData = {}) {
  return {
    exercises: sortById(transformedData.exercises).map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      defaultSideConfig: exercise.defaultSideConfig,
      category: exercise.category,
      notes: exercise.notes,
      isArchived: exercise.isArchived,
      legacy: exercise.legacy,
    })),
    workouts: sortById(transformedData.workouts).map((workout) => ({
      id: workout.id,
      date: workout.date,
      sessionNameSnapshot: workout.sessionNameSnapshot,
      notes: workout.notes,
      legacy: workout.legacy,
      exercises: sortById(workout.exercises).map((exercise) => ({
        id: exercise.id,
        exerciseId: exercise.exerciseId,
        exerciseNameSnapshot: exercise.exerciseNameSnapshot,
        sortOrder: exercise.sortOrder,
        notes: exercise.notes,
        legacy: exercise.legacy,
        prescriptionBlocks: sortById(exercise.prescriptionBlocks).map((block) => ({
          id: block.id,
          side: block.side,
          targetSets: block.targetSets,
          targetReps: block.targetReps,
          targetWeight: block.targetWeight,
          sortOrder: block.sortOrder,
          actualSets: sortById(block.actualSets).map((set) => ({
            id: set.id,
            setNumber: set.setNumber,
            side: set.side,
            setType: set.setType,
            actualReps: set.actualReps,
            weight: set.weight,
            completed: set.completed,
            rawReps: set.rawReps,
            rawWeight: set.rawWeight,
          })),
        })),
      })),
    })),
  };
}

export function fingerprintTransformedData(transformedData = {}) {
  return stableHash(canonicalizeTransformedData(transformedData));
}

function compareCanonical(expected, actual, path = "") {
  const errors = [];
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) return [`${path}: expected ${Array.isArray(expected) ? "array" : typeof expected}, got ${Array.isArray(actual) ? "array" : typeof actual}`];
    if (expected.length !== actual.length) errors.push(`${path}: expected ${expected.length} item(s), got ${actual.length}`);
    const length = Math.min(expected.length, actual.length);
    for (let i = 0; i < length; i += 1) errors.push(...compareCanonical(expected[i], actual[i], `${path}/${expected[i]?.id ?? i}`));
    return errors;
  }
  if (expected && typeof expected === "object") {
    for (const key of Object.keys(expected)) {
      errors.push(...compareCanonical(expected[key], actual?.[key], path ? `${path}/${key}` : key));
    }
    return errors;
  }
  if (expected !== actual) errors.push(`${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  return errors;
}

export function verifyWrittenMigration(preview, writtenData = {}) {
  const actualCounts = countTransformedData(writtenData);
  const expectedCounts = preview.transformedCounts;
  const errors = [];

  for (const [key, expected] of Object.entries(expectedCounts)) {
    if (actualCounts[key] !== expected) errors.push(`counts/${key}: expected ${expected}, got ${actualCounts[key]}`);
  }

  const expectedWorkoutIds = new Set(preview.transformedData.workouts.map((workout) => workout.id));
  const actualWorkoutIds = new Set(asArray(writtenData.workouts).map((workout) => workout.id));
  for (const id of expectedWorkoutIds) {
    if (!actualWorkoutIds.has(id)) errors.push(`workouts/${id}: missing expected workout document`);
  }

  const expectedExerciseIds = new Set(preview.transformedData.exercises.map((exercise) => exercise.id));
  const actualExerciseIds = new Set(asArray(writtenData.exercises).map((exercise) => exercise.id));
  for (const id of expectedExerciseIds) {
    if (!actualExerciseIds.has(id)) errors.push(`exercises/${id}: missing expected exercise document`);
  }

  const expectedCanonical = canonicalizeTransformedData(preview.transformedData);
  const actualCanonical = canonicalizeTransformedData(writtenData);
  const expectedFingerprint = preview.transformedFingerprint || fingerprintTransformedData(preview.transformedData);
  const actualFingerprint = fingerprintTransformedData(writtenData);

  if (actualFingerprint !== expectedFingerprint) {
    errors.push(`transformedFingerprint: expected ${expectedFingerprint}, got ${actualFingerprint}`);
    errors.push(...compareCanonical(expectedCanonical, actualCanonical));
  }

  return {
    passed: errors.length === 0,
    errors,
    expectedCounts,
    actualCounts,
    expectedFingerprint,
    actualFingerprint,
  };
}

export const __testables = {
  isValidDateString,
  legacySessionEntries,
  canonicalTraceKeyText,
  hasCompleteTraceKey,
  legacyTraceKey,
  normalizeLegacySource,
  traceKeyId,
};
