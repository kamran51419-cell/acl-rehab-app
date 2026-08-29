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
    '{actionsOpen ? <div className="absolute right-0 top-10 z-30 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">{onChangeExercise ? <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setActionsOpen(false); onChangeExercise(exercise); }}>Change exercise</button> : null}{onRemoveExercise ? <button type="button" className="block w-full px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50" onClick={() => { setActionsOpen(false); onRemoveExercise(exercise.id); }}>Delete exercise</button> : null}</div> : null}',
    '{actionsOpen ? <>{createPortal(<><button type="button" aria-label="Close exercise options" className="fixed inset-0 z-[9998] cursor-default touch-none bg-slate-950/30 sm:hidden" onClick={() => setActionsOpen(false)}/><div role="dialog" aria-modal="true" aria-label={`${exercise.exerciseNameSnapshot} options`} className="fixed inset-x-0 bottom-0 z-[9999] mx-auto w-full max-w-lg rounded-t-3xl border border-slate-200 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 shadow-2xl sm:hidden"><div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-200"/><div className="mb-2 px-1 pt-1"><p className="text-sm font-semibold text-slate-900">Exercise options</p><p className="truncate text-xs text-slate-500">{exercise.exerciseNameSnapshot}</p></div>{onChangeExercise ? <button type="button" className="flex min-h-12 w-full items-center rounded-xl px-3 text-left text-sm font-medium text-slate-700 active:bg-slate-50" onClick={() => { setActionsOpen(false); onChangeExercise(exercise); }}>Change exercise</button> : null}{onRemoveExercise ? <button type="button" className="mt-1 flex min-h-12 w-full items-center rounded-xl px-3 text-left text-sm font-semibold text-red-600 active:bg-red-50" onClick={() => { setActionsOpen(false); onRemoveExercise(exercise.id); }}>Delete exercise</button> : null}<button type="button" className="mt-2 flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-100 px-3 text-sm font-semibold text-slate-700" onClick={() => setActionsOpen(false)}>Cancel</button></div></>, document.body)}<div className="absolute right-0 top-10 z-30 hidden w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg sm:block">{onChangeExercise ? <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setActionsOpen(false); onChangeExercise(exercise); }}>Change exercise</button> : null}{onRemoveExercise ? <button type="button" className="block w-full px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50" onClick={() => { setActionsOpen(false); onRemoveExercise(exercise.id); }}>Delete exercise</button> : null}</div></> : null}',
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
