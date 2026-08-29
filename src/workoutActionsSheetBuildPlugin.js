function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Workout actions sheet transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

function transformWorkoutScreen(code, id) {
  let next = code

  next = replaceRequired(
    next,
    'import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";',
    'import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";\nimport { createPortal } from "react-dom";',
    id,
  )

  next = replaceRequired(
    next,
    '  const [actionsOpen, setActionsOpen] = useState(false);',
    '  const [actionsOpen, setActionsOpen] = useState(false);\n  useEffect(() => {\n    if (!actionsOpen) return undefined;\n    const body = document.body;\n    const root = document.documentElement;\n    const bodyOverflow = body.style.overflow;\n    const rootOverflow = root.style.overflow;\n    const overscroll = root.style.overscrollBehavior;\n    body.style.overflow = "hidden";\n    root.style.overflow = "hidden";\n    root.style.overscrollBehavior = "none";\n    return () => { body.style.overflow = bodyOverflow; root.style.overflow = rootOverflow; root.style.overscrollBehavior = overscroll; };\n  }, [actionsOpen]);',
    id,
  )

  next = replaceRequired(
    next,
    '{actionsOpen ? <div className="absolute right-0 top-10 z-30 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">{onChangeExercise ? <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setActionsOpen(false); onChangeExercise(exercise); }}>Change exercise</button> : null}{onRemoveExercise ? <button type="button" className="block w-full px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50" onClick={() => { setActionsOpen(false); onRemoveExercise(exercise.id); }}>Delete exercise</button> : null}</div> : null}',
    '{actionsOpen ? <>{createPortal(<><button type="button" aria-label="Close exercise options" className="fixed inset-0 z-[9998] cursor-default touch-none bg-slate-900/40 sm:hidden" onClick={() => setActionsOpen(false)}/><div className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:hidden"><section role="dialog" aria-modal="true" aria-label={`${exercise.exerciseNameSnapshot} options`} className="pointer-events-auto w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-base font-semibold text-slate-900">{exercise.exerciseNameSnapshot}</p><p className="mt-0.5 text-xs text-slate-500">Exercise options</p></div><Button variant="outline" size="sm" className="shrink-0" onClick={() => setActionsOpen(false)}>Close</Button></div>{onChangeExercise ? <Button variant="outline" className="mt-4 w-full" onClick={() => { setActionsOpen(false); onChangeExercise(exercise); }}>Edit exercise</Button> : null}{onRemoveExercise ? <Button variant="danger" className="mt-2 w-full" onClick={() => { setActionsOpen(false); onRemoveExercise(exercise.id); }}>Delete exercise</Button> : null}</section></div></>, document.body)}<div className="absolute right-0 top-10 z-30 hidden w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg sm:block">{onChangeExercise ? <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setActionsOpen(false); onChangeExercise(exercise); }}>Edit exercise</button> : null}{onRemoveExercise ? <button type="button" className="block w-full px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50" onClick={() => { setActionsOpen(false); onRemoveExercise(exercise.id); }}>Delete exercise</button> : null}</div></> : null}',
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
