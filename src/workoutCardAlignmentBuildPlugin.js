function transformWorkoutScreen(code, id) {
  let next = code

  const functionStart = next.indexOf('export function ExerciseCard(')
  const functionEnd = next.indexOf('\nfunction changeWorkout', functionStart)
  if (functionStart < 0 || functionEnd < 0) throw new Error(`Workout card alignment transform could not find ExerciseCard in ${id}`)

  let card = next.slice(functionStart, functionEnd)

  const headerSource = '<div className="flex items-start gap-2"><div className="min-w-0 flex-1">'
  if (!card.includes(headerSource)) throw new Error(`Workout card alignment transform could not find card header in ${id}`)
  card = card.replace(
    headerSource,
    '<div className="workout-card-header flex items-start gap-2"><div className="min-w-0 flex-1">',
  )

  /*
   * Strength cards originally render the equipment/flag row inside the
   * min-w-0 flex-1 title/description column. That column stops before the
   * edit-menu slot, so right:0 on the flag can never line up with the menu.
   * Move the whole conditional out of that column and reinsert it at the
   * card-body level immediately before the set content.
   */
  const strengthMetaPrefix = '{exercise.exerciseType === EXERCISE_TYPE.STRENGTH && onEquipment ? <div className="mt-1 inline-flex items-center gap-1.5">'
  const strengthMetaStart = card.indexOf(strengthMetaPrefix)
  if (strengthMetaStart < 0) throw new Error(`Workout card alignment transform could not find strength metadata row in ${id}`)
  const strengthMetaEndMarker = '</div> : null}'
  const strengthMetaEndStart = card.indexOf(strengthMetaEndMarker, strengthMetaStart)
  if (strengthMetaEndStart < 0) throw new Error(`Workout card alignment transform could not find strength metadata row end in ${id}`)
  const strengthMetaEnd = strengthMetaEndStart + strengthMetaEndMarker.length

  let strengthMeta = card.slice(strengthMetaStart, strengthMetaEnd)
  card = card.slice(0, strengthMetaStart) + card.slice(strengthMetaEnd)

  strengthMeta = strengthMeta.replace(
    '<div className="mt-1 inline-flex items-center gap-1.5">',
    '<div className="workout-card-meta-row mt-2 flex min-h-8 w-full items-center justify-between gap-2">',
  )

  /* Earlier transforms may already have added these classes. Add them only
     when absent instead of failing the build on an exact class string. */
  if (!strengthMeta.includes('workout-equipment-select')) {
    strengthMeta = strengthMeta.replace(
      /className="([^"]*h-7[^\"]*max-w-32[^\"]*)"(?= value=\{exercise\.equipmentType)/,
      'className="workout-equipment-select $1"',
    )
  }

  if (!strengthMeta.includes('workout-card-flag')) {
    strengthMeta = strengthMeta.replace(
      'className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm transition ${exercise.flaggedSkipped ?',
      'className={`workout-card-flag inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm transition ${exercise.flaggedSkipped ?',
    )
  }

  const setContentAnchor = '{isSetTickExercise ?'
  if (!card.includes(setContentAnchor)) throw new Error(`Workout card alignment transform could not find set content in ${id}`)
  card = card.replace(
    setContentAnchor,
    `${strengthMeta}{!hideExerciseName && onFlag && exercise.exerciseType !== EXERCISE_TYPE.STRENGTH ? <div className="workout-card-meta-row mt-2 flex min-h-8 w-full items-center justify-end"><button type="button" aria-label={exercise.flaggedSkipped ? "Remove exercise flag" : "Flag exercise as intentionally skipped"} aria-pressed={Boolean(exercise.flaggedSkipped)} title={exercise.flaggedSkipped ? "Flagged — tap to remove" : "Flag exercise"} className={\`workout-card-flag inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm transition-colors \${exercise.flaggedSkipped ? "border-red-300 bg-red-100 text-red-700 shadow-sm" : "border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"}\`} onClick={() => onFlag(exercise.id, !exercise.flaggedSkipped)}><span aria-hidden="true">⚑</span></button></div> : null}{isSetTickExercise ?`,
  )

  card = card.replace(
    '<div className="flex items-center gap-2"><div className="min-w-0 flex-1"><RepsInput exercise={exercise} set={set} onChange={onChange}/></div><span className="text-sm">reps</span></div>',
    '<label className="text-xs font-medium">Reps<div className="mt-1"><RepsInput exercise={exercise} set={set} onChange={onChange}/></div></label>',
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
