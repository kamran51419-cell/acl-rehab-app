function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Quick Workout exercise-history transform could not find expected source in ${id}`);
  return code.replace(oldText, newText);
}

function hidePairedSideRemoveControls(code) {
  return code.replace(
    /(<ExerciseCard exercise=\{(?:left|right)\} index=\{[^}]+\} hideExerciseName \{\.\.\.props\})(?! oneOff=\{false\})/g,
    '$1 oneOff={false}',
  );
}

function transformWorkoutScreen(code, id) {
  let next = hidePairedSideRemoveControls(code);

  next = replaceRequired(
    next,
    'import QuickWorkoutBuilder, { buildQuickWorkout } from "./QuickWorkoutBuilder";',
    'import QuickWorkoutBuilder, { buildQuickWorkout } from "./QuickWorkoutBuilder";\nimport { hydrateExercisePreviousPerformance, hydrateQuickWorkoutPreviousPerformance } from "../../lib/domain/quickWorkoutHistory";',
    id,
  );

  next = replaceRequired(
    next,
    'onEquipment={(exerciseId, equipmentType) => setWorkout((current) => { const changed = withWorkoutOverrides(setLinkedEquipment(current, exerciseId, equipmentType)); const ids = new Set(linkedExerciseIds(changed, exerciseId)); return { ...changed, exercises: changed.exercises.map((exercise) => { if (!ids.has(exercise.id)) return exercise; const previousWeights = previousWeightsForExercise(completedWorkouts, exercise); const previousReps = previousRepsForExercise(completedWorkouts, exercise); return { ...exercise, recordedSets: (exercise.recordedSets || []).map((set) => ({ ...set, previousWeight: previousWeights[set.setNumber] ?? "", previousReps: previousReps[set.setNumber] ?? "" })) }; }) }; })}',
    'onEquipment={(exerciseId, equipmentType) => setWorkout((current) => { const changed = withWorkoutOverrides(setLinkedEquipment(current, exerciseId, equipmentType)); const ids = new Set(linkedExerciseIds(changed, exerciseId)); return { ...changed, exercises: changed.exercises.map((exercise) => ids.has(exercise.id) ? hydrateExercisePreviousPerformance(exercise, completedWorkouts) : exercise) }; })}',
    id,
  );

  next = replaceRequired(
    next,
    '  const previousWeights = previousWeightsForExercise(completedWorkouts, template); const previousReps = previousRepsForExercise(completedWorkouts, template);\n  const fresh = createWorkoutExerciseSnapshot(template, previousWeights, previousReps);',
    '  const fresh = hydrateExercisePreviousPerformance(createWorkoutExerciseSnapshot(template, {}, {}), completedWorkouts);',
    id,
  );

  next = replaceRequired(
    next,
    'const original = useRef(saved); const catchUp = mode === "catch_up";',
    'const original = useRef(saved); const catchUp = mode === "catch_up"; const editorPreviousWorkouts = completedWorkouts.filter((item) => item.id !== saved.id);',
    id,
  );

  next = replaceRequired(
    next,
    'const previousWeights = previousWeightsForExercise(completedWorkouts, base); const previousReps = previousRepsForExercise(completedWorkouts, base); setAdding({ ...createWorkoutExerciseSnapshot(base, previousWeights, previousReps), addedDuringWorkout: true });',
    'setAdding({ ...hydrateExercisePreviousPerformance(createWorkoutExerciseSnapshot(base, {}, {}), editorPreviousWorkouts), addedDuringWorkout: true });',
    id,
  );

  next = replaceRequired(
    next,
    '<WorkoutExerciseDisplay list={ordered(draft.exercises)} exercise={exercise} oneOff={false} index={index} total={draft.exercises.length} onChange={(...args) => changeWorkout(setDraft, ...args)}',
    '<WorkoutExerciseDisplay list={ordered(draft.exercises).map((item) => hydrateExercisePreviousPerformance(item, editorPreviousWorkouts))} exercise={hydrateExercisePreviousPerformance(exercise, editorPreviousWorkouts)} oneOff={false} index={index} total={draft.exercises.length} onChange={(...args) => changeWorkout(setDraft, ...args)}',
    id,
  );

  next = replaceRequired(
    next,
    'onEquipment={(exerciseId, equipmentType) => setDraft((current) => setLinkedEquipment(current, exerciseId, equipmentType))}',
    'onEquipment={(exerciseId, equipmentType) => setDraft((current) => { const changed = setLinkedEquipment(current, exerciseId, equipmentType); const ids = new Set(linkedExerciseIds(changed, exerciseId)); return { ...changed, exercises: changed.exercises.map((item) => ids.has(item.id) ? hydrateExercisePreviousPerformance(item, editorPreviousWorkouts) : item) }; })}',
    id,
  );

  next = replaceRequired(
    next,
    'editWorkoutExerciseList({ ...current, exercises: [...current.exercises, adding] }, adding.id, edited, completedWorkouts)',
    'editWorkoutExerciseList({ ...current, exercises: [...current.exercises, adding] }, adding.id, edited, editorPreviousWorkouts)',
    id,
  );

  next = replaceRequired(
    next,
    'editWorkoutExerciseList(current, editing.id, edited, completedWorkouts)',
    'editWorkoutExerciseList(current, editing.id, edited, editorPreviousWorkouts)',
    id,
  );

  const openSavedStart = next.indexOf('  const openSaved = useCallback(');
  const startProgramme = openSavedStart >= 0 ? next.indexOf('\n  const startProgramme', openSavedStart) : -1;
  if (openSavedStart < 0 || startProgramme < 0) {
    throw new Error(`Quick Workout exercise-history transform could not find openSaved in ${id}`);
  }

  const replacement = '  const openSaved = useCallback((saved) => { const withPrevious = hydrateQuickWorkoutPreviousPerformance(saved, completedWorkouts); setWorkout(normalizeWorkoutForDisplay(syncSavedWithProgramme(withPrevious))); setBuilder(false); setOverviewDiscardConfirm(false); onIntentHandled(); }, [completedWorkouts, onIntentHandled, syncSavedWithProgramme]);';
  next = next.slice(0, openSavedStart) + replacement + next.slice(startProgramme);

  next = replaceRequired(
    next,
    'const list = ordered(workout.exercises);',
    'const list = ordered(hydrateQuickWorkoutPreviousPerformance(workout, completedWorkouts).exercises);',
    id,
  );

  return next;
}

function transformPlansScreen(code) {
  return code
    .replace('  syncProgrammeEquipmentHistory,\n', '')
    .replace('      await syncProgrammeEquipmentHistory(db, user.uid, saved);\n', '')
    .replace(
      'Previous programme history follows this unless you changed that workout manually.',
      'Default for new workouts. Completed workout history keeps the equipment used at the time.',
    );
}

function transformExerciseProgress(code) {
  return code.replace(
    /equipmentType:\s*exercise\.equipmentType\s*\|\|\s*"standard",\s*weight:\s*set\.weight,/,
    'equipmentType: date && String(date) < "2026-08-28" && exercise.equipmentSource !== "manual" ? "standard" : (exercise.equipmentType || "standard"), weight: set.weight,',
  );
}

function transformPlanRepository(code, id) {
  let next = replaceRequired(
    code,
    'import { duplicatePlan, nextPlanForSave } from "../domain/plans.js";',
    'import { duplicatePlan, nextPlanForSave } from "../domain/plans.js";\nimport { renameExerciseNameSnapshots } from "../domain/exerciseNameSync.js";',
    id,
  );

  const oldSave = `export async function saveExerciseDefinition(db, uid, exercise, { updatedAtToken }) {
  const path = \`${'${exerciseCollectionPath(uid)}'}/${'${exercise.id}'}\`;
  logExerciseRepository("save start", { uid, path });
  try {
    await setDoc(
      exerciseRef(db, uid, exercise.id),
      stripUndefined({ ...exercise, userId: uid, updatedAt: serverTimestamp(), updatedAtToken }),
      { merge: true }
    );
    logExerciseRepository("save complete", { uid, path });
  } catch (error) {
    console.error("Exercise library Firestore save failed", { uid, path, code: error?.code, message: error?.message, error });
    throw error;
  }
}`;

  const newSave = `async function syncExerciseNameSnapshots(db, uid, exerciseId, exerciseName) {
  const [plansSnapshot, workoutsSnapshot] = await Promise.all([
    getDocs(plansCollection(db, uid)),
    getDocs(collection(db, "users", uid, "workouts")),
  ]);
  const updates = [];

  plansSnapshot.docs.forEach((item) => {
    const current = item.data();
    const renamed = renameExerciseNameSnapshots(current, exerciseId, exerciseName);
    if (renamed !== current) updates.push({ ref: item.ref, data: { sessions: renamed.sessions } });
  });

  workoutsSnapshot.docs.forEach((item) => {
    const current = item.data();
    const renamed = renameExerciseNameSnapshots(current, exerciseId, exerciseName);
    if (renamed !== current) updates.push({ ref: item.ref, data: { exercises: renamed.exercises } });
  });

  for (let index = 0; index < updates.length; index += 400) {
    const batch = writeBatch(db);
    updates.slice(index, index + 400).forEach((update) => batch.update(update.ref, stripUndefined(update.data)));
    await batch.commit();
  }

  for (const [key, cached] of recentWorkoutSnapshots.entries()) {
    if (!key.startsWith(\`${'${uid}'}:\`)) continue;
    const renamed = renameExerciseNameSnapshots(cached, exerciseId, exerciseName);
    if (renamed !== cached) recentWorkoutSnapshots.set(key, renamed);
  }
}

export async function saveExerciseDefinition(db, uid, exercise, { updatedAtToken }) {
  const path = \`${'${exerciseCollectionPath(uid)}'}/${'${exercise.id}'}\`;
  const ref = exerciseRef(db, uid, exercise.id);
  logExerciseRepository("save start", { uid, path });
  try {
    const existing = await getDoc(ref);
    await setDoc(
      ref,
      stripUndefined({ ...exercise, userId: uid, updatedAt: serverTimestamp(), updatedAtToken }),
      { merge: true }
    );
    if (existing.exists()) await syncExerciseNameSnapshots(db, uid, exercise.id, exercise.name);
    logExerciseRepository("save complete", { uid, path });
  } catch (error) {
    console.error("Exercise library Firestore save failed", { uid, path, code: error?.code, message: error?.message, error });
    throw error;
  }
}`;

  next = replaceRequired(next, oldSave, newSave, id);
  return next;
}

export function quickWorkoutExerciseHistoryBuildPlugin() {
  return {
    name: 'quick-workout-exercise-history',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/');
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id);
      if (cleanId.endsWith('/src/features/plans/PlansScreen.jsx')) return transformPlansScreen(code);
      if (cleanId.endsWith('/src/lib/domain/exerciseProgress.js')) return transformExerciseProgress(code);
      if (cleanId.endsWith('/src/lib/firebase/planRepository.js')) return transformPlanRepository(code, id);
      return null;
    },
  };
}
