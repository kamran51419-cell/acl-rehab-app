function replaceOnce(code, oldText, newText, id) {
  if (!code.includes(oldText)) {
    throw new Error(`Time + Weight transform could not find expected source in ${id}`)
  }
  return code.replace(oldText, newText)
}

function transformPlans(code, id) {
  let next = code
  next = replaceOnce(next,
    '  TIME: "time",\n  DISTANCE: "distance",',
    '  TIME: "time",\n  TIME_WEIGHT: "time_weight",\n  DISTANCE: "distance",', id)
  next = replaceOnce(next,
    '  if (exerciseType === EXERCISE_TYPE.STRENGTH) return [EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT];',
    '  if (exerciseType === EXERCISE_TYPE.STRENGTH) return [EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT, EXERCISE_LOGGING_METHOD.TIME, EXERCISE_LOGGING_METHOD.TIME_WEIGHT];', id)
  next = replaceOnce(next,
    '  if ([EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT].includes(loggingMethod)) return createStrengthPrescription();\n  if (loggingMethod === EXERCISE_LOGGING_METHOD.INTERVALS) return createIntervalPrescription();',
    '  if ([EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT].includes(loggingMethod)) return createStrengthPrescription();\n  if (loggingMethod === EXERCISE_LOGGING_METHOD.TIME_WEIGHT) return createTimedHoldPrescription();\n  if (loggingMethod === EXERCISE_LOGGING_METHOD.INTERVALS) return createIntervalPrescription();', id)
  next = replaceOnce(next,
    '  if (loggingMethod === EXERCISE_LOGGING_METHOD.TIME && exerciseType === EXERCISE_TYPE.CARDIO) return createCardioPrescription();',
    '  if (loggingMethod === EXERCISE_LOGGING_METHOD.TIME && exerciseType === EXERCISE_TYPE.STRENGTH) return createTimedHoldPrescription();\n  if (loggingMethod === EXERCISE_LOGGING_METHOD.TIME && exerciseType === EXERCISE_TYPE.OTHER) return { targetSets: 3, targetDurationSeconds: 60, durationUnit: "seconds" };\n  if (loggingMethod === EXERCISE_LOGGING_METHOD.TIME && exerciseType === EXERCISE_TYPE.CARDIO) return createCardioPrescription();', id)
  next = replaceOnce(next,
    'function validateCardio(exercise, path, errors) {',
    'function validateSetDuration(exercise, path, errors, { requireSide = false } = {}) {\n  const prescription = exercise.prescription || {};\n  if (requireSide && ![SIDE.BOTH, SIDE.SEPARATE, SIDE.LEFT, SIDE.RIGHT].includes(prescription.side)) errors.push(`${path} has an invalid side.`);\n  if (!positiveInt(prescription.targetSets)) errors.push(`${path} must have at least one set.`);\n  if (!positiveInt(prescription.targetDurationSeconds)) errors.push(`${path} duration must be a positive whole number of seconds.`);\n}\n\nfunction validateCardio(exercise, path, errors) {', id)
  next = replaceOnce(next,
    '      if (exercise.exerciseType === EXERCISE_TYPE.STRENGTH) validateStrength(exercise, path, errors);',
    '      if (exercise.exerciseType === EXERCISE_TYPE.STRENGTH) {\n        if ([EXERCISE_LOGGING_METHOD.TIME, EXERCISE_LOGGING_METHOD.TIME_WEIGHT].includes(method)) validateSetDuration(exercise, path, errors, { requireSide: true });\n        else validateStrength(exercise, path, errors);\n      }', id)
  next = replaceOnce(next,
    '      else if (exercise.exerciseType === EXERCISE_TYPE.OTHER && [EXERCISE_LOGGING_METHOD.TIME, EXERCISE_LOGGING_METHOD.DISTANCE, EXERCISE_LOGGING_METHOD.INTERVALS].includes(method)) validateCardio(exercise, path, errors);',
    '      else if (exercise.exerciseType === EXERCISE_TYPE.OTHER && method === EXERCISE_LOGGING_METHOD.TIME) validateSetDuration(exercise, path, errors);\n      else if (exercise.exerciseType === EXERCISE_TYPE.OTHER && [EXERCISE_LOGGING_METHOD.DISTANCE, EXERCISE_LOGGING_METHOD.INTERVALS].includes(method)) validateCardio(exercise, path, errors);', id)
  next = replaceOnce(next,
    '  if (type === EXERCISE_TYPE.STRENGTH || type === EXERCISE_TYPE.PLYOMETRIC) {\n    const prescriptions = exercise.prescription?.blocks ? sortByOrder(exercise.prescription.blocks) : [exercise.prescription || {}];',
    '  if (type === EXERCISE_TYPE.STRENGTH && [EXERCISE_LOGGING_METHOD.TIME, EXERCISE_LOGGING_METHOD.TIME_WEIGHT].includes(exercise.loggingMethod)) {\n    const side = exercise.prescription?.side === SIDE.LEFT ? "left" : exercise.prescription?.side === SIDE.RIGHT ? "right" : "both";\n    return `${exercise.prescription?.targetSets || 0} × ${durationSummary(exercise.prescription?.targetDurationSeconds, exercise.prescription?.durationUnit)} ${side}`;\n  }\n  if (type === EXERCISE_TYPE.STRENGTH || type === EXERCISE_TYPE.PLYOMETRIC) {\n    const prescriptions = exercise.prescription?.blocks ? sortByOrder(exercise.prescription.blocks) : [exercise.prescription || {}];', id)
  next = replaceOnce(next,
    '    if (exercise.loggingMethod === EXERCISE_LOGGING_METHOD.TIME) return durationSummary(exercise.prescription?.targetDurationSeconds, exercise.prescription?.durationUnit);',
    '    if (exercise.loggingMethod === EXERCISE_LOGGING_METHOD.TIME) return `${exercise.prescription?.targetSets || 0} × ${durationSummary(exercise.prescription?.targetDurationSeconds, exercise.prescription?.durationUnit)}`;', id)
  return next
}

function transformPlansScreen(code, id) {
  let next = code
  next = replaceOnce(next,
    '  [EXERCISE_LOGGING_METHOD.TIME]: "Time",\n  [EXERCISE_LOGGING_METHOD.DISTANCE]: "Distance",',
    '  [EXERCISE_LOGGING_METHOD.TIME]: "Time",\n  [EXERCISE_LOGGING_METHOD.TIME_WEIGHT]: "Time + Weight",\n  [EXERCISE_LOGGING_METHOD.DISTANCE]: "Distance",', id)
  next = replaceOnce(next,
    '  if (selectedMethod === EXERCISE_LOGGING_METHOD.TIME) {',
    '  if ([EXERCISE_LOGGING_METHOD.TIME, EXERCISE_LOGGING_METHOD.TIME_WEIGHT].includes(selectedMethod)) {', id)
  next = replaceOnce(next,
    '    if (exercise.exerciseType === EXERCISE_TYPE.BALANCE || exercise.exerciseType === EXERCISE_TYPE.TIMED_HOLD) {',
    '    if ([EXERCISE_TYPE.STRENGTH, EXERCISE_TYPE.BALANCE, EXERCISE_TYPE.TIMED_HOLD].includes(exercise.exerciseType)) {', id)
  next = replaceOnce(next,
    '    return <div className="space-y-3"><div className="max-w-xs">{methodField}</div>{duration}</div>;\n  }',
    '    if (exercise.exerciseType === EXERCISE_TYPE.OTHER) {\n      return <div className="space-y-3"><div className="max-w-xs">{methodField}</div><div className="grid gap-3 md:grid-cols-2"><Field label="Sets"><Input inputMode="numeric" value={p.targetSets || ""} onChange={(event) => updatePrescription({ ...p, targetSets: Number(event.target.value) })} /></Field>{duration}</div></div>;\n    }\n    return <div className="space-y-3"><div className="max-w-xs">{methodField}</div>{duration}</div>;\n  }', id)
  return next
}

function transformWorkoutDisplay(code, id) {
  return replaceOnce(code,
    '\nexport function groupSessionExercises(exercises = []) {',
    '\nexport function previousSetValuesForExercise(workouts = [], target) {\n  const exerciseId = typeof target === "string" ? target : target.exerciseId;\n  const targetId = typeof target === "string" ? undefined : target.id;\n  const targetSide = typeof target === "string" ? undefined : resolveWorkoutExerciseSide(target);\n  const ordered = workouts.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));\n  const candidates = ordered.flatMap((workout) => (workout.exercises || []).filter((item) => item.exerciseId === exerciseId).map((exercise) => ({ exercise, sameIdentity: Boolean(targetId && exercise.id === targetId) })));\n  const explicit = candidates.filter(({ exercise }) => resolveWorkoutExerciseSide(exercise) === targetSide && (targetSide !== undefined || resolveWorkoutExerciseSide(exercise) === undefined)).sort((a, b) => Number(b.sameIdentity) - Number(a.sameIdentity));\n  const legacy = candidates.filter(({ exercise }) => resolveWorkoutExerciseSide(exercise) === undefined);\n  const match = explicit[0] || (explicit.length === 0 && legacy.length === 1 ? legacy[0] : undefined);\n  if (!match) return {};\n  const sets = match.exercise?.recordedSets?.length ? match.exercise.recordedSets : (match.exercise?.prescriptionBlocks || []).flatMap((block) => block.actualSets || []);\n  const prescribed = typeof target === "string" ? {} : target.prescription?.targetReps || {};\n  const prescribedValue = prescribed.type === "range" ? Number(prescribed.min) : Number(prescribed.value);\n  return Object.fromEntries(sets.map((set, index) => {\n    const setNumber = Number(set.setNumber || index + 1);\n    const weight = Number.isFinite(Number(set.weight)) ? Number(set.weight) : "";\n    const actualReps = Number(set.actualReps ?? set.rawReps);\n    const repsChanged = Number.isFinite(actualReps) && Number.isFinite(prescribedValue) && actualReps !== prescribedValue;\n    return [setNumber, { weight, previousReps: repsChanged ? actualReps : "" }];\n  }));\n}\n\nexport function groupSessionExercises(exercises = []) {', id)
}

function transformWorkoutScreen(code, id) {
  let next = code
  next = replaceOnce(next,
    'durationLabel, previousWeightsForExercise, resolveWorkoutExerciseSide, sessionWorkoutStatus, workoutExerciseSideLabel',
    'durationLabel, previousSetValuesForExercise, previousWeightsForExercise, resolveWorkoutExerciseSide, sessionWorkoutStatus, workoutExerciseSideLabel', id)
  next = replaceOnce(next,
    'if (exercise?.loggingMethod === EXERCISE_LOGGING_METHOD.REPS_WEIGHT) return sets.some(hasWeight);',
    'if ([EXERCISE_LOGGING_METHOD.REPS_WEIGHT, EXERCISE_LOGGING_METHOD.TIME_WEIGHT].includes(exercise?.loggingMethod)) return sets.some(hasWeight);', id)
  next = replaceOnce(next,
    'function fieldsFor(method) { return { reps: [EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT].includes(method), weight: method === EXERCISE_LOGGING_METHOD.REPS_WEIGHT, time: [EXERCISE_LOGGING_METHOD.TIME, EXERCISE_LOGGING_METHOD.TIME_DISTANCE].includes(method), distance: [EXERCISE_LOGGING_METHOD.DISTANCE, EXERCISE_LOGGING_METHOD.TIME_DISTANCE].includes(method) }; }',
    'function fieldsFor(method) { return { reps: [EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT].includes(method), weight: [EXERCISE_LOGGING_METHOD.REPS_WEIGHT, EXERCISE_LOGGING_METHOD.TIME_WEIGHT].includes(method), time: [EXERCISE_LOGGING_METHOD.TIME, EXERCISE_LOGGING_METHOD.TIME_WEIGHT, EXERCISE_LOGGING_METHOD.TIME_DISTANCE].includes(method), distance: [EXERCISE_LOGGING_METHOD.DISTANCE, EXERCISE_LOGGING_METHOD.TIME_DISTANCE].includes(method) }; }', id)
  next = replaceOnce(next,
    '{fields.reps ? <label className="text-xs font-medium">Reps<RepsInput exercise={exercise} set={set} onChange={onChange}/></label> : null}{isWeighted ? <label className="text-xs font-medium">Weight (kg)<input inputMode="decimal" className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3" value={set.rawWeight ?? set.weight ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(exercise.id, set.id, "weight", event.target.value)}/>{set.previousWeight !== undefined && set.previousWeight !== "" ? <span className="mt-1 block text-[11px] font-normal text-slate-400">Prev. {set.previousWeight}</span> : null}</label> : null}',
    '{fields.reps ? <label className="text-xs font-medium">Reps<div className="mt-1"><RepsInput exercise={exercise} set={set} onChange={onChange}/></div><span className={`mt-1 block h-4 text-[11px] font-normal text-slate-400 ${set.previousReps !== undefined && set.previousReps !== "" ? "" : "invisible"}`}>Prev. {set.previousReps || "—"}</span></label> : fields.time ? <label className="text-xs font-medium">Time<div className="mt-1 flex h-10 items-center rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm">{prescribedDuration}</div><span className="mt-1 block h-4 invisible text-[11px]">—</span></label> : null}{isWeighted ? <label className="text-xs font-medium">Weight (kg)<input inputMode="decimal" className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3" value={set.rawWeight ?? set.weight ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(exercise.id, set.id, "weight", event.target.value)}/><span className={`mt-1 block h-4 text-[11px] font-normal text-slate-400 ${set.previousWeight !== undefined && set.previousWeight !== "" ? "" : "invisible"}`}>Prev. {set.previousWeight || "—"}</span></label> : null}', id)
  next = replaceOnce(next,
    'grid items-end gap-2 rounded-xl bg-slate-50 p-3',
    'grid items-start gap-2 rounded-xl bg-slate-50 p-3', id)
  next = replaceOnce(next,
    '<span className="pb-2 text-sm font-medium">Set {set.setNumber}</span>',
    '<span className="pt-7 text-sm font-medium">Set {set.setNumber}</span>', id)
  next = next.replaceAll('previousWeightsForExercise(workouts.filter((item) => item.status === "completed"), exercise)', 'previousSetValuesForExercise(workouts.filter((item) => item.status === "completed"), exercise)')
  return next
}

function transformWorkoutSession(code, id) {
  let next = code
  next = replaceOnce(next,
    '    EXERCISE_LOGGING_METHOD.TIME,\n    EXERCISE_LOGGING_METHOD.DISTANCE,',
    '    EXERCISE_LOGGING_METHOD.TIME,\n    EXERCISE_LOGGING_METHOD.TIME_WEIGHT,\n    EXERCISE_LOGGING_METHOD.DISTANCE,', id)
  next = replaceOnce(next,
    '      previousWeight: previousWeights[index + 1] ?? "",',
    '      previousWeight: [EXERCISE_LOGGING_METHOD.REPS_WEIGHT, EXERCISE_LOGGING_METHOD.TIME_WEIGHT].includes(exercise.loggingMethod) ? previousWeights[index + 1]?.weight ?? previousWeights[index + 1] ?? "" : "",\n      previousReps: previousWeights[index + 1]?.previousReps ?? "",', id)
  next = replaceOnce(next,
    '          previousWeight: "",',
    '          previousWeight: "",\n          previousReps: "",', id)
  next = replaceOnce(next,
    '            previousWeight: set.previousWeight,',
    '            previousWeight: set.previousWeight,\n            previousReps: set.previousReps,', id)
  return next
}

export function timeWeightTrackingBuildPlugin() {
  return {
    name: 'time-weight-tracking',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\', '/')
      if (cleanId.endsWith('/src/lib/domain/plans.js')) return transformPlans(code, id)
      if (cleanId.endsWith('/src/features/plans/PlansScreen.jsx')) return transformPlansScreen(code, id)
      if (cleanId.endsWith('/src/lib/domain/workoutDisplay.js')) return transformWorkoutDisplay(code, id)
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      if (cleanId.endsWith('/src/lib/domain/workoutSession.js')) return transformWorkoutSession(code, id)
      return null
    },
  }
}
