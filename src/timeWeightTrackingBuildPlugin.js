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

function transformWorkoutDisplay(code) {
  return code
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
    '{fields.reps ? <label className="text-xs font-medium">Reps<RepsInput exercise={exercise} set={set} onChange={onChange}/></label> : null}{isWeighted ? <label className="text-xs font-medium">Weight (kg)<input inputMode="decimal" className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3" value={set.rawWeight ?? set.weight ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(exercise.id, set.id, "weight", event.target.value)}/>{set.previousWeight !== undefined && set.previousWeight !== "" ? <span className="mt-1 block text-[11px] font-normal text-slate-400">Prev. {set.previousWeight}</span> : null}</label> : null}',
    '{fields.reps ? <label className="text-xs font-medium">Reps<div className="mt-1"><RepsInput exercise={exercise} set={set} onChange={onChange}/></div></label> : fields.time ? <label className="text-xs font-medium">Time<div className="mt-1 flex h-10 items-center rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm">{prescribedDuration}</div></label> : null}{isWeighted ? <label className="text-xs font-medium">Weight (kg)<input inputMode="decimal" className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3" value={set.rawWeight ?? set.weight ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(exercise.id, set.id, "weight", event.target.value)}/>{set.previousWeight !== undefined && set.previousWeight !== "" ? <span className="mt-1 block text-[11px] font-normal text-slate-400">Prev. {set.previousWeight}</span> : null}</label> : null}', id)
  next = replaceOnce(next,
    'grid items-end gap-2 rounded-xl bg-slate-50 p-3',
    'grid items-start gap-2 rounded-xl bg-slate-50 p-3', id)
  next = replaceOnce(next,
    '<span className="pb-2 text-sm font-medium">Set {set.setNumber}</span>',
    '<span className="pt-7 text-sm font-medium">Set {set.setNumber}</span>', id)

  next = replaceOnce(next,
    'import { Check, ChevronDown, ChevronRight, ChevronUp, Dumbbell } from "lucide-react";',
    'import { Check, ChevronDown, ChevronRight, ChevronUp, Dumbbell, MoreHorizontal, Plus, Search } from "lucide-react";', id)
  next = replaceOnce(next,
    'import { EXERCISE_LOGGING_METHOD, EXERCISE_TYPE, planPrescriptionSummary } from "../../lib/domain/plans";',
    'import { createDefaultPrescription, defaultLoggingMethodForExerciseType, EXERCISE_LOGGING_METHOD, EXERCISE_TYPE, filterExerciseLibrary, planPrescriptionSummary } from "../../lib/domain/plans";', id)
  next = replaceOnce(next,
    'import { addRecordedSet, completeWorkout, createDebouncedSaver, createInProgressWorkout, isMeaningfulWorkout, removeRecordedSet, resumeWorkout, updateRecordedSet } from "../../lib/domain/workoutSession";',
    'import { addRecordedSet, completeWorkout, createDebouncedSaver, createInProgressWorkout, createWorkoutExerciseSnapshot, isMeaningfulWorkout, removeRecordedSet, resumeWorkout, updateRecordedSet } from "../../lib/domain/workoutSession";', id)
  next = replaceOnce(next,
    'const supportsSides = (exercise) => [EXERCISE_TYPE.STRENGTH, EXERCISE_TYPE.BALANCE].includes(exercise?.exerciseType);',
    'const supportsSides = (exercise) => [EXERCISE_TYPE.STRENGTH, EXERCISE_TYPE.BALANCE].includes(exercise?.exerciseType);\nconst EQUIPMENT_OPTIONS = [["", "Not specified"], ["machine", "Machine"], ["cable", "Cable"], ["free_weight", "Free weight"]];\nfunction definitionType(definition) { return definition?.exerciseType || definition?.trackingType || EXERCISE_TYPE.STRENGTH; }\nfunction linkedExerciseIds(workout, exerciseId) { const target = (workout?.exercises || []).find((exercise) => exercise.id === exerciseId); if (!target || ![SIDE.LEFT, SIDE.RIGHT].includes(target.sideSnapshot)) return [exerciseId]; const match = String(exerciseId).match(/^(.*)-(left|right)$/); if (!match) return [exerciseId]; const oppositeSide = target.sideSnapshot === SIDE.LEFT ? SIDE.RIGHT : SIDE.LEFT; const counterpartId = `${match[1]}-${oppositeSide}`; const counterpart = (workout.exercises || []).find((exercise) => exercise.id === counterpartId && exercise.exerciseId === target.exerciseId && exercise.sideSnapshot === oppositeSide); return counterpart ? [exerciseId, counterpartId] : [exerciseId]; }\nfunction withWorkoutOverrides(workout) { return workout ? { ...workout, workoutOverrides: true } : workout; }\nfunction addSetToLinkedExercise(workout, exerciseId) { return linkedExerciseIds(workout, exerciseId).reduce((current, linkedId) => addRecordedSet(current, linkedId), workout); }\nfunction removeSetFromLinkedExercise(workout, exerciseId) { return linkedExerciseIds(workout, exerciseId).reduce((current, linkedId) => { const exercise = current.exercises.find((item) => item.id === linkedId); const sets = exercise?.recordedSets || []; return sets.length > 1 ? removeRecordedSet(current, linkedId, sets[sets.length - 1].id) : current; }, workout); }\nfunction removeLinkedExercise(workout, exerciseId) { const ids = new Set(linkedExerciseIds(workout, exerciseId)); return { ...workout, exercises: workout.exercises.filter((exercise) => !ids.has(exercise.id)).map((exercise, index) => ({ ...exercise, sortOrder: index })) }; }\nfunction setLinkedEquipment(workout, exerciseId, equipmentType) { const ids = new Set(linkedExerciseIds(workout, exerciseId)); return { ...workout, exercises: workout.exercises.map((exercise) => ids.has(exercise.id) ? { ...exercise, equipmentType } : exercise) }; }', id)
  next = replaceOnce(next,
    '\nexport function ExerciseCard({ exercise, oneOff, onChange, onAddSet, onRemoveSet, onRemoveExercise, onMove, index, total, hideExerciseName = false }) {',
    '\nfunction WorkoutExercisePicker({ exercises, replacing, onCancel, onChoose }) {\n  const [query, setQuery] = useState("");\n  const available = useMemo(() => filterExerciseLibrary(exercises, { query }).filter((definition) => !replacing || definitionType(definition) === replacing.exerciseType), [exercises, query, replacing]);\n  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-3 sm:items-center"><section className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl"><div className="border-b border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{replacing ? "Change exercise" : "Add exercise"}</h2>{replacing ? <p className="text-xs text-slate-500">Choose another {replacing.exerciseType} exercise. This changes this workout only.</p> : <p className="text-xs text-slate-500">This adds an exercise to this workout only.</p>}</div><button type="button" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100" onClick={onCancel}>Cancel</button></div><label className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400"/><input autoFocus className="min-w-0 flex-1 outline-none" placeholder="Search exercises" value={query} onChange={(event) => setQuery(event.target.value)}/></label></div><div className="max-h-[55vh] overflow-y-auto p-3">{available.length ? <div className="space-y-2">{available.map((definition) => <button type="button" key={definition.id} onClick={() => onChoose(definition)} className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50"><span><span className="block font-medium">{definition.name}</span><span className="text-xs capitalize text-slate-500">{definitionType(definition).replaceAll("_", " ")}</span></span><span className="text-sm font-medium text-blue-600">{replacing ? "Choose" : "Add"}</span></button>)}</div> : <p className="p-6 text-center text-sm text-slate-500">No matching exercises.</p>}</div></section></div>;\n}\n\nexport function ExerciseCard({ exercise, oneOff, onChange, onAddSet, onRemoveSet, onRemoveExercise, onChangeExercise, onEquipment, onMove, index, total, hideExerciseName = false }) {\n  const [actionsOpen, setActionsOpen] = useState(false);', id)
  next = replaceOnce(next,
    'const isSetTickExercise = !isWeighted && (isRepsOnly || fields.time || fields.distance) && (exercise.recordedSets || []).length > 0;\n  return',
    'const isSetTickExercise = !isWeighted && (isRepsOnly || fields.time || fields.distance) && (exercise.recordedSets || []).length > 0;\n  const setCount = (exercise.recordedSets || []).length;\n  return', id)
  next = replaceOnce(next,
    '{exercise.programmeNoteSnapshot ? <p className="mt-1 text-xs text-slate-500">{exercise.programmeNoteSnapshot}</p> : null}</div>',
    '{exercise.programmeNoteSnapshot ? <p className="mt-1 text-xs text-slate-500">{exercise.programmeNoteSnapshot}</p> : null}{exercise.exerciseType === EXERCISE_TYPE.STRENGTH && onEquipment ? <label className="mt-2 block max-w-44 text-xs font-medium text-slate-500">Equipment<select aria-label={`${exercise.exerciseNameSnapshot} equipment`} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700" value={exercise.equipmentType || ""} onChange={(event) => onEquipment(exercise.id, event.target.value)}>{EQUIPMENT_OPTIONS.map(([value, label]) => <option key={value || "unspecified"} value={value}>{label}</option>)}</select></label> : null}</div>', id)
  next = replaceOnce(next,
    '{oneOff ? <button type="button" onClick={() => onRemoveExercise(exercise.id)} className="min-h-10 px-2 text-sm font-medium text-red-600">Remove</button> : null}</div>',
    '{onChangeExercise || onRemoveExercise ? <div className="relative"><button type="button" aria-label={`Edit ${exercise.exerciseNameSnapshot}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setActionsOpen((value) => !value)}><MoreHorizontal className="h-5 w-5"/></button>{actionsOpen ? <div className="absolute right-0 top-10 z-30 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">{onChangeExercise ? <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setActionsOpen(false); onChangeExercise(exercise); }}>Change exercise</button> : null}{onRemoveExercise ? <button type="button" className="block w-full px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50" onClick={() => { setActionsOpen(false); onRemoveExercise(exercise.id); }}>Delete exercise</button> : null}</div> : null}</div> : oneOff ? <button type="button" onClick={() => onRemoveExercise(exercise.id)} className="min-h-10 px-2 text-sm font-medium text-red-600">Remove</button> : null}</div>', id)
  next = replaceOnce(next,
    '\n  </section>;\n}\n\nfunction changeWorkout',
    '\n    {setCount && !isTask && !isIntervals && (onAddSet || onRemoveSet) ? <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50" onClick={() => onAddSet?.(exercise.id)}>+ Add set</button><button type="button" disabled={setCount <= 1} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => onRemoveSet?.(exercise.id)}>Remove set</button></div> : null}\n  </section>;\n}\n\nfunction changeWorkout', id)
  next = replaceOnce(next,
    'export function WorkoutForm({ workout, saveStatus, finishing, finishError, onBack, onChange, onAddSet, onRemoveSet, onRemoveExercise, onReorder, onDate, onNotes, onFinish, onDiscard }) {',
    'export function WorkoutForm({ workout, exerciseLibrary = [], saveStatus, finishing, finishError, onBack, onChange, onAddSet, onRemoveSet, onAddExercise, onReplaceExercise, onRemoveExercise, onEquipment, onReorder, onDate, onNotes, onFinish, onDiscard }) {\n  const [picker, setPicker] = useState(null);', id)
  next = replaceOnce(next,
    'const list = ordered(workout.exercises); const move = (index, direction) => { const target = index + direction; if (target < 0 || target >= list.length) return; const next = list.slice(); [next[index], next[target]] = [next[target], next[index]]; onReorder(next.map((item, itemIndex) => ({ ...item, sortOrder: itemIndex }))); };\n  return <div className="space-y-5">',
    'const list = ordered(workout.exercises); const move = (index, direction) => { const target = index + direction; if (target < 0 || target >= list.length) return; const next = list.slice(); [next[index], next[target]] = [next[target], next[index]]; onReorder(next.map((item, itemIndex) => ({ ...item, sortOrder: itemIndex }))); };\n  const chooseExercise = (definition) => { if (picker?.mode === "replace") onReplaceExercise?.(picker.exercise.id, definition); else onAddExercise?.(definition); setPicker(null); };\n  return <><div className="space-y-5">', id)
  next = replaceOnce(next,
    'onRemoveExercise={onRemoveExercise} onMove={move}/>)}</div><label className="mt-5 block text-sm font-medium">Workout notes',
    'onRemoveExercise={onRemoveExercise} onChangeExercise={() => setPicker({ mode: "replace", exercise })} onEquipment={onEquipment} onMove={move}/>)}</div><Button className="mt-3 w-full" variant="outline" onClick={() => setPicker({ mode: "add" })}><Plus className="mr-1 h-4 w-4"/> Add exercise</Button><label className="mt-5 block text-sm font-medium">Workout notes', id)
  next = replaceOnce(next,
    '</section></div>;\n}\n\nexport function DiscardWorkoutDialog',
    '</section></div>{picker ? <WorkoutExercisePicker exercises={exerciseLibrary} replacing={picker.mode === "replace" ? picker.exercise : null} onCancel={() => setPicker(null)} onChoose={chooseExercise}/> : null}</>;\n}\n\nexport function DiscardWorkoutDialog', id)
  next = replaceOnce(next,
    'const syncSavedWithProgramme = useCallback((saved) => { if (!saved || saved.sourceType !== "programme" || !programme || saved.planId !== programme.id) return saved;',
    'const syncSavedWithProgramme = useCallback((saved) => { if (!saved || saved.workoutOverrides || saved.sourceType !== "programme" || !programme || saved.planId !== programme.id) return saved;', id)
  next = replaceOnce(next,
    '<WorkoutForm workout={workout} saveStatus={saveStatus}',
    '<WorkoutForm workout={workout} exerciseLibrary={library} saveStatus={saveStatus}', id)
  next = replaceOnce(next,
    'onAddSet={(id) => setWorkout((current) => addRecordedSet(current, id))}',
    'onAddSet={(id) => setWorkout((current) => withWorkoutOverrides(addSetToLinkedExercise(current, id)))}', id)
  next = replaceOnce(next,
    'onRemoveSet={(id, setId) => setWorkout((current) => removeRecordedSet(current, id, setId))}',
    'onRemoveSet={(id) => setWorkout((current) => withWorkoutOverrides(removeSetFromLinkedExercise(current, id)))}', id)
  next = replaceOnce(next,
    'onRemoveExercise={(id) => setWorkout((current) => ({ ...current, exercises: current.exercises.filter((exercise) => exercise.id !== id) }))}',
    'onAddExercise={(definition) => setWorkout((current) => { const exerciseType = definitionType(definition); const loggingMethod = defaultLoggingMethodForExerciseType(exerciseType); const base = { id: `workout-exercise-${makeId()}`, exerciseId: definition.id, exerciseNameSnapshot: definition.name, exerciseType, loggingMethod, prescription: createDefaultPrescription(exerciseType, loggingMethod), notes: "", sortOrder: current.exercises.length }; const previousWeights = previousWeightsForExercise(completedWorkouts, base); const previousReps = previousRepsForExercise(completedWorkouts, base); const snapshot = { ...createWorkoutExerciseSnapshot(base, previousWeights, previousReps), addedDuringWorkout: true }; return withWorkoutOverrides({ ...current, exercises: [...current.exercises, snapshot] }); })} onReplaceExercise={(exerciseId, definition) => setWorkout((current) => { const target = current.exercises.find((exercise) => exercise.id === exerciseId); if (!target || definition.id === target.exerciseId || definitionType(definition) !== target.exerciseType) return current; const ids = new Set(linkedExerciseIds(current, exerciseId)); const exercises = current.exercises.map((exercise) => { if (!ids.has(exercise.id)) return exercise; const updated = { ...exercise, exerciseId: definition.id, exerciseNameSnapshot: definition.name, equipmentType: "", substitutedForExerciseId: exercise.substitutedForExerciseId || exercise.exerciseId, substitutedForExerciseName: exercise.substitutedForExerciseName || exercise.exerciseNameSnapshot }; const previousWeights = previousWeightsForExercise(completedWorkouts, updated); const previousReps = previousRepsForExercise(completedWorkouts, updated); return { ...updated, recordedSets: (updated.recordedSets || []).map((set) => ({ ...set, previousWeight: previousWeights[set.setNumber] ?? "", previousReps: previousReps[set.setNumber] ?? "" })) }; }); return withWorkoutOverrides({ ...current, exercises }); })} onRemoveExercise={(exerciseId) => setWorkout((current) => withWorkoutOverrides(removeLinkedExercise(current, exerciseId)))} onEquipment={(exerciseId, equipmentType) => setWorkout((current) => withWorkoutOverrides(setLinkedEquipment(current, exerciseId, equipmentType)))}', id)
  next = replaceOnce(next,
    'onReorder={(exercises) => setWorkout((current) => ({ ...current, exercises }))}',
    'onReorder={(exercises) => setWorkout((current) => withWorkoutOverrides({ ...current, exercises }))}', id)
  return next
}

function transformWorkoutSession(code, id) {
  let next = code
  next = replaceOnce(next,
    '    EXERCISE_LOGGING_METHOD.TIME,\n    EXERCISE_LOGGING_METHOD.DISTANCE,',
    '    EXERCISE_LOGGING_METHOD.TIME,\n    EXERCISE_LOGGING_METHOD.TIME_WEIGHT,\n    EXERCISE_LOGGING_METHOD.DISTANCE,', id)
  next = replaceOnce(next,
    '      previousWeight: previousWeights[index + 1] ?? "",',
    '      previousWeight: [EXERCISE_LOGGING_METHOD.REPS_WEIGHT, EXERCISE_LOGGING_METHOD.TIME_WEIGHT].includes(exercise.loggingMethod) ? previousWeights[index + 1]?.weight ?? previousWeights[index + 1] ?? "" : "",', id)
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
