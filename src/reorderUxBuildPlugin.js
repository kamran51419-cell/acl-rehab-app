function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Reorder UX transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

function transformPlansScreen(code, id) {
  let next = code
  next = replaceRequired(
    next,
    '  const [draggingExercise, setDraggingExercise] = useState(null);\n  const [draggingSession, setDraggingSession] = useState(null);',
    '  const [draggingExercise, setDraggingExercise] = useState(null);\n  const [draggingSession, setDraggingSession] = useState(null);\n  const [dragOverExercise, setDragOverExercise] = useState(null);\n  const [dragOverSession, setDragOverSession] = useState(null);',
    id,
  )
  next = replaceRequired(
    next,
    `  const moveSession = (fromIndex, toIndex) => {\n    if (fromIndex === toIndex) return;\n    setSessions(reorderItems(draft.sessions, fromIndex, toIndex));\n    setDraggingSession(toIndex);\n  };\n\n  const moveExercise = (sessionIndex, fromIndex, toIndex) => {\n    if (fromIndex === toIndex) return;\n    updateSession(sessionIndex, { exercises: reorderItems(draft.sessions[sessionIndex].exercises, fromIndex, toIndex) });\n    setDraggingExercise({ sessionIndex, exerciseIndex: toIndex });\n  };`,
    `  const moveSession = (fromIndex, toIndex) => {\n    if (fromIndex === toIndex || fromIndex === null) return;\n    setSessions(reorderItems(draft.sessions, fromIndex, toIndex));\n  };\n\n  const moveExercise = (sessionIndex, fromIndex, toIndex) => {\n    if (fromIndex === toIndex || fromIndex === null) return;\n    updateSession(sessionIndex, { exercises: reorderItems(draft.sessions[sessionIndex].exercises, fromIndex, toIndex) });\n  };`,
    id,
  )
  next = replaceRequired(
    next,
    '            onDragOver={(event) => event.preventDefault()}\n            onDrop={() => draggingSession !== null && moveSession(draggingSession, sessionIndex)}\n            className="scroll-mt-4 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"',
    '            onDragOver={(event) => { event.preventDefault(); setDragOverSession(sessionIndex); }}\n            onDrop={() => { if (draggingSession !== null) moveSession(draggingSession, sessionIndex); setDraggingSession(null); setDragOverSession(null); }}\n            className={cls("reorder-target scroll-mt-4 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition", dragOverSession === sessionIndex && draggingSession !== sessionIndex ? "reorder-over" : "", draggingSession === sessionIndex ? "reorder-dragging" : "")}',
    id,
  )
  next = replaceRequired(
    next,
    '                onDragStart={() => setDraggingSession(sessionIndex)}\n                onDragEnd={() => setDraggingSession(null)}\n                className="mt-6 cursor-grab rounded p-1 text-slate-400"',
    '                onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggingSession(sessionIndex); setDragOverSession(sessionIndex); }}\n                onDragEnd={() => { setDraggingSession(null); setDragOverSession(null); }}\n                className="mt-6 cursor-grab rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-600 active:cursor-grabbing"',
    id,
  )
  next = replaceRequired(
    next,
    '                  onDragOver={(event) => event.preventDefault()}\n                  onDrop={() => draggingExercise?.sessionIndex === sessionIndex && moveExercise(sessionIndex, draggingExercise.exerciseIndex, exerciseIndex)}\n                  className={cls("space-y-3 rounded-xl border bg-white p-3", activeExerciseId === exercise.id ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200")}',
    '                  onDragOver={(event) => { event.preventDefault(); if (draggingExercise?.sessionIndex === sessionIndex) setDragOverExercise({ sessionIndex, exerciseIndex }); }}\n                  onDrop={() => { if (draggingExercise?.sessionIndex === sessionIndex) moveExercise(sessionIndex, draggingExercise.exerciseIndex, exerciseIndex); setDraggingExercise(null); setDragOverExercise(null); }}\n                  className={cls("reorder-target space-y-3 rounded-xl border bg-white p-3 transition", activeExerciseId === exercise.id ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200", dragOverExercise?.sessionIndex === sessionIndex && dragOverExercise?.exerciseIndex === exerciseIndex && draggingExercise?.exerciseIndex !== exerciseIndex ? "reorder-over" : "", draggingExercise?.sessionIndex === sessionIndex && draggingExercise?.exerciseIndex === exerciseIndex ? "reorder-dragging" : "")}',
    id,
  )
  next = replaceRequired(
    next,
    '                        onDragStart={() => setDraggingExercise({ sessionIndex, exerciseIndex })}\n                        onDragEnd={() => setDraggingExercise(null)}\n                        className="cursor-grab rounded p-1 text-slate-400"',
    '                        onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggingExercise({ sessionIndex, exerciseIndex }); setDragOverExercise({ sessionIndex, exerciseIndex }); }}\n                        onDragEnd={() => { setDraggingExercise(null); setDragOverExercise(null); }}\n                        className="cursor-grab rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 active:cursor-grabbing"',
    id,
  )
  return next
}

function transformQuickWorkoutBuilder(code, id) {
  let next = code
  next = replaceRequired(
    next,
    '  const [draggingIndex, setDraggingIndex] = useState(null);',
    '  const [draggingIndex, setDraggingIndex] = useState(null);\n  const [dragOverIndex, setDragOverIndex] = useState(null);',
    id,
  )
  next = replaceRequired(
    next,
    `  const moveExercise = (fromIndex, toIndex) => {\n    if (fromIndex === toIndex || fromIndex === null) return;\n    setSelected((items) => {\n      const next = items.slice();\n      const [item] = next.splice(fromIndex, 1);\n      next.splice(toIndex, 0, item);\n      return next;\n    });\n    setDraggingIndex(toIndex);\n  };`,
    `  const moveExercise = (fromIndex, toIndex) => {\n    if (fromIndex === toIndex || fromIndex === null) return;\n    setSelected((items) => {\n      const next = items.slice();\n      const [item] = next.splice(fromIndex, 1);\n      next.splice(toIndex, 0, item);\n      return next;\n    });\n  };`,
    id,
  )
  next = replaceRequired(
    next,
    '              onDragOver={(event) => event.preventDefault()}\n              onDrop={() => moveExercise(draggingIndex, index)}\n              className="space-y-3 rounded-xl border border-slate-200 bg-white p-3"',
    '              onDragOver={(event) => { event.preventDefault(); setDragOverIndex(index); }}\n              onDrop={() => { moveExercise(draggingIndex, index); setDraggingIndex(null); setDragOverIndex(null); }}\n              className={`reorder-target space-y-3 rounded-xl border border-slate-200 bg-white p-3 transition ${dragOverIndex === index && draggingIndex !== index ? "reorder-over" : ""} ${draggingIndex === index ? "reorder-dragging" : ""}`}',
    id,
  )
  next = replaceRequired(
    next,
    '<button type="button" draggable onDragStart={() => setDraggingIndex(index)} onDragEnd={() => setDraggingIndex(null)} className="cursor-grab rounded p-1 text-slate-400" aria-label={`Drag ${exercise.exerciseNameSnapshot}`}><GripVertical className="h-5 w-5" /></button>',
    '<button type="button" draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggingIndex(index); setDragOverIndex(index); }} onDragEnd={() => { setDraggingIndex(null); setDragOverIndex(null); }} className="cursor-grab rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 active:cursor-grabbing" aria-label={`Drag ${exercise.exerciseNameSnapshot}`}><GripVertical className="h-5 w-5" /></button>',
    id,
  )
  return next
}

function transformWorkoutScreen(code, id) {
  let next = code
  next = replaceRequired(
    next,
    'import { Check, ChevronDown, ChevronRight, ChevronUp, Dumbbell, MoreHorizontal, Plus, Search } from "lucide-react";',
    'import { Check, ChevronDown, ChevronRight, ChevronUp, Dumbbell, GripVertical, MoreHorizontal, Plus, Search } from "lucide-react";',
    id,
  )
  next = replaceRequired(
    next,
    'export function ExerciseCard({ exercise, oneOff, onChange, onAddSet, onRemoveSet, onRemoveExercise, onChangeExercise, onEquipment, onMove, index, total, hideExerciseName = false }) {',
    'export function ExerciseCard({ exercise, oneOff, onChange, onAddSet, onRemoveSet, onRemoveExercise, onChangeExercise, onEquipment, onMove, dragHandleProps, index, total, hideExerciseName = false }) {',
    id,
  )
  next = replaceRequired(
    next,
    '{!hideExerciseName && onMove ? <><button type="button" disabled={!index} onClick={() => onMove(index, -1)} className="p-2 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button><button type="button" disabled={index === total - 1} onClick={() => onMove(index, 1)} className="p-2 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button></> : null}',
    '{!hideExerciseName && dragHandleProps ? <button type="button" draggable {...dragHandleProps} className="cursor-grab rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 active:cursor-grabbing" aria-label={`Drag ${exercise.exerciseNameSnapshot}`}><GripVertical className="h-5 w-5" /></button> : !hideExerciseName && onMove ? <><button type="button" disabled={!index} onClick={() => onMove(index, -1)} className="p-2 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button><button type="button" disabled={index === total - 1} onClick={() => onMove(index, 1)} className="p-2 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button></> : null}',
    id,
  )
  next = replaceRequired(
    next,
    '  const [picker, setPicker] = useState(null);\n  const [editing, setEditing] = useState(null);',
    '  const [picker, setPicker] = useState(null);\n  const [editing, setEditing] = useState(null);\n  const [draggingIndex, setDraggingIndex] = useState(null);\n  const [dragOverIndex, setDragOverIndex] = useState(null);',
    id,
  )
  next = replaceRequired(
    next,
    'const list = ordered(workout.exercises); const move = (index, direction) => { const target = index + direction; if (target < 0 || target >= list.length) return; const next = list.slice(); [next[index], next[target]] = [next[target], next[index]]; onReorder(next.map((item, itemIndex) => ({ ...item, sortOrder: itemIndex }))); };\n  const chooseExercise = (definition) => { if (picker?.mode === "replace") onReplaceExercise?.(picker.exercise.id, definition); else onAddExercise?.(definition); setPicker(null); };',
    'const list = ordered(workout.exercises); const move = (index, direction) => { const target = index + direction; if (target < 0 || target >= list.length) return; const next = list.slice(); [next[index], next[target]] = [next[target], next[index]]; onReorder(next.map((item, itemIndex) => ({ ...item, sortOrder: itemIndex }))); };\n  const dropExercise = (fromIndex, toIndex) => { if (fromIndex === null || fromIndex === toIndex) return; const next = list.slice(); const [item] = next.splice(fromIndex, 1); next.splice(toIndex, 0, item); onReorder(next.map((exercise, itemIndex) => ({ ...exercise, sortOrder: itemIndex }))); };\n  const chooseExercise = (definition) => { if (picker?.mode === "replace") onReplaceExercise?.(picker.exercise.id, definition); else onAddExercise?.(definition); setPicker(null); };',
    id,
  )
  next = replaceRequired(
    next,
    '{list.map((exercise, index) => <ExerciseCard key={exercise.id} exercise={exercise} oneOff={workout.sourceType === "one_off"} index={index} total={list.length} onChange={onChange} onAddSet={onAddSet} onRemoveSet={onRemoveSet} onRemoveExercise={onRemoveExercise} onChangeExercise={() => setEditing(exercise)} onEquipment={onEquipment} onMove={move}/>)}',
    '{list.map((exercise, index) => <div key={exercise.id} onDragOver={(event) => { event.preventDefault(); setDragOverIndex(index); }} onDrop={() => { dropExercise(draggingIndex, index); setDraggingIndex(null); setDragOverIndex(null); }} className={`reorder-target transition ${dragOverIndex === index && draggingIndex !== index ? "reorder-over" : ""} ${draggingIndex === index ? "reorder-dragging" : ""}`}><ExerciseCard exercise={exercise} oneOff={workout.sourceType === "one_off"} index={index} total={list.length} onChange={onChange} onAddSet={onAddSet} onRemoveSet={onRemoveSet} onRemoveExercise={onRemoveExercise} onChangeExercise={() => setEditing(exercise)} onEquipment={onEquipment} onMove={move} dragHandleProps={{ onDragStart: (event) => { event.dataTransfer.effectAllowed = "move"; setDraggingIndex(index); setDragOverIndex(index); }, onDragEnd: () => { setDraggingIndex(null); setDragOverIndex(null); } }}/></div>)}',
    id,
  )
  return next
}

function transformIndexCss(code) {
  return `${code}\n\n/* Drag and drop reorder feedback */\n.reorder-target {\n  position: relative;\n}\n\n.reorder-target.reorder-over::before {\n  content: "";\n  position: absolute;\n  z-index: 30;\n  left: 0.35rem;\n  right: 0.35rem;\n  top: -0.45rem;\n  height: 3px;\n  border-radius: 999px;\n  background: #2563eb;\n  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);\n}\n\n.reorder-dragging {\n  opacity: 0.55;\n  transform: scale(0.992);\n}\n`
}

export function reorderUxBuildPlugin() {
  return {
    name: 'reorder-ux',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/plans/PlansScreen.jsx')) return transformPlansScreen(code, id)
      if (cleanId.endsWith('/src/features/workout/QuickWorkoutBuilder.jsx')) return transformQuickWorkoutBuilder(code, id)
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      if (cleanId.endsWith('/src/index.css')) return transformIndexCss(code)
      return null
    },
  }
}
