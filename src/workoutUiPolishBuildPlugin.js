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
    '<section className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Edit exercise</h2><p className="mt-1 text-xs text-slate-500">Changes here apply to this workout only. Your Programme stays unchanged.</p></div><button type="button" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600" onClick={onCancel}>Cancel</button></div>',
    '<section className="max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white px-4 pb-10 pt-5 shadow-xl sm:max-h-[88vh] sm:px-5 sm:pb-9 sm:pt-6"><div><h2 className="text-lg font-semibold">Edit exercise</h2><p className="mt-1 text-xs text-slate-500">Changes here apply to this workout only. Your Programme stays unchanged.</p></div>',
    id,
  )
  next = replaceOnce(
    next,
    '<div className="mt-5 grid grid-cols-2 gap-3"><Button variant="outline" onClick={onCancel}>Cancel</Button><Button onClick={() => onSave(draft)}>Save changes</Button></div>',
    '<div className="mt-7 grid grid-cols-2 gap-3 pb-2"><button type="button" className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onCancel}>Cancel</button><button type="button" className="h-11 rounded-xl px-4 text-sm font-semibold" style={{ backgroundColor: "#2563eb", color: "#ffffff" }} onClick={() => onSave(draft)}>Save changes</button></div>',
    id,
  )
  return next
}

function transformIndexCss(code) {
  return `${code}\n\n/* Consistent native select spacing */\nselect:not([multiple]) {\n  -webkit-appearance: none;\n  appearance: none;\n  padding-right: 2.5rem !important;\n  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='m6 8 4 4 4-4' stroke='%2364758b' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");\n  background-repeat: no-repeat;\n  background-position: right 0.8rem center;\n  background-size: 1rem 1rem;\n}\n\nselect:not([multiple]):disabled {\n  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='m6 8 4 4 4-4' stroke='%2394a3b8' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");\n}\n`
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
