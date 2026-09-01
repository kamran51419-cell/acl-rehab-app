function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Stats improvement percentage transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

function replaceAllRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Stats improvement percentage transform could not find expected selector source in ${id}`)
  return code.split(oldText).join(newText)
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
        '  if (!bests) return null;\n  const improvementPercent = summary.first && summary.latest && Number(summary.first.weight) > 0 ? Math.round((((Number(summary.latest.weight) - Number(summary.first.weight)) / Number(summary.first.weight)) * 100) * 10) / 10 : null;\n  return <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label={`${prefix}Progress`} value={summary.improvement === null ? "Not available" : `${summary.improvement >= 0 ? "+" : ""}${summary.improvement} kg`} detail={summary.first && summary.latest ? `${summary.first.weight} kg to ${summary.latest.weight} kg` : null}/><StatCard label={`${prefix}Progress %`} value={improvementPercent === null ? "Not available" : `${improvementPercent >= 0 ? "+" : ""}${improvementPercent}%`}/><StatCard label={`${prefix}Latest performance`} value={resultLabel(summary.latest)} detail={summary.latest?.displayDate}/><StatCard label={`${prefix}Personal best`} value={resultLabel(bests.bestSet)} detail={bests.bestSet.displayDate}/></section>;',
        id,
      )

      next = replaceRequired(
        next,
        'return <div className="rounded-2xl border border-slate-200 bg-white p-4">',
        'return <div className="rounded-2xl border border-blue-200 p-4 shadow-sm" style={{ background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)" }}>',
        id,
      )

      next = replaceRequired(
        next,
        '<p className="text-sm font-medium text-slate-600">Left & Right</p>',
        '<div className="flex"><span className="inline-flex rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600">Left & Right</span></div>',
        id,
      )

      next = replaceRequired(
        next,
        '<p className="text-sm font-medium text-slate-600">{SIDE_MODE_LABELS[availableModes[0]]}</p>',
        '<div className="flex"><span className="inline-flex rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600">{SIDE_MODE_LABELS[availableModes[0]]}</span></div>',
        id,
      )

      next = replaceRequired(
        next,
        'equipmentTypes[0] && equipmentTypes[0] !== "standard" ? <p className="text-xs font-medium text-slate-500">{EQUIPMENT_LABELS[equipmentTypes[0]]}</p> : null;',
        'equipmentTypes[0] && equipmentTypes[0] !== "standard" ? <div className="flex"><span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">{EQUIPMENT_LABELS[equipmentTypes[0]]}</span></div> : null;',
        id,
      )

      next = replaceAllRequired(
        next,
        '<div className="flex flex-wrap gap-2">{equipmentTypes.map((type) => <Button key={type} size="sm" variant={equipment === type ? "primary" : "outline"} onClick={() => setEquipment(type)}>{EQUIPMENT_LABELS[type]}</Button>)}</div>',
        '<div className="flex flex-wrap gap-2">{equipmentTypes.map((type) => <button type="button" key={type} className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${equipment === type ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-blue-200 bg-white text-blue-700 hover:bg-blue-50"}`} onClick={() => setEquipment(type)}>{EQUIPMENT_LABELS[type]}</button>)}</div>',
        id,
      )

      next = replaceAllRequired(
        next,
        '<div className="flex flex-wrap gap-2">{availableModes.map((item) => <Button key={item} variant={mode === item ? "primary" : "outline"} onClick={() => setMode(item)}>{SIDE_MODE_LABELS[item]}</Button>)}</div>',
        '<div className="flex flex-wrap gap-2">{availableModes.map((item) => <button type="button" key={item} className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${mode === item ? "border-slate-300 bg-slate-100 text-slate-900" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`} onClick={() => setMode(item)}>{SIDE_MODE_LABELS[item]}</button>)}</div>',
        id,
      )

      return next
    },
  }
}
