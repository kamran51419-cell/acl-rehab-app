function replaceOnce(code, oldText, newText, id) {
  if (!code.includes(oldText)) {
    throw new Error(`Equipment tracking transform could not find expected source in ${id}`)
  }
  return code.replace(oldText, newText)
}

function transformPlansScreen(code, id) {
  let next = code

  next = replaceOnce(
    next,
    '  updatePlan,\n} from "../../lib/firebase/planRepository";',
    '  updatePlan,\n  syncProgrammeEquipmentHistory,\n} from "../../lib/firebase/planRepository";',
    id,
  )

  next = replaceOnce(
    next,
    `  const methodField = (\n    <Field label="Track by">\n      <Select value={selectedMethod} onChange={(event) => changeLoggingMethod(event.target.value)}>\n        {methods.map((method) => <option key={method} value={method}>{loggingMethodLabel(method)}</option>)}\n      </Select>\n    </Field>\n  );`,
    `  const methodField = (\n    <div className="space-y-3">\n      <Field label="Track by">\n        <Select value={selectedMethod} onChange={(event) => changeLoggingMethod(event.target.value)}>\n          {methods.map((method) => <option key={method} value={method}>{loggingMethodLabel(method)}</option>)}\n        </Select>\n      </Field>\n      {exercise.exerciseType === EXERCISE_TYPE.STRENGTH ? <div>\n        <Field label="Equipment">\n          <Select value={exercise.equipmentType || "standard"} onChange={(event) => onChange({ ...exercise, equipmentType: event.target.value })}>\n            <option value="standard">Standard</option>\n            <option value="machine">Machine</option>\n            <option value="cable">Cable</option>\n            <option value="free_weight">Free weight</option>\n          </Select>\n        </Field>\n        <p className="mt-1 text-[11px] font-normal text-slate-400">Default for workouts. Previous programme history follows this unless you changed that workout manually.</p>\n      </div> : null}\n    </div>\n  );`,
    id,
  )

  next = replaceOnce(
    next,
    '      if (saved.isActive) await setPlanActive(db, user.uid, saved, true, { updatedAtToken: saveToken });\n      setOriginal(null);',
    '      if (saved.isActive) await setPlanActive(db, user.uid, saved, true, { updatedAtToken: saveToken });\n      await syncProgrammeEquipmentHistory(db, user.uid, saved);\n      setOriginal(null);',
    id,
  )

  return next
}

function transformPlanRepository(code, id) {
  return replaceOnce(
    code,
    'export function subscribeWorkouts(db, uid, onNext, onError) {',
    `function baseProgrammeExerciseId(value) {\n  return String(value || "").replace(/-(left|right)$/, "");\n}\n\nexport async function syncProgrammeEquipmentHistory(db, uid, plan) {\n  const defaults = new Map();\n  (plan?.sessions || []).forEach((session) => {\n    (session.exercises || []).forEach((exercise) => {\n      if (exercise?.exerciseType !== "strength" || !exercise?.id || !exercise?.exerciseId) return;\n      defaults.set(exercise.id, { exerciseId: exercise.exerciseId, equipmentType: exercise.equipmentType || "standard" });\n    });\n  });\n  if (!defaults.size) return 0;\n\n  const snapshot = await getDocs(collection(db, "users", uid, "workouts"));\n  const updates = [];\n  snapshot.docs.forEach((item) => {\n    const workout = item.data();\n    if ((workout.status !== "completed" && workout.completed !== true) || (workout.planId || workout.programmeId) !== plan.id) return;\n    let changed = false;\n    const exercises = (workout.exercises || []).map((exercise) => {\n      const defaultInfo = defaults.get(baseProgrammeExerciseId(exercise.id));\n      if (!defaultInfo || exercise.exerciseId !== defaultInfo.exerciseId || exercise.equipmentSource === "manual") return exercise;\n      const currentType = exercise.equipmentType || "standard";\n      if (currentType === defaultInfo.equipmentType && exercise.equipmentSource === "programme") return exercise;\n      changed = true;\n      return { ...exercise, equipmentType: defaultInfo.equipmentType, equipmentSource: "programme" };\n    });\n    if (changed) updates.push({ ref: item.ref, exercises });\n  });\n\n  for (let index = 0; index < updates.length; index += 400) {\n    const batch = writeBatch(db);\n    updates.slice(index, index + 400).forEach((update) => batch.update(update.ref, stripUndefined({ exercises: update.exercises, updatedAt: serverTimestamp() })));\n    await batch.commit();\n  }\n  return updates.length;\n}\n\nexport function subscribeWorkouts(db, uid, onNext, onError) {`,
    id,
  )
}

function transformWorkoutSession(code, id) {
  return replaceOnce(
    code,
    '    loggingMethod: exercise.loggingMethod,\n    sideSnapshot: resolveWorkoutExerciseSide(exercise),',
    '    loggingMethod: exercise.loggingMethod,\n    equipmentType: exercise.exerciseType === EXERCISE_TYPE.STRENGTH ? (exercise.equipmentType || "standard") : undefined,\n    sideSnapshot: resolveWorkoutExerciseSide(exercise),',
    id,
  )
}

function transformWorkoutDisplay(code, id) {
  let next = code
  next = replaceOnce(
    next,
    '  const targetSide = typeof target === "string" ? undefined : resolveWorkoutExerciseSide(target);\n  const ordered = workouts.slice().sort((a, b) => String(b.date || b.workoutDate || "").localeCompare(String(a.date || a.workoutDate || "")));',
    '  const targetSide = typeof target === "string" ? undefined : resolveWorkoutExerciseSide(target);\n  const targetEquipment = typeof target === "string" ? "standard" : (target.equipmentType || "standard");\n  const ordered = workouts.slice().sort((a, b) => String(b.date || b.workoutDate || "").localeCompare(String(a.date || a.workoutDate || "")));',
    id,
  )
  next = replaceOnce(
    next,
    '  const candidates = ordered.flatMap((workout) => (workout.exercises || []).filter((item) => item.exerciseId === exerciseId).map((exercise) => ({ exercise, sameIdentity: Boolean(targetId && exercise.id === targetId) })));',
    '  const candidates = ordered.flatMap((workout) => (workout.exercises || []).filter((item) => item.exerciseId === exerciseId && (item.equipmentType || "standard") === targetEquipment).map((exercise) => ({ exercise, sameIdentity: Boolean(targetId && exercise.id === targetId) })));',
    id,
  )
  return next
}

function transformWorkoutScreen(code, id) {
  let next = code

  next = replaceOnce(
    next,
    'const EQUIPMENT_OPTIONS = [["", "Not specified"], ["machine", "Machine"], ["cable", "Cable"], ["free_weight", "Free weight"]];',
    'const EQUIPMENT_OPTIONS = [["standard", "Standard"], ["machine", "Machine"], ["cable", "Cable"], ["free_weight", "Free weight"]];\nfunction equipmentLabel(value) { return EQUIPMENT_OPTIONS.find(([type]) => type === (value || "standard"))?.[1] || "Standard"; }',
    id,
  )

  next = replaceOnce(
    next,
    'function setLinkedEquipment(workout, exerciseId, equipmentType) { const ids = new Set(linkedExerciseIds(workout, exerciseId)); return { ...workout, exercises: workout.exercises.map((exercise) => ids.has(exercise.id) ? { ...exercise, equipmentType } : exercise) }; }',
    'function setLinkedEquipment(workout, exerciseId, equipmentType) { const ids = new Set(linkedExerciseIds(workout, exerciseId)); const nextType = equipmentType || "standard"; return { ...workout, exercises: workout.exercises.map((exercise) => ids.has(exercise.id) ? { ...exercise, equipmentType: nextType, equipmentSource: "manual" } : exercise) }; }',
    id,
  )

  next = replaceOnce(
    next,
    'className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700" value={exercise.equipmentType || ""}',
    'className="h-7 max-w-32 rounded-full border border-transparent bg-slate-50 px-2 text-xs font-normal text-slate-500 hover:border-slate-200" value={exercise.equipmentType || "standard"}',
    id,
  )
  next = replaceOnce(next, 'key={value || "unspecified"}', 'key={value}', id)
  next = replaceOnce(next, 'className="mt-2 block max-w-44 text-xs font-medium text-slate-500">Equipment<select', 'className="mt-1 inline-flex items-center"><span className="sr-only">Equipment</span><select', id)

  next = replaceOnce(
    next,
    'equipmentType: "", substitutedForExerciseId:',
    'equipmentType: "standard", equipmentSource: "manual", substitutedForExerciseId:',
    id,
  )

  next = replaceOnce(
    next,
    '<ExerciseCard exercise={exercise} oneOff={false} index={index} total={draft.exercises.length} onChange={(...args) => changeWorkout(setDraft, ...args)} onMove={null}/>',
    '<ExerciseCard exercise={exercise} oneOff={false} index={index} total={draft.exercises.length} onChange={(...args) => changeWorkout(setDraft, ...args)} onEquipment={(exerciseId, equipmentType) => setDraft((current) => setLinkedEquipment(current, exerciseId, equipmentType))} onMove={null}/>',
    id,
  )

  next = replaceOnce(
    next,
    'onEquipment={(exerciseId, equipmentType) => setWorkout((current) => withWorkoutOverrides(setLinkedEquipment(current, exerciseId, equipmentType)))}',
    'onEquipment={(exerciseId, equipmentType) => setWorkout((current) => { const changed = withWorkoutOverrides(setLinkedEquipment(current, exerciseId, equipmentType)); const ids = new Set(linkedExerciseIds(changed, exerciseId)); return { ...changed, exercises: changed.exercises.map((exercise) => { if (!ids.has(exercise.id)) return exercise; const previousWeights = previousWeightsForExercise(completedWorkouts, exercise); const previousReps = previousRepsForExercise(completedWorkouts, exercise); return { ...exercise, recordedSets: (exercise.recordedSets || []).map((set) => ({ ...set, previousWeight: previousWeights[set.setNumber] ?? "", previousReps: previousReps[set.setNumber] ?? "" })) }; }) }; })}',
    id,
  )

  return next
}

function transformExerciseProgress(code, id) {
  return replaceOnce(
    code,
    'side, sideMode, variant: variantForSide(side), weight: set.weight, reps: set.reps, setNumber:',
    'side, sideMode, variant: variantForSide(side), equipmentType: exercise.equipmentType || "standard", weight: set.weight, reps: set.reps, setNumber:',
    id,
  )
}

function transformProgressScreen(code, id) {
  let next = code
  const oldWeightedStats = `function WeightedStats({ group, trainingMode }) {\n  const availableModes = SIDE_MODE_ORDER.filter((mode) => sideModeEntries(group, mode).length);\n  const [mode, setMode] = useState(availableModes[0]);\n  useEffect(() => { if (!availableModes.includes(mode)) setMode(availableModes[0]); }, [availableModes.join("|"), mode]);\n  if (!availableModes.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">No valid weighted data is available for this exercise.</div>;\n  if (mode === PROGRESS_SIDE_MODE.LEFT_RIGHT) return <div className="space-y-5">{availableModes.length > 1 ? <div className="flex flex-wrap gap-2">{availableModes.map((item) => <Button key={item} variant={mode === item ? "primary" : "outline"} onClick={() => setMode(item)}>{SIDE_MODE_LABELS[item]}</Button>)}</div> : <p className="text-sm font-medium text-slate-600">Left & Right</p>}<LeftRightStats group={group} trainingMode={trainingMode}/></div>;\n  const selectedEntries = sideModeEntries(group, mode);\n  return <div className="space-y-5">{availableModes.length > 1 ? <div className="flex flex-wrap gap-2">{availableModes.map((item) => <Button key={item} variant={mode === item ? "primary" : "outline"} onClick={() => setMode(item)}>{SIDE_MODE_LABELS[item]}</Button>)}</div> : <p className="text-sm font-medium text-slate-600">{SIDE_MODE_LABELS[availableModes[0]]}</p>}<StatsCards entries={selectedEntries}/><StrengthGraph entries={selectedEntries}/></div>;\n}`
  const newWeightedStats = `const EQUIPMENT_ORDER = ["standard", "machine", "cable", "free_weight"];\nconst EQUIPMENT_LABELS = { standard: "Standard", machine: "Machine", cable: "Cable", free_weight: "Free weight" };\n\nfunction WeightedStats({ group, trainingMode }) {\n  const equipmentTypes = EQUIPMENT_ORDER.filter((type) => (group.entries || []).some((entry) => (entry.equipmentType || "standard") === type));\n  const latestEquipment = (group.entries || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]?.equipmentType || "standard";\n  const [equipment, setEquipment] = useState(equipmentTypes.includes(latestEquipment) ? latestEquipment : equipmentTypes[0]);\n  useEffect(() => { if (!equipmentTypes.includes(equipment)) setEquipment(equipmentTypes[0]); }, [equipmentTypes.join("|"), equipment]);\n  const equipmentGroup = { ...group, entries: (group.entries || []).filter((entry) => (entry.equipmentType || "standard") === equipment) };\n  const availableModes = SIDE_MODE_ORDER.filter((mode) => sideModeEntries(equipmentGroup, mode).length);\n  const [mode, setMode] = useState(availableModes[0]);\n  useEffect(() => { if (!availableModes.includes(mode)) setMode(availableModes[0]); }, [availableModes.join("|"), mode]);\n  const equipmentPicker = equipmentTypes.length > 1\n    ? <div className="flex flex-wrap gap-2">{equipmentTypes.map((type) => <Button key={type} size="sm" variant={equipment === type ? "primary" : "outline"} onClick={() => setEquipment(type)}>{EQUIPMENT_LABELS[type]}</Button>)}</div>\n    : equipmentTypes[0] && equipmentTypes[0] !== "standard" ? <p className="text-xs font-medium text-slate-500">{EQUIPMENT_LABELS[equipmentTypes[0]]}</p> : null;\n  if (!availableModes.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">No valid weighted data is available for this exercise.</div>;\n  if (mode === PROGRESS_SIDE_MODE.LEFT_RIGHT) return <div className="space-y-5">{equipmentPicker}{availableModes.length > 1 ? <div className="flex flex-wrap gap-2">{availableModes.map((item) => <Button key={item} variant={mode === item ? "primary" : "outline"} onClick={() => setMode(item)}>{SIDE_MODE_LABELS[item]}</Button>)}</div> : <p className="text-sm font-medium text-slate-600">Left & Right</p>}<LeftRightStats group={equipmentGroup} trainingMode={trainingMode}/></div>;\n  const selectedEntries = sideModeEntries(equipmentGroup, mode);\n  return <div className="space-y-5">{equipmentPicker}{availableModes.length > 1 ? <div className="flex flex-wrap gap-2">{availableModes.map((item) => <Button key={item} variant={mode === item ? "primary" : "outline"} onClick={() => setMode(item)}>{SIDE_MODE_LABELS[item]}</Button>)}</div> : <p className="text-sm font-medium text-slate-600">{SIDE_MODE_LABELS[availableModes[0]]}</p>}<StatsCards entries={selectedEntries}/><StrengthGraph entries={selectedEntries}/></div>;\n}`
  next = replaceOnce(next, oldWeightedStats, newWeightedStats, id)
  return next
}

export function equipmentTrackingBuildPlugin() {
  return {
    name: 'equipment-tracking',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/plans/PlansScreen.jsx')) return transformPlansScreen(code, id)
      if (cleanId.endsWith('/src/lib/firebase/planRepository.js')) return transformPlanRepository(code, id)
      if (cleanId.endsWith('/src/lib/domain/workoutSession.js')) return transformWorkoutSession(code, id)
      if (cleanId.endsWith('/src/lib/domain/workoutDisplay.js')) return transformWorkoutDisplay(code, id)
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      if (cleanId.endsWith('/src/lib/domain/exerciseProgress.js')) return transformExerciseProgress(code, id)
      if (cleanId.endsWith('/src/features/progress/ProgressScreen.jsx')) return transformProgressScreen(code, id)
      return null
    },
  }
}
