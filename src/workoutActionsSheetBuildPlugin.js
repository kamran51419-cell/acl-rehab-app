function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Workout inline actions transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

function transformWorkoutScreen(code, id) {
  return replaceRequired(
    code,
    '{onChangeExercise || onRemoveExercise ? <div className="relative"><button type="button" aria-label={`Edit ${exercise.exerciseNameSnapshot}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setActionsOpen((value) => !value)}><MoreHorizontal className="h-5 w-5"/></button>{actionsOpen ? <div className="absolute right-0 top-10 z-30 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">{onChangeExercise ? <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setActionsOpen(false); onChangeExercise(exercise); }}>Change exercise</button> : null}{onRemoveExercise ? <button type="button" className="block w-full px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50" onClick={() => { setActionsOpen(false); onRemoveExercise(exercise.id); }}>Delete exercise</button> : null}</div> : null}</div> : oneOff ? <button type="button" onClick={() => onRemoveExercise(exercise.id)} className="min-h-10 px-2 text-sm font-medium text-red-600">Remove</button> : null}</div>',
    '{onChangeExercise || onRemoveExercise ? <div className="relative"><button type="button" aria-label={`Edit ${exercise.exerciseNameSnapshot}`} aria-expanded={actionsOpen} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setActionsOpen((value) => !value)}><MoreHorizontal className="h-5 w-5"/></button>{actionsOpen ? <div className="absolute right-0 top-10 z-30 hidden w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg sm:block">{onChangeExercise ? <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setActionsOpen(false); onChangeExercise(exercise); }}>Edit exercise</button> : null}{onRemoveExercise ? <button type="button" className="block w-full px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50" onClick={() => { setActionsOpen(false); onRemoveExercise(exercise.id); }}>Delete exercise</button> : null}</div> : null}</div> : oneOff ? <button type="button" onClick={() => onRemoveExercise(exercise.id)} className="min-h-10 px-2 text-sm font-medium text-red-600">Remove</button> : null}</div>{actionsOpen && (onChangeExercise || onRemoveExercise) ? <div className="mt-3 flex gap-2 rounded-xl bg-slate-50 p-2 sm:hidden">{onChangeExercise ? <Button variant="outline" className="min-w-0 flex-1" onClick={() => { setActionsOpen(false); onChangeExercise(exercise); }}>Edit exercise</Button> : null}{onRemoveExercise ? <Button variant="danger" className="min-w-0 flex-1" onClick={() => { setActionsOpen(false); onRemoveExercise(exercise.id); }}>Delete exercise</Button> : null}</div> : null}',
    id,
  )
}

export function workoutActionsSheetBuildPlugin() {
  return {
    name: 'workout-inline-actions',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      return null
    },
  }
}
