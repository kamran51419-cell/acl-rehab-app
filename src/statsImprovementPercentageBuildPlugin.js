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

      let next = replaceRequired(
        code,
        '  if (!bests) return null;\n  return <section className="grid gap-3 sm:grid-cols-3"><StatCard label={`${prefix}Improvement`} value={summary.improvement === null ? "Not available" : `${summary.improvement >= 0 ? "+" : ""}${summary.improvement} kg`} detail={summary.first && summary.latest ? `${summary.first.weight} kg to ${summary.latest.weight} kg` : null}/><StatCard label={`${prefix}Latest performance`} value={resultLabel(summary.latest)} detail={summary.latest?.displayDate}/><StatCard label={`${prefix}Personal best`} value={resultLabel(bests.bestSet)} detail={bests.bestSet.displayDate}/></section>;',
        '  if (!bests) return null;\n  const improvementPercent = summary.first && summary.latest && Number(summary.first.weight) > 0 ? Math.round((((Number(summary.latest.weight) - Number(summary.first.weight)) / Number(summary.first.weight)) * 100) * 10) / 10 : null;\n  return <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label={`${prefix}Improvement`} value={summary.improvement === null ? "Not available" : `${summary.improvement >= 0 ? "+" : ""}${summary.improvement} kg`} detail={summary.first && summary.latest ? `${summary.first.weight} kg to ${summary.latest.weight} kg` : null}/><StatCard label={`${prefix}Improvement %`} value={improvementPercent === null ? "Not available" : `${improvementPercent >= 0 ? "+" : ""}${improvementPercent}%`}/><StatCard label={`${prefix}Latest performance`} value={resultLabel(summary.latest)} detail={summary.latest?.displayDate}/><StatCard label={`${prefix}Personal best`} value={resultLabel(bests.bestSet)} detail={bests.bestSet.displayDate}/></section>;',
        id,
      )

      next = replaceRequired(
        next,
        'return <div className="rounded-2xl border border-slate-200 bg-white p-4">',
        'return <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-white p-4 shadow-sm">',
        id,
      )

      next = replaceRequired(
        next,
        '<p className="text-sm font-medium text-slate-600">Left & Right</p>',
        '<Button variant="primary">Left & Right</Button>',
        id,
      )

      next = replaceRequired(
        next,
        '<p className="text-sm font-medium text-slate-600">{SIDE_MODE_LABELS[availableModes[0]]}</p>',
        '<Button variant="primary">{SIDE_MODE_LABELS[availableModes[0]]}</Button>',
        id,
      )

      next = replaceRequired(
        next,
        'equipmentTypes[0] && equipmentTypes[0] !== "standard" ? <p className="text-xs font-medium text-slate-500">{EQUIPMENT_LABELS[equipmentTypes[0]]}</p> : null;',
        'equipmentTypes[0] && equipmentTypes[0] !== "standard" ? <Button size="sm" variant="primary">{EQUIPMENT_LABELS[equipmentTypes[0]]}</Button> : null;',
        id,
      )

      return next
    },
  }
}
