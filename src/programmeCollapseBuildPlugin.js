function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Programme collapse transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

function transformPlansScreen(code, id) {
  let next = code

  next = replaceRequired(
    next,
    'import { GripVertical, Plus, Search, Trash2 } from "lucide-react";',
    'import { ChevronDown, ChevronRight, GripVertical, Plus, Search, Trash2 } from "lucide-react";',
    id,
  )

  next = replaceRequired(
    next,
    '  const [editingRoutineId, setEditingRoutineId] = useState("");',
    '  const [editingRoutineId, setEditingRoutineId] = useState("");\n  const [expandedSessionIds, setExpandedSessionIds] = useState(() => new Set());\n  const [expandedExerciseIds, setExpandedExerciseIds] = useState(() => new Set());\n  const toggleSessionExpanded = (sessionId) => setExpandedSessionIds((current) => { const nextIds = new Set(current); if (nextIds.has(sessionId)) nextIds.delete(sessionId); else nextIds.add(sessionId); return nextIds; });\n  const toggleExerciseExpanded = (exerciseId) => setExpandedExerciseIds((current) => { const nextIds = new Set(current); if (nextIds.has(exerciseId)) nextIds.delete(exerciseId); else nextIds.add(exerciseId); return nextIds; });',
    id,
  )

  next = next.replaceAll(
    '      setActiveExerciseId(replacement.id);',
    '      setActiveExerciseId(replacement.id);\n      setExpandedExerciseIds((current) => new Set(current).add(replacement.id));',
  )
  next = next.replaceAll(
    '      setActiveExerciseId(planExercise.id);',
    '      setActiveExerciseId(planExercise.id);\n      setExpandedExerciseIds((current) => new Set(current).add(planExercise.id));',
  )

  next = replaceRequired(
    next,
    '            <div className="flex items-start gap-2">\n              <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[1fr_1fr_auto]">',
    '            <div className="flex items-start gap-2">\n              <button type="button" className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-left hover:bg-white" aria-expanded={expandedSessionIds.has(session.id)} onClick={(event) => { event.stopPropagation(); toggleSessionExpanded(session.id); }}>\n                {expandedSessionIds.has(session.id) ? <ChevronDown className="h-5 w-5 shrink-0 text-slate-500"/> : <ChevronRight className="h-5 w-5 shrink-0 text-slate-500"/>}\n                {!expandedSessionIds.has(session.id) ? <><span className="truncate font-semibold text-slate-900">{session.name || "Untitled session"}</span><span className="shrink-0 text-xs text-slate-500">{session.exercises?.length || 0} exercises</span></> : <span className="sr-only">Collapse {session.name || "session"}</span>}\n              </button>\n              <div className={cls("grid min-w-0 flex-1 gap-3 md:grid-cols-[1fr_1fr_auto]", !expandedSessionIds.has(session.id) && "hidden")}>',
    id,
  )

  next = replaceRequired(
    next,
    '            <div className="space-y-3">\n              {session.exercises.map((exercise, exerciseIndex) => (',
    '            <div className={cls("space-y-3", !expandedSessionIds.has(session.id) && "hidden")}>\n              {session.exercises.map((exercise, exerciseIndex) => (',
    id,
  )

  next = replaceRequired(
    next,
    '            <div className="flex items-center justify-between gap-3">\n              <Button variant="outline" onClick={() => openPickerForAdd(sessionIndex)}>',
    '            <div className={cls("flex items-center justify-between gap-3", !expandedSessionIds.has(session.id) && "hidden")}>\n              <Button variant="outline" onClick={() => openPickerForAdd(sessionIndex)}>',
    id,
  )

  next = replaceRequired(
    next,
    '                      <div>\n                        <div className="font-semibold">{exercise.exerciseNameSnapshot}</div>\n                        <div className="text-sm text-slate-500">{planPrescriptionSummary(exercise)}</div>\n                      </div>',
    '                      <button type="button" className="-ml-1 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50" aria-expanded={expandedExerciseIds.has(exercise.id)} aria-label={`${expandedExerciseIds.has(exercise.id) ? "Collapse" : "Expand"} ${exercise.exerciseNameSnapshot}`} onClick={(event) => { event.stopPropagation(); toggleExerciseExpanded(exercise.id); }}>{expandedExerciseIds.has(exercise.id) ? <ChevronDown className="h-5 w-5"/> : <ChevronRight className="h-5 w-5"/>}</button>\n                      <div className="min-w-0 flex-1 text-left">\n                        <div className="truncate font-semibold">{exercise.exerciseNameSnapshot}</div>\n                        <div className="text-sm text-slate-500">{planPrescriptionSummary(exercise)}</div>\n                      </div>',
    id,
  )

  next = replaceRequired(
    next,
    `                  <ExerciseSetupEditor\n                    exercise={exercise}\n                    onChange={(next) => updateSession(sessionIndex, { exercises: session.exercises.map((item, index) => index === exerciseIndex ? next : item) })}\n                    trainingMode={trainingMode}\n                  />\n\n                  <Field label="Notes">\n                    <Textarea value={exercise.notes || ""} onChange={(event) => updateSession(sessionIndex, { exercises: session.exercises.map((item, index) => index === exerciseIndex ? { ...item, notes: event.target.value } : item) })} />\n                  </Field>`,
    `                  {expandedExerciseIds.has(exercise.id) ? <>\n                    <ExerciseSetupEditor\n                      exercise={exercise}\n                      onChange={(next) => updateSession(sessionIndex, { exercises: session.exercises.map((item, index) => index === exerciseIndex ? next : item) })}\n                      trainingMode={trainingMode}\n                    />\n\n                    <Field label="Notes">\n                      <Textarea value={exercise.notes || ""} onChange={(event) => updateSession(sessionIndex, { exercises: session.exercises.map((item, index) => index === exerciseIndex ? { ...item, notes: event.target.value } : item) })} />\n                    </Field>\n                  </> : null}`,
    id,
  )

  return next
}

export function programmeCollapseBuildPlugin() {
  return {
    name: 'programme-collapse',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/plans/PlansScreen.jsx')) return transformPlansScreen(code, id)
      return null
    },
  }
}
