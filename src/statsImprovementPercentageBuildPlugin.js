function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Stats improvement percentage transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

export function statsImprovementPercentageBuildPlugin() {
  return {
    name: 'stats-improvement-percentage',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (!cleanId.endsWith('/src/features/progress/ProgressScreen.jsx')) return null

      return replaceRequired(
        code,
        '  if (!bests) return null;\n  return <section className="grid gap-3 sm:grid-cols-3"><StatCard label={`${prefix}Improvement`} value={summary.improvement === null ? "Not available" : `${summary.improvement >= 0 ? "+" : ""}${summary.improvement} kg`} detail={summary.first && summary.latest ? `${summary.first.weight} kg to ${summary.latest.weight} kg` : null}/><StatCard label={`${prefix}Latest performance`} value={resultLabel(summary.latest)} detail={summary.latest?.displayDate}/><StatCard label={`${prefix}Personal best`} value={resultLabel(bests.bestSet)} detail={bests.bestSet.displayDate}/></section>;',
        '  if (!bests) return null;\n  const improvementPercent = summary.first && summary.latest && Number(summary.first.weight) > 0 ? Math.round((((Number(summary.latest.weight) - Number(summary.first.weight)) / Number(summary.first.weight)) * 100) * 10) / 10 : null;\n  return <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label={`${prefix}Improvement`} value={summary.improvement === null ? "Not available" : `${summary.improvement >= 0 ? "+" : ""}${summary.improvement} kg`} detail={summary.first && summary.latest ? `${summary.first.weight} kg to ${summary.latest.weight} kg` : null}/><StatCard label={`${prefix}Improvement %`} value={improvementPercent === null ? "Not available" : `${improvementPercent >= 0 ? "+" : ""}${improvementPercent}%`}/><StatCard label={`${prefix}Latest performance`} value={resultLabel(summary.latest)} detail={summary.latest?.displayDate}/><StatCard label={`${prefix}Personal best`} value={resultLabel(bests.bestSet)} detail={bests.bestSet.displayDate}/></section>;',
        id,
      )
    },
  }
}
