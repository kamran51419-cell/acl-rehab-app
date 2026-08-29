function transformWorkoutScreen(code) {
  return code.replaceAll('>Change exercise</button>', '>Edit exercise</button>')
}

export function workoutActionTextBuildPlugin() {
  return {
    name: 'workout-action-text',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code)
      return null
    },
  }
}
