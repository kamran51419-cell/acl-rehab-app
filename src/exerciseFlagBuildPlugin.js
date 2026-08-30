function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Exercise flag transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

function transformWorkoutScreen(code, id) {
  let next = code
  next = replaceRequired(next, 'function exerciseAttempted(exercise) { if (exercise?.completed) return true;', 'function exerciseAttempted(exercise) { if (exercise?.flaggedSkipped) return true; if (exercise?.completed) return true;', id)
  next = replaceRequired(next, 'function clearLinkedCarriedNote(workout, exerciseId) {\n  const ids = new Set(linkedExerciseIds(workout, exerciseId));\n  return { ...workout, exercises: workout.exercises.map((exercise) => ids.has(exercise.id) ? { ...exercise, carryNoteCleared: true } : exercise) };\n}', 'function clearLinkedCarriedNote(workout, exerciseId) {\n  const ids = new Set(linkedExerciseIds(workout, exerciseId));\n  return { ...workout, exercises: workout.exercises.map((exercise) => ids.has(exercise.id) ? { ...exercise, carryNoteCleared: true } : exercise) };\n}\n\nfunction setLinkedExerciseFlag(workout, exerciseId, flaggedSkipped) {\n  const ids = new Set(linkedExerciseIds(workout, exerciseId));\n  return { ...workout, exercises: workout.exercises.map((exercise) => ids.has(exercise.id) ? { ...exercise, flaggedSkipped: Boolean(flaggedSkipped) } : exercise) };\n}', id)
  next = replaceRequired(next, 'onMove, dragHandleProps, previousNote = "", onExerciseNote, onClearPreviousNote, index, total, hideExerciseName = false }) {', 'onMove, dragHandleProps, previousNote = "", onExerciseNote, onClearPreviousNote, onFlag, index, total, hideExerciseName = false }) {', id)

  const equipmentPattern = /<label className="mt-1 inline-flex items-center"><span className="sr-only">Equipment<\/span>(<select[\s\S]*?value=\{exercise\.equipmentType \|\| "standard"\}[\s\S]*?<\/select>)<\/label>/
  if (!equipmentPattern.test(next)) throw new Error(`Exercise flag transform could not find equipment control in ${id}`)
  next = next.replace(
    equipmentPattern,
    '<div className="mt-1 inline-flex items-center gap-1.5"><label className="inline-flex items-center"><span className="sr-only">Equipment</span>$1</label>{onFlag ? <button type="button" aria-label={exercise.flaggedSkipped ? "Remove exercise flag" : "Flag exercise as intentionally skipped"} aria-pressed={Boolean(exercise.flaggedSkipped)} title={exercise.flaggedSkipped ? "Remove flag" : "Flag exercise"} className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm transition ${exercise.flaggedSkipped ? "border-red-200 bg-red-50 text-red-700" : "border-transparent bg-slate-50 text-slate-400 hover:border-slate-200 hover:text-slate-600"}`} onClick={() => onFlag(exercise.id, !exercise.flaggedSkipped)}><span aria-hidden="true">⚑</span></button> : null}</div>',
  )

  next = replaceRequired(next, 'onClearPreviousNote={(exerciseId) => onReorder(clearLinkedCarriedNote(workout, exerciseId).exercises)}/>', 'onClearPreviousNote={(exerciseId) => onReorder(clearLinkedCarriedNote(workout, exerciseId).exercises)} onFlag={(exerciseId, flaggedSkipped) => onReorder(setLinkedExerciseFlag(workout, exerciseId, flaggedSkipped).exercises)}/>', id)
  next = replaceRequired(next, 'onExerciseNote={(exerciseId, note) => setDraft((current) => setLinkedWorkoutNote(current, exerciseId, note))} onMove={null}/>', 'onExerciseNote={(exerciseId, note) => setDraft((current) => setLinkedWorkoutNote(current, exerciseId, note))} onFlag={(exerciseId, flaggedSkipped) => setDraft((current) => setLinkedExerciseFlag(current, exerciseId, flaggedSkipped))} onMove={null}/>', id)
  return next
}

function transformWorkoutSession(code, id) {
  return replaceRequired(code, '    exercise.completed || (exercise.recordedSets || []).some((set) =>', '    exercise.flaggedSkipped || exercise.completed || (exercise.recordedSets || []).some((set) =>', id)
}

function transformExerciseProgress(code, id) {
  let next = code
  next = replaceRequired(next, 'weightedEntries: [] });', 'weightedEntries: [], flaggedEntries: [] });', id)
  next = replaceRequired(next,
    '      const date = exerciseDate(workout, exercise);\n      groups.get(exercise.exerciseId).performances.push({ workoutId: workout.id, date, displayDate: formatDate(date).replaceAll("-", "/"), exercise });',
    '      const date = exerciseDate(workout, exercise);\n      const group = groups.get(exercise.exerciseId);\n      group.performances.push({ workoutId: workout.id, date, displayDate: formatDate(date).replaceAll("-", "/"), exercise });\n      if (exercise.flaggedSkipped) {\n        const side = resolveWorkoutExerciseSide(exercise);\n        const weightedExercises = (workout.exercises || []).filter((candidate) => candidate.exerciseId === exercise.exerciseId && candidate.loggingMethod === EXERCISE_LOGGING_METHOD.REPS_WEIGHT);\n        group.flaggedEntries.push({ workoutId: workout.id, date, displayDate: formatDate(date).replaceAll("-", "/"), side, sideMode: progressSideMode(exercise, weightedExercises), equipmentType: exercise.equipmentType || "standard", workoutNote: exercise.workoutNote || "" });\n      }',
    id,
  )
  return next
}

function transformProgressScreen(code, id) {
  let next = code
  next = replaceRequired(next, 'import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";', 'import { CartesianGrid, Legend, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";', id)
  next = replaceRequired(
    next,
    'function StrengthGraph({ entries, leftRight = false }) {\n  const points = useMemo(() => strengthGraphPoints(entries), [entries]);',
    `function strengthGraphWithFlags(entries, flaggedEntries, leftRight) {
  const points = strengthGraphPoints(entries).map((point) => ({ ...point }));
  const byWorkout = new Map(points.map((point) => [point.workoutId, point]));
  (flaggedEntries || []).forEach((flag) => {
    if (!byWorkout.has(flag.workoutId)) { const point = { workoutId: flag.workoutId, date: flag.date, displayDate: flag.displayDate }; points.push(point); byWorkout.set(flag.workoutId, point); }
  });
  points.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.workoutId).localeCompare(String(b.workoutId)));
  const markers = (flaggedEntries || []).flatMap((flag) => {
    const key = leftRight ? (flag.side === SIDE.RIGHT ? "right" : "left") : "strength";
    const index = points.findIndex((point) => point.workoutId === flag.workoutId);
    if (index < 0) return [];
    const point = points[index];
    const actualY = point[key];
    const actualWeight = point[key + "Weight"];
    const actualReps = point[key + "Reps"];
    let y = actualY;
    if (y === undefined || y === null) for (let cursor = index - 1; cursor >= 0; cursor -= 1) if (points[cursor][key] !== undefined && points[cursor][key] !== null) { y = points[cursor][key]; break; }
    if (y === undefined || y === null) for (let cursor = index + 1; cursor < points.length; cursor += 1) if (points[cursor][key] !== undefined && points[cursor][key] !== null) { y = points[cursor][key]; break; }
    return y === undefined || y === null ? [] : [{ ...flag, y, actualY, actualWeight, actualReps }];
  });
  return { points, markers };
}

function StrengthGraph({ entries, flaggedEntries = [], leftRight = false }) {
  const graph = useMemo(() => strengthGraphWithFlags(entries, flaggedEntries, leftRight), [entries, flaggedEntries, leftRight]);
  const points = graph.points;
  const flagMarkers = graph.markers;
  const [selectedFlag, setSelectedFlag] = useState(null);`,
    id,
  )
  next = replaceRequired(next, '<LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>', '<LineChart data={points} accessibilityLayer={false} tabIndex={-1} style={{ outline: "none" }} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>', id)
  next = replaceRequired(next, '<div className="h-64 rounded-2xl border border-slate-200 bg-white p-2 sm:p-3"><ResponsiveContainer', '<div className="relative h-64 rounded-2xl border border-slate-200 bg-white p-2 sm:p-3" onPointerDown={() => setSelectedFlag(null)}><ResponsiveContainer', id)
  next = replaceRequired(next, '<Tooltip content={<StrengthTooltip />}/>{leftRight ?', '<Tooltip content={<StrengthTooltip />}/>{flagMarkers.map((marker, index) => <ReferenceDot key={`${marker.workoutId}-${marker.side || "standard"}-${index}`} x={marker.displayDate} y={marker.y} r={5} ifOverflow="extendDomain" shape={(shapeProps) => <g role="button" tabIndex={0} aria-label={"Flagged session " + marker.displayDate} style={{ cursor: "pointer", outline: "none" }} onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => { event.stopPropagation(); setSelectedFlag((current) => current?.workoutId === marker.workoutId && current?.side === marker.side ? null : { ...marker, tooltipX: shapeProps.cx, tooltipY: shapeProps.cy }); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); setSelectedFlag((current) => current?.workoutId === marker.workoutId && current?.side === marker.side ? null : { ...marker, tooltipX: shapeProps.cx, tooltipY: shapeProps.cy }); } }}><circle cx={shapeProps.cx} cy={shapeProps.cy} r={16} fill="transparent" pointerEvents="all"/><circle cx={shapeProps.cx} cy={shapeProps.cy} r={5} fill="#dc2626" stroke="#dc2626" pointerEvents="none"/></g>}/>)}{leftRight ?', id)

  const strengthGraphStart = next.indexOf('function StrengthGraph({ entries, flaggedEntries = [], leftRight = false }) {')
  const symmetryStart = strengthGraphStart >= 0 ? next.indexOf('\n\nfunction SymmetryStats(', strengthGraphStart) : -1
  if (strengthGraphStart < 0 || symmetryStart < 0) throw new Error(`Exercise flag transform could not isolate StrengthGraph in ${id}`)
  const strengthGraphBlock = next.slice(strengthGraphStart, symmetryStart)
  const strengthGraphClose = '</ResponsiveContainer></div></section>;'
  if (!strengthGraphBlock.includes(strengthGraphClose)) throw new Error(`Exercise flag transform could not find StrengthGraph close in ${id}`)
  const flagTooltip = '</ResponsiveContainer>{selectedFlag ? <div role="status" className="pointer-events-auto absolute z-20 w-44 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg" style={{ left: `clamp(5.5rem, ${Number(selectedFlag.tooltipX || 0) + 8}px, calc(100% - 5.5rem))`, top: Number(selectedFlag.tooltipY || 0) < 92 ? Number(selectedFlag.tooltipY || 0) + 18 : Number(selectedFlag.tooltipY || 0) - 10, transform: Number(selectedFlag.tooltipY || 0) < 92 ? "translate(-50%, 0)" : "translate(-50%, -100%)" }} onPointerDown={(event) => event.stopPropagation()}><div className="font-medium">{selectedFlag.displayDate}</div><div className="mt-1 font-semibold text-red-600">Flagged</div>{selectedFlag.actualY !== undefined && selectedFlag.actualY !== null ? <><div className="mt-1">{leftRight ? (selectedFlag.side === SIDE.RIGHT ? "Right" : "Left") : "e1RM"}: {selectedFlag.actualY} kg</div>{selectedFlag.actualWeight !== undefined && selectedFlag.actualWeight !== null && selectedFlag.actualReps !== undefined && selectedFlag.actualReps !== null ? <div className="text-xs text-slate-500">{selectedFlag.actualWeight} kg × {selectedFlag.actualReps} reps</div> : null}</> : null}<div className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{selectedFlag.workoutNote || "No note added."}</div></div> : null}</div></section>;'
  const updatedStrengthGraphBlock = strengthGraphBlock.replace(strengthGraphClose, flagTooltip)
  next = `${next.slice(0, strengthGraphStart)}${updatedStrengthGraphBlock}${next.slice(symmetryStart)}`

  next = replaceRequired(next, '<StrengthGraph entries={entries} leftRight/>', '<StrengthGraph entries={entries} flaggedEntries={(group.flaggedEntries || []).filter((entry) => entry.sideMode === PROGRESS_SIDE_MODE.LEFT_RIGHT)} leftRight/>', id)
  next = replaceRequired(next, 'const equipmentGroup = { ...group, entries: (group.entries || []).filter((entry) => (entry.equipmentType || "standard") === equipment) };', 'const equipmentGroup = { ...group, entries: (group.entries || []).filter((entry) => (entry.equipmentType || "standard") === equipment), flaggedEntries: (group.flaggedEntries || []).filter((entry) => (entry.equipmentType || "standard") === equipment) };', id)
  next = replaceRequired(next, '<StatsCards entries={selectedEntries}/><StrengthGraph entries={selectedEntries}/>', '<StatsCards entries={selectedEntries}/><StrengthGraph entries={selectedEntries} flaggedEntries={(equipmentGroup.flaggedEntries || []).filter((entry) => entry.sideMode === mode)}/>', id)
  return next
}

export function exerciseFlagBuildPlugin() {
  return {
    name: 'exercise-flag',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      if (cleanId.endsWith('/src/lib/domain/workoutSession.js')) return transformWorkoutSession(code, id)
      if (cleanId.endsWith('/src/lib/domain/exerciseProgress.js')) return transformExerciseProgress(code, id)
      if (cleanId.endsWith('/src/features/progress/ProgressScreen.jsx')) return transformProgressScreen(code, id)
      return null
    },
  }
}
