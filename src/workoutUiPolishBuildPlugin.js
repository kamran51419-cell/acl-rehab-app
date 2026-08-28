function replaceOnce(code, oldText, newText, id) {
  if (!code.includes(oldText)) {
    throw new Error(`Workout UI polish transform could not find expected source in ${id}`)
  }
  return code.replace(oldText, newText)
}

function transformWorkoutScreen(code, id) {
  let next = code
  next = replaceOnce(
    next,
    '<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-3 sm:items-center"><section className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Edit exercise</h2><p className="mt-1 text-xs text-slate-500">Changes here apply to this workout only. Your Programme stays unchanged.</p></div><button type="button" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600" onClick={onCancel}>Cancel</button></div>',
    '<div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-900/50 p-2 sm:p-6"><section id="workout-edit-modal" className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"><div id="workout-edit-header" className="shrink-0 px-4 pb-3 pt-4 sm:px-5 sm:pb-4 sm:pt-6"><h2 className="text-lg font-semibold">Edit exercise</h2><p className="mt-1 text-xs text-slate-500">Changes here apply to this workout only. Your Programme stays unchanged.</p></div><div id="workout-edit-scroll" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5">',
    id,
  )
  next = replaceOnce(
    next,
    '<div className="mt-5 grid grid-cols-2 gap-3"><Button variant="outline" onClick={onCancel}>Cancel</Button><Button onClick={() => onSave(draft)}>Save changes</Button></div>',
    '</div><div id="workout-edit-footer" className="shrink-0 grid grid-cols-2 gap-3 px-4 pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-4"><button type="button" className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onCancel}>Cancel</button><button id="workout-edit-save" type="button" className="h-11 rounded-xl px-4 text-sm font-semibold" onClick={() => onSave(draft)}>Save changes</button></div>',
    id,
  )
  return next
}

function transformIndexCss(code) {
  return `${code}\n\n/* Consistent native select spacing */\nselect:not([multiple]) {\n  -webkit-appearance: none;\n  appearance: none;\n  padding-right: 2.5rem !important;\n  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='m6 8 4 4 4-4' stroke='%2364758b' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");\n  background-repeat: no-repeat;\n  background-position: right 0.8rem center;\n  background-size: 1rem 1rem;\n}\n\nselect:not([multiple]):disabled {\n  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='m6 8 4 4 4-4' stroke='%2394a3b8' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");\n}\n\n#workout-edit-save {\n  background: #2563eb !important;\n  background-image: none !important;\n  color: #ffffff !important;\n  border: 1px solid #2563eb !important;\n}\n\n#workout-edit-save:hover {\n  background: #1d4ed8 !important;\n}\n\n#workout-edit-modal {\n  height: min(92dvh, 760px);\n  max-height: calc(100dvh - 1rem);\n}\n\n#workout-edit-scroll {\n  scrollbar-gutter: stable;\n  padding-bottom: 1rem;\n}\n\n#workout-edit-footer {\n  background: inherit;\n  padding-bottom: calc(1rem + env(safe-area-inset-bottom));\n}\n\n@media (max-width: 639px) {\n  #workout-edit-modal {\n    height: calc(100dvh - 0.75rem);\n    max-height: calc(100dvh - 0.75rem);\n  }\n\n  #workout-edit-header {\n    padding-top: 0.9rem;\n    padding-bottom: 0.65rem;\n  }\n\n  #workout-edit-scroll .space-y-3 > :not([hidden]) ~ :not([hidden]) {\n    margin-top: 0.5rem !important;\n  }\n\n  #workout-edit-scroll select:not([multiple]),\n  #workout-edit-scroll input:not([type='checkbox']):not([type='radio']) {\n    min-height: 2.35rem;\n  }\n\n  #workout-edit-footer {\n    padding-top: 0.6rem;\n  }\n}\n`
}

export function workoutUiPolishBuildPlugin() {
  return {
    name: 'workout-ui-polish',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      if (cleanId.endsWith('/src/index.css')) return transformIndexCss(code)
      return null
    },
  }
}
