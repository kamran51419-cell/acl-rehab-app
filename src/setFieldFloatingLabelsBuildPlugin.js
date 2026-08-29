function transformWorkoutScreen(code) {
  let next = code

  // Reps fields (both reps-only and weighted layouts). Fieldset/legend creates
  // a real gap in the outline, so there is no coloured patch behind the label.
  next = next.replaceAll(
    '<div className="min-w-0"><RepsInput exercise={exercise} set={set} onChange={onChange}/></div>',
    '<fieldset className="workout-floating-field min-w-0"><legend className="workout-floating-label">Reps</legend><RepsInput exercise={exercise} set={set} onChange={onChange}/></fieldset>',
  )

  // Weight fields use the same outlined treatment. Previous performance is
  // deliberately not rendered inside the field; it belongs to the set column.
  next = next.replaceAll(
    '<div className="min-w-0"><input inputMode="decimal" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3" value={set.rawWeight ?? set.weight ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(exercise.id, set.id, "weight", event.target.value)}/>{set.previousWeight !== undefined && set.previousWeight !== "" ? <span className="mt-1 block text-[11px] font-normal text-slate-400">Prev. {set.previousWeight}</span> : null}</div>',
    '<fieldset className="workout-floating-field min-w-0"><legend className="workout-floating-label">Weight (kg)</legend><input inputMode="decimal" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3" value={set.rawWeight ?? set.weight ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(exercise.id, set.id, "weight", event.target.value)}/></fieldset>',
  )

  // Time-only weighted fields.
  next = next.replaceAll(
    '<div className="min-w-0"><input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} time`} inputMode="decimal" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3"',
    '<fieldset className="workout-floating-field min-w-0"><legend className="workout-floating-label">Time ({durationUnitLabel})</legend><input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} time`} inputMode="decimal" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3"',
  )
  next = next.replaceAll(
    'onChange={(event) => onChange(exercise.id, set.id, "durationSeconds", event.target.value === "" ? "" : Number(event.target.value) * durationScale)}/></div>',
    'onChange={(event) => onChange(exercise.id, set.id, "durationSeconds", event.target.value === "" ? "" : Number(event.target.value) * durationScale)}/></fieldset>',
  )

  // Time/distance tick rows can contain one or both editable fields.
  next = next.replaceAll(
    '{fields.time ? <input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} time`}',
    '{fields.time ? <fieldset className="workout-floating-field min-w-0"><legend className="workout-floating-label">Time ({durationUnitLabel})</legend><input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} time`}',
  )
  next = next.replaceAll(
    'onChange={(event) => onChange(exercise.id, set.id, "durationSeconds", event.target.value === "" ? "" : Number(event.target.value) * durationScale)}/> : null}{fields.distance ?',
    'onChange={(event) => onChange(exercise.id, set.id, "durationSeconds", event.target.value === "" ? "" : Number(event.target.value) * durationScale)}/></fieldset> : null}{fields.distance ?',
  )
  next = next.replaceAll(
    '{fields.distance ? <input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} distance`}',
    '{fields.distance ? <fieldset className="workout-floating-field min-w-0"><legend className="workout-floating-label">Distance (km)</legend><input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} distance`}',
  )
  next = next.replaceAll(
    'onChange={(event) => onChange(exercise.id, set.id, "distance", event.target.value)}/> : null}</div>',
    'onChange={(event) => onChange(exercise.id, set.id, "distance", event.target.value)}/></fieldset> : null}</div>',
  )

  // The exact set owns its own previous values. If that previous set was not
  // performed, these conditionals render nothing rather than borrowing another set.
  next = next.replaceAll(
    '<span className="text-sm font-medium">Set {set.setNumber}</span>',
    '<div className="workout-set-label"><span className="workout-set-number">Set {set.setNumber}</span>{set.previousReps !== undefined && set.previousReps !== "" ? <span className="workout-set-previous">Prev. {set.previousReps} reps</span> : null}</div>',
  )
  next = next.replaceAll(
    '<span className="pt-2.5 text-sm font-medium leading-5">Set {set.setNumber}</span>',
    '<div className="workout-set-label"><span className="workout-set-number">Set {set.setNumber}</span>{set.previousReps !== undefined && set.previousReps !== "" || set.previousWeight !== undefined && set.previousWeight !== "" ? <span className="workout-set-previous">Prev. {[set.previousReps !== undefined && set.previousReps !== "" ? `${set.previousReps} reps` : null, set.previousWeight !== undefined && set.previousWeight !== "" ? `${set.previousWeight} kg` : null].filter(Boolean).join(" · ")}</span> : null}</div>',
  )

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
