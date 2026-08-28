function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Exercise flag transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

function transformWorkoutScreen(code, id) {
  let next = code
  next = replaceRequired(next, 'function exerciseAttempted(exercise) { if (exercise?.completed) return true;', 'function exerciseAttempted(exercise) { if (exercise?.flaggedSkipped) return true; if (exercise?.completed) return true;', id)
  next = replaceRequired(next, 'function clearLinkedCarriedNote(workout, exerciseId) {\n  const ids = new Set(linkedExerciseIds(workout, exerciseId));\n  return { ...workout, exercises: workout.exercises.map((exercise) => ids.has(exercise.id) ? { ...exercise, carryNoteCleared: true } : exercise) };\n}', 'function clearLinkedCarriedNote(workout, exerciseId) {\n  const ids = new Set(linkedExerciseIds(workout, exerciseId));\n  return { ...workout, exercises: workout.exercises.map((exercise) => ids.has(exercise.id) ? { ...exercise, carryNoteCleared: true } : exercise) };\n}\n\nfunction setLinkedExerciseFlag(workout, exerciseId, flaggedSkipped) {\n  const ids = new Set(linkedExerciseIds(workout, exerciseId));\n  return { ...workout, exercises: workout.exercises.map((exercise) => ids.has(exercise.id) ? { ...exercise, flaggedSkipped: Boolean(flaggedSkipped) } : exercise) };\n}', id)
  next = replaceRequired(next, 'onMove, dragHandleProps, previousNote = "", onExerciseNote, onClearPreviousNote, index, total, hideExerciseName = false }) {', 'onMove, dragHandleProps, previousNote = "", onExerciseNote, onClearPreviousNote, onFlag, index, total, hideExerciseName = false }) {', id)
  next = replaceRequired(next, '{previousNote ? <div className="mt-3 flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600">', '{onFlag ? <div className="mt-3"><button type="button" aria-pressed={Boolean(exercise.flaggedSkipped)} className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition ${exercise.flaggedSkipped ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`} onClick={() => onFlag(exercise.id, !exercise.flaggedSkipped)}><span aria-hidden="true">⚑</span>{exercise.flaggedSkipped ? "Flagged" : "Flag"}</button></div> : null}{previousNote ? <div className="mt-3 flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600">', id)
  next = replaceRequired(next, 'onClearPreviousNote={(exerciseId) => onReorder(clearLinkedCarriedNote(workout, exerciseId).exercises)}/>', 'onClearPreviousNote={(exerciseId) => onReorder(clearLinkedCarriedNote(workout, exerciseId).exercises)} onFlag={(exerciseId, flaggedSkipped) => onReorder(setLinkedExerciseFlag(workout, exerciseId, flaggedSkipped).exercises)}/>', id)
  next = replaceRequired(next, 'onExerciseNote={(exerciseId, note) => setDraft((current) => setLinkedWorkoutNote(current, exerciseId, note))} onMove={null}/>', 'onExerciseNote={(exerciseId, note) => setDraft((current) => setLinkedWorkoutNote(current, exerciseId, note))} onFlag={(exerciseId, flaggedSkipped) => setDraft((current) => setLinkedExerciseFlag(current, exerciseId, flaggedSkipped))} onMove={null}/>', id)
  return next
}

function transformWorkoutSession(code, id) {
  return replaceRequired(code, '    exercise.completed || (exercise.recordedSets || []).some((set) =>', '    exercise.flaggedSkipped || exercise.completed || (exercise.recordedSets || []).some((set) =>', id)
}

function transformExerciseProgress(code, id) {
  let next = code
  next = replaceRequired(next, 'weightedEntries: [] });', 'weightedEntries: [], flaggedEntries: [] });', id)
  next = replaceRequired(next,
    '      const date = exerciseDate(workout, exercise);\n      groups.get(exercise.exerciseId).performances.push({ workoutId: workout.id, date, displayDate: formatDate(date).replaceAll("-", "/"), exercise });',
    '      const date = exerciseDate(workout, exercise);\n      const group = groups.get(exercise.exerciseId);\n      group.performances.push({ workoutId: workout.id, date, displayDate: formatDate(date).replaceAll("-", "/"), exercise });\n      if (exercise.flaggedSkipped) {\n        const side = resolveWorkoutExerciseSide(exercise);\n        const weightedExercises = (workout.exercises || []).filter((candidate) => candidate.exerciseId === exercise.exerciseId && candidate.loggingMethod === EXERCISE_LOGGING_METHOD.REPS_WEIGHT);\n        group.flaggedEntries.push({ workoutId: workout.id, date, displayDate: formatDate(date).replaceAll("-", "/"), side, sideMode: progressSideMode(exercise, weightedExercises), equipmentType: exercise.equipmentType || "standard", workoutNote: exercise.workoutNote || "" });\n      }',
    id,
  )
  return next
}

export function exerciseFlagBuildPlugin() {
  return {
    name: 'exercise-flag',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      if (cleanId.endsWith('/src/lib/domain/workoutSession.js')) return transformWorkoutSession(code, id)
      if (cleanId.endsWith('/src/lib/domain/exerciseProgress.js')) return transformExerciseProgress(code, id)
      return null
    },
  }
}
