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

function transformWorkoutScreen(code, id) {
  let next = code
  next = replaceOnce(next,
    'if (exercise?.loggingMethod === EXERCISE_LOGGING_METHOD.REPS_WEIGHT) return sets.some(hasWeight);',
    'if ([EXERCISE_LOGGING_METHOD.REPS_WEIGHT, EXERCISE_LOGGING_METHOD.TIME_WEIGHT].includes(exercise?.loggingMethod)) return sets.some(hasWeight);', id)
  next = replaceOnce(next,
    'function fieldsFor(method) { return { reps: [EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT].includes(method), weight: method === EXERCISE_LOGGING_METHOD.REPS_WEIGHT, time: [EXERCISE_LOGGING_METHOD.TIME, EXERCISE_LOGGING_METHOD.TIME_DISTANCE].includes(method), distance: [EXERCISE_LOGGING_METHOD.DISTANCE, EXERCISE_LOGGING_METHOD.TIME_DISTANCE].includes(method) }; }',
    'function fieldsFor(method) { return { reps: [EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT].includes(method), weight: [EXERCISE_LOGGING_METHOD.REPS_WEIGHT, EXERCISE_LOGGING_METHOD.TIME_WEIGHT].includes(method), time: [EXERCISE_LOGGING_METHOD.TIME, EXERCISE_LOGGING_METHOD.TIME_WEIGHT, EXERCISE_LOGGING_METHOD.TIME_DISTANCE].includes(method), distance: [EXERCISE_LOGGING_METHOD.DISTANCE, EXERCISE_LOGGING_METHOD.TIME_DISTANCE].includes(method) }; }', id)
  next = replaceOnce(next,
    '{fields.reps ? <label className="text-xs font-medium">Reps<RepsInput exercise={exercise} set={set} onChange={onChange}/></label> : null}{isWeighted ? <label className="text-xs font-medium">Weight (kg)<input inputMode="decimal" className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3" value={set.rawWeight ?? set.weight ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(exercise.id, set.id, "weight", event.target.value)}/></label> : null}',
    '{fields.reps ? <label className="text-xs font-medium">Reps<RepsInput exercise={exercise} set={set} onChange={onChange}/></label> : fields.time ? <label className="text-xs font-medium">Time<div className="mt-1 flex h-10 items-center rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm">{prescribedDuration}</div></label> : null}{isWeighted ? <label className="text-xs font-medium">Weight (kg)<input inputMode="decimal" className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3" value={set.rawWeight ?? set.weight ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(exercise.id, set.id, "weight", event.target.value)}/></label> : null}', id)
  return next
}

function transformWorkoutSession(code, id) {
  let next = code
  next = replaceOnce(next,
    '    EXERCISE_LOGGING_METHOD.TIME,\n    EXERCISE_LOGGING_METHOD.DISTANCE,',
    '    EXERCISE_LOGGING_METHOD.TIME,\n    EXERCISE_LOGGING_METHOD.TIME_WEIGHT,\n    EXERCISE_LOGGING_METHOD.DISTANCE,', id)
  next = replaceOnce(next,
    '      weight: exercise.loggingMethod === EXERCISE_LOGGING_METHOD.REPS_WEIGHT ? previousWeights[index + 1] ?? "" : "",',
    '      weight: [EXERCISE_LOGGING_METHOD.REPS_WEIGHT, EXERCISE_LOGGING_METHOD.TIME_WEIGHT].includes(exercise.loggingMethod) ? previousWeights[index + 1] ?? "" : "",', id)
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
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      if (cleanId.endsWith('/src/lib/domain/workoutSession.js')) return transformWorkoutSession(code, id)
      return null
    },
  }
}
