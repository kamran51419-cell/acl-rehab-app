function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Quick workout previous-performance transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

function transformQuickWorkoutBuilder(code, id) {
  let next = code

  next = replaceRequired(
    next,
    'import { createWorkoutExerciseSnapshot } from "../../lib/domain/workoutSession";',
    'import { createWorkoutExerciseSnapshot } from "../../lib/domain/workoutSession";\nimport { previousRepsForExercise, previousWeightsForExercise } from "../../lib/domain/workoutDisplay";',
    id,
  )

  next = replaceRequired(
    next,
    'function createSelectedExercise(definition, index) {',
    `function latestEquipmentForExercise(workouts = [], exerciseId) {
  const timestamp = (workout) => {
    const completed = workout?.completedAt?.seconds ? Number(workout.completedAt.seconds) * 1000 : Date.parse(workout?.completedAt || "");
    return Number.isFinite(completed) ? completed : 0;
  };
  const orderedWorkouts = (workouts || []).slice().sort((a, b) => String(b.date || b.workoutDate || "").localeCompare(String(a.date || a.workoutDate || "")) || timestamp(b) - timestamp(a));
  for (const workout of orderedWorkouts) {
    const match = (workout.exercises || []).find((exercise) => exercise.exerciseId === exerciseId);
    if (match) return match.equipmentType || "standard";
  }
  return "standard";
}

function createSelectedExercise(definition, index, completedWorkouts = []) {`,
    id,
  )

  next = replaceRequired(
    next,
    '    equipmentType: exerciseType === EXERCISE_TYPE.STRENGTH ? "standard" : undefined,',
    '    equipmentType: exerciseType === EXERCISE_TYPE.STRENGTH ? latestEquipmentForExercise(completedWorkouts, definition.id) : undefined,',
    id,
  )

  next = replaceRequired(
    next,
    'export function buildQuickWorkout({ id, userId, name, exercises, date, startedAt = new Date().toISOString() }) {',
    'export function buildQuickWorkout({ id, userId, name, exercises, date, completedWorkouts = [], startedAt = new Date().toISOString() }) {',
    id,
  )

  const buildStart = next.indexOf('export function buildQuickWorkout(')
  const buildEnd = buildStart >= 0 ? next.indexOf('\n\nexport default function QuickWorkoutBuilder', buildStart) : -1
  if (buildStart < 0 || buildEnd < 0) throw new Error(`Quick workout previous-performance transform could not isolate buildQuickWorkout in ${id}`)

  const buildFunction = `export function buildQuickWorkout({ id, userId, name, exercises, date, completedWorkouts = [], startedAt = new Date().toISOString() }) {
  const title = name.trim() || "Quick Workout";
  const snapshots = exercises.flatMap((exercise, index) => {
    const base = { id: exercise.instanceId, exerciseId: exercise.exerciseId, exerciseNameSnapshot: exercise.exerciseNameSnapshot, exerciseType: exercise.exerciseType, loggingMethod: exercise.loggingMethod, equipmentType: exercise.equipmentType, prescription: exercise.prescription, notes: exercise.notes, sortOrder: index };
    if (supportsSides(exercise.exerciseType) && exercise.prescription?.side === SIDE.SEPARATE) {
      return [SIDE.LEFT, SIDE.RIGHT].map((side, sideIndex) => {
        const target = { ...base, id: exercise.instanceId + "-" + side, prescription: { ...exercise.prescription, side }, sideSnapshot: side, sortOrder: index * 2 + sideIndex };
        return createWorkoutExerciseSnapshot(target, previousWeightsForExercise(completedWorkouts, target), previousRepsForExercise(completedWorkouts, target));
      });
    }
    return [createWorkoutExerciseSnapshot(base, previousWeightsForExercise(completedWorkouts, base), previousRepsForExercise(completedWorkouts, base))];
  }).map((exercise, index) => ({ ...exercise, sortOrder: index }));
  return { id, userId, date, createdAt: null, updatedAt: null, completedAt: null, startedAt, status: WORKOUT_STATUS.IN_PROGRESS, sourceType: "one_off", name: title, sessionNameSnapshot: title, exercises: snapshots, notes: "" };
}`

  next = `${next.slice(0, buildStart)}${buildFunction}${next.slice(buildEnd)}`

  next = replaceRequired(
    next,
    'export default function QuickWorkoutBuilder({ exercises, trainingMode = "gym", onCancel, onStart }) {',
    'export default function QuickWorkoutBuilder({ exercises, completedWorkouts = [], trainingMode = "gym", onCancel, onStart }) {',
    id,
  )

  next = next.replaceAll('createSelectedExercise(definition, index)', 'createSelectedExercise(definition, index, completedWorkouts)')
  next = next.replaceAll('createSelectedExercise(definition, items.length)', 'createSelectedExercise(definition, items.length, completedWorkouts)')

  return next
}

function transformWorkoutScreen(code, id) {
  let next = code
  const start = next.indexOf('  const startQuick = async (name, exercises) => {')
  const end = start >= 0 ? next.indexOf('\n  useEffect(() => {', start) : -1
  if (start < 0 || end < 0) throw new Error(`Quick workout previous-performance transform could not isolate startQuick in ${id}`)

  const replacement = `  const startQuick = async (name, exercises) => {
    if (unfinished) return openSaved(unfinished);
    setStartingWorkout(true);
    try {
      const next = buildQuickWorkout({ id: \`workout-\${makeId()}\`, userId: user.uid, name, exercises, date: todayString(), completedWorkouts });
      await repository.createInProgressWorkoutDocument(db, user.uid, next);
      setWorkouts((items) => items.some((item) => item.id === next.id) ? items : [...items, next]);
      openSaved(next);
    } finally {
      setStartingWorkout(false);
    }
  };`

  next = `${next.slice(0, start)}${replacement}${next.slice(end)}`
  next = replaceRequired(
    next,
    '<QuickWorkoutBuilder exercises={library} trainingMode={trainingMode} onCancel={() => setBuilder(false)} onStart={startQuick}/>',
    '<QuickWorkoutBuilder exercises={library} completedWorkouts={completedWorkouts} trainingMode={trainingMode} onCancel={() => setBuilder(false)} onStart={startQuick}/>',
    id,
  )

  next = replaceRequired(
    next,
    'const programme = useMemo(() => plans.find((plan) => plan.isActive && !plan.isArchived), [plans]); const unfinished = workouts.find((item) => item.status === "in_progress" && item.id !== suppressedWorkoutId);',
    'const programme = useMemo(() => plans.find((plan) => plan.isActive && !plan.isArchived), [plans]); const unfinished = workouts.find((item) => item.status === "in_progress" && item.completed !== true && !item.completedAt && (item.exercises || []).some(exerciseAttempted) && item.id !== suppressedWorkoutId);',
    id,
  )

  const formStart = next.indexOf('export function WorkoutForm(')
  const formEnd = formStart >= 0 ? next.indexOf('\n}\n\nexport function DiscardWorkoutDialog', formStart) : -1
  if (formStart < 0 || formEnd < 0) throw new Error(`Quick workout previous-performance transform could not isolate WorkoutForm in ${id}`)
  const formBlock = next.slice(formStart, formEnd)
  const oldShell = '<section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">'
  if (!formBlock.includes(oldShell)) throw new Error(`Quick workout previous-performance transform could not find workout shell in ${id}`)
  const polishedForm = formBlock.replace(oldShell, '<section className={workout.sourceType === "one_off" ? "p-0" : "rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"}>')
  next = `${next.slice(0, formStart)}${polishedForm}${next.slice(formEnd)}`

  return next
}

function transformHomeScreen(code, id) {
  return replaceRequired(
    code,
    '  const unfinishedWorkout = useMemo(() => workouts.find((item) => item.status === "in_progress") || null, [workouts]);',
    '  const unfinishedWorkout = useMemo(() => workouts.find((item) => item.status === "in_progress" && item.completed !== true && !item.completedAt && (item.exercises || []).some(exerciseAttempted)) || null, [workouts]);',
    id,
  )
}

function transformPlanRepository(code, id) {
  const oldStart = `export async function createInProgressWorkoutDocument(db, uid, workout) {
  const existing = await getDocs(collection(db, "users", uid, "workouts"));
  if (existing.docs.some((item) => item.data()?.status === "in_progress" && item.id !== workout.id)) {`
  const newStart = `function inProgressWorkoutHasProgress(workout) {
  return (workout?.exercises || []).some((exercise) => {
    if (exercise?.flaggedSkipped || exercise?.completed) return true;
    const sets = exercise?.recordedSets || [];
    if (exercise?.loggingMethod === "reps_weight" || exercise?.loggingMethod === "time_weight") {
      return sets.some((set) => {
        const weight = set?.weight ?? set?.rawWeight;
        return weight !== "" && weight !== undefined && weight !== null && Number.isFinite(Number(weight));
      });
    }
    if (sets.some((set) => Boolean(set?.completed))) return true;
    return Boolean(exercise?.intervalProgress?.completed || exercise?.intervalProgress?.completedBlocks?.length);
  });
}

export async function createInProgressWorkoutDocument(db, uid, workout) {
  const existing = await getDocs(collection(db, "users", uid, "workouts"));
  const untouched = existing.docs.filter((item) => {
    const saved = item.data();
    return item.id !== workout.id && saved?.status === "in_progress" && saved?.completed !== true && !saved?.completedAt && !inProgressWorkoutHasProgress(saved);
  });
  if (untouched.length) {
    await Promise.all(untouched.map((item) => deleteDoc(item.ref)));
    untouched.forEach((item) => {
      recentWorkoutSnapshots.delete(workoutCacheKey(uid, item.id));
      deletedWorkoutIds.add(workoutCacheKey(uid, item.id));
    });
  }
  if (existing.docs.some((item) => {
    const saved = item.data();
    return item.id !== workout.id && saved?.status === "in_progress" && saved?.completed !== true && !saved?.completedAt && inProgressWorkoutHasProgress(saved);
  })) {`
  return replaceRequired(code, oldStart, newStart, id)
}

function transformProgressScreen(code, id) {
  return replaceRequired(code, '${prefix}Best set', '${prefix}Personal best', id)
}

export function quickWorkoutPreviousPerformanceBuildPlugin() {
  return {
    name: 'quick-workout-previous-performance',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/workout/QuickWorkoutBuilder.jsx')) return transformQuickWorkoutBuilder(code, id)
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      if (cleanId.endsWith('/src/features/home/HomeScreen.jsx')) return transformHomeScreen(code, id)
      if (cleanId.endsWith('/src/lib/firebase/planRepository.js')) return transformPlanRepository(code, id)
      if (cleanId.endsWith('/src/features/progress/ProgressScreen.jsx')) return transformProgressScreen(code, id)
      return null
    },
  }
}
