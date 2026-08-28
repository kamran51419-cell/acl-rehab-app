function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Catch-up parity transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

function transformWorkoutScreen(code, id) {
  let next = code

  next = replaceRequired(
    next,
    'function CompletedWorkoutEditor({ user, saved, mode, onClose }) {',
    'function CompletedWorkoutEditor({ user, saved, mode, exerciseLibrary = [], completedWorkouts = [], onClose }) {',
    id,
  )

  next = replaceRequired(
    next,
    '  const original = useRef(saved); const catchUp = mode === "catch_up"; const originalDate = saved.date || saved.workoutDate || ""; const [entryDate, setEntryDate] = useState(catchUp ? todayString() : originalDate || todayString()); const [draft, setDraft] = useState(() => ({ ...saved, exercises: catchUp ? saved.exercises.filter((exercise) => !exerciseAttempted(exercise)) : saved.exercises })); const [saving, setSaving] = useState(false); const [error, setError] = useState("");',
    '  const original = useRef(saved); const catchUp = mode === "catch_up"; const originalDate = saved.date || saved.workoutDate || ""; const [entryDate, setEntryDate] = useState(catchUp ? todayString() : originalDate || todayString()); const [draft, setDraft] = useState(() => ({ ...saved, exercises: catchUp ? saved.exercises.filter((exercise) => !exerciseAttempted(exercise)).map((exercise) => ({ ...exercise, catchUpSourceId: exercise.id })) : saved.exercises })); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [editing, setEditing] = useState(null); const [draggingIndex, setDraggingIndex] = useState(null); const [dragOverIndex, setDragOverIndex] = useState(null);\n  const reorderDraft = (fromIndex, toIndex) => { if (fromIndex === null || toIndex === null || fromIndex === toIndex) return; setDraft((current) => { const items = ordered(current.exercises); if (!items[fromIndex] || !items[toIndex]) return current; const [moved] = items.splice(fromIndex, 1); items.splice(toIndex, 0, moved); return { ...current, exercises: items.map((item, index) => ({ ...item, sortOrder: index })) }; }); };',
    id,
  )

  next = replaceRequired(
    next,
    '      const exercises = original.current.exercises.map((exercise) => {\n        const edited = editedById.get(exercise.id);\n        if (!edited || (catchUp && !completedCatchUpIds.has(exercise.id))) return exercise;\n        return { ...edited, completedDate: exerciseAttempted(edited) ? entryDate : edited.completedDate };\n      });',
    '      const exercises = catchUp\n        ? (() => {\n            const completedDraft = draft.exercises.filter(exerciseAttempted).map(({ catchUpSourceId, ...exercise }) => ({ ...exercise, completedDate: entryDate }));\n            const replacedSourceIds = new Set(draft.exercises.filter(exerciseAttempted).map((exercise) => exercise.catchUpSourceId).filter(Boolean));\n            const kept = original.current.exercises.filter((exercise) => !replacedSourceIds.has(exercise.id));\n            return [...kept, ...completedDraft].map((exercise, index) => ({ ...exercise, sortOrder: index }));\n          })()\n        : original.current.exercises.map((exercise) => {\n            const edited = editedById.get(exercise.id);\n            if (!edited) return exercise;\n            return { ...edited, completedDate: exerciseAttempted(edited) ? entryDate : edited.completedDate };\n          });',
    id,
  )

  next = replaceRequired(
    next,
    '<div key={exercise.id}><ExerciseCard exercise={exercise} oneOff={false}',
    '<div key={exercise.id} data-catchup-reorder-index={index} draggable={typeof window === "undefined" || !("ontouchstart" in window)} onContextMenu={(event) => { if (typeof window !== "undefined" && "ontouchstart" in window) event.preventDefault(); }} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggingIndex(index); setDragOverIndex(index); }} onDragEnd={() => { setDraggingIndex(null); setDragOverIndex(null); }} onDragOver={(event) => { event.preventDefault(); setDragOverIndex(index); }} onDrop={() => { reorderDraft(draggingIndex, index); setDraggingIndex(null); setDragOverIndex(null); }} onTouchStart={(event) => startLongPressReorder(event, { onStart: () => { setDraggingIndex(index); setDragOverIndex(index); }, onMove: (element) => { const target = element?.closest?.("[data-catchup-reorder-index]"); if (target) setDragOverIndex(Number(target.dataset.catchupReorderIndex)); }, onDrop: (element) => { const target = element?.closest?.("[data-catchup-reorder-index]"); const targetIndex = target ? Number(target.dataset.catchupReorderIndex) : index; reorderDraft(index, targetIndex); setDraggingIndex(null); setDragOverIndex(null); } })} className={"reorder-target transition " + (dragOverIndex === index && draggingIndex !== index ? "reorder-over " : "") + (draggingIndex === index ? "reorder-dragging" : "")}><ExerciseCard exercise={exercise} oneOff={false}',
    id,
  )

  next = replaceRequired(
    next,
    '<ExerciseCard exercise={exercise} oneOff={false} index={index} total={draft.exercises.length} onChange={(...args) => changeWorkout(setDraft, ...args)} onEquipment={(exerciseId, equipmentType) => setDraft((current) => setLinkedEquipment(current, exerciseId, equipmentType))} onExerciseNote={(exerciseId, note) => setDraft((current) => setLinkedWorkoutNote(current, exerciseId, note))} onMove={null}/>',
    '<ExerciseCard exercise={exercise} oneOff={false} index={index} total={draft.exercises.length} onChange={(...args) => changeWorkout(setDraft, ...args)} onAddSet={(exerciseId) => setDraft((current) => addSetToLinkedExercise(current, exerciseId))} onRemoveSet={(exerciseId) => setDraft((current) => removeSetFromLinkedExercise(current, exerciseId))} onRemoveExercise={(exerciseId) => setDraft((current) => removeLinkedExercise(current, exerciseId))} onChangeExercise={() => setEditing(exercise)} onEquipment={(exerciseId, equipmentType) => setDraft((current) => setLinkedEquipment(current, exerciseId, equipmentType))} onExerciseNote={(exerciseId, note) => setDraft((current) => setLinkedWorkoutNote(current, exerciseId, note))} onMove={null}/>',
    id,
  )

  next = replaceRequired(
    next,
    '<Button variant="outline" onClick={onClose}>Cancel</Button></div></section></div>;',
    '<Button variant="outline" onClick={onClose}>Cancel</Button></div></section>{editing ? <WorkoutExerciseEditor workout={draft} exercise={editing} exercises={exerciseLibrary} onCancel={() => setEditing(null)} onSave={(edited) => { setDraft((current) => ({ ...current, exercises: editWorkoutExerciseList(current, editing.id, edited, completedWorkouts) })); setEditing(null); }}/> : null}</div>;',
    id,
  )

  next = replaceRequired(
    next,
    'return <CompletedWorkoutEditor user={user} saved={normalizeWorkoutForDisplay(editorWorkout)} mode={editor.mode}',
    'return <CompletedWorkoutEditor user={user} saved={normalizeWorkoutForDisplay(editorWorkout)} mode={editor.mode} exerciseLibrary={library} completedWorkouts={completedWorkouts}',
    id,
  )

  const oldDateClass = 'date-field-clip mt-1 block w-full max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white'
  if ((next.split(oldDateClass).length - 1) < 2) throw new Error(`Catch-up parity transform could not find both date fields in ${id}`)
  next = next.replaceAll(oldDateClass, 'date-field-clip mt-1 block w-[11.5rem] max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white')

  next = replaceRequired(
    next,
    'function AutoGrowTextarea({ className = "", onInput, style, ...props }) {\n  const ref = useRef(null);\n  const resize = useCallback(() => { const node = ref.current; if (!node) return; node.style.height = "36px"; if (String(node.value || "").includes("\\n") || node.scrollHeight > 36) node.style.height = Math.max(36, node.scrollHeight) + "px"; }, []);\n  useEffect(resize, [props.value, resize]);\n  return <textarea ref={ref} rows={1} {...props} style={{ height: 36, ...style }} onInput={(event) => { resize(); onInput?.(event); }} className={className} />;\n}',
    'function AutoGrowTextarea({ className = "", onInput, style, ...props }) {\n  const ref = useRef(null);\n  const resize = useCallback(() => { const node = ref.current; if (!node) return; node.style.height = "36px"; if (node.scrollHeight > node.clientHeight + 1) node.style.height = Math.min(180, node.scrollHeight) + "px"; }, []);\n  useEffect(resize, [props.value, resize]);\n  return <textarea ref={ref} rows={1} {...props} style={{ height: 36, minHeight: 36, maxHeight: 180, boxSizing: "border-box", overflowY: "hidden", ...style }} onInput={(event) => { resize(); onInput?.(event); }} className={className} />;\n}',
    id,
  )

  return next
}

export function catchUpParityBuildPlugin() {
  return {
    name: 'catch-up-parity',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      return null
    },
  }
}
