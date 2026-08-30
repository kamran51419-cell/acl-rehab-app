function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Unified add-exercise setup could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

function transformWorkoutScreen(code, id) {
  let next = code

  next = replaceRequired(
    next,
    '  const [editing, setEditing] = useState(null);',
    '  const [editing, setEditing] = useState(null);\n  const [adding, setAdding] = useState(null);',
    id,
  )

  next = replaceRequired(
    next,
    '  const chooseExercise = (definition) => { if (picker?.mode === "replace") onReplaceExercise?.(picker.exercise.id, definition); else onAddExercise?.(definition); setPicker(null); };',
    '  const chooseExercise = (definition) => { if (picker?.mode === "replace") { onReplaceExercise?.(picker.exercise.id, definition); setPicker(null); return; } const exerciseType = definitionType(definition); const loggingMethod = defaultLoggingMethodForExerciseType(exerciseType); const base = { id: `workout-exercise-${makeId()}`, exerciseId: definition.id, exerciseNameSnapshot: definition.name, exerciseType, loggingMethod, prescription: createDefaultPrescription(exerciseType, loggingMethod), notes: "", sortOrder: workout.exercises.length }; const previousWeights = previousWeightsForExercise(completedWorkouts, base); const previousReps = previousRepsForExercise(completedWorkouts, base); setAdding({ ...createWorkoutExerciseSnapshot(base, previousWeights, previousReps), addedDuringWorkout: true }); setPicker(null); };',
    id,
  )

  next = replaceRequired(
    next,
    '{picker ? <WorkoutExercisePicker exercises={exerciseLibrary} replacing={picker.mode === "replace" ? picker.exercise : null} onCancel={() => setPicker(null)} onChoose={chooseExercise}/> : null}{editing ? <WorkoutExerciseEditor workout={workout} exercise={editing} exercises={exerciseLibrary} onCancel={() => setEditing(null)} onSave={(edited) => { onReorder(editWorkoutExerciseList(workout, editing.id, edited, completedWorkouts)); setEditing(null); }}/> : null}</>;',
    '{picker ? <WorkoutExercisePicker exercises={exerciseLibrary} replacing={picker.mode === "replace" ? picker.exercise : null} onCancel={() => setPicker(null)} onChoose={chooseExercise}/> : null}{adding ? <WorkoutExerciseEditor workout={{ ...workout, exercises: [...workout.exercises, adding] }} exercise={adding} exercises={exerciseLibrary} heading="Add exercise" description="Set up this exercise for this workout. Your Programme stays unchanged." actionLabel="Add exercise" onCancel={() => setAdding(null)} onSave={(edited) => { onReorder(editWorkoutExerciseList({ ...workout, exercises: [...workout.exercises, adding] }, adding.id, edited, completedWorkouts)); setAdding(null); }}/> : null}{editing ? <WorkoutExerciseEditor workout={workout} exercise={editing} exercises={exerciseLibrary} onCancel={() => setEditing(null)} onSave={(edited) => { onReorder(editWorkoutExerciseList(workout, editing.id, edited, completedWorkouts)); setEditing(null); }}/> : null}</>;',
    id,
  )

  const editorStart = next.indexOf('function WorkoutExerciseSetupEditor({ exercise, onChange }) {')
  const intervalStart = editorStart >= 0 ? next.indexOf('  if (method === EXERCISE_LOGGING_METHOD.INTERVALS)', editorStart) : -1
  const fallbackStart = intervalStart >= 0 ? next.indexOf('  return <div className="space-y-3">{methodField}</div>;', intervalStart) : -1
  if (editorStart < 0 || intervalStart < 0 || fallbackStart < 0) throw new Error(`Unified add-exercise setup could not isolate workout interval editor in ${id}`)

  const intervalEditor = `  if (method === EXERCISE_LOGGING_METHOD.INTERVALS) {
    const intervalFormat = p.intervalFormat || "individual";
    const stages = p.stages || [];
    const repeatedGroups = p.repeatedGroups || [];
    const normalizeStages = (items) => items.map((stage, index) => ({ ...stage, sortOrder: index }));
    const setStages = (items) => updateP({ intervalFormat: "individual", stages: normalizeStages(items) });
    const setGroups = (items) => updateP({ intervalFormat: "repeated", repeatedGroups: items.map((group, index) => ({ ...group, sortOrder: index, stages: normalizeStages(group.stages || []) })) });
    const newStage = (phase, sortOrder) => createIntervalStage({ phase, durationSeconds: 0, durationUnit: "seconds", sortOrder });
    const changeFormat = (format) => {
      if (format === "repeated") {
        const seedStages = stages.length ? normalizeStages(stages) : [newStage(INTERVAL_PHASE.WORK, 0), newStage(INTERVAL_PHASE.REST, 1)];
        updateP({ intervalFormat: "repeated", repeatedGroups: repeatedGroups.length ? repeatedGroups : [{ id: \`interval-group-\${makeId()}\`, repeatCount: 5, sortOrder: 0, stages: seedStages }] });
      } else {
        updateP({ intervalFormat: "individual", stages: stages.length ? normalizeStages(stages) : [newStage(INTERVAL_PHASE.WORK, 0), newStage(INTERVAL_PHASE.REST, 1)] });
      }
    };
    const stageEditor = (stage, onStageChange, onRemove) => {
      const isDistance = stage.distance !== undefined && stage.distance !== null;
      const unit = isDistance ? (stage.distanceUnit || "m") : (stage.durationUnit || "seconds");
      const value = isDistance ? Number(stage.distance || 0) : unit === "minutes" ? Number(stage.durationSeconds || 0) / 60 : Number(stage.durationSeconds || 0);
      return <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3"><WorkoutEditField label="Stage"><WorkoutEditSelect value={stage.phase || INTERVAL_PHASE.WORK} onChange={(event) => onStageChange({ ...stage, phase: event.target.value })}><option value={INTERVAL_PHASE.WORK}>Work</option><option value={INTERVAL_PHASE.REST}>Rest</option></WorkoutEditSelect></WorkoutEditField><WorkoutEditField label={isDistance ? "Distance" : "Duration"}><WorkoutEditInput inputMode="decimal" value={value || ""} onChange={(event) => { const numeric = Number(event.target.value); onStageChange(isDistance ? { ...stage, distance: numeric } : { ...stage, durationSeconds: numeric * (unit === "minutes" ? 60 : 1) }); }}/></WorkoutEditField><WorkoutEditField label="Unit"><WorkoutEditSelect value={(isDistance ? "distance:" : "time:") + unit} onChange={(event) => { const [kind, nextUnit] = event.target.value.split(":"); onStageChange(kind === "distance" ? { ...stage, distance: stage.distance ?? 0, distanceUnit: nextUnit, durationSeconds: undefined, durationUnit: undefined } : { ...stage, durationSeconds: stage.durationSeconds ?? 0, durationUnit: nextUnit, distance: undefined, distanceUnit: undefined }); }}><option value="time:seconds">Seconds</option><option value="time:minutes">Minutes</option><option value="distance:m">Metres</option><option value="distance:km">Kilometres</option></WorkoutEditSelect></WorkoutEditField><WorkoutEditField label="Label (optional)"><WorkoutEditInput value={stage.label || ""} onChange={(event) => onStageChange({ ...stage, label: event.target.value })}/></WorkoutEditField><button type="button" className="text-sm font-medium text-red-600" onClick={onRemove}>Remove interval</button></div>;
    };
    return <div className="space-y-3">{methodField}<WorkoutEditField label="Interval format"><WorkoutEditSelect value={intervalFormat} onChange={(event) => changeFormat(event.target.value)}><option value="individual">Individual intervals</option><option value="repeated">Repeated blocks</option></WorkoutEditSelect></WorkoutEditField>{intervalFormat === "individual" ? <>{stages.map((stage, index) => <div key={stage.id || index}>{stageEditor(stage, (updated) => setStages(stages.map((item, itemIndex) => itemIndex === index ? updated : item)), () => setStages(stages.filter((_, itemIndex) => itemIndex !== index)))}</div>)}<div className="grid grid-cols-2 gap-3"><button type="button" className="h-10 rounded-xl border border-slate-200 bg-white text-sm font-medium" onClick={() => setStages([...stages, newStage(INTERVAL_PHASE.WORK, stages.length)])}>Add work</button><button type="button" className="h-10 rounded-xl border border-slate-200 bg-white text-sm font-medium" onClick={() => setStages([...stages, newStage(INTERVAL_PHASE.REST, stages.length)])}>Add rest</button></div></> : <>{repeatedGroups.map((group, groupIndex) => <div key={group.id || groupIndex} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-end justify-between gap-3"><WorkoutEditField label="Repeat"><WorkoutEditInput inputMode="numeric" value={group.repeatCount || ""} onChange={(event) => setGroups(repeatedGroups.map((item, index) => index === groupIndex ? { ...item, repeatCount: Math.max(1, Number(event.target.value) || 1) } : item))}/></WorkoutEditField><button type="button" className="shrink-0 pb-2 text-sm font-medium text-red-600" onClick={() => setGroups(repeatedGroups.filter((_, index) => index !== groupIndex))}>Remove block</button></div>{(group.stages || []).map((stage, stageIndex) => <div key={stage.id || stageIndex}>{stageEditor(stage, (updated) => setGroups(repeatedGroups.map((item, index) => index === groupIndex ? { ...item, stages: (item.stages || []).map((stageItem, index2) => index2 === stageIndex ? updated : stageItem) } : item)), () => setGroups(repeatedGroups.map((item, index) => index === groupIndex ? { ...item, stages: (item.stages || []).filter((_, index2) => index2 !== stageIndex) } : item)))}</div>)}<div className="grid grid-cols-2 gap-3"><button type="button" className="h-10 rounded-xl border border-slate-200 bg-white text-sm font-medium" onClick={() => setGroups(repeatedGroups.map((item, index) => index === groupIndex ? { ...item, stages: [...(item.stages || []), newStage(INTERVAL_PHASE.WORK, item.stages?.length || 0)] } : item))}>Add work</button><button type="button" className="h-10 rounded-xl border border-slate-200 bg-white text-sm font-medium" onClick={() => setGroups(repeatedGroups.map((item, index) => index === groupIndex ? { ...item, stages: [...(item.stages || []), newStage(INTERVAL_PHASE.REST, item.stages?.length || 0)] } : item))}>Add rest</button></div></div>)}<div className="flex flex-wrap gap-2"><button type="button" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium" onClick={() => setGroups([...repeatedGroups, { id: \`interval-group-\${makeId()}\`, repeatCount: 5, sortOrder: repeatedGroups.length, stages: [newStage(INTERVAL_PHASE.WORK, 0), newStage(INTERVAL_PHASE.REST, 1)] }])}>Add repeated block</button><button type="button" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium" onClick={() => setGroups([...repeatedGroups, { id: \`interval-group-\${makeId()}\`, repeatCount: 1, sortOrder: repeatedGroups.length, stages: [newStage(INTERVAL_PHASE.WORK, 0)] }])}>Add single interval</button></div></>}</div>;
  }
`

  next = `${next.slice(0, intervalStart)}${intervalEditor}${next.slice(fallbackStart)}`
  return next
}

function transformQuickWorkoutBuilder(code, id) {
  let next = code

  next = replaceRequired(
    next,
    '  [EXERCISE_LOGGING_METHOD.TIME]: "Time",',
    '  [EXERCISE_LOGGING_METHOD.TIME]: "Time",\n  [EXERCISE_LOGGING_METHOD.TIME_WEIGHT]: "Time + Weight",',
    id,
  )

  next = replaceRequired(
    next,
    '    loggingMethod,\n    prescription: createDefaultPrescription(exerciseType, loggingMethod),',
    '    loggingMethod,\n    equipmentType: exerciseType === EXERCISE_TYPE.STRENGTH ? "standard" : undefined,\n    prescription: createDefaultPrescription(exerciseType, loggingMethod),',
    id,
  )

  next = replaceRequired(
    next,
    'const base = { id: exercise.instanceId, exerciseId: exercise.exerciseId, exerciseNameSnapshot: exercise.exerciseNameSnapshot, exerciseType: exercise.exerciseType, loggingMethod: exercise.loggingMethod, prescription: exercise.prescription, notes: exercise.notes, sortOrder: index };',
    'const base = { id: exercise.instanceId, exerciseId: exercise.exerciseId, exerciseNameSnapshot: exercise.exerciseNameSnapshot, exerciseType: exercise.exerciseType, loggingMethod: exercise.loggingMethod, equipmentType: exercise.equipmentType, prescription: exercise.prescription, notes: exercise.notes, sortOrder: index };',
    id,
  )

  const setupStart = next.indexOf('function QuickExerciseSetupEditor({ exercise, onChange, trainingMode }) {')
  const setupEnd = setupStart >= 0 ? next.indexOf('\n\nexport function buildQuickWorkout', setupStart) : -1
  if (setupStart < 0 || setupEnd < 0) throw new Error(`Unified add-exercise setup could not isolate QuickExerciseSetupEditor in ${id}`)

  const quickEditor = `function QuickExerciseSetupEditor({ exercise, onChange, trainingMode }) {
  const updatePrescription = (prescription) => onChange({ ...exercise, prescription });
  const methods = loggingMethodsForExerciseType(exercise.exerciseType);
  const selectedMethod = methods.includes(exercise.loggingMethod) ? exercise.loggingMethod : methods[0];
  const changeLoggingMethod = (loggingMethod) => onChange({ ...exercise, loggingMethod, prescription: loggingMethod === EXERCISE_LOGGING_METHOD.INTERVALS ? { intervalFormat: "individual", stages: [createIntervalStage({ phase: INTERVAL_PHASE.WORK, durationSeconds: 0, durationUnit: "seconds", sortOrder: 0 }), createIntervalStage({ phase: INTERVAL_PHASE.REST, durationSeconds: 0, durationUnit: "seconds", sortOrder: 1 })] } : createDefaultPrescription(exercise.exerciseType, loggingMethod) });
  const methodField = <Field label="Track by"><Select value={selectedMethod} onChange={(event) => changeLoggingMethod(event.target.value)}>{methods.map((method) => <option key={method} value={method}>{METHOD_LABELS[method] || "Task"}</option>)}</Select></Field>;
  const equipmentField = exercise.exerciseType === EXERCISE_TYPE.STRENGTH ? <Field label="Equipment"><Select value={exercise.equipmentType || "standard"} onChange={(event) => onChange({ ...exercise, equipmentType: event.target.value })}><option value="standard">Standard</option><option value="machine">Machine</option><option value="cable">Cable</option><option value="free_weight">Free weight</option></Select></Field> : null;
  if (!methods.length || selectedMethod === EXERCISE_LOGGING_METHOD.COMPLETED) return <div className="space-y-3">{equipmentField}<div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">This exercise is completed as a task.</div></div>;
  if ([EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT].includes(selectedMethod)) return <div className="space-y-3"><div className="w-full">{methodField}</div>{equipmentField}<DirectStrengthPrescription prescription={exercise.prescription || {}} onChange={updatePrescription} showNotes={false} bothLabel="Standard" trainingMode={trainingMode}/></div>;
  if ([EXERCISE_LOGGING_METHOD.TIME, EXERCISE_LOGGING_METHOD.TIME_WEIGHT].includes(selectedMethod)) {
    const p = exercise.prescription || {}; const duration = <DurationInput seconds={p.targetDurationSeconds} durationUnit={p.durationUnit} onChange={({ seconds, unit }) => updatePrescription({ ...p, targetDurationSeconds: seconds, durationUnit: unit })}/>; const needsSets = [EXERCISE_TYPE.STRENGTH, EXERCISE_TYPE.BALANCE, EXERCISE_TYPE.OTHER].includes(exercise.exerciseType);
    return <div className="space-y-3"><div className="w-full">{methodField}</div>{equipmentField}{supportsSides(exercise.exerciseType) ? <Field label="Side"><Select value={p.side || SIDE.BOTH} onChange={(event) => updatePrescription({ ...p, side: event.target.value })}><option value={SIDE.BOTH}>Standard</option><option value={SIDE.SEPARATE}>Left & right</option>{trainingMode === "rehab" ? <><option value={SIDE.LEFT}>Left only</option><option value={SIDE.RIGHT}>Right only</option></> : null}</Select></Field> : null}{needsSets ? <Field label="Sets"><Input inputMode="numeric" value={p.targetSets || ""} onChange={(event) => updatePrescription({ ...p, targetSets: Math.max(1, Number(event.target.value) || 1) })}/></Field> : null}{duration}</div>;
  }
  if (selectedMethod === EXERCISE_LOGGING_METHOD.DISTANCE) { const p = exercise.prescription || {}; return <div className="space-y-3"><div className="w-full">{methodField}</div><Field label="Distance (km)"><Input inputMode="decimal" value={p.targetDistance ?? p.distance ?? ""} onChange={(event) => updatePrescription({ ...p, targetDistance: Number(event.target.value) })}/></Field></div>; }
  if (selectedMethod === EXERCISE_LOGGING_METHOD.TIME_DISTANCE) { const p = exercise.prescription || {}; return <div className="space-y-3"><div className="w-full">{methodField}</div><DurationInput seconds={p.targetDurationSeconds} durationUnit={p.durationUnit} onChange={({ seconds, unit }) => updatePrescription({ ...p, targetDurationSeconds: seconds, durationUnit: unit })}/><Field label="Distance (km)"><Input inputMode="decimal" value={p.targetDistance ?? p.distance ?? ""} onChange={(event) => updatePrescription({ ...p, targetDistance: Number(event.target.value) })}/></Field></div>; }
  if (selectedMethod === EXERCISE_LOGGING_METHOD.INTERVALS) {
    const p = exercise.prescription || {}; const intervalFormat = p.intervalFormat || "individual"; const stages = p.stages || []; const repeatedGroups = p.repeatedGroups || []; const normalizeStages = (items) => items.map((stage, index) => ({ ...stage, sortOrder: index })); const updateStages = (items) => updatePrescription({ ...p, intervalFormat: "individual", stages: normalizeStages(items) }); const updateGroups = (items) => updatePrescription({ ...p, intervalFormat: "repeated", repeatedGroups: items.map((group, index) => ({ ...group, sortOrder: index, stages: normalizeStages(group.stages || []) })) }); const newStage = (phase, sortOrder) => createIntervalStage({ phase, durationSeconds: 0, durationUnit: "seconds", sortOrder });
    const changeFormat = (format) => format === "repeated" ? updatePrescription({ ...p, intervalFormat: "repeated", repeatedGroups: repeatedGroups.length ? repeatedGroups : [{ id: \`interval-group-\${makeId()}\`, repeatCount: 5, sortOrder: 0, stages: stages.length ? normalizeStages(stages) : [newStage(INTERVAL_PHASE.WORK, 0), newStage(INTERVAL_PHASE.REST, 1)] }] }) : updatePrescription({ ...p, intervalFormat: "individual", stages: stages.length ? normalizeStages(stages) : [newStage(INTERVAL_PHASE.WORK, 0), newStage(INTERVAL_PHASE.REST, 1)] });
    const renderStage = (stage, onStageChange, onRemove) => <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3"><div className="grid gap-2 md:grid-cols-[140px_1fr_1fr]"><Field label="Stage"><Select value={stage.phase || INTERVAL_PHASE.WORK} onChange={(event) => onStageChange({ ...stage, phase: event.target.value })}><option value={INTERVAL_PHASE.WORK}>Work</option><option value={INTERVAL_PHASE.REST}>Rest</option></Select></Field><IntervalValueInput stage={stage} onChange={onStageChange}/><Field label="Label (optional)"><Input value={stage.label || ""} onChange={(event) => onStageChange({ ...stage, label: event.target.value })}/></Field></div><Button size="sm" variant="danger" onClick={onRemove}>Remove</Button></div>;
    return <div className="space-y-3"><div className="w-full">{methodField}</div><Field label="Interval format"><Select value={intervalFormat} onChange={(event) => changeFormat(event.target.value)}><option value="individual">Individual intervals</option><option value="repeated">Repeated blocks</option></Select></Field>{intervalFormat === "individual" ? <>{stages.map((stage, index) => <div key={stage.id || index}>{renderStage(stage, (updated) => updateStages(stages.map((item, itemIndex) => itemIndex === index ? updated : item)), () => updateStages(stages.filter((_, itemIndex) => itemIndex !== index)))}</div>)}<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => updateStages([...stages, newStage(INTERVAL_PHASE.WORK, stages.length)])}>Add work</Button><Button variant="outline" onClick={() => updateStages([...stages, newStage(INTERVAL_PHASE.REST, stages.length)])}>Add rest</Button></div></> : <>{repeatedGroups.map((group, groupIndex) => <div key={group.id || groupIndex} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-end justify-between gap-3"><Field label="Repeat"><Input inputMode="numeric" value={group.repeatCount || ""} onChange={(event) => updateGroups(repeatedGroups.map((item, index) => index === groupIndex ? { ...item, repeatCount: Math.max(1, Number(event.target.value) || 1) } : item))}/></Field><Button size="sm" variant="danger" onClick={() => updateGroups(repeatedGroups.filter((_, index) => index !== groupIndex))}>Remove block</Button></div>{(group.stages || []).map((stage, stageIndex) => <div key={stage.id || stageIndex}>{renderStage(stage, (updated) => updateGroups(repeatedGroups.map((item, index) => index === groupIndex ? { ...item, stages: (item.stages || []).map((stageItem, index2) => index2 === stageIndex ? updated : stageItem) } : item)), () => updateGroups(repeatedGroups.map((item, index) => index === groupIndex ? { ...item, stages: (item.stages || []).filter((_, index2) => index2 !== stageIndex) } : item)))}</div>)}<div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => updateGroups(repeatedGroups.map((item, index) => index === groupIndex ? { ...item, stages: [...(item.stages || []), newStage(INTERVAL_PHASE.WORK, item.stages?.length || 0)] } : item))}>Add work</Button><Button size="sm" variant="outline" onClick={() => updateGroups(repeatedGroups.map((item, index) => index === groupIndex ? { ...item, stages: [...(item.stages || []), newStage(INTERVAL_PHASE.REST, item.stages?.length || 0)] } : item))}>Add rest</Button></div></div>)}<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => updateGroups([...repeatedGroups, { id: \`interval-group-\${makeId()}\`, repeatCount: 5, sortOrder: repeatedGroups.length, stages: [newStage(INTERVAL_PHASE.WORK, 0), newStage(INTERVAL_PHASE.REST, 1)] }])}>Add repeated block</Button><Button variant="outline" onClick={() => updateGroups([...repeatedGroups, { id: \`interval-group-\${makeId()}\`, repeatCount: 1, sortOrder: repeatedGroups.length, stages: [newStage(INTERVAL_PHASE.WORK, 0)] }])}>Add single interval</Button></div></>}</div>;
  }
  return <div className="text-sm text-slate-500">No configurable tracking option is available for this exercise.</div>;
}`

  next = `${next.slice(0, setupStart)}${quickEditor}${next.slice(setupEnd)}`
  return next
}

export function unifiedAddExerciseSetupBuildPlugin() {
  return {
    name: 'unified-add-exercise-setup',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      if (cleanId.endsWith('/src/features/workout/QuickWorkoutBuilder.jsx')) return transformQuickWorkoutBuilder(code, id)
      return null
    },
  }
}
