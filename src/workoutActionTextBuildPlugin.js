function replaceUnfinishedWorkoutSelection(code) {
  const programmeIndex = code.indexOf('const programme = useMemo(')
  if (programmeIndex < 0) return code
  const start = code.indexOf('const unfinished = ', programmeIndex)
  const endMarker = '\n  const completedWorkouts'
  const end = start >= 0 ? code.indexOf(endMarker, start) : -1
  if (start < 0 || end < 0) return code
  return `${code.slice(0, start)}const unfinished = activeInProgressWorkout(workouts, suppressedWorkoutId);${code.slice(end)}`
}

function replaceContinueSelection(code) {
  const start = code.indexOf('if (intent.mode === "continue") {')
  if (start < 0) return code
  const guard = code.indexOf('if (!saved) return;', start)
  if (guard < 0) return code
  const bodyStart = start + 'if (intent.mode === "continue") {'.length
  return `${code.slice(0, bodyStart)} const saved = unfinished; ${code.slice(guard)}`
}

function transformWorkoutScreen(code) {
  let next = code.replaceAll('>Change exercise</button>', '>Edit exercise</button>')

  const screenAnchor = 'export default function WorkoutScreen('
  if (!next.includes('function activeInProgressWorkout(') && next.includes(screenAnchor)) {
    const helpers = `function workoutStateTime(value) {\n  if (!value) return 0;\n  if (value?.toDate) return value.toDate().getTime();\n  if (value?.seconds) return Number(value.seconds) * 1000;\n  const parsed = new Date(value).getTime();\n  return Number.isNaN(parsed) ? 0 : parsed;\n}\n\nfunction activeInProgressWorkout(workouts, suppressedWorkoutId = null) {\n  const list = workouts || [];\n  const latestCompletedAt = Math.max(0, ...list.filter((item) => item.status === "completed" || item.completed === true).map((item) => workoutStateTime(item.completedAt) || workoutStateTime(item.updatedAt)));\n  return list\n    .filter((item) => item.status === "in_progress" && item.completed !== true && !item.completedAt && item.id !== suppressedWorkoutId)\n    .filter((item) => { const started = workoutStateTime(item.startedAt) || workoutStateTime(item.createdAt); return Boolean(started) && (!latestCompletedAt || started > latestCompletedAt); })\n    .sort((a, b) => (workoutStateTime(b.startedAt) || workoutStateTime(b.createdAt)) - (workoutStateTime(a.startedAt) || workoutStateTime(a.createdAt)))[0];\n}\n\n`
    next = next.replace(screenAnchor, helpers + screenAnchor)
  }

  next = replaceUnfinishedWorkoutSelection(next)
  next = replaceContinueSelection(next)
  return next
}

function transformHomeScreen(code) {
  let next = code
  const homeAnchor = 'export default function HomeScreen('
  if (!next.includes('function activeHomeWorkout(') && next.includes(homeAnchor)) {
    const helpers = `function activeHomeWorkout(workouts) {\n  const list = workouts || [];\n  const time = (value) => timestampDate(value)?.getTime() || 0;\n  const latestCompletedAt = Math.max(0, ...list.filter((item) => item.status === "completed" || item.completed === true).map((item) => time(item.completedAt) || time(item.updatedAt)));\n  return list\n    .filter((item) => item.status === "in_progress" && item.completed !== true && !item.completedAt)\n    .filter((item) => { const started = time(item.startedAt) || time(item.createdAt); return Boolean(started) && (!latestCompletedAt || started > latestCompletedAt); })\n    .sort((a, b) => (time(b.startedAt) || time(b.createdAt)) - (time(a.startedAt) || time(a.createdAt)))[0] || null;\n}\n\n`
    next = next.replace(homeAnchor, helpers + homeAnchor)
  }

  const start = next.indexOf('const unfinishedWorkout = useMemo(')
  const endMarker = '\n  const incompleteWorkoutList'
  const end = start >= 0 ? next.indexOf(endMarker, start) : -1
  if (start >= 0 && end >= 0) {
    next = `${next.slice(0, start)}const unfinishedWorkout = useMemo(() => activeHomeWorkout(workouts), [workouts]);${next.slice(end)}`
  }
  return next
}

function transformPlanRepository(code) {
  let next = code.replace(
    '  const visible = remote.filter((workout) => !deletedWorkoutIds.has(workoutCacheKey(uid, workout.id))).map((workout) => {\n    const recent = recentWorkoutSnapshots.get(workoutCacheKey(uid, workout.id));\n    return workout.status === "in_progress" && recent?.status === "in_progress" ? recent : workout;\n  });',
    '  const visible = remote.filter((workout) => !deletedWorkoutIds.has(workoutCacheKey(uid, workout.id))).map((workout) => {\n    const normalized = workout.completed === true || workout.completedAt ? { ...workout, status: "completed", completed: true } : workout;\n    const recent = recentWorkoutSnapshots.get(workoutCacheKey(uid, workout.id));\n    return normalized.status === "in_progress" && recent?.status === "in_progress" ? recent : normalized;\n  });',
  )
  next = next.replace(
    `  const existing = await getDocs(collection(db, "users", uid, "workouts"));\n  if (existing.docs.some((item) => item.data()?.status === "in_progress" && item.id !== workout.id)) {\n    const error = new Error("An unfinished workout already exists.");\n    error.code = "workout/already-in-progress";\n    throw error;\n  }\n`,
    '',
  )
  return next
}

export function workoutActionTextBuildPlugin() {
  return {
    name: 'workout-action-text',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code)
      if (cleanId.endsWith('/src/features/home/HomeScreen.jsx')) return transformHomeScreen(code)
      if (cleanId.endsWith('/src/lib/firebase/planRepository.js')) return transformPlanRepository(code)
      return null
    },
  }
}