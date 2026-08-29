function transformWorkoutScreen(code) {
  return code
    .replaceAll(
      'className="fixed inset-x-0 bottom-0 z-[9999] mx-auto w-full max-w-lg rounded-t-2xl border-t border-slate-200 bg-white px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-xl sm:hidden"',
      'className="fixed left-1/2 top-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:hidden"',
    )
    .replaceAll(
      'className="mb-3 flex items-center justify-between gap-3 px-1"',
      'className="mb-4 flex items-start justify-between gap-3"',
    )
    .replaceAll('>Change exercise</Button>', '>Edit exercise</Button>')
    .replaceAll('>Change exercise</button>', '>Edit exercise</button>')
}

export function workoutActionsModalPolishBuildPlugin() {
  return {
    name: 'workout-actions-modal-polish',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code)
      return null
    },
  }
}
