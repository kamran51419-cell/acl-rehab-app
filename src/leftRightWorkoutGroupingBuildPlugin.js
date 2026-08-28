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
  const baseId = workoutPairBaseId(exercise.id);
  return list.findIndex((candidate, candidateIndex) => candidateIndex !== index
    && candidate.exerciseId === exercise.exerciseId
    && candidate.loggingMethod === exercise.loggingMethod
    && (candidate.equipmentType || "standard") === (exercise.equipmentType || "standard")
    && workoutPairBaseId(candidate.id) === baseId
    && resolveWorkoutExerciseSide(candidate) === opposite);
}

function isLinkedWorkoutRightSide(list, exercise, index) {
  return resolveWorkoutExerciseSide(exercise) === SIDE.RIGHT && linkedWorkoutPairIndex(list, exercise, index) >= 0;
}

function WorkoutExerciseDisplay({ list, exercise, index, ...props }) {
  const pairIndex = linkedWorkoutPairIndex(list, exercise, index);
  if (pairIndex < 0) return <ExerciseCard exercise={exercise} index={index} {...props}/>;
  const pair = list[pairIndex];
  const left = resolveWorkoutExerciseSide(exercise) === SIDE.LEFT ? exercise : pair;
  const right = resolveWorkoutExerciseSide(exercise) === SIDE.RIGHT ? exercise : pair;
  const range = left.prescription?.targetReps?.type === "range"
    ? \`Range: \${left.prescription.targetReps.min}–\${left.prescription.targetReps.max} reps\`
    : "";
  return <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
    <div className="mb-2 min-w-0">
      <h2 className="font-semibold">{left.exerciseNameSnapshot}</h2>
      <p className="text-xs text-slate-500">{["Left & Right", range].filter(Boolean).join(" · ")}</p>
    </div>
    <div className="grid gap-2 sm:grid-cols-2">
      <ExerciseCard exercise={left} index={index} hideExerciseName {...props}/>
      <ExerciseCard exercise={right} index={pairIndex} hideExerciseName {...props} onAddSet={undefined} onRemoveSet={undefined} onRemoveExercise={undefined} onChangeExercise={undefined} onEquipment={undefined} onExerciseNote={undefined} onClearPreviousNote={undefined} onFlag={undefined} previousNote=""/>
    </div>
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
