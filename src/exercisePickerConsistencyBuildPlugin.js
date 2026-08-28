function replaceAll(code, oldText, newText) {
  return code.split(oldText).join(newText)
}

function transformPlansScreen(code) {
  let next = code
  next = replaceAll(next, '<Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />', '<Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />')
  next = replaceAll(next, 'className="h-12 rounded-xl pl-10 text-base" autoFocus aria-label="Search exercises"', 'className="exercise-picker-search h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-base outline-none" aria-label="Search exercises"')
  next = replaceAll(next, 'className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"', 'className="exercise-picker-row flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3"')
  next = replaceAll(next, '{replaceTarget ? "Use" : selected ? "Selected" : "Add"}', '{replaceTarget ? "Select" : selected ? "Selected" : "Add"}')
  next = replaceAll(next, '<div className="max-w-xs">{methodField}</div>', '<div className="w-full">{methodField}</div>')
  next = replaceAll(next, '<p className="mt-1 text-[11px] font-normal text-slate-400">Default for workouts. Previous programme history follows this unless you changed that workout manually.</p>', '')
  return next
}

function transformQuickWorkoutBuilder(code) {
  let next = code
  next = replaceAll(next, '<Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />', '<Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />')
  next = replaceAll(next, 'className="h-12 rounded-xl pl-10 text-base" autoFocus aria-label="Search exercises"', 'className="exercise-picker-search h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-base outline-none" aria-label="Search exercises"')
  next = replaceAll(next, 'className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"', 'className="exercise-picker-row flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3"')
  next = replaceAll(next, '{replaceIndex !== null ? "Use" : "Add"}', '{replaceIndex !== null ? "Select" : "Add"}')
  return next
}

function transformWorkoutScreen(code) {
  let next = code
  next = replaceAll(next, '<input autoFocus className="min-w-0 flex-1 outline-none" placeholder="Search exercises"', '<input className="min-w-0 flex-1 bg-transparent outline-none" placeholder="Search exercises"')
  next = replaceAll(next, 'className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3"', 'className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3"')
  next = replaceAll(next, 'placeholder="Search exercises" value={query}', 'placeholder="Search exercises" data-exercise-picker-search="true" value={query}')
  next = replaceAll(next, 'className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-slate-50"', 'className="exercise-picker-row flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left hover:bg-slate-50 sm:px-4 sm:py-3"')
  next = replaceAll(next, '<span className="text-xs font-medium text-blue-600">Use</span>', '<span className="exercise-picker-action">Select</span>')
  next = replaceAll(next, '<span className="text-sm font-medium text-blue-600">{replacing ? "Choose" : "Add"}</span>', '<span className="exercise-picker-action">{replacing ? "Select" : "Add"}</span>')
  return next
}

function transformIndexCss(code) {
  return `${code}\n\n.exercise-picker-search {\n  width: 100%;\n  border: 1px solid #cbd5e1 !important;\n  background: #ffffff !important;\n  box-shadow: none !important;\n}\n\n.exercise-picker-search:focus {\n  border-color: #94a3b8 !important;\n  outline: none !important;\n}\n\n[data-exercise-picker-search='true'] {\n  width: auto !important;\n  min-width: 0 !important;\n  flex: 1 1 0% !important;\n  border: 0 !important;\n  background: transparent !important;\n  box-shadow: none !important;\n  outline: none !important;\n}\n\n.exercise-picker-row {\n  min-height: 3.25rem;\n}\n\n.exercise-picker-action {\n  display: inline-flex;\n  flex-shrink: 0;\n  align-items: center;\n  justify-content: center;\n  min-width: 4.25rem;\n  min-height: 2rem;\n  border-radius: 0.65rem;\n  background: #2563eb;\n  padding: 0.35rem 0.7rem;\n  color: #fff;\n  font-size: 0.75rem;\n  font-weight: 600;\n  line-height: 1;\n}\n\n@media (max-width: 639px) {\n  .exercise-picker-row {\n    min-height: 3rem;\n  }\n\n  .exercise-picker-action {\n    min-width: 3.9rem;\n  }\n}\n`
}

export function exercisePickerConsistencyBuildPlugin() {
  return {
    name: 'exercise-picker-consistency',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/plans/PlansScreen.jsx')) return transformPlansScreen(code)
      if (cleanId.endsWith('/src/features/workout/QuickWorkoutBuilder.jsx')) return transformQuickWorkoutBuilder(code)
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code)
      if (cleanId.endsWith('/src/index.css')) return transformIndexCss(code)
      return null
    },
  }
}
