function transformPlansScreen(code) {
  let next = code

  next = next.replace(
    'className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-left hover:bg-white" aria-expanded={expandedSessionIds.has(session.id)}',
    'className={cls("flex min-h-10 min-w-0 items-center gap-2 rounded-xl text-left hover:bg-white", expandedSessionIds.has(session.id) ? "shrink-0 px-1.5" : "flex-1 px-2")} aria-expanded={expandedSessionIds.has(session.id)}',
  )

  next = next.replace(
    '<div className="flex items-start gap-2">\n              <button type="button" className={cls("flex min-h-10',
    '<div className="flex items-center gap-2">\n              <button type="button" className={cls("flex min-h-10',
  )

  next = next.replaceAll(
    'reorder-target cursor-grab scroll-mt-4 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition active:cursor-grabbing',
    'reorder-target cursor-grab scroll-mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 transition active:cursor-grabbing sm:p-4',
  )

  next = next.replace(
    '<div className="flex flex-wrap gap-2">\n                      <Button size="sm" variant="outline" onClick={() => openPickerForReplace(sessionIndex, exerciseIndex)}>Change exercise</Button>',
    '<div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap [&>button]:w-full sm:[&>button]:w-auto">\n                      <Button size="sm" variant="outline" onClick={() => openPickerForReplace(sessionIndex, exerciseIndex)}>Change exercise</Button>',
  )

  next = next.replace(
    '<div className="flex flex-wrap items-center justify-between gap-2">\n                    <div className="flex items-start gap-2">',
    '<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">\n                    <div className="flex w-full min-w-0 items-start gap-2 sm:flex-1">',
  )

  return next
}

function polishSetButtons(code) {
  const oldButtons = '<div className="mt-3 flex flex-wrap gap-2"><button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50" onClick={() => onAddSet?.(exercise.id)}>+ Add set</button><button type="button" disabled={setCount <= 1} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => onRemoveSet?.(exercise.id)}>Remove set</button></div>'
  const newButtons = '<div className="mt-3 grid w-full grid-cols-2 gap-2"><button type="button" className="workout-set-control w-full rounded-lg bg-white px-2.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50" onClick={() => onAddSet?.(exercise.id)}>+ Add set</button><button type="button" disabled={setCount <= 1} className="workout-set-control w-full rounded-lg bg-white px-2.5 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50 hover:ring-red-200 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-slate-400 disabled:shadow-none disabled:ring-0 disabled:opacity-45" onClick={() => onRemoveSet?.(exercise.id)}>− Remove set</button></div>'
  let next = code.replaceAll(oldButtons, newButtons)

  const oldLinkedButtons = '<div className="mt-3 flex flex-wrap gap-2"><button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50" onClick={() => onAddSet?.(left.id)}>+ Add set</button><button type="button" disabled={setCount <= 1} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => onRemoveSet?.(left.id)}>Remove set</button></div>'
  const newLinkedButtons = '<div className="mt-3 grid w-full grid-cols-2 gap-2"><button type="button" className="workout-set-control w-full rounded-lg bg-white px-2.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50" onClick={() => onAddSet?.(left.id)}>+ Add set</button><button type="button" disabled={setCount <= 1} className="workout-set-control w-full rounded-lg bg-white px-2.5 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50 hover:ring-red-200 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-slate-400 disabled:shadow-none disabled:ring-0 disabled:opacity-45" onClick={() => onRemoveSet?.(left.id)}>− Remove set</button></div>'
  next = next.replaceAll(oldLinkedButtons, newLinkedButtons)

  next = next.replace(
    '{side || exercise.prescription?.targetReps?.type === "range" ? <p',
    '{side || (!hideExerciseName && exercise.prescription?.targetReps?.type === "range") ? <p',
  )
  next = next.replace(
    '[side, exercise.prescription?.targetReps?.type === "range" ? `Range:',
    '[side, !hideExerciseName && exercise.prescription?.targetReps?.type === "range" ? `Range:',
  )

  return next
}

export function programmeWorkoutVisualPolishBuildPlugin() {
  return {
    name: 'programme-workout-visual-polish',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/plans/PlansScreen.jsx')) return transformPlansScreen(code)
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return polishSetButtons(code)
      return null
    },
  }
}
