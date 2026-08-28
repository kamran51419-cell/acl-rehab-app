function transformWorkoutScreen(code) {
  let next = code
  const completedIndex = next.indexOf('function CompletedWorkoutEditor(')
  if (completedIndex < 0) return next

  const mapAnchor = '{ordered(draft.exercises).map((exercise, index) => '
  const mapStart = next.indexOf(mapAnchor, completedIndex)
  if (mapStart < 0) return next

  const groupedPrefix = '{ordered(draft.exercises).map((exercise, index) => isLinkedWorkoutRightSide(ordered(draft.exercises), exercise, index) ? null : '
  if (!next.startsWith(groupedPrefix, mapStart)) {
    next = next.slice(0, mapStart) + groupedPrefix + next.slice(mapStart + mapAnchor.length)
  }

  const cardStart = next.indexOf('<ExerciseCard exercise={exercise}', mapStart)
  if (cardStart < 0) return next
  next = next.slice(0, cardStart) + '<WorkoutExerciseDisplay list={ordered(draft.exercises)} exercise={exercise}' + next.slice(cardStart + '<ExerciseCard exercise={exercise}'.length)

  return next
}

export function catchUpLeftRightGroupingBuildPlugin() {
  return {
    name: 'catch-up-left-right-grouping',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code)
      return null
    },
  }
}
