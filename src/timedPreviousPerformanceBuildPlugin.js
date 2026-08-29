function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Timed previous performance transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

function transformWorkoutDisplay(code, id) {
  return replaceRequired(
    code,
    'export function groupSessionExercises(exercises = []) {',
    `export function previousDurationsForExercise(workouts = [], target) {\n  const sets = previousSetsForExercise(workouts, target);\n  const values = sets.flatMap((set, index) => {\n    const value = set.durationSeconds ?? set.rawDuration;\n    if (value === "" || value === undefined || value === null || !Number.isFinite(Number(value))) return [];\n    return [[Number(set.setNumber || index + 1), Number(value)]];\n  });\n  return values.length ? Object.fromEntries(values) : {};\n}\n\nexport function previousDistancesForExercise(workouts = [], target) {\n  const sets = previousSetsForExercise(workouts, target);\n  const values = sets.flatMap((set, index) => {\n    const value = set.distance ?? set.rawDistance;\n    if (value === "" || value === undefined || value === null || !Number.isFinite(Number(value))) return [];\n    return [[Number(set.setNumber || index + 1), Number(value)]];\n  });\n  return values.length ? Object.fromEntries(values) : {};\n}\n\nexport function groupSessionExercises(exercises = []) {`,
    id,
  )
}

function transformWorkoutScreen(code, id) {
  let next = code
  next = replaceRequired(
    next,
    'import { durationLabel, previousRepsForExercise, previousWeightsForExercise, resolveWorkoutExerciseSide, sessionWorkoutStatus, workoutExerciseSideLabel } from "../../lib/domain/workoutDisplay";',
    'import { durationLabel, previousDistancesForExercise, previousDurationsForExercise, previousRepsForExercise, previousWeightsForExercise, resolveWorkoutExerciseSide, sessionWorkoutStatus, workoutExerciseSideLabel } from "../../lib/domain/workoutDisplay";',
    id,
  )
  next = replaceRequired(
    next,
    'function cleanUnsupportedSideExercise(exercise) {',
    `function applyPreviousMeasurementsToExercise(exercise, completedWorkouts = []) {\n  const durations = previousDurationsForExercise(completedWorkouts, exercise);\n  const distances = previousDistancesForExercise(completedWorkouts, exercise);\n  return { ...exercise, recordedSets: (exercise.recordedSets || []).map((set) => ({ ...set, previousDurationSeconds: durations[Number(set.setNumber)] ?? "", previousDistance: distances[Number(set.setNumber)] ?? "" })) };\n}\n\nfunction applyPreviousMeasurements(workout, completedWorkouts = []) {\n  return workout ? { ...workout, exercises: (workout.exercises || []).map((exercise) => applyPreviousMeasurementsToExercise(exercise, completedWorkouts)) } : workout;\n}\n\nfunction cleanUnsupportedSideExercise(exercise) {`,
    id,
  )
  next = replaceRequired(
    next,
    'const openSaved = useCallback((saved) => { setWorkout(normalizeWorkoutForDisplay(syncSavedWithProgramme(saved))); setBuilder(false); setOverviewDiscardConfirm(false); onIntentHandled(); }, [onIntentHandled, syncSavedWithProgramme]);',
    'const openSaved = useCallback((saved) => { setWorkout(applyPreviousMeasurements(normalizeWorkoutForDisplay(syncSavedWithProgramme(saved)), completedWorkouts)); setBuilder(false); setOverviewDiscardConfirm(false); onIntentHandled(); }, [completedWorkouts, onIntentHandled, syncSavedWithProgramme]);',
    id,
  )
  next = next.replace(
    'const snapshot = { ...createWorkoutExerciseSnapshot(base, previousWeights, previousReps), addedDuringWorkout: true };',
    'const snapshot = applyPreviousMeasurementsToExercise({ ...createWorkoutExerciseSnapshot(base, previousWeights, previousReps), addedDuringWorkout: true }, completedWorkouts);',
  )
  return next
}

export function timedPreviousPerformanceBuildPlugin() {
  return {
    name: 'timed-previous-performance',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/lib/domain/workoutDisplay.js')) return transformWorkoutDisplay(code, id)
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      return null
    },
  }
}
