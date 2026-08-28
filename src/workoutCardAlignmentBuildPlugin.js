function transformWorkoutScreen(code, id) {
  let next = code

  const functionStart = next.indexOf('export function ExerciseCard(')
  const functionEnd = next.indexOf('\nfunction changeWorkout', functionStart)
  if (functionStart < 0 || functionEnd < 0) throw new Error(`Workout card alignment transform could not find ExerciseCard in ${id}`)

  let card = next.slice(functionStart, functionEnd)
  const headerAnchor = '</div>{!hideExerciseName &&'
  if (!card.includes(headerAnchor)) throw new Error(`Workout card alignment transform could not find exercise header actions in ${id}`)

  card = card.replace(
    '<div className="flex items-start gap-2"><div className="min-w-0 flex-1">',
    '<div className="workout-card-header flex items-start gap-2"><div className="min-w-0 flex-1">',
  )

  card = card.replace(
    headerAnchor,
    '</div>{!hideExerciseName && onFlag ? <button type="button" aria-label={exercise.flaggedSkipped ? "Remove exercise flag" : "Flag exercise as intentionally skipped"} aria-pressed={Boolean(exercise.flaggedSkipped)} title={exercise.flaggedSkipped ? "Flagged — tap to remove" : "Flag exercise"} className={`workout-card-flag inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-base transition-colors ${exercise.flaggedSkipped ? "border-red-300 bg-red-100 text-red-700 shadow-sm" : "border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"}`} onClick={() => onFlag(exercise.id, !exercise.flaggedSkipped)}><span aria-hidden="true">⚑</span></button> : null}{!hideExerciseName &&',
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
