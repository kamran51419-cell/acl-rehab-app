function transformWorkoutScreen(code) {
  let next = code

  // Keep the programmed prescription visible in one consistent place for every
  // non-interval measurement type. Prefixes make it distinct from a programme note.
  next = next.replace(
    'const prescribedDistance = exercise.prescription?.targetDistance ?? exercise.prescription?.distance; const isSetTickExercise',
    'const prescribedDistance = exercise.prescription?.targetDistance ?? exercise.prescription?.distance; const prescribedRepsTarget = exercise.prescription?.targetReps; const prescribedRepsText = fields.reps && prescribedRepsTarget !== undefined && prescribedRepsTarget !== null ? (typeof prescribedRepsTarget === "number" ? `Reps: ${prescribedRepsTarget}` : prescribedRepsTarget.type === "range" ? `Range: ${prescribedRepsTarget.min}–${prescribedRepsTarget.max} reps` : prescribedRepsTarget.value !== undefined ? `Reps: ${prescribedRepsTarget.value}` : null) : null; const prescribedTimeText = fields.time && prescribedDuration !== "—" ? `Time: ${prescribedDuration}` : null; const prescribedDistanceText = fields.distance && prescribedDistance !== undefined && prescribedDistance !== null ? `Distance: ${prescribedDistance} km` : null; const prescriptionMeasureSummary = isIntervals ? "" : [prescribedRepsText, prescribedTimeText, prescribedDistanceText].filter(Boolean).join(" · "); const isSetTickExercise',
  )

  next = next.replace(
    '{side || exercise.prescription?.targetReps?.type === "range" ? <p className={hideExerciseName ? "text-sm font-semibold text-slate-700" : "text-xs text-slate-500"}>{[side, exercise.prescription?.targetReps?.type === "range" ? `Range: ${exercise.prescription.targetReps.min}–${exercise.prescription.targetReps.max} reps` : null].filter(Boolean).join(" · ")}</p> : null}{exercise.programmeNoteSnapshot ?',
    '{side ? <p className={hideExerciseName ? "text-sm font-semibold text-slate-700" : "text-xs text-slate-500"}>{side}</p> : null}{prescriptionMeasureSummary ? <p className="workout-prescription-summary mt-1 text-xs font-semibold text-slate-700">{prescriptionMeasureSummary}</p> : null}{exercise.programmeNoteSnapshot ?',
  )

  // Both labels sit in a real segmented top-border rail. No border is ever drawn
  // behind the label text, so there is no mask, halo, dot or line-through artefact.
  next = next.replaceAll(
    '<div className="min-w-0"><RepsInput exercise={exercise} set={set} onChange={onChange}/></div>',
    '<div className="workout-field-shell min-w-0"><div className="workout-floating-field"><div className="workout-field-control"><RepsInput exercise={exercise} set={set} onChange={onChange}/></div></div><div className="workout-field-topline"><span className="workout-topline-segment workout-topline-start"/><span className="workout-border-label">Reps</span><span className="workout-topline-segment workout-topline-middle"/>{set.previousReps !== undefined && set.previousReps !== "" ? <span className="workout-border-label">Prev. {set.previousReps}</span> : null}<span className="workout-topline-segment workout-topline-end"/></div></div>',
  )

  next = next.replaceAll(
    '<div className="min-w-0"><input inputMode="decimal" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3" value={set.rawWeight ?? set.weight ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(exercise.id, set.id, "weight", event.target.value)}/>{set.previousWeight !== undefined && set.previousWeight !== "" ? <span className="mt-1 block text-[11px] font-normal text-slate-400">Prev. {set.previousWeight}</span> : null}</div>',
    '<div className="workout-field-shell min-w-0"><div className="workout-floating-field"><div className="workout-field-control"><input inputMode="decimal" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3" value={set.rawWeight ?? set.weight ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(exercise.id, set.id, "weight", event.target.value)}/></div></div><div className="workout-field-topline"><span className="workout-topline-segment workout-topline-start"/><span className="workout-border-label">Weight (kg)</span><span className="workout-topline-segment workout-topline-middle"/>{set.previousWeight !== undefined && set.previousWeight !== "" ? <span className="workout-border-label">Prev. {set.previousWeight}</span> : null}<span className="workout-topline-segment workout-topline-end"/></div></div>',
  )

  next = next.replaceAll(
    '<div className="min-w-0"><input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} time`} inputMode="decimal" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3"',
    '<div className="workout-field-shell min-w-0"><div className="workout-floating-field"><div className="workout-field-control"><input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} time`} inputMode="decimal" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3"',
  )
  next = next.replaceAll(
    'onChange={(event) => onChange(exercise.id, set.id, "durationSeconds", event.target.value === "" ? "" : Number(event.target.value) * durationScale)}/></div>',
    'onChange={(event) => onChange(exercise.id, set.id, "durationSeconds", event.target.value === "" ? "" : Number(event.target.value) * durationScale)}/></div></div><div className="workout-field-topline"><span className="workout-topline-segment workout-topline-start"/><span className="workout-border-label">Time ({durationUnitLabel})</span><span className="workout-topline-segment workout-topline-middle"/>{set.previousDurationSeconds !== undefined && set.previousDurationSeconds !== "" ? <span className="workout-border-label">Prev. {Number(set.previousDurationSeconds) / durationScale}</span> : null}<span className="workout-topline-segment workout-topline-end"/></div></div>',
  )

  next = next.replaceAll(
    '{fields.time ? <input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} time`}',
    '{fields.time ? <div className="workout-field-shell min-w-0"><div className="workout-floating-field"><div className="workout-field-control"><input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} time`}',
  )
  next = next.replaceAll(
    'onChange={(event) => onChange(exercise.id, set.id, "durationSeconds", event.target.value === "" ? "" : Number(event.target.value) * durationScale)}/> : null}{fields.distance ?',
    'onChange={(event) => onChange(exercise.id, set.id, "durationSeconds", event.target.value === "" ? "" : Number(event.target.value) * durationScale)}/></div></div><div className="workout-field-topline"><span className="workout-topline-segment workout-topline-start"/><span className="workout-border-label">Time ({durationUnitLabel})</span><span className="workout-topline-segment workout-topline-middle"/>{set.previousDurationSeconds !== undefined && set.previousDurationSeconds !== "" ? <span className="workout-border-label">Prev. {Number(set.previousDurationSeconds) / durationScale}</span> : null}<span className="workout-topline-segment workout-topline-end"/></div></div> : null}{fields.distance ?',
  )
  next = next.replaceAll(
    '{fields.distance ? <input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} distance`}',
    '{fields.distance ? <div className="workout-field-shell min-w-0"><div className="workout-floating-field"><div className="workout-field-control"><input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} distance`}',
  )
  next = next.replaceAll(
    'onChange={(event) => onChange(exercise.id, set.id, "distance", event.target.value)}/> : null}</div>',
    'onChange={(event) => onChange(exercise.id, set.id, "distance", event.target.value)}/></div></div><div className="workout-field-topline"><span className="workout-topline-segment workout-topline-start"/><span className="workout-border-label">Distance (km)</span><span className="workout-topline-segment workout-topline-middle"/>{set.previousDistance !== undefined && set.previousDistance !== "" ? <span className="workout-border-label">Prev. {set.previousDistance}</span> : null}<span className="workout-topline-segment workout-topline-end"/></div></div> : null}</div>',
  )

  // RepsInput owns both fixed-rep inputs and range selects. The field shell now
  // owns previous-performance display for both, so suppress the legacy line.
  next = next.replace(
    'return <>{input}{set.previousReps !== undefined && set.previousReps !== "" ? <span className="mt-1 block text-[11px] font-normal text-slate-400">Prev. {set.previousReps}</span> : null}</>;',
    'return input;',
  )

  next = next.replaceAll(
    '<span className="text-sm font-medium">Set {set.setNumber}</span>',
    '<div className="workout-set-label"><span className="workout-set-number">Set {set.setNumber}</span></div>',
  )
  next = next.replaceAll(
    '<span className="pt-2.5 text-sm font-medium leading-5">Set {set.setNumber}</span>',
    '<div className="workout-set-label"><span className="workout-set-number">Set {set.setNumber}</span></div>',
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
