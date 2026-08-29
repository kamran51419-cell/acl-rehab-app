function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Exercise notes transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

function transformWorkoutScreen(code, id) {
  let next = code

  next = replaceRequired(
    next,
    'export function ExerciseCard({ exercise, oneOff, onChange, onAddSet, onRemoveSet, onRemoveExercise, onChangeExercise, onEquipment, onMove, dragHandleProps, index, total, hideExerciseName = false }) {',
    'export function ExerciseCard({ exercise, oneOff, onChange, onAddSet, onRemoveSet, onRemoveExercise, onChangeExercise, onEquipment, onMove, dragHandleProps, previousNote = "", onExerciseNote, onClearPreviousNote, index, total, hideExerciseName = false }) {',
    id,
  )

  next = replaceRequired(
    next,
    '{setCount && !isTask && !isIntervals && (onAddSet || onRemoveSet) ? <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50" onClick={() => onAddSet?.(exercise.id)}>+ Add set</button><button type="button" disabled={setCount <= 1} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => onRemoveSet?.(exercise.id)}>Remove set</button></div> : null}',
    '{previousNote ? <div className="workout-previous-note mt-3 flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600"><span className="min-w-0 whitespace-pre-wrap">{previousNote}</span>{onClearPreviousNote ? <button type="button" aria-label="Clear carried note" className="shrink-0 rounded-md px-1.5 text-lg leading-none text-slate-400 hover:bg-slate-200 hover:text-slate-700" onClick={() => onClearPreviousNote(exercise.id)}>×</button> : null}</div> : null}{onExerciseNote ? <label className="mt-3 block text-xs font-medium text-slate-600">Note<textarea className="mt-1 min-h-16 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-slate-400" value={exercise.workoutNote || ""} placeholder="Add a note for this workout" onChange={(event) => onExerciseNote(exercise.id, event.target.value)}/></label> : null}{setCount && !isTask && !isIntervals && (onAddSet || onRemoveSet) ? <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50" onClick={() => onAddSet?.(exercise.id)}>+ Add set</button><button type="button" disabled={setCount <= 1} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => onRemoveSet?.(exercise.id)}>Remove set</button></div> : null}',
    id,
  )

  next = replaceRequired(
    next,
    'export function WorkoutForm({ workout, exerciseLibrary = [], completedWorkouts = [], saveStatus, finishing, finishError, onBack, onChange, onAddSet, onRemoveSet, onAddExercise, onReplaceExercise, onRemoveExercise, onEquipment, onReorder, onDate, onNotes, onFinish, onDiscard }) {',
    `function carriedExerciseNote(workouts, exercise) {\n  if (exercise?.carryNoteCleared) return "";\n  const orderedWorkouts = (workouts || []).slice().sort((a, b) => String(b.date || b.workoutDate || "").localeCompare(String(a.date || a.workoutDate || "")) || String(b.completedAt || "").localeCompare(String(a.completedAt || "")));\n  for (const workout of orderedWorkouts) {\n    const matches = (workout.exercises || []).filter((candidate) => candidate.exerciseId === exercise.exerciseId);\n    for (const candidate of matches) {\n      if (String(candidate.workoutNote || "").trim()) return String(candidate.workoutNote).trim();\n      if (candidate.carryNoteCleared) return "";\n    }\n  }\n  return "";\n}\n\nfunction setLinkedWorkoutNote(workout, exerciseId, note) {\n  const ids = new Set(linkedExerciseIds(workout, exerciseId));\n  return { ...workout, exercises: workout.exercises.map((exercise) => ids.has(exercise.id) ? { ...exercise, workoutNote: note, ...(String(note || "").trim() ? { carryNoteCleared: false } : {}) } : exercise) };\n}\n\nfunction clearLinkedCarriedNote(workout, exerciseId) {\n  const ids = new Set(linkedExerciseIds(workout, exerciseId));\n  return { ...workout, exercises: workout.exercises.map((exercise) => ids.has(exercise.id) ? { ...exercise, carryNoteCleared: true } : exercise) };\n}\n\nexport function WorkoutForm({ workout, exerciseLibrary = [], completedWorkouts = [], saveStatus, finishing, finishError, onBack, onChange, onAddSet, onRemoveSet, onAddExercise, onReplaceExercise, onRemoveExercise, onEquipment, onReorder, onDate, onNotes, onFinish, onDiscard }) {`,
    id,
  )

  next = replaceRequired(
    next,
    'onRemoveExercise={onRemoveExercise} onChangeExercise={() => setEditing(exercise)} onEquipment={onEquipment} onMove={null}/>',
    'onRemoveExercise={onRemoveExercise} onChangeExercise={() => setEditing(exercise)} onEquipment={onEquipment} onMove={null} previousNote={carriedExerciseNote(completedWorkouts, exercise)} onExerciseNote={(exerciseId, note) => onReorder(setLinkedWorkoutNote(workout, exerciseId, note).exercises)} onClearPreviousNote={(exerciseId) => onReorder(clearLinkedCarriedNote(workout, exerciseId).exercises)}/>',
    id,
  )

  next = replaceRequired(
    next,
    '<ExerciseCard exercise={exercise} oneOff={false} index={index} total={draft.exercises.length} onChange={(...args) => changeWorkout(setDraft, ...args)} onEquipment={(exerciseId, equipmentType) => setDraft((current) => setLinkedEquipment(current, exerciseId, equipmentType))} onMove={null}/>',
    '<ExerciseCard exercise={exercise} oneOff={false} index={index} total={draft.exercises.length} onChange={(...args) => changeWorkout(setDraft, ...args)} onEquipment={(exerciseId, equipmentType) => setDraft((current) => setLinkedEquipment(current, exerciseId, equipmentType))} onExerciseNote={(exerciseId, note) => setDraft((current) => setLinkedWorkoutNote(current, exerciseId, note))} onMove={null}/>',
    id,
  )

  return next
}

function transformExerciseProgress(code, id) {
  return replaceRequired(
    code,
    'side, sideMode, variant: variantForSide(side), equipmentType: exercise.equipmentType || "standard", weight: set.weight, reps: set.reps, setNumber:',
    'side, sideMode, variant: variantForSide(side), equipmentType: exercise.equipmentType || "standard", workoutNote: exercise.workoutNote || "", weight: set.weight, reps: set.reps, setNumber:',
    id,
  )
}

function transformProgressScreen(code, id) {
  let next = code
  next = replaceRequired(
    next,
    '    point[`${key}Reps`] = entry.reps;',
    '    point[`${key}Reps`] = entry.reps;\n    point[`${key}Note`] = entry.workoutNote || "";',
    id,
  )
  next = replaceRequired(
    next,
    '<div className="text-xs text-slate-500">{point[`${item.dataKey}Weight`]} kg × {point[`${item.dataKey}Reps`]} reps</div></div>)}</div>;',
    '<div className="text-xs text-slate-500">{point[`${item.dataKey}Weight`]} kg × {point[`${item.dataKey}Reps`]} reps</div>{point[`${item.dataKey}Note`] ? <div className="mt-1 max-w-56 whitespace-pre-wrap text-xs text-slate-600">{point[`${item.dataKey}Note`]}</div> : null}</div>)}</div>;',
    id,
  )
  return next
}

function transformWorkoutHistory(code, id) {
  let next = code
  next = replaceRequired(
    next,
    '{left.programmeNoteSnapshot ? <div className="text-xs text-slate-500">{left.programmeNoteSnapshot}</div> : null}<div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">',
    '{left.programmeNoteSnapshot ? <div className="text-xs text-slate-500">{left.programmeNoteSnapshot}</div> : null}{(left.workoutNote || right.workoutNote) ? <div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 text-sm text-slate-600">{left.workoutNote || right.workoutNote}</div> : null}<div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">',
    id,
  )
  next = replaceRequired(
    next,
    '{exercise.programmeNoteSnapshot ? <div className="text-xs text-slate-500">{exercise.programmeNoteSnapshot}</div> : null}{summary ? <div className="mt-1 text-sm text-slate-600">{summary}</div> : null}',
    '{exercise.programmeNoteSnapshot ? <div className="text-xs text-slate-500">{exercise.programmeNoteSnapshot}</div> : null}{exercise.workoutNote ? <div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 text-sm text-slate-600">{exercise.workoutNote}</div> : null}{summary ? <div className="mt-1 text-sm text-slate-600">{summary}</div> : null}',
    id,
  )
  return next
}

export function exerciseNotesBuildPlugin() {
  return {
    name: 'exercise-notes',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      if (cleanId.endsWith('/src/lib/domain/exerciseProgress.js')) return transformExerciseProgress(code, id)
      if (cleanId.endsWith('/src/features/progress/ProgressScreen.jsx')) return transformProgressScreen(code, id)
      if (cleanId.endsWith('/src/features/workout/WorkoutHistoryScreen.jsx')) return transformWorkoutHistory(code, id)
      return null
    },
  }
}
