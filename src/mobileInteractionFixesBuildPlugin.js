function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Mobile interaction transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

const TOUCH_HELPER = `function startLongPressReorder(event, handlers) {
  if (event.touches?.length !== 1) return;
  if (event.target?.closest?.('button, input, select, textarea, a, [role="button"]')) return;
  const start = event.touches[0];
  let active = false;
  let lastElement = event.currentTarget;
  let timer = null;

  const cleanup = () => {
    clearTimeout(timer);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    document.removeEventListener('touchcancel', onEnd);
    document.body.classList.remove('touch-reordering');
  };

  const onMove = (moveEvent) => {
    const touch = moveEvent.touches?.[0];
    if (!touch) return;
    if (!active) {
      if (Math.hypot(touch.clientX - start.clientX, touch.clientY - start.clientY) > 12) cleanup();
      return;
    }
    moveEvent.preventDefault();
    lastElement = document.elementFromPoint(touch.clientX, touch.clientY) || lastElement;
    handlers.onMove?.(lastElement);
  };

  const onEnd = (endEvent) => {
    if (active) {
      endEvent.preventDefault();
      handlers.onDrop?.(lastElement);
    }
    cleanup();
  };

  timer = window.setTimeout(() => {
    active = true;
    window.getSelection?.()?.removeAllRanges?.();
    document.body.classList.add('touch-reordering');
    handlers.onStart?.();
  }, 220);

  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd, { passive: false });
  document.addEventListener('touchcancel', onEnd, { passive: false });
}`

const TOUCH_DRAGGABLE = 'draggable={typeof window === "undefined" || !("ontouchstart" in window)}'
const TOUCH_CONTEXT_GUARD = 'onContextMenu={(event) => { if (typeof window !== "undefined" && "ontouchstart" in window) event.preventDefault(); }}'

function transformPlansScreen(code, id) {
  let next = code
  next = replaceRequired(next, 'function cls(...parts) {\n  return parts.filter(Boolean).join(" ");\n}', `function cls(...parts) {\n  return parts.filter(Boolean).join(" ");\n}\n\n${TOUCH_HELPER}`, id)

  next = replaceRequired(
    next,
    '            draggable\n            onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggingSession(sessionIndex); setDragOverSession(sessionIndex); }}',
    `            ${TOUCH_DRAGGABLE}\n            data-reorder-session-index={sessionIndex}\n            ${TOUCH_CONTEXT_GUARD}\n            onTouchStart={(event) => startLongPressReorder(event, { onStart: () => { setDraggingSession(sessionIndex); setDragOverSession(sessionIndex); }, onMove: (element) => { const target = element?.closest?.("[data-reorder-session-index]"); if (target) setDragOverSession(Number(target.dataset.reorderSessionIndex)); }, onDrop: (element) => { const target = element?.closest?.("[data-reorder-session-index]"); const targetIndex = target ? Number(target.dataset.reorderSessionIndex) : sessionIndex; moveSession(sessionIndex, targetIndex); setDraggingSession(null); setDragOverSession(null); } })}\n            onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggingSession(sessionIndex); setDragOverSession(sessionIndex); }}`,
    id,
  )

  next = replaceRequired(
    next,
    '                  draggable\n                  onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.effectAllowed = "move"; setDraggingExercise({ sessionIndex, exerciseIndex }); setDragOverExercise({ sessionIndex, exerciseIndex }); }}',
    `                  ${TOUCH_DRAGGABLE}\n                  data-reorder-session-index={sessionIndex}\n                  data-reorder-exercise-index={exerciseIndex}\n                  ${TOUCH_CONTEXT_GUARD}\n                  onTouchStart={(event) => { event.stopPropagation(); startLongPressReorder(event, { onStart: () => { setDraggingExercise({ sessionIndex, exerciseIndex }); setDragOverExercise({ sessionIndex, exerciseIndex }); }, onMove: (element) => { const target = element?.closest?.("[data-reorder-exercise-index]"); if (target && Number(target.dataset.reorderSessionIndex) === sessionIndex) setDragOverExercise({ sessionIndex, exerciseIndex: Number(target.dataset.reorderExerciseIndex) }); }, onDrop: (element) => { const target = element?.closest?.("[data-reorder-exercise-index]"); const targetIndex = target && Number(target.dataset.reorderSessionIndex) === sessionIndex ? Number(target.dataset.reorderExerciseIndex) : exerciseIndex; moveExercise(sessionIndex, exerciseIndex, targetIndex); setDraggingExercise(null); setDragOverExercise(null); } }); }}\n                  onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.effectAllowed = "move"; setDraggingExercise({ sessionIndex, exerciseIndex }); setDragOverExercise({ sessionIndex, exerciseIndex }); }}`,
    id,
  )

  return next
}

function transformQuickWorkoutBuilder(code, id) {
  let next = code
  const anchor = 'function cls(...parts) {'
  if (next.includes(anchor)) {
    next = replaceRequired(next, 'function cls(...parts) {\n  return parts.filter(Boolean).join(" ");\n}', `function cls(...parts) {\n  return parts.filter(Boolean).join(" ");\n}\n\n${TOUCH_HELPER}`, id)
  } else {
    next = `${TOUCH_HELPER}\n\n${next}`
  }
  next = replaceRequired(
    next,
    '              draggable\n              onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggingIndex(index); setDragOverIndex(index); }}',
    `              ${TOUCH_DRAGGABLE}\n              data-reorder-exercise-index={index}\n              ${TOUCH_CONTEXT_GUARD}\n              onTouchStart={(event) => startLongPressReorder(event, { onStart: () => { setDraggingIndex(index); setDragOverIndex(index); }, onMove: (element) => { const target = element?.closest?.("[data-reorder-exercise-index]"); if (target) setDragOverIndex(Number(target.dataset.reorderExerciseIndex)); }, onDrop: (element) => { const target = element?.closest?.("[data-reorder-exercise-index]"); const targetIndex = target ? Number(target.dataset.reorderExerciseIndex) : index; moveExercise(index, targetIndex); setDraggingIndex(null); setDragOverIndex(null); } })}\n              onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggingIndex(index); setDragOverIndex(index); }}`,
    id,
  )
  return next
}

function transformWorkoutScreen(code, id) {
  let next = code
  next = replaceRequired(next, 'const noop = () => {};', `${TOUCH_HELPER}\n\nfunction AutoGrowTextarea({ className = "", onInput, style, ...props }) {\n  const ref = useRef(null);\n  const resize = useCallback(() => { const node = ref.current; if (!node) return; node.style.height = "auto"; node.style.height = Math.max(40, node.scrollHeight) + "px"; }, []);\n  useEffect(resize, [props.value, resize]);\n  return <textarea ref={ref} rows={1} {...props} style={{ fieldSizing: "content", ...style }} onInput={(event) => { resize(); onInput?.(event); }} className={className} />;\n}\n\nconst noop = () => {};`, id)

  next = replaceRequired(
    next,
    'draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggingIndex(index); setDragOverIndex(index); }}',
    `${TOUCH_DRAGGABLE} data-reorder-exercise-index={index} ${TOUCH_CONTEXT_GUARD} onTouchStart={(event) => startLongPressReorder(event, { onStart: () => { setDraggingIndex(index); setDragOverIndex(index); }, onMove: (element) => { const target = element?.closest?.("[data-reorder-exercise-index]"); if (target) setDragOverIndex(Number(target.dataset.reorderExerciseIndex)); }, onDrop: (element) => { const target = element?.closest?.("[data-reorder-exercise-index]"); const targetIndex = target ? Number(target.dataset.reorderExerciseIndex) : index; dropExercise(index, targetIndex); setDraggingIndex(null); setDragOverIndex(null); } })} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggingIndex(index); setDragOverIndex(index); }}`,
    id,
  )

  next = next.split('className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3"').join('className="mt-1 block h-10 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 px-3 text-sm"')
  next = replaceRequired(
    next,
    '<textarea className="mt-1 min-h-16 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-slate-400" value={exercise.workoutNote || ""} placeholder="Add a note for this workout" onChange={(event) => onExerciseNote(exercise.id, event.target.value)}/>',
    '<AutoGrowTextarea className="mt-1 min-h-10 w-full resize-none overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-slate-400" value={exercise.workoutNote || ""} placeholder="Add a note for this workout" onChange={(event) => onExerciseNote(exercise.id, event.target.value)}/>',
    id,
  )
  next = replaceRequired(
    next,
    '<textarea className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 p-3" value={workout.notes || ""} onChange={(event) => onNotes(event.target.value)}/>',
    '<AutoGrowTextarea className="mt-1 min-h-10 w-full resize-none overflow-hidden rounded-xl border border-slate-200 px-3 py-2" value={workout.notes || ""} onChange={(event) => onNotes(event.target.value)}/>',
    id,
  )
  return next
}

function transformIndexCss(code) {
  return `${code}\n\nbody.touch-reordering {\n  user-select: none;\n  -webkit-user-select: none;\n  overscroll-behavior: none;\n}\n\n@media (hover: none) and (pointer: coarse) {\n  .reorder-target {\n    -webkit-touch-callout: none;\n  }\n\n  body.touch-reordering,\n  body.touch-reordering .reorder-target {\n    touch-action: none;\n  }\n}\n\n@media (max-width: 639px) {\n  input[type='date'] {\n    display: block;\n    width: 100% !important;\n    min-width: 0 !important;\n    max-width: 100% !important;\n    inline-size: 100% !important;\n    max-inline-size: 100% !important;\n    box-sizing: border-box;\n    overflow: hidden;\n    font-size: 16px;\n  }\n}\n`
}

export function mobileInteractionFixesBuildPlugin() {
  return {
    name: 'mobile-interaction-fixes',
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
