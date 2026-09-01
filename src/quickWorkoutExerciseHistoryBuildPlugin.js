function transformWorkoutScreen(code, id) {
  if (code.includes('withQuickPreviousPerformance')) return code;

  const openSavedStart = code.indexOf('  const openSaved = useCallback(');
  const startProgramme = openSavedStart >= 0 ? code.indexOf('\n  const startProgramme', openSavedStart) : -1;
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

  return code.slice(0, openSavedStart) + replacement + code.slice(startProgramme);
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
