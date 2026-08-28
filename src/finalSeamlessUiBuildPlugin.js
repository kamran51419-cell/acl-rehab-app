function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Final seamless UI transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

function transformWorkoutScreen(code, id) {
  let next = code

  next = replaceRequired(
    next,
    'className="grid grid-cols-[3.5rem_minmax(0,1fr)_2rem] items-center gap-3 rounded-xl bg-slate-50 p-3"',
    'className="grid grid-cols-[3.5rem_minmax(0,1fr)_2rem] items-start gap-3 rounded-xl bg-slate-50 p-3"',
    id,
  )
  next = replaceRequired(
    next,
    '<span className="text-sm font-medium">Set {set.setNumber}</span>{isRepsOnly ?',
    '<span className="pt-2.5 text-sm font-medium">Set {set.setNumber}</span>{isRepsOnly ?',
    id,
  )
  next = replaceRequired(
    next,
    '<SetTick checked={Boolean(set.completed)} label={`Toggle set ${set.setNumber}`} onClick={() => onChange(exercise.id, set.id, "setCompleted", !set.completed)}/></div>)}</div>',
    '<div className="mt-1 self-start"><SetTick checked={Boolean(set.completed)} label={`Toggle set ${set.setNumber}`} onClick={() => onChange(exercise.id, set.id, "setCompleted", !set.completed)}/></div></div>)}</div>',
    id,
  )

  const normalEquipmentWithFlag = /<div className="mt-1 inline-flex items-center gap-1\.5"><label className="inline-flex items-center"><span className="sr-only">Equipment<\/span>(<select[\s\S]*?<\/select>)<\/label>\{onFlag \? <button type="button" aria-label=\{exercise\.flaggedSkipped[\s\S]*?<\/button> : null\}<\/div>/
  if (!normalEquipmentWithFlag.test(next)) throw new Error(`Final seamless UI transform could not find standard exercise flag in ${id}`)
  next = next.replace(normalEquipmentWithFlag, '<div className="mt-1 inline-flex items-center"><label className="inline-flex items-center"><span className="sr-only">Equipment</span>$1</label></div>')

  next = replaceRequired(
    next,
    '</div>{!hideExerciseName && onMove ? <><button type="button"',
    '</div>{!hideExerciseName && onFlag ? <button type="button" aria-label={exercise.flaggedSkipped ? "Remove exercise flag" : "Flag exercise as intentionally skipped"} aria-pressed={Boolean(exercise.flaggedSkipped)} title={exercise.flaggedSkipped ? "Flagged — tap to remove" : "Flag exercise"} className={`workout-exercise-flag mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-base transition-colors ${exercise.flaggedSkipped ? "border-red-300 bg-red-100 text-red-700 shadow-sm" : "border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"}`} onClick={() => onFlag(exercise.id, !exercise.flaggedSkipped)}><span aria-hidden="true">⚑</span></button> : null}{!hideExerciseName && onMove ? <><button type="button"',
    id,
  )

  next = replaceRequired(
    next,
    '{onChangeExercise || onRemoveExercise ? <div className="relative"><button type="button" aria-label={`Edit ${left.exerciseNameSnapshot}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setSharedActionsOpen((value) => !value)}><MoreHorizontal className="h-5 w-5"/></button>{sharedActionsOpen ?',
    '<div className="flex shrink-0 items-center gap-1">{onFlag ? <button type="button" aria-label={left.flaggedSkipped ? "Remove exercise flag" : "Flag exercise as intentionally skipped"} aria-pressed={Boolean(left.flaggedSkipped)} title={left.flaggedSkipped ? "Flagged — tap to remove" : "Flag exercise"} className={`workout-exercise-flag inline-flex h-8 w-8 items-center justify-center rounded-full border text-base transition-colors ${left.flaggedSkipped ? "border-red-300 bg-red-100 text-red-700 shadow-sm" : "border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"}`} onClick={() => onFlag(left.id, !left.flaggedSkipped)}><span aria-hidden="true">⚑</span></button> : null}{onChangeExercise || onRemoveExercise ? <div className="relative"><button type="button" aria-label={`Edit ${left.exerciseNameSnapshot}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setSharedActionsOpen((value) => !value)}><MoreHorizontal className="h-5 w-5"/></button>{sharedActionsOpen ?',
    id,
  )

  next = replaceRequired(
    next,
    '</div> : null}</div> : null}\n    </div>\n    {(left.exerciseType === EXERCISE_TYPE.STRENGTH && onEquipment) || onFlag ? <div className="mt-2 flex flex-wrap items-center gap-2">{left.exerciseType === EXERCISE_TYPE.STRENGTH && onEquipment ? <label className="inline-flex items-center"><span className="sr-only">Equipment</span><select aria-label={`${left.exerciseNameSnapshot} equipment`} className="workout-equipment-select h-7 max-w-32 rounded-full border border-transparent bg-slate-50 px-2 text-xs font-normal leading-4 text-slate-500 hover:border-slate-200" value={left.equipmentType || "standard"} onChange={(event) => onEquipment(left.id, event.target.value)}>{EQUIPMENT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : null}{onFlag ? <button type="button" aria-pressed={Boolean(left.flaggedSkipped)} className={`inline-flex h-7 items-center justify-center rounded-full px-2 transition ${left.flaggedSkipped ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`} onClick={() => onFlag(left.id, !left.flaggedSkipped)}><span aria-hidden="true">⚑</span><span className="sr-only">{left.flaggedSkipped ? "Remove flag" : "Flag exercise"}</span></button> : null}</div> : null}',
    '</div> : null}</div> : null}</div>\n    </div>\n    {left.exerciseType === EXERCISE_TYPE.STRENGTH && onEquipment ? <div className="mt-2 flex flex-wrap items-center gap-2"><label className="inline-flex items-center"><span className="sr-only">Equipment</span><select aria-label={`${left.exerciseNameSnapshot} equipment`} className="workout-equipment-select h-7 max-w-32 rounded-full border border-transparent bg-slate-50 px-2 text-xs font-normal leading-4 text-slate-500 hover:border-slate-200" value={left.equipmentType || "standard"} onChange={(event) => onEquipment(left.id, event.target.value)}>{EQUIPMENT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div> : null}',
    id,
  )

  return next
}

function transformIndexCss(code) {
  return `${code}\n\n/* Final optical alignment for shared date controls. */\ninput[type='date'] {\n  padding-left: 1.9rem !important;\n  padding-right: 3.1rem !important;\n}\n\ninput[type='date']::-webkit-date-and-time-value,\ninput[type='date']::-webkit-datetime-edit {\n  height: 100% !important;\n  line-height: 2.5rem !important;\n  transform: translateX(-2px);\n}\n\n/* Compact set controls: smaller than normal actions, but still comfortable to tap. */\nbutton.workout-set-control {\n  height: 2rem !important;\n  min-height: 2rem !important;\n  padding-top: 0 !important;\n  padding-bottom: 0 !important;\n}\n\n.workout-exercise-flag[aria-pressed='true'] {\n  border-color: rgb(252 165 165) !important;\n  background: rgb(254 226 226) !important;\n  color: rgb(185 28 28) !important;\n  box-shadow: 0 0 0 2px rgb(239 68 68 / 0.08) !important;\n}\n\n@media (max-width: 639px) {\n  input[type='date'] {\n    padding-left: 2.35rem !important;\n    padding-right: 2.65rem !important;\n  }\n\n  input[type='date']::-webkit-date-and-time-value,\n  input[type='date']::-webkit-datetime-edit {\n    line-height: 2.5rem !important;\n    transform: translateY(1.5px);\n  }\n}\n`
}

export function finalSeamlessUiBuildPlugin() {
  return {
    name: 'final-seamless-ui',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      if (cleanId.endsWith('/src/index.css')) return transformIndexCss(code)
      return null
    },
  }
}
