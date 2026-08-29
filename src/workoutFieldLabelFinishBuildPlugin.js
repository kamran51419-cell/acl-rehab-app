function transformWorkoutScreen(code) {
  return code
    .replaceAll('className="workout-border-label"', 'className="workout-border-label !bg-white"')
    .replaceAll('className="workout-border-label workout-border-label-previous"', 'className="workout-border-label workout-border-label-previous !bg-white"')
}

export function workoutFieldLabelFinishBuildPlugin() {
  return {
    name: 'workout-field-label-finish',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code)
      return null
    },
  }
}
