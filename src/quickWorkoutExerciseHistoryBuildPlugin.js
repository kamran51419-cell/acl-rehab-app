function hidePairedSideRemoveControls(code) {
  return code.replace(
    /(<ExerciseCard exercise=\{(?:left|right)\} index=\{[^}]+\} hideExerciseName \{\.\.\.props\})(?! oneOff=\{false\})/g,
    '$1 oneOff={false}',
  );
}

function transformWorkoutScreen(code, id) {
  let next = hidePairedSideRemoveControls(code);
  if (next.includes('withQuickPreviousPerformance')) return next;

  const openSavedStart = next.indexOf('  const openSaved = useCallback(');
  const startProgramme = openSavedStart >= 0 ? next.indexOf('\n  const startProgramme', openSavedStart) : -1;
  if (openSavedStart < 0 || startProgramme < 0) {
    throw new Error(`Quick Workout exercise-history transform could not find openSaved in ${id}`);
  }

  const replacement = `  const withQuickPreviousPerformance = useCallback((saved) => {
    if (!saved || saved.sourceType !== "one_off") return saved;
    return {
      ...saved,
      exercises: (saved.exercises || []).map((exercise) => {
        const previousWeights = previousWeightsForExercise(completedWorkouts, exercise);
        const previousReps = previousRepsForExercise(completedWorkouts, exercise);
        return {
          ...exercise,
          recordedSets: (exercise.recordedSets || []).map((set) => ({
            ...set,
            previousWeight: previousWeights[set.setNumber] ?? "",
            previousReps: previousReps[set.setNumber] ?? "",
          })),
        };
      }),
    };
  }, [completedWorkouts]);
  const openSaved = useCallback((saved) => { setWorkout(normalizeWorkoutForDisplay(syncSavedWithProgramme(withQuickPreviousPerformance(saved)))); setBuilder(false); setOverviewDiscardConfirm(false); onIntentHandled(); }, [onIntentHandled, syncSavedWithProgramme, withQuickPreviousPerformance]);`;

  next = next.slice(0, openSavedStart) + replacement + next.slice(startProgramme);
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
