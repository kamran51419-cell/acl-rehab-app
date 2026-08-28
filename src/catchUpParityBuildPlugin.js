function transformWorkoutScreen(code, id) {
  const oldDateClass = 'date-field-clip mt-1 block w-full max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white'
  if ((code.split(oldDateClass).length - 1) < 2) throw new Error(`Catch-up parity transform could not find both date fields in ${id}`)
  return code.replaceAll(oldDateClass, 'date-field-clip mt-1 block w-[11.5rem] max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white')
}

export function catchUpParityBuildPlugin() {
  return {
    name: 'catch-up-parity',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      return null
    },
  }
}
