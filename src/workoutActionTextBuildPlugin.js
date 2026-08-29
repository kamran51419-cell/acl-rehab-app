function transformWorkoutScreen(code) {
  let next = code.replaceAll('>Change exercise</button>', '>Edit exercise</button>')

  const screenAnchor = 'export default function WorkoutScreen('
  if (!next.includes('function activeInProgressWorkout(') && next.includes(screenAnchor)) {
    const helpers = `function workoutStateTime(value) {\n  if (!value) return 0;\n  if (value?.toDate) return value.toDate().getTime();\n  if (value?.seconds) return Number(value.seconds) * 1000;\n  const parsed = new Date(value).getTime();\n  return Number.isNaN(parsed) ? 0 : parsed;\n}\n\nfunction activeInProgressWorkout(workouts, suppressedWorkoutId = null) {\n  const list = workouts || [];\n  const latestCompletedAt = Math.max(0, ...list.filter((item) => item.status === "completed" || item.completed === true).map((item) => workoutStateTime(item.completedAt) || workoutStateTime(item.updatedAt)));\n  return list\n    .filter((item) => item.status === "in_progress" && item.completed !== true && !item.completedAt && item.id !== suppressedWorkoutId)\n    .filter((item) => { const started = workoutStateTime(item.startedAt) || workoutStateTime(item.createdAt); return !latestCompletedAt || !started || started > latestCompletedAt; })\n    .sort((a, b) => (workoutStateTime(b.startedAt) || workoutStateTime(b.createdAt)) - (workoutStateTime(a.startedAt) || workoutStateTime(a.createdAt)))[0];\n}\n\n`
    next = next.replace(screenAnchor, helpers + screenAnchor)
  }

  next = next.replace(
    'const programme = useMemo(() => plans.find((plan) => plan.isActive && !plan.isArchived), [plans]); const unfinished = workouts.find((item) => item.status === "in_progress" && item.id !== suppressedWorkoutId);',
    'const programme = useMemo(() => plans.find((plan) => plan.isActive && !plan.isArchived), [plans]); const unfinished = activeInProgressWorkout(workouts, suppressedWorkoutId);',
  )
  next = next.replace(
    'if (intent.mode === "continue") { const saved = workouts.find((item) => item.id === intent.workoutId && item.status === "in_progress") || unfinished;',
    'if (intent.mode === "continue") { const saved = unfinished;',
  )
  return next
}

function transformHomeScreen(code) {
  let next = code
  const homeAnchor = 'export default function HomeScreen('
  if (!next.includes('function activeHomeWorkout(') && next.includes(homeAnchor)) {
    const helpers = `function activeHomeWorkout(workouts) {\n  const list = workouts || [];\n  const time = (value) => timestampDate(value)?.getTime() || 0;\n  const latestCompletedAt = Math.max(0, ...list.filter((item) => item.status === "completed" || item.completed === true).map((item) => time(item.completedAt) || time(item.updatedAt)));\n  return list\n    .filter((item) => item.status === "in_progress" && item.completed !== true && !item.completedAt)\n    .filter((item) => { const started = time(item.startedAt) || time(item.createdAt); return !latestCompletedAt || !started || started > latestCompletedAt; })\n    .sort((a, b) => (time(b.startedAt) || time(b.createdAt)) - (time(a.startedAt) || time(a.createdAt)))[0] || null;\n}\n\n`
    next = next.replace(homeAnchor, helpers + homeAnchor)
  }
  return next.replace(
    'const unfinishedWorkout = useMemo(() => workouts.find((item) => item.status === "in_progress") || null, [workouts]);',
    'const unfinishedWorkout = useMemo(() => activeHomeWorkout(workouts), [workouts]);',
  )
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