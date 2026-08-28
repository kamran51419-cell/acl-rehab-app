function transformPlansScreen(code) {
  return code.replace(
    'className="h-12 rounded-xl pl-10 text-base" autoFocus aria-label="Search exercises"',
    'className="h-12 rounded-xl pl-10 text-base" aria-label="Search exercises"',
  )
}

function transformQuickWorkoutBuilder(code) {
  return code.replace(
    'className="h-12 rounded-xl pl-10 text-base" autoFocus aria-label="Search exercises"',
    'className="h-12 rounded-xl pl-10 text-base" aria-label="Search exercises"',
  )
}

function transformWorkoutScreen(code) {
  return code.replace(
    '<input autoFocus className="min-w-0 flex-1 outline-none" placeholder="Search exercises"',
    '<input className="min-w-0 flex-1 outline-none" placeholder="Search exercises"',
  )
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
      return null
    },
  }
}
