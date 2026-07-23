function replaceOnce(code, oldText, newText, id) {
  if (!code.includes(oldText)) {
    throw new Error(`Vertical interval display transform could not find expected source in ${id}`)
  }
  return code.replace(oldText, newText)
}

export function verticalIntervalWorkoutDisplayPlugin() {
  return {
    name: 'vertical-interval-workout-display',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\', '/')
      if (!cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return null

      return replaceOnce(
        code,
        '<span className="min-w-0 flex-1 text-sm font-medium">{stages.length ? stages.map((stage) => `${durationLabel(stage.durationSeconds, stage.durationUnit)} ${stage.phase}`).join(" · ") : programmeSummary(exercise) || "Complete exercise"}</span>',
        '<div className="min-w-0 flex-1 text-sm font-medium">{exercise.prescription?.intervalFormat === "repeated" && exercise.prescription?.repeatedGroups?.length ? <div className="space-y-3">{ordered(exercise.prescription.repeatedGroups).map((group, groupIndex) => { const standalone = Number(group.repeatCount || 1) === 1; return <div key={group.id || groupIndex} className={standalone ? "my-2 space-y-1.5 rounded-lg bg-white/60 px-2 py-2" : "space-y-1.5"}>{standalone ? null : <div className="font-semibold">Repeat {group.repeatCount} times</div>}{ordered(group.stages || []).map((stage, stageIndex) => <div key={stage.id || stageIndex} className="flex items-baseline gap-2 pl-1"><span>{durationLabel(stage.durationSeconds, stage.durationUnit)}</span><span className="text-slate-500">{stage.label?.trim() || `${String(stage.phase || "").charAt(0).toUpperCase()}${String(stage.phase || "").slice(1)}`}</span></div>)}</div> })}</div> : stages.length ? <div className="space-y-1.5">{stages.map((stage, stageIndex) => <div key={stage.id || stageIndex} className="flex items-baseline gap-2"><span>{durationLabel(stage.durationSeconds, stage.durationUnit)}</span><span className="text-slate-500">{stage.label?.trim() || `${String(stage.phase || "").charAt(0).toUpperCase()}${String(stage.phase || "").slice(1)}`}</span></div>)}</div> : programmeSummary(exercise) || "Complete exercise"}</div>',
        id,
      )
    },
  }
}
