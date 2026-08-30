function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Flagged graph interaction fix could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

function transformProgressScreen(code, id) {
  let next = code

  next = replaceRequired(
    next,
    '<LineChart data={points} accessibilityLayer={false} tabIndex={-1} style={{ outline: "none" }} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>',
    '<LineChart data={points} accessibilityLayer={false} tabIndex={-1} style={{ outline: "none" }} margin={{ top: 8, right: 12, left: 0, bottom: 8 }} onClick={(state) => { const marker = flagMarkers.find((item) => item.displayDate === state?.activeLabel); if (!marker) { setSelectedFlag(null); return; } const chartX = Number(state?.chartX ?? 0); const chartY = Number(state?.chartY ?? 0); setSelectedFlag((current) => current?.workoutId === marker.workoutId && current?.side === marker.side ? null : { ...marker, tooltipX: chartX, tooltipY: chartY }); }}>',
    id,
  )

  next = replaceRequired(
    next,
    '<div className="relative h-64 rounded-2xl border border-slate-200 bg-white p-2 sm:p-3" onPointerDown={() => setSelectedFlag(null)}><ResponsiveContainer',
    '<div className="strength-progress-chart relative h-64 rounded-2xl border border-slate-200 bg-white p-2 sm:p-3"><ResponsiveContainer',
    id,
  )

  next = replaceRequired(
    next,
    '<Tooltip content={<StrengthTooltip />}/>{flagMarkers.map((marker, index) => <ReferenceDot key={`${marker.workoutId}-${marker.side || "standard"}-${index}`} x={marker.displayDate} y={marker.y} r={5} ifOverflow="extendDomain" shape={(shapeProps) => <g role="button" tabIndex={0} aria-label={"Flagged session " + marker.displayDate} style={{ cursor: "pointer", outline: "none" }} onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => { event.stopPropagation(); setSelectedFlag((current) => current?.workoutId === marker.workoutId && current?.side === marker.side ? null : { ...marker, tooltipX: shapeProps.cx, tooltipY: shapeProps.cy }); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); setSelectedFlag((current) => current?.workoutId === marker.workoutId && current?.side === marker.side ? null : { ...marker, tooltipX: shapeProps.cx, tooltipY: shapeProps.cy }); } }}><circle cx={shapeProps.cx} cy={shapeProps.cy} r={16} fill="transparent" pointerEvents="all"/><circle cx={shapeProps.cx} cy={shapeProps.cy} r={5} fill="#dc2626" stroke="#dc2626" pointerEvents="none"/></g>}/>)}{leftRight ?',
    '<Tooltip content={<StrengthTooltip />}/>{flagMarkers.map((marker, index) => <ReferenceDot key={`${marker.workoutId}-${marker.side || "standard"}-${index}`} x={marker.displayDate} y={marker.y} r={5} fill="#dc2626" stroke="#dc2626" ifOverflow="extendDomain"/>)}{leftRight ?',
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
