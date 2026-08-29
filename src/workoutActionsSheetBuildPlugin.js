function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Workout actions sheet transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

function transformWorkoutScreen(code, id) {
  let next = code

  next = replaceRequired(
    next,
    '  const [actionsOpen, setActionsOpen] = useState(false);',
    '  const [actionsOpen, setActionsOpen] = useState(false);\n  useEffect(() => {\n    if (!actionsOpen) return undefined;\n    const body = document.body; const root = document.documentElement;\n    const previousBodyOverflow = body.style.overflow; const previousRootOverflow = root.style.overflow; const previousOverscroll = root.style.overscrollBehavior;\n    body.style.overflow = "hidden"; root.style.overflow = "hidden"; root.style.overscrollBehavior = "none";\n    return () => { body.style.overflow = previousBodyOverflow; root.style.overflow = previousRootOverflow; root.style.overscrollBehavior = previousOverscroll; };\n  }, [actionsOpen]);',
    id,
  )

  next = replaceRequired(
    next,
    '{actionsOpen ? <div className="absolute right-0 top-10 z-30 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">{onChangeExercise ? <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setActionsOpen(false); onChangeExercise(exercise); }}>Change exercise</button> : null}{onRemoveExercise ? <button type="button" className="block w-full px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50" onClick={() => { setActionsOpen(false); onRemoveExercise(exercise.id); }}>Delete exercise</button> : null}</div> : null}',
    '{actionsOpen ? <><button type="button" aria-label="Close exercise options" className="fixed inset-0 z-[80] cursor-default bg-slate-950/35 backdrop-blur-[1px] sm:hidden" onClick={() => setActionsOpen(false)}/><div role="dialog" aria-modal="true" aria-label={`${exercise.exerciseNameSnapshot} options`} className="fixed inset-x-0 bottom-0 z-[90] mx-auto w-full max-w-lg rounded-t-3xl border border-slate-200 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-10 sm:w-52 sm:rounded-xl sm:p-1.5"><div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-200 sm:hidden"/><div className="mb-2 px-1 pt-1 sm:hidden"><p className="text-sm font-semibold text-slate-900">Exercise options</p><p className="truncate text-xs text-slate-500">{exercise.exerciseNameSnapshot}</p></div>{onChangeExercise ? <button type="button" className="flex min-h-12 w-full items-center rounded-xl px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 sm:min-h-0 sm:py-2" onClick={() => { setActionsOpen(false); onChangeExercise(exercise); }}>Change exercise</button> : null}{onRemoveExercise ? <button type="button" className="mt-1 flex min-h-12 w-full items-center rounded-xl px-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50 sm:min-h-0 sm:py-2" onClick={() => { setActionsOpen(false); onRemoveExercise(exercise.id); }}>Delete exercise</button> : null}<button type="button" className="mt-2 flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-100 px-3 text-sm font-semibold text-slate-700 sm:hidden" onClick={() => setActionsOpen(false)}>Cancel</button></div></> : null}',
    id,
  )

  return next
}

export function workoutActionsSheetBuildPlugin() {
  return {
    name: 'workout-actions-sheet',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      return null
    },
  }
}
