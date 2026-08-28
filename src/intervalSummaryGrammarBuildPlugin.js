function transformPlans(code) {
  return code.replace(
    'if (exercise.loggingMethod === EXERCISE_LOGGING_METHOD.INTERVALS) return exercise.prescription?.intervalFormat === "repeated" ? `${asArray(exercise.prescription?.repeatedGroups).length} interval blocks` : `${asArray(exercise.prescription?.stages).length} intervals`;',
    'if (exercise.loggingMethod === EXERCISE_LOGGING_METHOD.INTERVALS) { const blockCount = asArray(exercise.prescription?.repeatedGroups).length; return exercise.prescription?.intervalFormat === "repeated" ? `${blockCount} interval ${blockCount === 1 ? "block" : "blocks"}` : `${asArray(exercise.prescription?.stages).length} intervals`; }',
  )
}

export function intervalSummaryGrammarBuildPlugin() {
  return {
    name: 'interval-summary-grammar',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/lib/domain/plans.js')) return transformPlans(code)
      return null
    },
  }
}
