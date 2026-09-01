function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Stats selector polish transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

export function statsSelectorPolishBuildPlugin() {
  return {
    name: 'stats-selector-polish',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (!cleanId.endsWith('/src/features/progress/ProgressScreen.jsx')) return null

      let next = replaceRequired(
        code,
        'label={`${prefix}Improvement`}',
        'label={`${prefix}Progress`}',
        id,
      )

      next = replaceRequired(
        next,
        'label={`${prefix}Improvement %`}',
        'label={`${prefix}Progress %`}',
        id,
      )

      next = replaceRequired(
        next,
        'function StatCard({ label, value, detail }) {\n  return <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-white p-4 shadow-sm">',
        'function StatCard({ label, value, detail }) {\n  return <div className="rounded-2xl border border-blue-200 p-4 shadow-sm" style={{ background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)" }}>',
        id,
      )

      next = replaceRequired(
        next,
        'equipmentTypes[0] && equipmentTypes[0] !== "standard" ? <Button size="sm" variant="primary">{EQUIPMENT_LABELS[equipmentTypes[0]]}</Button> : null;',
        'equipmentTypes[0] && equipmentTypes[0] !== "standard" ? <div className="flex"><span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">{EQUIPMENT_LABELS[equipmentTypes[0]]}</span></div> : null;',
        id,
      )

      next = replaceRequired(
        next,
        '<Button variant="primary">Left & Right</Button>',
        '<div className="flex"><span className="inline-flex rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600">Left & Right</span></div>',
        id,
      )

      next = replaceRequired(
        next,
        '<Button variant="primary">{SIDE_MODE_LABELS[availableModes[0]]}</Button>',
        '<div className="flex"><span className="inline-flex rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600">{SIDE_MODE_LABELS[availableModes[0]]}</span></div>',
        id,
      )

      next = replaceRequired(
        next,
        '<div className="flex flex-wrap gap-2">{equipmentTypes.map((type) => <Button key={type} size="sm" variant={equipment === type ? "primary" : "outline"} onClick={() => setEquipment(type)}>{EQUIPMENT_LABELS[type]}</Button>)}</div>',
        '<div className="flex flex-wrap gap-2">{equipmentTypes.map((type) => <button type="button" key={type} className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${equipment === type ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-blue-200 bg-white text-blue-700 hover:bg-blue-50"}`} onClick={() => setEquipment(type)}>{EQUIPMENT_LABELS[type]}</button>)}</div>',
        id,
      )

      const variationButtons = '<div className="flex flex-wrap gap-2">{availableModes.map((item) => <Button key={item} variant={mode === item ? "primary" : "outline"} onClick={() => setMode(item)}>{SIDE_MODE_LABELS[item]}</Button>)}</div>'
      if (!next.includes(variationButtons)) throw new Error(`Stats selector polish transform could not find variation controls in ${id}`)
      next = next.replaceAll(
        variationButtons,
        '<div className="flex flex-wrap gap-2">{availableModes.map((item) => <button type="button" key={item} className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${mode === item ? "border-slate-300 bg-slate-100 text-slate-900" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`} onClick={() => setMode(item)}>{SIDE_MODE_LABELS[item]}</button>)}</div>',
      )

      return next
    },
  }
}
