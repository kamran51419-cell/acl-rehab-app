function transformWorkoutScreen(code) {
  let next = code

  // Reps fields (both reps-only and weighted layouts).
  next = next.replaceAll(
    '<div className="min-w-0"><RepsInput exercise={exercise} set={set} onChange={onChange}/></div>',
    '<div className="workout-floating-field min-w-0"><span className="workout-floating-label">Reps</span><RepsInput exercise={exercise} set={set} onChange={onChange}/></div>',
  )

  // Weight fields. Keep the previous value directly underneath the input.
  next = next.replaceAll(
    '<div className="min-w-0"><input inputMode="decimal" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3" value={set.rawWeight ?? set.weight ?? ""}',
    '<div className="workout-floating-field min-w-0"><span className="workout-floating-label">Weight (kg)</span><input inputMode="decimal" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3" value={set.rawWeight ?? set.weight ?? ""}',
  )

  // Time-only weighted fields.
  next = next.replaceAll(
    '<div className="min-w-0"><input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} time`}',
    '<div className="workout-floating-field min-w-0"><span className="workout-floating-label">Time ({durationUnitLabel})</span><input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} time`}',
  )

  // Time/distance tick rows can contain one or both editable fields.
  next = next.replaceAll(
    '{fields.time ? <input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} time`}',
    '{fields.time ? <div className="workout-floating-field min-w-0"><span className="workout-floating-label">Time ({durationUnitLabel})</span><input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} time`}',
  )
  next = next.replaceAll(
    'onChange={(event) => onChange(exercise.id, set.id, "durationSeconds", event.target.value === "" ? "" : Number(event.target.value) * durationScale)}/> : null}{fields.distance ?',
    'onChange={(event) => onChange(exercise.id, set.id, "durationSeconds", event.target.value === "" ? "" : Number(event.target.value) * durationScale)}/></div> : null}{fields.distance ?',
  )
  next = next.replaceAll(
    '{fields.distance ? <input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} distance`}',
    '{fields.distance ? <div className="workout-floating-field min-w-0"><span className="workout-floating-label">Distance (km)</span><input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} distance`}',
  )
  next = next.replaceAll(
    'onChange={(event) => onChange(exercise.id, set.id, "distance", event.target.value)}/> : null}</div>',
    'onChange={(event) => onChange(exercise.id, set.id, "distance", event.target.value)}/></div> : null}</div>',
  )

  // “Last” reads as quieter reference information than “Prev.” in every set.
  next = next.replaceAll('>Prev. {set.previousReps}</span>', '>Last {set.previousReps}</span>')
  next = next.replaceAll('>Prev. {set.previousWeight}</span>', '>Last {set.previousWeight}</span>')

  return next
}

export function setFieldFloatingLabelsBuildPlugin() {
  return {
    name: 'set-field-floating-labels',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code)
      return null
    },
  }
}
