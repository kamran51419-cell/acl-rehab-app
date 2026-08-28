function transformWorkoutScreen(code, id) {
  let next = code

  const functionStart = next.indexOf('export function ExerciseCard(')
  const functionEnd = next.indexOf('\nfunction changeWorkout', functionStart)
  if (functionStart < 0 || functionEnd < 0) throw new Error(`Workout card alignment transform could not find ExerciseCard in ${id}`)

  let card = next.slice(functionStart, functionEnd)

  card = card.replace(
    '<div className="flex items-start gap-2"><div className="min-w-0 flex-1">',
    '<div className="workout-card-header flex items-start gap-2"><div className="min-w-0 flex-1">',
  )

  card = card.replace(
    '<div className="mt-1 inline-flex items-center gap-1.5">',
    '<div className="workout-card-meta-row mt-1 flex min-h-8 w-full items-center justify-between gap-2">',
  )

  card = card.replace(
    'className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm transition ${exercise.flaggedSkipped ?',
    'className={`workout-card-flag inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm transition ${exercise.flaggedSkipped ?',
  )

  const setContentAnchor = '{isSetTickExercise ?'
  if (!card.includes(setContentAnchor)) throw new Error(`Workout card alignment transform could not find set content in ${id}`)
  card = card.replace(
    setContentAnchor,
    '{!hideExerciseName && onFlag && exercise.exerciseType !== EXERCISE_TYPE.STRENGTH ? <div className="workout-card-meta-row mt-1 flex min-h-8 w-full items-center justify-end"><button type="button" aria-label={exercise.flaggedSkipped ? "Remove exercise flag" : "Flag exercise as intentionally skipped"} aria-pressed={Boolean(exercise.flaggedSkipped)} title={exercise.flaggedSkipped ? "Flagged — tap to remove" : "Flag exercise"} className={`workout-card-flag inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm transition-colors ${exercise.flaggedSkipped ? "border-red-300 bg-red-100 text-red-700 shadow-sm" : "border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"}`} onClick={() => onFlag(exercise.id, !exercise.flaggedSkipped)}><span aria-hidden="true">⚑</span></button></div> : null}{isSetTickExercise ?',
  )

  card = card.replace(
    '<div className="flex items-center gap-2"><div className="min-w-0 flex-1"><RepsInput exercise={exercise} set={set} onChange={onChange}/></div><span className="text-sm">reps</span></div>',
    '<div className="flex items-start gap-2"><div className="min-w-0 flex-1"><RepsInput exercise={exercise} set={set} onChange={onChange}/></div><span className="pt-2.5 text-sm leading-5">reps</span></div>',
  )

  card = card.replace(
    '<span className="text-sm font-medium">{[fields.time ? prescribedDuration : null, fields.distance && prescribedDistance !== undefined ? `${prescribedDistance} km` : null].filter(Boolean).join(" · ")}</span>',
    '<span className="pt-2.5 text-sm font-medium leading-5">{[fields.time ? prescribedDuration : null, fields.distance && prescribedDistance !== undefined ? `${prescribedDistance} km` : null].filter(Boolean).join(" · ")}</span>',
  )

  next = next.slice(0, functionStart) + card + next.slice(functionEnd)
  return next
}

export function workoutCardAlignmentBuildPlugin() {
  return {
    name: 'workout-card-alignment',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      return null
    },
  }
}
