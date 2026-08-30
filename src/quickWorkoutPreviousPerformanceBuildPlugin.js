function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Quick workout previous-performance transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

function transformQuickWorkoutBuilder(code, id) {
  let next = code
  next = replaceRequired(
    next,
    'export function buildQuickWorkout({ id, userId, name, exercises, date, startedAt = new Date().toISOString() }) {',
    'export function buildQuickWorkout({ id, userId, name, exercises, date, previousWeightsByExercise = {}, previousRepsByExercise = {}, startedAt = new Date().toISOString() }) {',
    id,
  )
  next = replaceRequired(
    next,
    'return [SIDE.LEFT, SIDE.RIGHT].map((side, sideIndex) => createWorkoutExerciseSnapshot({ ...base, id: `${exercise.instanceId}-${side}`, prescription: { ...exercise.prescription, side }, sortOrder: index * 2 + sideIndex }, {}));',
    'return [SIDE.LEFT, SIDE.RIGHT].map((side, sideIndex) => createWorkoutExerciseSnapshot({ ...base, id: `${exercise.instanceId}-${side}`, prescription: { ...exercise.prescription, side }, sortOrder: index * 2 + sideIndex }, previousWeightsByExercise[exercise.instanceId + "-" + side] || {}, previousRepsByExercise[exercise.instanceId + "-" + side] || {}));',
    id,
  )
  next = replaceRequired(
    next,
    'return [createWorkoutExerciseSnapshot(base, {})];',
    'return [createWorkoutExerciseSnapshot(base, previousWeightsByExercise[base.id] || {}, previousRepsByExercise[base.id] || {})];',
    id,
  )
  return next
}

function transformWorkoutScreen(code, id) {
  const start = code.indexOf('  const startQuick = async (name, exercises) => {')
  const end = start >= 0 ? code.indexOf('\n  useEffect(() => {', start) : -1
  if (start < 0 || end < 0) throw new Error(`Quick workout previous-performance transform could not isolate startQuick in ${id}`)
  const replacement = `  const startQuick = async (name, exercises) => {
    if (unfinished) return openSaved(unfinished);
    setStartingWorkout(true);
    try {
      const previousWeightsByExercise = {};
      const previousRepsByExercise = {};
      (exercises || []).forEach((exercise) => {
        const separate = supportsSides(exercise) && exercise.prescription?.side === SIDE.SEPARATE;
        const sides = separate ? [SIDE.LEFT, SIDE.RIGHT] : [exercise.prescription?.side];
        sides.forEach((side) => {
          const id = separate ? exercise.instanceId + "-" + side : exercise.instanceId;
          const target = side
            ? { ...exercise, id, sideSnapshot: side, prescription: { ...(exercise.prescription || {}), side } }
            : { ...exercise, id };
          previousWeightsByExercise[id] = previousWeightsForExercise(completedWorkouts, target);
          previousRepsByExercise[id] = previousRepsForExercise(completedWorkouts, target);
        });
      });
      const next = buildQuickWorkout({ id: \`workout-\${makeId()}\`, userId: user.uid, name, exercises, date: todayString(), previousWeightsByExercise, previousRepsByExercise });
      await repository.createInProgressWorkoutDocument(db, user.uid, next);
      setWorkouts((items) => items.some((item) => item.id === next.id) ? items : [...items, next]);
      openSaved(next);
    } finally {
      setStartingWorkout(false);
    }
  };`
  return `${code.slice(0, start)}${replacement}${code.slice(end)}`
}

export function quickWorkoutPreviousPerformanceBuildPlugin() {
  return {
    name: 'quick-workout-previous-performance',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/workout/QuickWorkoutBuilder.jsx')) return transformQuickWorkoutBuilder(code, id)
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      return null
    },
  }
}
