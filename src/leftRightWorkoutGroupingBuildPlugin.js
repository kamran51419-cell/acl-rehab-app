function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Left/right workout grouping transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

const PAIR_HELPERS = `function workoutPairBaseId(value) {
  return String(value || "").replace(/-(left|right)$/, "");
}

function linkedWorkoutPairIndex(list, exercise, index) {
  const side = resolveWorkoutExerciseSide(exercise);
  if (![SIDE.LEFT, SIDE.RIGHT].includes(side)) return -1;
  const opposite = side === SIDE.LEFT ? SIDE.RIGHT : SIDE.LEFT;
  const samePairShape = (candidate, candidateIndex) => candidateIndex !== index
    && candidate.exerciseId === exercise.exerciseId
    && candidate.loggingMethod === exercise.loggingMethod
    && (candidate.equipmentType || "standard") === (exercise.equipmentType || "standard")
    && resolveWorkoutExerciseSide(candidate) === opposite;
  const baseId = workoutPairBaseId(exercise.id);
  const exactIndex = list.findIndex((candidate, candidateIndex) => samePairShape(candidate, candidateIndex)
    && workoutPairBaseId(candidate.id) === baseId);
  if (exactIndex >= 0) return exactIndex;
  const legacyMatches = list.map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
    .filter(({ candidate, candidateIndex }) => samePairShape(candidate, candidateIndex));
  if (legacyMatches.length === 1) return legacyMatches[0].candidateIndex;
  if (legacyMatches.length > 1) {
    legacyMatches.sort((a, b) => Math.abs(a.candidateIndex - index) - Math.abs(b.candidateIndex - index));
    return legacyMatches[0].candidateIndex;
  }
  return -1;
}

function isLinkedWorkoutRightSide(list, exercise, index) {
  return resolveWorkoutExerciseSide(exercise) === SIDE.RIGHT && linkedWorkoutPairIndex(list, exercise, index) >= 0;
}

function WorkoutExerciseDisplay({ list, exercise, index, previousNote = "", onAddSet, onRemoveSet, onRemoveExercise, onChangeExercise, onEquipment, onExerciseNote, onClearPreviousNote, onFlag, ...props }) {
  const [sharedActionsOpen, setSharedActionsOpen] = useState(false);
  const pairIndex = linkedWorkoutPairIndex(list, exercise, index);
  if (pairIndex < 0) return <ExerciseCard exercise={exercise} index={index} previousNote={previousNote} onAddSet={onAddSet} onRemoveSet={onRemoveSet} onRemoveExercise={onRemoveExercise} onChangeExercise={onChangeExercise} onEquipment={onEquipment} onExerciseNote={onExerciseNote} onClearPreviousNote={onClearPreviousNote} onFlag={onFlag} {...props}/>;
  const pair = list[pairIndex];
  const left = resolveWorkoutExerciseSide(exercise) === SIDE.LEFT ? exercise : pair;
  const right = resolveWorkoutExerciseSide(exercise) === SIDE.RIGHT ? exercise : pair;
  const range = left.prescription?.targetReps?.type === "range"
    ? \`Range: \${left.prescription.targetReps.min}–\${left.prescription.targetReps.max} reps\`
    : "";
  const setCount = Math.max((left.recordedSets || []).length, (right.recordedSets || []).length);
  const isTask = left.loggingMethod === EXERCISE_LOGGING_METHOD.COMPLETED;
  const isIntervals = left.loggingMethod === EXERCISE_LOGGING_METHOD.INTERVALS;
  return <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold">{left.exerciseNameSnapshot}</h2>
        <p className="text-xs text-slate-500">{["Left & Right", range].filter(Boolean).join(" · ")}</p>
      </div>
      {onChangeExercise || onRemoveExercise ? <div className="relative"><button type="button" aria-label={\`Edit \${left.exerciseNameSnapshot}\`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setSharedActionsOpen((value) => !value)}><MoreHorizontal className="h-5 w-5"/></button>{sharedActionsOpen ? <div className="absolute right-0 top-10 z-30 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">{onChangeExercise ? <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setSharedActionsOpen(false); onChangeExercise(left); }}>Change exercise</button> : null}{onRemoveExercise ? <button type="button" className="block w-full px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50" onClick={() => { setSharedActionsOpen(false); onRemoveExercise(left.id); }}>Delete exercise</button> : null}</div> : null}</div> : null}
    </div>
    {(left.exerciseType === EXERCISE_TYPE.STRENGTH && onEquipment) || onFlag ? <div className="mt-2 flex flex-wrap items-center gap-2">{left.exerciseType === EXERCISE_TYPE.STRENGTH && onEquipment ? <label className="inline-flex items-center"><span className="sr-only">Equipment</span><select aria-label={\`\${left.exerciseNameSnapshot} equipment\`} className="workout-equipment-select h-7 max-w-32 rounded-full border border-transparent bg-slate-50 px-2 text-xs font-normal leading-4 text-slate-500 hover:border-slate-200" value={left.equipmentType || "standard"} onChange={(event) => onEquipment(left.id, event.target.value)}>{EQUIPMENT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : null}{onFlag ? <button type="button" aria-pressed={Boolean(left.flaggedSkipped)} className={\`inline-flex h-7 items-center justify-center rounded-full px-2 transition \${left.flaggedSkipped ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"}\`} onClick={() => onFlag(left.id, !left.flaggedSkipped)}><span aria-hidden="true">⚑</span><span className="sr-only">{left.flaggedSkipped ? "Remove flag" : "Flag exercise"}</span></button> : null}</div> : null}
    <div className="mt-3 grid items-stretch gap-3 sm:grid-cols-2">
      <ExerciseCard exercise={left} index={index} hideExerciseName {...props} previousNote="" onAddSet={undefined} onRemoveSet={undefined} onRemoveExercise={undefined} onChangeExercise={undefined} onEquipment={undefined} onExerciseNote={undefined} onClearPreviousNote={undefined} onFlag={undefined}/>
      <ExerciseCard exercise={right} index={pairIndex} hideExerciseName {...props} previousNote="" onAddSet={undefined} onRemoveSet={undefined} onRemoveExercise={undefined} onChangeExercise={undefined} onEquipment={undefined} onExerciseNote={undefined} onClearPreviousNote={undefined} onFlag={undefined}/>
    </div>
    {previousNote ? <div className="mt-3 flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600"><span className="min-w-0 whitespace-pre-wrap">{previousNote}</span>{onClearPreviousNote ? <button type="button" aria-label="Clear carried note" className="shrink-0 rounded-md px-1.5 text-lg leading-none text-slate-400 hover:bg-slate-200 hover:text-slate-700" onClick={() => onClearPreviousNote(left.id)}>×</button> : null}</div> : null}
    {onExerciseNote ? <label className="mt-3 block text-xs font-medium text-slate-600">Note<AutoGrowTextarea className="mt-1 block h-9 min-h-9 w-full resize-none overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-normal leading-5 text-slate-800 outline-none focus:border-slate-400" value={left.workoutNote || right.workoutNote || ""} placeholder="Add a note for this workout" onChange={(event) => onExerciseNote(left.id, event.target.value)}/></label> : null}
    {setCount && !isTask && !isIntervals && (onAddSet || onRemoveSet) ? <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50" onClick={() => onAddSet?.(left.id)}>+ Add set</button><button type="button" disabled={setCount <= 1} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => onRemoveSet?.(left.id)}>Remove set</button></div> : null}
  </section>;
}
`

function transformWorkoutScreen(code, id) {
  let next = code
  next = replaceRequired(next, 'export function WorkoutForm({', `${PAIR_HELPERS}\n\nexport function WorkoutForm({`, id)

  next = replaceRequired(
    next,
    'const dropExercise = (fromIndex, toIndex) => { if (fromIndex === null || fromIndex === toIndex) return; const next = list.slice(); const [item] = next.splice(fromIndex, 1); next.splice(toIndex, 0, item); onReorder(next.map((exercise, itemIndex) => ({ ...exercise, sortOrder: itemIndex }))); };',
    'const dropExercise = (fromIndex, toIndex) => { if (fromIndex === null || fromIndex === toIndex) return; const source = list[fromIndex]; if (!source) return; const pairIndex = linkedWorkoutPairIndex(list, source, fromIndex); if (pairIndex < 0) { const next = list.slice(); const [item] = next.splice(fromIndex, 1); next.splice(toIndex, 0, item); onReorder(next.map((exercise, itemIndex) => ({ ...exercise, sortOrder: itemIndex }))); return; } const movingIndexes = [fromIndex, pairIndex].sort((a, b) => a - b); const moving = movingIndexes.map((itemIndex) => list[itemIndex]); const next = list.filter((_, itemIndex) => !movingIndexes.includes(itemIndex)); const removedBeforeTarget = movingIndexes.filter((itemIndex) => itemIndex < toIndex).length; const insertionIndex = Math.max(0, Math.min(next.length, toIndex - removedBeforeTarget)); next.splice(insertionIndex, 0, ...moving); onReorder(next.map((exercise, itemIndex) => ({ ...exercise, sortOrder: itemIndex }))); };',
    id,
  )

  const formIndex = next.indexOf('export function WorkoutForm({')
  const mapStart = next.indexOf('{list.map((exercise, index) => ', formIndex)
  if (mapStart < 0) throw new Error(`Left/right workout grouping transform could not find workout exercise map in ${id}`)
  next = next.slice(0, mapStart) + '{list.map((exercise, index) => isLinkedWorkoutRightSide(list, exercise, index) ? null : ' + next.slice(mapStart + '{list.map((exercise, index) => '.length)

  const cardStart = next.indexOf('<ExerciseCard exercise={exercise}', mapStart)
  if (cardStart < 0) throw new Error(`Left/right workout grouping transform could not find workout exercise card in ${id}`)
  next = next.slice(0, cardStart) + '<WorkoutExerciseDisplay list={list} exercise={exercise}' + next.slice(cardStart + '<ExerciseCard exercise={exercise}'.length)

  return next
}

export function leftRightWorkoutGroupingBuildPlugin() {
  return {
    name: 'left-right-workout-grouping',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      return null
    },
  }
}
