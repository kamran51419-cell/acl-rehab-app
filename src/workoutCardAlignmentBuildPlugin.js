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

  /* Keep set cards looking like the existing UI, but put field labels once at
     the top of the set block instead of repeating them inside every row. */
  const tickSetList = '<div className="mt-3 space-y-2">{exercise.recordedSets.map((set) =>'
  if (!card.includes(tickSetList)) throw new Error(`Workout card alignment transform could not find tick set list in ${id}`)
  card = card.replace(
    tickSetList,
    '<div className="mt-3 space-y-2"><div className="workout-set-header grid grid-cols-[3.5rem_minmax(0,1fr)_2rem] gap-3 px-3 pb-0.5 text-xs font-medium text-slate-500"><span aria-hidden="true"></span><div className={`grid ${fields.time && fields.distance ? "grid-cols-2 gap-2" : "grid-cols-1"}`}>{isRepsOnly ? <span>Reps</span> : <>{fields.time ? <span>{`Time (${durationUnitLabel})`}</span> : null}{fields.distance ? <span>Distance (km)</span> : null}</>}</div><span aria-hidden="true"></span></div>{exercise.recordedSets.map((set) =>',
  )

  const weightedSetList = '<div className="mt-3 space-y-2">{(exercise.recordedSets || []).map((set) =>'
  if (!card.includes(weightedSetList)) throw new Error(`Workout card alignment transform could not find weighted set list in ${id}`)
  card = card.replace(
    weightedSetList,
    '<div className="mt-3 space-y-2"><div className="workout-set-header grid grid-cols-[3.25rem_minmax(0,1fr)_minmax(0,1fr)] gap-2 px-3 pb-0.5 text-xs font-medium text-slate-500"><span aria-hidden="true"></span><span>{fields.reps ? "Reps" : fields.time ? `Time (${durationUnitLabel})` : fields.distance ? "Distance (km)" : ""}</span><span>{isWeighted ? "Weight (kg)" : ""}</span></div>{(exercise.recordedSets || []).map((set) =>',
  )

  card = card.replace(
    'const isSetTickExercise = !isWeighted && (isRepsOnly || fields.time || fields.distance) && (exercise.recordedSets || []).length > 0;',
    'const isSetTickExercise = !isWeighted && (isRepsOnly || fields.time || fields.distance) && (exercise.recordedSets || []).length > 0; const durationUnit = exercise.prescription?.durationUnit === "minutes" ? "minutes" : "seconds"; const durationScale = durationUnit === "minutes" ? 60 : 1; const durationUnitLabel = durationUnit === "minutes" ? "min" : "sec"; const prescribedDurationValue = Number(exercise.prescription?.targetDurationSeconds || 0) / durationScale;',
  )

  card = card.replace(
    'className="grid grid-cols-[3.5rem_minmax(0,1fr)_2rem] items-center gap-3 rounded-xl bg-slate-50 p-3"',
    'className="workout-set-tick-row grid grid-cols-[3.5rem_minmax(0,1fr)_2rem] items-start gap-3 rounded-xl bg-slate-50 p-3"',
  )

  /* Reps-only: no repeated label inside each row. */
  card = card.replace(
    '<div className="flex items-center gap-2"><div className="min-w-0 flex-1"><RepsInput exercise={exercise} set={set} onChange={onChange}/></div><span className="text-sm">reps</span></div>',
    '<div className="min-w-0"><RepsInput exercise={exercise} set={set} onChange={onChange}/></div>',
  )

  /* Time and distance use the same editable field treatment as reps. Time is
     displayed in the programme-selected unit but stored as seconds. */
  card = card.replace(
    '<span className="text-sm font-medium">{[fields.time ? prescribedDuration : null, fields.distance && prescribedDistance !== undefined ? `${prescribedDistance} km` : null].filter(Boolean).join(" · ")}</span>',
    '<div className={`grid min-w-0 ${fields.time && fields.distance ? "grid-cols-2 gap-2" : "grid-cols-1"}`}>{fields.time ? <input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} time`} inputMode="decimal" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3" value={set.durationSeconds !== "" && set.durationSeconds !== undefined && set.durationSeconds !== null ? Number(set.durationSeconds) / durationScale : prescribedDurationValue || ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(exercise.id, set.id, "durationSeconds", event.target.value === "" ? "" : Number(event.target.value) * durationScale)}/> : null}{fields.distance ? <input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} distance`} inputMode="decimal" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3" value={set.rawDistance !== undefined && set.rawDistance !== "" ? set.rawDistance : set.distance !== undefined && set.distance !== "" ? set.distance : prescribedDistance ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(exercise.id, set.id, "distance", event.target.value)}/> : null}</div>',
  )

  /* Weighted rows already have two editable fields; remove their repeated
     labels now that the block has one shared header. */
  card = card.replace(
    '<label className="text-xs font-medium">Reps<div className="mt-1"><RepsInput exercise={exercise} set={set} onChange={onChange}/></div></label>',
    '<div className="min-w-0"><RepsInput exercise={exercise} set={set} onChange={onChange}/></div>',
  )

  card = card.replace(
    '<label className="text-xs font-medium">Time<div className="mt-1 flex h-10 items-center rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm">{prescribedDuration}</div></label>',
    '<div className="min-w-0"><input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} time`} inputMode="decimal" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3" value={set.durationSeconds !== "" && set.durationSeconds !== undefined && set.durationSeconds !== null ? Number(set.durationSeconds) / durationScale : prescribedDurationValue || ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(exercise.id, set.id, "durationSeconds", event.target.value === "" ? "" : Number(event.target.value) * durationScale)}/></div>',
  )

  card = card.replace(
    '<label className="text-xs font-medium">Weight (kg)<input inputMode="decimal" className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3" value={set.rawWeight ?? set.weight ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(exercise.id, set.id, "weight", event.target.value)}/>{set.previousWeight !== undefined && set.previousWeight !== "" ? <span className="mt-1 block text-[11px] font-normal text-slate-400">Prev. {set.previousWeight}</span> : null}</label>',
    '<div className="min-w-0"><input inputMode="decimal" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3" value={set.rawWeight ?? set.weight ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(exercise.id, set.id, "weight", event.target.value)}/>{set.previousWeight !== undefined && set.previousWeight !== "" ? <span className="mt-1 block text-[11px] font-normal text-slate-400">Prev. {set.previousWeight}</span> : null}</div>',
  )

  /* Set labels align to the 40px inputs, regardless of Prev. text. */
  card = card.replace(
    '<span className="pt-7 text-sm font-medium">Set {set.setNumber}</span>',
    '<span className="pt-2.5 text-sm font-medium leading-5">Set {set.setNumber}</span>',
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
