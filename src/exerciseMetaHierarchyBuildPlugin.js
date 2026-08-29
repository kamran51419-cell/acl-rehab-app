const PRESCRIPTION_HELPER = `function workoutPrescriptionSummary(exercise) {
  const summary = programmeSummary(exercise);
  const side = resolveWorkoutExerciseSide(exercise);
  if (side === SIDE.LEFT) return summary.replace(/\\s+left$/i, "");
  if (side === SIDE.RIGHT) return summary.replace(/\\s+right$/i, "");
  if (side === SIDE.SEPARATE) return summary.replace(/\\s+left & right$/i, "");
  return summary;
}`

function transformWorkoutScreen(code, id) {
  let next = code

  const cardStart = next.indexOf('export function ExerciseCard(')
  if (cardStart < 0) throw new Error(`Exercise metadata hierarchy transform could not find ExerciseCard in ${id}`)
  if (!next.includes('function workoutPrescriptionSummary(')) {
    next = `${next.slice(0, cardStart)}${PRESCRIPTION_HELPER}\n\n${next.slice(cardStart)}`
  }

  const updatedCardStart = next.indexOf('export function ExerciseCard(')
  const cardEnd = next.indexOf('\nfunction changeWorkout', updatedCardStart)
  if (cardEnd < 0) throw new Error(`Exercise metadata hierarchy transform could not find ExerciseCard end in ${id}`)

  let card = next.slice(updatedCardStart, cardEnd)
  const titleAnchor = '{!hideExerciseName ? <h2 className="font-semibold">{exercise.exerciseNameSnapshot}</h2> : null}'
  const titleIndex = card.indexOf(titleAnchor)
  if (titleIndex < 0) throw new Error(`Exercise metadata hierarchy transform could not find exercise title in ${id}`)

  const metaStart = titleIndex + titleAnchor.length
  const metaEnd = card.indexOf('</div>{!hideExerciseName', metaStart)
  if (metaEnd < 0) throw new Error(`Exercise metadata hierarchy transform could not find exercise metadata end in ${id}`)

  const exerciseMeta = '{!hideExerciseName ? <p className="mt-0.5 text-sm font-medium leading-5 text-slate-900">{workoutPrescriptionSummary(exercise)}</p> : null}{side ? <p className={hideExerciseName ? "text-sm font-semibold text-slate-700" : "mt-0.5 text-xs font-medium leading-4 text-slate-600"}>{side}</p> : null}{!hideExerciseName && exercise.programmeNoteSnapshot ? <p className="mt-0.5 whitespace-pre-wrap text-xs leading-4 text-slate-400">{exercise.programmeNoteSnapshot}</p> : null}'
  card = `${card.slice(0, metaStart)}${exerciseMeta}${card.slice(metaEnd)}`
  next = `${next.slice(0, updatedCardStart)}${card}${next.slice(cardEnd)}`

  const pairStart = next.indexOf('function WorkoutExerciseDisplay(')
  if (pairStart >= 0) {
    const pairEnd = next.indexOf('\n\nexport function WorkoutForm(', pairStart)
    if (pairEnd < 0) throw new Error(`Exercise metadata hierarchy transform could not find linked exercise display end in ${id}`)
    let pair = next.slice(pairStart, pairEnd)

    pair = pair.replace(
      /  const range = left\.prescription\?\.targetReps\?\.type === "range"\n    \? `Range: \$\{left\.prescription\.targetReps\.min\}–\$\{left\.prescription\.targetReps\.max\} reps`\n    : "";\n/,
      '',
    )

    const pairTitle = '<h2 className="font-semibold">{left.exerciseNameSnapshot}</h2>'
    const pairTitleIndex = pair.indexOf(pairTitle)
    if (pairTitleIndex < 0) throw new Error(`Exercise metadata hierarchy transform could not find linked exercise title in ${id}`)
    const pairMetaStart = pairTitleIndex + pairTitle.length
    const pairMetaEnd = pair.indexOf('</div>\n      {onChangeExercise', pairMetaStart)
    if (pairMetaEnd < 0) throw new Error(`Exercise metadata hierarchy transform could not find linked exercise metadata end in ${id}`)

    const pairMeta = '\n        <p className="mt-0.5 text-sm font-medium leading-5 text-slate-900">{workoutPrescriptionSummary(left)}</p>\n        <p className="mt-0.5 text-xs font-medium leading-4 text-slate-600">Left & Right</p>\n        {left.programmeNoteSnapshot ? <p className="mt-0.5 whitespace-pre-wrap text-xs leading-4 text-slate-400">{left.programmeNoteSnapshot}</p> : null}\n      '
    pair = `${pair.slice(0, pairMetaStart)}${pairMeta}${pair.slice(pairMetaEnd)}`
    next = `${next.slice(0, pairStart)}${pair}${next.slice(pairEnd)}`
  }

  return next
}

export function exerciseMetaHierarchyBuildPlugin() {
  return {
    name: 'exercise-meta-hierarchy',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      return null
    },
  }
}
