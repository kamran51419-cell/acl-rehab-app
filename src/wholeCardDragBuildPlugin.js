function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Whole-card drag transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

function transformPlansScreen(code, id) {
  let next = code

  // Keep programme sessions handle-only draggable so text inputs remain normally selectable.
  // Exercise cards still use the existing whole-card drag behaviour below.
  next = replaceRequired(
    next,
    '                  onDragOver={(event) => { event.preventDefault(); if (draggingExercise?.sessionIndex === sessionIndex) setDragOverExercise({ sessionIndex, exerciseIndex }); }}\n                  onDrop={() => { if (draggingExercise?.sessionIndex === sessionIndex) moveExercise(sessionIndex, draggingExercise.exerciseIndex, exerciseIndex); setDraggingExercise(null); setDragOverExercise(null); }}\n                  className={cls("reorder-target space-y-3 rounded-xl border bg-white p-3 transition", activeExerciseId === exercise.id ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200", dragOverExercise?.sessionIndex === sessionIndex && dragOverExercise?.exerciseIndex === exerciseIndex && draggingExercise?.exerciseIndex !== exerciseIndex ? "reorder-over" : "", draggingExercise?.sessionIndex === sessionIndex && draggingExercise?.exerciseIndex === exerciseIndex ? "reorder-dragging" : "")}',
    '                  draggable\n                  onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.effectAllowed = "move"; setDraggingExercise({ sessionIndex, exerciseIndex }); setDragOverExercise({ sessionIndex, exerciseIndex }); }}\n                  onDragEnd={(event) => { event.stopPropagation(); setDraggingExercise(null); setDragOverExercise(null); }}\n                  onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); if (draggingExercise?.sessionIndex === sessionIndex) setDragOverExercise({ sessionIndex, exerciseIndex }); }}\n                  onDrop={(event) => { event.stopPropagation(); if (draggingExercise?.sessionIndex === sessionIndex) moveExercise(sessionIndex, draggingExercise.exerciseIndex, exerciseIndex); setDraggingExercise(null); setDragOverExercise(null); }}\n                  className={cls("reorder-target cursor-grab space-y-3 rounded-xl border bg-white p-3 transition active:cursor-grabbing", activeExerciseId === exercise.id ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200", dragOverExercise?.sessionIndex === sessionIndex && dragOverExercise?.exerciseIndex === exerciseIndex && draggingExercise?.exerciseIndex !== exerciseIndex ? "reorder-over" : "", draggingExercise?.sessionIndex === sessionIndex && draggingExercise?.exerciseIndex === exerciseIndex ? "reorder-dragging" : "")}',
    id,
  )

  next = replaceRequired(
    next,
    '                      <button\n                        type="button"\n                        draggable\n                        onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggingExercise({ sessionIndex, exerciseIndex }); setDragOverExercise({ sessionIndex, exerciseIndex }); }}\n                        onDragEnd={() => { setDraggingExercise(null); setDragOverExercise(null); }}\n                        className="cursor-grab rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 active:cursor-grabbing"\n                        aria-label={`Drag ${exercise.exerciseNameSnapshot}`}\n                      >\n                        <GripVertical className="h-5 w-5" />\n                      </button>\n',
    '',
    id,
  )

  return next
}

function transformQuickWorkoutBuilder(code, id) {
  let next = code
  next = replaceRequired(
    next,
    '              onDragOver={(event) => { event.preventDefault(); setDragOverIndex(index); }}\n              onDrop={() => { moveExercise(draggingIndex, index); setDraggingIndex(null); setDragOverIndex(null); }}\n              className={`reorder-target space-y-3 rounded-xl border border-slate-200 bg-white p-3 transition ${dragOverIndex === index && draggingIndex !== index ? "reorder-over" : ""} ${draggingIndex === index ? "reorder-dragging" : ""}`}',
    '              draggable\n              onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggingIndex(index); setDragOverIndex(index); }}\n              onDragEnd={() => { setDraggingIndex(null); setDragOverIndex(null); }}\n              onDragOver={(event) => { event.preventDefault(); setDragOverIndex(index); }}\n              onDrop={() => { moveExercise(draggingIndex, index); setDraggingIndex(null); setDragOverIndex(null); }}\n              className={`reorder-target cursor-grab space-y-3 rounded-xl border border-slate-200 bg-white p-3 transition active:cursor-grabbing ${dragOverIndex === index && draggingIndex !== index ? "reorder-over" : ""} ${draggingIndex === index ? "reorder-dragging" : ""}`}',
    id,
  )
  next = replaceRequired(
    next,
    '<button type="button" draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggingIndex(index); setDragOverIndex(index); }} onDragEnd={() => { setDraggingIndex(null); setDragOverIndex(null); }} className="cursor-grab rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 active:cursor-grabbing" aria-label={`Drag ${exercise.exerciseNameSnapshot}`}><GripVertical className="h-5 w-5" /></button>',
    '',
    id,
  )
  return next
}

function transformWorkoutScreen(code, id) {
  let next = code
  next = replaceRequired(
    next,
    'onDragOver={(event) => { event.preventDefault(); setDragOverIndex(index); }} onDrop={() => { dropExercise(draggingIndex, index); setDraggingIndex(null); setDragOverIndex(null); }} className={`reorder-target transition ${dragOverIndex === index && draggingIndex !== index ? "reorder-over" : ""} ${draggingIndex === index ? "reorder-dragging" : ""}`}',
    'draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggingIndex(index); setDragOverIndex(index); }} onDragEnd={() => { setDraggingIndex(null); setDragOverIndex(null); }} onDragOver={(event) => { event.preventDefault(); setDragOverIndex(index); }} onDrop={() => { dropExercise(draggingIndex, index); setDraggingIndex(null); setDragOverIndex(null); }} className={`reorder-target cursor-grab transition active:cursor-grabbing ${dragOverIndex === index && draggingIndex !== index ? "reorder-over" : ""} ${draggingIndex === index ? "reorder-dragging" : ""}`}',
    id,
  )
  next = replaceRequired(
    next,
    ' onMove={move} dragHandleProps={{ onDragStart: (event) => { event.dataTransfer.effectAllowed = "move"; setDraggingIndex(index); setDragOverIndex(index); }, onDragEnd: () => { setDraggingIndex(null); setDragOverIndex(null); } }}',
    ' onMove={null}',
    id,
  )
  return next
}

export function wholeCardDragBuildPlugin() {
  return {
    name: 'whole-card-drag',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/plans/PlansScreen.jsx')) return transformPlansScreen(code, id)
      if (cleanId.endsWith('/src/features/workout/QuickWorkoutBuilder.jsx')) return transformQuickWorkoutBuilder(code, id)
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      return null
    },
  }
}
