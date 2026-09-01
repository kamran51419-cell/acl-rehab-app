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
    'import QuickWorkoutBuilder, { buildQuickWorkout } from "./QuickWorkoutBuilder";\nimport { hydrateQuickWorkoutPreviousPerformance } from "../../lib/domain/quickWorkoutHistory";',
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

export function quickWorkoutExerciseHistoryBuildPlugin() {
  return {
    name: 'quick-workout-exercise-history',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/');
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id);
      return null;
    },
  };
}
