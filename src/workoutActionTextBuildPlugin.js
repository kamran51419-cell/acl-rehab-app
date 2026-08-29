function transformWorkoutScreen(code) {
  let next = code.replaceAll('>Change exercise</button>', '>Edit exercise</button>')
  next = next.replace(
    'const programme = useMemo(() => plans.find((plan) => plan.isActive && !plan.isArchived), [plans]); const unfinished = workouts.find((item) => item.status === "in_progress" && item.id !== suppressedWorkoutId);',
    'const programme = useMemo(() => plans.find((plan) => plan.isActive && !plan.isArchived), [plans]); const unfinished = workouts.filter((item) => item.status === "in_progress" && item.completed !== true && !item.completedAt && item.id !== suppressedWorkoutId).sort((a, b) => Number(b.updatedAt?.seconds || 0) - Number(a.updatedAt?.seconds || 0) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];',
  )
  next = next.replace(
    'if (intent.mode === "continue") { const saved = workouts.find((item) => item.id === intent.workoutId && item.status === "in_progress") || unfinished;',
    'if (intent.mode === "continue") { const saved = workouts.find((item) => item.id === intent.workoutId && item.status === "in_progress" && item.completed !== true && !item.completedAt) || unfinished;',
  )
  return next
}

function transformHomeScreen(code) {
  return code.replace(
    'const unfinishedWorkout = useMemo(() => workouts.find((item) => item.status === "in_progress") || null, [workouts]);',
    'const unfinishedWorkout = useMemo(() => workouts.filter((item) => item.status === "in_progress" && item.completed !== true && !item.completedAt).sort((a, b) => Number(b.updatedAt?.seconds || 0) - Number(a.updatedAt?.seconds || 0) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0] || null, [workouts]);',
  )
}

function transformPlanRepository(code) {
  let next = code.replace(
    'import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";',
    'import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";',
  )
  next = next.replace(
    '  const visible = remote.filter((workout) => !deletedWorkoutIds.has(workoutCacheKey(uid, workout.id))).map((workout) => {\n    const recent = recentWorkoutSnapshots.get(workoutCacheKey(uid, workout.id));\n    return workout.status === "in_progress" && recent?.status === "in_progress" ? recent : workout;\n  });',
    '  const visible = remote.filter((workout) => !deletedWorkoutIds.has(workoutCacheKey(uid, workout.id))).map((workout) => {\n    const normalized = workout.completed === true || workout.completedAt ? { ...workout, status: "completed", completed: true } : workout;\n    const recent = recentWorkoutSnapshots.get(workoutCacheKey(uid, workout.id));\n    return normalized.status === "in_progress" && recent?.status === "in_progress" ? recent : normalized;\n  });',
  )
  next = next.replace(
    '  const existing = await getDocs(collection(db, "users", uid, "workouts"));\n  if (existing.docs.some((item) => item.data()?.status === "in_progress" && item.id !== workout.id)) {',
    '  const existing = await getDocs(query(collection(db, "users", uid, "workouts"), where("status", "==", "in_progress")));\n  if (existing.docs.some((item) => { const current = item.data(); return current?.completed !== true && !current?.completedAt && item.id !== workout.id; })) {',
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
