function replaceOnce(code, oldText, newText, id) {
  if (!code.includes(oldText)) {
    throw new Error(`Workout exercise edit transform could not find expected source in ${id}`)
  }
  return code.replace(oldText, newText)
}

function transformProgrammeFormControls(code, id) {
  let next = code
  next = replaceOnce(
    next,
    `export function DirectStrengthPrescription({\n  prescription,\n  onChange,\n  showNotes = true,\n  bothLabel = "Both legs",\n}) {`,
    `export function DirectStrengthPrescription({\n  prescription,\n  onChange,\n  showNotes = true,\n  bothLabel = "Both legs",\n  lockSide = false,\n  showAllSides = false,\n}) {`,
    id,
  )
  next = replaceOnce(
    next,
    '<Select value={prescription.side || SIDE.BOTH} onChange={(event) => onChange({ ...prescription, side: event.target.value })}>',
    '<Select disabled={lockSide} value={prescription.side || SIDE.BOTH} onChange={(event) => onChange({ ...prescription, side: event.target.value })}>',
    id,
  )
  next = replaceOnce(
    next,
    '            <option value={SIDE.SEPARATE}>Left & right</option>\n          </Select>',
    '            <option value={SIDE.SEPARATE}>Left & right</option>\n            {showAllSides ? <><option value={SIDE.LEFT}>Left only</option><option value={SIDE.RIGHT}>Right only</option></> : null}\n          </Select>',
    id,
  )
  return next
}

function transformPlansScreen(code, id) {
  let next = code
  next = replaceOnce(
    next,
    `function ExerciseSetupEditor({\n  exercise,\n  onChange,\n  trainingMode = "gym",\n}) {`,
    `export function ExerciseSetupEditor({\n  exercise,\n  onChange,\n  trainingMode = "gym",\n  context = "programme",\n  lockSide = false,\n  showAllSides = false,\n}) {`,
    id,
  )
  next = replaceOnce(
    next,
    '<p className="mt-1 text-[11px] font-normal text-slate-400">Default for workouts. Previous programme history follows this unless you changed that workout manually.</p>',
    '{context === "programme" ? <p className="mt-1 text-[11px] font-normal text-slate-400">Default for workouts. Previous programme history follows this unless you changed that workout manually.</p> : <p className="mt-1 text-[11px] font-normal text-slate-400">Changes this workout only.</p>}',
    id,
  )
  next = replaceOnce(
    next,
    '          trainingMode={trainingMode}\n        />',
    '          trainingMode={trainingMode}\n          lockSide={lockSide}\n          showAllSides={showAllSides}\n        />',
    id,
  )
  next = replaceOnce(
    next,
    '<Select value={p.side || SIDE.BOTH} onChange={(event) => updatePrescription({ ...p, side: event.target.value })}>',
    '<Select disabled={lockSide} value={p.side || SIDE.BOTH} onChange={(event) => updatePrescription({ ...p, side: event.target.value })}>',
    id,
  )
  next = replaceOnce(
    next,
    '                <option value={SIDE.SEPARATE}>Left & right</option>\n                {trainingMode === "rehab" ? <><option value={SIDE.LEFT}>Left only</option><option value={SIDE.RIGHT}>Right only</option></> : null}',
    '                <option value={SIDE.SEPARATE}>Left & right</option>\n                {showAllSides || trainingMode === "rehab" ? <><option value={SIDE.LEFT}>Left only</option><option value={SIDE.RIGHT}>Right only</option></> : null}',
    id,
  )
  return next
}

function transformWorkoutScreen(code, id) {
  let next = code

  next = replaceOnce(
    next,
    'import QuickWorkoutBuilder, { buildQuickWorkout } from "./QuickWorkoutBuilder";',
    'import QuickWorkoutBuilder, { buildQuickWorkout } from "./QuickWorkoutBuilder";\nimport { ExerciseSetupEditor } from "../plans/PlansScreen";',
    id,
  )

  next = replaceOnce(
    next,
    'function WorkoutExercisePicker({ exercises, replacing, onCancel, onChoose }) {',
    `function workoutEditorDraft(workout, exercise) {\n  const linked = linkedExerciseIds(workout, exercise.id);\n  const side = linked.length > 1 ? SIDE.SEPARATE : (resolveWorkoutExerciseSide(exercise) || SIDE.BOTH);\n  return { ...exercise, equipmentType: exercise.equipmentType || "standard", prescription: { ...(exercise.prescription || {}), ...(supportsSides(exercise) ? { side } : {}) } };\n}\n\nfunction setHasWorkoutEntry(set = {}) {\n  const entered = [set.actualReps, set.rawReps, set.weight, set.rawWeight, set.durationSeconds, set.rawDuration, set.distance, set.rawDistance].some((value) => value !== "" && value !== undefined && value !== null);\n  return Boolean(set.completed) || entered;\n}\n\nfunction sideIdBase(value) { return String(value || "").replace(/-(left|right)$/, ""); }\n\nfunction rebuildEditedWorkoutExercise(existing, edited, completedWorkouts, side, id) {\n  const definitionChanged = existing.exerciseId !== edited.exerciseId;\n  const methodChanged = existing.loggingMethod !== edited.loggingMethod;\n  const equipmentChanged = (existing.equipmentType || "standard") !== (edited.equipmentType || "standard");\n  const prescription = { ...(edited.prescription || {}), ...(supportsSides(existing) ? { side } : {}) };\n  const template = { ...edited, id, sortOrder: existing.sortOrder, prescription, notes: existing.programmeNoteSnapshot || "", sideSnapshot: side, equipmentType: edited.equipmentType || "standard" };\n  const previousWeights = previousWeightsForExercise(completedWorkouts, template);\n  const previousReps = previousRepsForExercise(completedWorkouts, template);\n  const fresh = createWorkoutExerciseSnapshot(template, previousWeights, previousReps);\n  const preserveSets = !definitionChanged && !methodChanged;\n  const recordedSets = fresh.recordedSets.map((set, index) => {\n    const saved = (existing.recordedSets || [])[index];\n    if (!preserveSets || !saved || !setHasWorkoutEntry(saved)) return set;\n    return { ...set, ...saved, id: set.id, setNumber: set.setNumber, prescribedReps: set.prescribedReps, previousWeight: set.previousWeight, previousReps: set.previousReps };\n  });\n  return {\n    ...existing,\n    ...fresh,\n    id,\n    exerciseId: edited.exerciseId,\n    exerciseNameSnapshot: edited.exerciseNameSnapshot,\n    exerciseType: edited.exerciseType,\n    loggingMethod: edited.loggingMethod,\n    prescription,\n    sideSnapshot: side,\n    equipmentType: edited.equipmentType || "standard",\n    equipmentSource: equipmentChanged ? "manual" : existing.equipmentSource,\n    recordedSets,\n    completed: preserveSets ? existing.completed : false,\n    intervalProgress: preserveSets ? existing.intervalProgress : fresh.intervalProgress,\n    notes: existing.notes || "",\n    programmeNoteSnapshot: existing.programmeNoteSnapshot || "",\n    ...(definitionChanged ? { substitutedForExerciseId: existing.substitutedForExerciseId || existing.exerciseId, substitutedForExerciseName: existing.substitutedForExerciseName || existing.exerciseNameSnapshot } : {}),\n  };\n}\n\nfunction editWorkoutExerciseList(workout, exerciseId, edited, completedWorkouts) {\n  const linkedIds = linkedExerciseIds(workout, exerciseId);\n  const linked = linkedIds.map((id) => workout.exercises.find((exercise) => exercise.id === id)).filter(Boolean);\n  const primary = linked[0] || workout.exercises.find((exercise) => exercise.id === exerciseId);\n  if (!primary) return workout.exercises;\n  const targetSide = supportsSides(primary) ? (edited.prescription?.side || SIDE.BOTH) : undefined;\n  const baseId = sideIdBase(primary.id);\n  let replacements;\n  if (supportsSides(primary) && targetSide === SIDE.SEPARATE) {\n    const sourceFor = (side) => linked.find((exercise) => resolveWorkoutExerciseSide(exercise) === side) || primary;\n    replacements = [SIDE.LEFT, SIDE.RIGHT].map((side, index) => ({ ...rebuildEditedWorkoutExercise(sourceFor(side), edited, completedWorkouts, side, `${baseId}-${side}`), sortOrder: primary.sortOrder + index * 0.01 }));\n  } else {\n    const source = linked.find((exercise) => resolveWorkoutExerciseSide(exercise) === targetSide) || primary;\n    replacements = [rebuildEditedWorkoutExercise(source, edited, completedWorkouts, targetSide, baseId)];\n  }\n  const removeIds = new Set(linkedIds);\n  const firstIndex = Math.min(...linked.map((exercise) => workout.exercises.indexOf(exercise)).filter((index) => index >= 0));\n  const kept = workout.exercises.filter((exercise) => !removeIds.has(exercise.id));\n  const insertionIndex = Number.isFinite(firstIndex) ? Math.min(firstIndex, kept.length) : kept.length;\n  kept.splice(insertionIndex, 0, ...replacements);\n  return kept.map((exercise, index) => ({ ...exercise, sortOrder: index }));\n}\n\nfunction WorkoutExerciseEditor({ workout, exercise, exercises, trainingMode, onCancel, onSave }) {\n  const [draft, setDraft] = useState(() => workoutEditorDraft(workout, exercise));\n  const [changingExercise, setChangingExercise] = useState(false);\n  const [query, setQuery] = useState("");\n  const available = useMemo(() => filterExerciseLibrary(exercises, { query }).filter((definition) => definitionType(definition) === draft.exerciseType), [exercises, query, draft.exerciseType]);\n  const chooseDefinition = (definition) => { setDraft((current) => ({ ...current, exerciseId: definition.id, exerciseNameSnapshot: definition.name })); setChangingExercise(false); setQuery(""); };\n  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-3 sm:items-center"><section className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Edit exercise</h2><p className="mt-1 text-xs text-slate-500">Changes here apply to this workout only. Your Programme stays unchanged.</p></div><button type="button" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100" onClick={onCancel}>Cancel</button></div><div className="mt-4 rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="truncate font-semibold">{draft.exerciseNameSnapshot}</div><div className="text-xs capitalize text-slate-500">{String(draft.exerciseType || "strength").replaceAll("_", " ")}</div></div><Button size="sm" variant="outline" onClick={() => setChangingExercise((value) => !value)}>{changingExercise ? "Close" : "Change exercise"}</Button></div>{changingExercise ? <div className="mt-3"><label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400"/><input autoFocus className="min-w-0 flex-1 outline-none" placeholder="Search exercises" value={query} onChange={(event) => setQuery(event.target.value)}/></label><div className="mt-2 max-h-52 space-y-1.5 overflow-y-auto">{available.length ? available.map((definition) => <button type="button" key={definition.id} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-slate-50" onClick={() => chooseDefinition(definition)}><span className="truncate text-sm font-medium">{definition.name}</span><span className="text-xs font-medium text-blue-600">Use</span></button>) : <p className="p-3 text-center text-sm text-slate-500">No matching exercises.</p>}</div></div> : null}</div><div className="mt-4 w-full [&_label]:w-full [&_select]:w-full [&_input]:w-full [&_.max-w-xs]:max-w-none"><ExerciseSetupEditor exercise={draft} onChange={setDraft} trainingMode={trainingMode} context="workout" showAllSides/></div><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onCancel}>Cancel</Button><Button onClick={() => onSave(draft)}>Save changes</Button></div></section></div>;\n}\n\nfunction WorkoutExercisePicker({ exercises, replacing, onCancel, onChoose }) {`,
    id,
  )

  next = replaceOnce(
    next,
    'onChangeExercise(exercise); }}>Change exercise</button>',
    'onChangeExercise(exercise); }}>Edit exercise</button>',
    id,
  )

  next = replaceOnce(
    next,
    'export function WorkoutForm({ workout, exerciseLibrary = [], saveStatus, finishing, finishError, onBack, onChange, onAddSet, onRemoveSet, onAddExercise, onReplaceExercise, onRemoveExercise, onEquipment, onReorder, onDate, onNotes, onFinish, onDiscard }) {\n  const [picker, setPicker] = useState(null);',
    'export function WorkoutForm({ workout, exerciseLibrary = [], completedWorkouts = [], trainingMode = "gym", saveStatus, finishing, finishError, onBack, onChange, onAddSet, onRemoveSet, onAddExercise, onReplaceExercise, onRemoveExercise, onEquipment, onReorder, onDate, onNotes, onFinish, onDiscard }) {\n  const [picker, setPicker] = useState(null);\n  const [editing, setEditing] = useState(null);',
    id,
  )

  next = replaceOnce(
    next,
    'onRemoveExercise={onRemoveExercise} onChangeExercise={() => setPicker({ mode: "replace", exercise })} onEquipment={onEquipment} onMove={move}/>)}</div>',
    'onRemoveExercise={onRemoveExercise} onChangeExercise={() => setEditing(exercise)} onEquipment={onEquipment} onMove={move}/>)}</div>',
    id,
  )

  next = replaceOnce(
    next,
    '{picker ? <WorkoutExercisePicker exercises={exerciseLibrary} replacing={picker.mode === "replace" ? picker.exercise : null} onCancel={() => setPicker(null)} onChoose={chooseExercise}/> : null}</>;',
    '{picker ? <WorkoutExercisePicker exercises={exerciseLibrary} replacing={picker.mode === "replace" ? picker.exercise : null} onCancel={() => setPicker(null)} onChoose={chooseExercise}/> : null}{editing ? <WorkoutExerciseEditor workout={workout} exercise={editing} exercises={exerciseLibrary} trainingMode={trainingMode} onCancel={() => setEditing(null)} onSave={(edited) => { onReorder(editWorkoutExerciseList(workout, editing.id, edited, completedWorkouts)); setEditing(null); }}/> : null}</>;',
    id,
  )

  next = replaceOnce(
    next,
    '<WorkoutForm workout={workout} exerciseLibrary={library} saveStatus={saveStatus}',
    '<WorkoutForm workout={workout} exerciseLibrary={library} completedWorkouts={completedWorkouts} trainingMode={trainingMode} saveStatus={saveStatus}',
    id,
  )

  return next
}

export function workoutExerciseEditBuildPlugin() {
  return {
    name: 'workout-exercise-edit',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/plans/ProgrammeFormControls.jsx')) return transformProgrammeFormControls(code, id)
      if (cleanId.endsWith('/src/features/plans/PlansScreen.jsx')) return transformPlansScreen(code, id)
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      return null
    },
  }
}
