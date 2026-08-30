function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Flagged graph interaction fix could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

function transformProgressScreen(code, id) {
  let next = code

  const tooltipStart = next.indexOf('function StrengthTooltip({ active, payload }) {')
  const shortDateStart = tooltipStart >= 0 ? next.indexOf('\n\nfunction shortDate(', tooltipStart) : -1
  if (tooltipStart < 0 || shortDateStart < 0) throw new Error(`Flagged graph interaction fix could not isolate StrengthTooltip in ${id}`)

  const tooltipBlock = `function StrengthTooltip({ active, payload }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const performanceItems = (payload || []).filter((item) => item.value !== undefined && item.value !== null && !String(item.dataKey || "").startsWith("flag"));
  const flagRows = [
    { key: "flagStrength", label: "Flagged" },
    { key: "flagLeft", label: "Left flagged" },
    { key: "flagRight", label: "Right flagged" },
  ].filter((item) => point[item.key] !== undefined && point[item.key] !== null);
  const flagNotes = new Set(flagRows.map((item) => String(point[item.key + "Note"] || "").trim()).filter(Boolean));
  return <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg"><div className="font-medium">{point.displayDate}</div>{performanceItems.map((item) => <div key={item.dataKey}><div>{item.name}: {item.value} kg</div><div className="text-xs text-slate-500">{point[item.dataKey + "Weight"]} kg × {point[item.dataKey + "Reps"]} reps</div>{point[item.dataKey + "Note"] && !flagNotes.has(String(point[item.dataKey + "Note"]).trim()) ? <div className="mt-1 max-w-56 whitespace-pre-wrap text-xs text-slate-600">{point[item.dataKey + "Note"]}</div> : null}</div>)}{flagRows.map((item) => <div key={item.key} className={performanceItems.length ? "mt-1.5 border-t border-slate-100 pt-1.5" : "mt-1"}><div className="font-semibold text-red-600">{item.label}</div><div className="mt-0.5 max-w-56 whitespace-pre-wrap text-xs text-slate-600">{point[item.key + "Note"] || "No note added."}</div></div>)}</div>;
}`
  next = `${next.slice(0, tooltipStart)}${tooltipBlock}${next.slice(shortDateStart)}`

  next = replaceRequired(
    next,
    '<div className="h-64 rounded-2xl border border-slate-200 bg-white p-2 sm:p-3"><ResponsiveContainer',
    '<div className="strength-progress-chart h-64 rounded-2xl border border-slate-200 bg-white p-2 sm:p-3"><ResponsiveContainer',
    id,
  )

  return next
}

export function flaggedGraphInteractionFixBuildPlugin() {
  return {
    name: 'flagged-graph-interaction-fix',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/progress/ProgressScreen.jsx')) return transformProgressScreen(code, id)
      return null
    },
  }
}
