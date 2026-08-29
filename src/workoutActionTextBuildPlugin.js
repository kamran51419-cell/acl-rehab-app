function moveActionsIntoHeader(block, openState) {
  let next = block

  next = next.replace(
    'className="flex items-start gap-2"',
    'className="workout-exercise-header flex flex-wrap items-start gap-2"',
  )
  next = next.replace(
    'className="flex items-start justify-between gap-3"',
    'className="workout-exercise-header flex flex-wrap items-start justify-between gap-3"',
  )

  const menuClass = 'absolute right-0 top-10 z-30 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg'
  const escapedState = openState.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(</button>)(\\{${escapedState} \\? <div className="${menuClass}">([\\s\\S]*?)</div> : null\\})(</div>)`)
  next = next.replace(pattern, '$1$4$2')
  next = next.replaceAll(
    `className="${menuClass}"`,
    `className="workout-exercise-actions-menu ${menuClass}"`,
  )

  return next
}

function transformWorkoutScreen(code) {
  let next = code.replaceAll('>Change exercise</button>', '>Edit exercise</button>')

  const cardStart = next.indexOf('export function ExerciseCard(')
  const cardEnd = cardStart >= 0 ? next.indexOf('\nfunction changeWorkout', cardStart) : -1
  if (cardStart >= 0 && cardEnd > cardStart) {
    const card = moveActionsIntoHeader(next.slice(cardStart, cardEnd), 'actionsOpen')
    next = `${next.slice(0, cardStart)}${card}${next.slice(cardEnd)}`
  }

  const pairStart = next.indexOf('function WorkoutExerciseDisplay(')
  const pairEnd = pairStart >= 0 ? next.indexOf('\n\nexport function WorkoutForm(', pairStart) : -1
  if (pairStart >= 0 && pairEnd > pairStart) {
    const pair = moveActionsIntoHeader(next.slice(pairStart, pairEnd), 'sharedActionsOpen')
    next = `${next.slice(0, pairStart)}${pair}${next.slice(pairEnd)}`
  }

  return next
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
