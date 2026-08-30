function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Unified add-exercise state fix could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

function transformWorkoutScreen(code, id) {
  let next = code

  next = replaceRequired(
    next,
    'const [editing, setEditing] = useState(null);\n  const [adding, setAdding] = useState(null); const [picker, setPicker] = useState(false); const [adding, setAdding] = useState(null);',
    'const [editing, setEditing] = useState(null); const [picker, setPicker] = useState(false); const [adding, setAdding] = useState(null);',
    id,
  )

  const formStart = next.indexOf('export function WorkoutForm(')
  const formEnd = formStart >= 0 ? next.indexOf('\n\nexport function DiscardWorkoutDialog', formStart) : -1
  if (formStart < 0 || formEnd < 0) throw new Error(`Unified add-exercise state fix could not isolate WorkoutForm in ${id}`)
  const form = next.slice(formStart, formEnd)
  const updatedForm = replaceRequired(
    form,
    '  const [picker, setPicker] = useState(null);\n  const [editing, setEditing] = useState(null);',
    '  const [picker, setPicker] = useState(null);\n  const [editing, setEditing] = useState(null);\n  const [adding, setAdding] = useState(null);',
    id,
  )
  return `${next.slice(0, formStart)}${updatedForm}${next.slice(formEnd)}`
}

export function unifiedAddExerciseSetupStateFixBuildPlugin() {
  return {
    name: 'unified-add-exercise-setup-state-fix',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      return null
    },
  }
}
