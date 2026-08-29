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

  // Make the programme description visually independent from prescription metadata.
  next = next.replaceAll(
    '<p className="mt-1 text-xs text-slate-500">{exercise.programmeNoteSnapshot}</p>',
    '<p className="workout-programme-description mt-1 text-xs text-slate-500">{exercise.programmeNoteSnapshot}</p>',
  )

  // Reps fields (fixed and range) use one identical outlined control. The
  // input/select lives in its own centred layer so fieldset legend layout cannot
  // push the current value down.
  next = next.replaceAll(
    '<div className="min-w-0"><RepsInput exercise={exercise} set={set} onChange={onChange}/></div>',
    '<fieldset className="workout-floating-field min-w-0"><legend className="workout-floating-label">Reps</legend>{set.previousReps !== undefined && set.previousReps !== "" ? <span className="workout-field-previous">Prev. {set.previousReps}</span> : null}<div className="workout-field-control"><RepsInput exercise={exercise} set={set} onChange={onChange}/></div></fieldset>',
  )

  // Weight uses the same centred layer and matching-set previous reference.
  next = next.replaceAll(
    '<div className="min-w-0"><input inputMode="decimal" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3" value={set.rawWeight ?? set.weight ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(exercise.id, set.id, "weight", event.target.value)}/>{set.previousWeight !== undefined && set.previousWeight !== "" ? <span className="mt-1 block text-[11px] font-normal text-slate-400">Prev. {set.previousWeight}</span> : null}</div>',
    '<fieldset className="workout-floating-field min-w-0"><legend className="workout-floating-label">Weight (kg)</legend>{set.previousWeight !== undefined && set.previousWeight !== "" ? <span className="workout-field-previous">Prev. {set.previousWeight}</span> : null}<div className="workout-field-control"><input inputMode="decimal" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3" value={set.rawWeight ?? set.weight ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(exercise.id, set.id, "weight", event.target.value)}/></div></fieldset>',
  )

  // Time-only weighted fields.
  next = next.replaceAll(
    '<div className="min-w-0"><input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} time`} inputMode="decimal" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3"',
    '<fieldset className="workout-floating-field min-w-0"><legend className="workout-floating-label">Time ({durationUnitLabel})</legend>{set.previousDurationSeconds !== undefined && set.previousDurationSeconds !== "" ? <span className="workout-field-previous">Prev. {Number(set.previousDurationSeconds) / durationScale}</span> : null}<div className="workout-field-control"><input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} time`} inputMode="decimal" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3"',
  )
  next = next.replaceAll(
    'onChange={(event) => onChange(exercise.id, set.id, "durationSeconds", event.target.value === "" ? "" : Number(event.target.value) * durationScale)}/></div>',
    'onChange={(event) => onChange(exercise.id, set.id, "durationSeconds", event.target.value === "" ? "" : Number(event.target.value) * durationScale)}/></div></fieldset>',
  )

  // Time/distance tick rows use the same centred field-control layer.
  next = next.replaceAll(
    '{fields.time ? <input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} time`}',
    '{fields.time ? <fieldset className="workout-floating-field min-w-0"><legend className="workout-floating-label">Time ({durationUnitLabel})</legend>{set.previousDurationSeconds !== undefined && set.previousDurationSeconds !== "" ? <span className="workout-field-previous">Prev. {Number(set.previousDurationSeconds) / durationScale}</span> : null}<div className="workout-field-control"><input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} time`}',
  )
  next = next.replaceAll(
    'onChange={(event) => onChange(exercise.id, set.id, "durationSeconds", event.target.value === "" ? "" : Number(event.target.value) * durationScale)}/> : null}{fields.distance ?',
    'onChange={(event) => onChange(exercise.id, set.id, "durationSeconds", event.target.value === "" ? "" : Number(event.target.value) * durationScale)}/></div></fieldset> : null}{fields.distance ?',
  )
  next = next.replaceAll(
    '{fields.distance ? <input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} distance`}',
    '{fields.distance ? <fieldset className="workout-floating-field min-w-0"><legend className="workout-floating-label">Distance (km)</legend>{set.previousDistance !== undefined && set.previousDistance !== "" ? <span className="workout-field-previous">Prev. {set.previousDistance}</span> : null}<div className="workout-field-control"><input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} distance`}',
  )
  next = next.replaceAll(
    'onChange={(event) => onChange(exercise.id, set.id, "distance", event.target.value)}/> : null}</div>',
    'onChange={(event) => onChange(exercise.id, set.id, "distance", event.target.value)}/></div></fieldset> : null}</div>',
  )

  // RepsInput owns both fixed-rep inputs and range selects. Remove its legacy
  // previous-value line because the fieldset owns that reference for both.
  next = next.replace(
    'return <>{input}{set.previousReps !== undefined && set.previousReps !== "" ? <span className="mt-1 block text-[11px] font-normal text-slate-400">Prev. {set.previousReps}</span> : null}</>;',
    'return input;',
  )

  // Give every set number the same fixed-height alignment container.
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
