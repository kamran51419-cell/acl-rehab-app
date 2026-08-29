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

const ACTION_MENU_CLASS = 'absolute right-0 top-10 z-30 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg'

function addMobileActionRow(block, openState, headerClass) {
  let next = block.replace(
    headerClass,
    headerClass.replace('className="', 'className="workout-exercise-header '),
  )

  const triggerStart = next.indexOf('<div className="relative"><button type="button" aria-label={`Edit ')
  if (triggerStart < 0) return next

  const menuPrefix = `{${openState} ? <div className="${ACTION_MENU_CLASS}">`
  const menuStart = next.indexOf(menuPrefix, triggerStart)
  if (menuStart < 0) return next

  const menuInnerStart = menuStart + menuPrefix.length
  const menuSuffix = '</div> : null}'
  const menuEnd = next.indexOf(menuSuffix, menuInnerStart)
  if (menuEnd < 0) return next

  const wrapperEnd = menuEnd + menuSuffix.length
  if (next.slice(wrapperEnd, wrapperEnd + 6) !== '</div>') return next
  const wrapperCloseEnd = wrapperEnd + 6

  const menuInner = next.slice(menuInnerStart, menuEnd)
  const desktopConditional = `{${openState} ? <div className="workout-exercise-actions-desktop ${ACTION_MENU_CLASS}">${menuInner}</div> : null}`
  const mobileConditional = `{${openState} ? <div className="workout-exercise-actions-mobile">${menuInner}</div> : null}`
  const transformedWrapper = `${next.slice(triggerStart, menuStart)}${desktopConditional}${next.slice(menuEnd + menuSuffix.length, wrapperCloseEnd)}`

  /* The wrapper is the truthy branch of an existing ternary. A fragment keeps
     the trigger and mobile row inside that one branch while rendering both as
     direct flex children of the header. */
  return `${next.slice(0, triggerStart)}<>${transformedWrapper}${mobileConditional}</>${next.slice(wrapperCloseEnd)}`
}

function addMobileActionRows(code) {
  let next = code

  const cardStart = next.indexOf('export function ExerciseCard(')
  const cardEnd = cardStart >= 0 ? next.indexOf('\nfunction changeWorkout', cardStart) : -1
  if (cardStart >= 0 && cardEnd > cardStart) {
    const card = addMobileActionRow(
      next.slice(cardStart, cardEnd),
      'actionsOpen',
      'className="flex items-start gap-2"',
    )
    next = `${next.slice(0, cardStart)}${card}${next.slice(cardEnd)}`
  }

  const pairStart = next.indexOf('function WorkoutExerciseDisplay(')
  const pairEnd = pairStart >= 0 ? next.indexOf('\n\nexport function WorkoutForm(', pairStart) : -1
  if (pairStart >= 0 && pairEnd > pairStart) {
    const pair = addMobileActionRow(
      next.slice(pairStart, pairEnd),
      'sharedActionsOpen',
      'className="flex items-start justify-between gap-3"',
    )
    next = `${next.slice(0, pairStart)}${pair}${next.slice(pairEnd)}`
  }

  return next
}

function seedWorkoutScreenFromIntent(code) {
  return code.replace(
    'const [plans, setPlans] = useState([]); const [workouts, setWorkouts] = useState([]);',
    'const [plans, setPlans] = useState(() => intent?.programmeSnapshot ? [intent.programmeSnapshot] : []); const [workouts, setWorkouts] = useState(() => intent?.workoutsSnapshot || []);',
  )
}

function makeWorkoutStartImmediate(code) {
  return code.replace(
    'await repository.createInProgressWorkoutDocument(db, user.uid, next); setWorkouts((items) => items.some((item) => item.id === next.id) ? items : [...items, next]); openSaved(next);',
    'setWorkouts((items) => items.some((item) => item.id === next.id) ? items : [...items, next]); openSaved(next); repository.createInProgressWorkoutDocument(db, user.uid, next).catch(console.error);',
  )
}

function transformWorkoutScreen(code) {
  let next = code.replaceAll('>Change exercise</button>', '>Edit exercise</button>')

  const screenAnchor = 'export default function WorkoutScreen('
  if (!next.includes('function activeInProgressWorkout(') && next.includes(screenAnchor)) {
    const helpers = `function workoutStateTime(value) {\n  if (!value) return 0;\n  if (value?.toDate) return value.toDate().getTime();\n  if (value?.seconds) return Number(value.seconds) * 1000;\n  const parsed = new Date(value).getTime();\n  return Number.isNaN(parsed) ? 0 : parsed;\n}\n\nfunction activeInProgressWorkout(workouts, suppressedWorkoutId = null) {\n  const list = workouts || [];\n  const latestCompletedAt = Math.max(0, ...list.filter((item) => item.status === "completed" || item.completed === true).map((item) => workoutStateTime(item.completedAt) || workoutStateTime(item.updatedAt)));\n  return list\n    .filter((item) => item.status === "in_progress" && item.completed !== true && !item.completedAt && item.id !== suppressedWorkoutId)\n    .filter((item) => { const started = workoutStateTime(item.startedAt) || workoutStateTime(item.createdAt); return Boolean(started) && (!latestCompletedAt || started > latestCompletedAt); })\n    .sort((a, b) => (workoutStateTime(b.startedAt) || workoutStateTime(b.createdAt)) - (workoutStateTime(a.startedAt) || workoutStateTime(a.createdAt)))[0];\n}\n\n`
    next = next.replace(screenAnchor, helpers + screenAnchor)
  }

  next = seedWorkoutScreenFromIntent(next)
  next = replaceUnfinishedWorkoutSelection(next)
  next = replaceContinueSelection(next)
  next = addMobileActionRows(next)
  next = makeWorkoutStartImmediate(next)
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

  next = next.replace(
    'onChooseSession={(sessionId) => onOpenWorkout({ mode: "session", sessionId })}',
    'onChooseSession={(sessionId) => onOpenWorkout({ mode: "session", sessionId, programmeSnapshot: programme, workoutsSnapshot: workouts })}',
  )
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
