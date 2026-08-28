function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Latest previous performance transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

function transformWorkoutDisplay(code, id) {
  const oldFunction = `function previousSetsForExercise(workouts = [], target) {
  const exerciseId = typeof target === "string" ? target : target.exerciseId;
  const targetId = typeof target === "string" ? undefined : target.id;
  const targetSide = typeof target === "string" ? undefined : resolveWorkoutExerciseSide(target);
  const targetEquipment = typeof target === "string" ? "standard" : (target.equipmentType || "standard");
  const ordered = workouts.slice().sort((a, b) => String(b.date || b.workoutDate || "").localeCompare(String(a.date || a.workoutDate || "")));
  const candidates = ordered.flatMap((workout) => (workout.exercises || []).filter((item) => item.exerciseId === exerciseId && (item.equipmentType || "standard") === targetEquipment).map((exercise) => ({ exercise, sameIdentity: Boolean(targetId && exercise.id === targetId) })));
  const explicit = candidates.filter(({ exercise }) => resolveWorkoutExerciseSide(exercise) === targetSide && (targetSide !== undefined || resolveWorkoutExerciseSide(exercise) === undefined)).sort((a, b) => Number(b.sameIdentity) - Number(a.sameIdentity));
  const legacy = candidates.filter(({ exercise }) => resolveWorkoutExerciseSide(exercise) === undefined);
  const match = explicit[0] || (explicit.length === 0 && legacy.length === 1 ? legacy[0] : undefined);
  if (!match) return [];
  const exercise = match.exercise;
  return exercise?.recordedSets?.length ? exercise.recordedSets : (exercise?.prescriptionBlocks || []).flatMap((block) => block.actualSets || []);
}`

  const newFunction = `function previousSetsForExercise(workouts = [], target) {
  const exerciseId = typeof target === "string" ? target : target.exerciseId;
  const targetSide = typeof target === "string" ? undefined : resolveWorkoutExerciseSide(target);
  const targetEquipment = typeof target === "string" ? "standard" : (target.equipmentType || "standard");
  const timestamp = (workout) => {
    const completed = workout?.completedAt?.seconds ? Number(workout.completedAt.seconds) * 1000 : Date.parse(workout?.completedAt || "");
    return Number.isFinite(completed) ? completed : 0;
  };
  const ordered = workouts.slice().sort((a, b) => String(b.date || b.workoutDate || "").localeCompare(String(a.date || a.workoutDate || "")) || timestamp(b) - timestamp(a));
  const hasEnteredValue = (set = {}) => {
    const weight = set.weight ?? set.rawWeight;
    const reps = set.actualReps ?? set.rawReps ?? set.reps;
    return (weight !== "" && weight !== undefined && weight !== null && Number.isFinite(Number(weight)))
      || (reps !== "" && reps !== undefined && reps !== null && Number.isFinite(Number(reps)));
  };

  for (const workout of ordered) {
    const candidates = (workout.exercises || []).filter((exercise) => exercise.exerciseId === exerciseId && (exercise.equipmentType || "standard") === targetEquipment);
    if (!candidates.length) continue;

    const explicit = candidates.filter((exercise) => resolveWorkoutExerciseSide(exercise) === targetSide && (targetSide !== undefined || resolveWorkoutExerciseSide(exercise) === undefined));
    const legacy = candidates.filter((exercise) => resolveWorkoutExerciseSide(exercise) === undefined);
    const matches = explicit.length ? explicit : (legacy.length === 1 ? legacy : []);

    for (const exercise of matches) {
      const sets = exercise?.recordedSets?.length ? exercise.recordedSets : (exercise?.prescriptionBlocks || []).flatMap((block) => block.actualSets || []);
      if (sets.some(hasEnteredValue)) return sets;
    }
  }

  return [];
}`

  return replaceRequired(code, oldFunction, newFunction, id)
}

export function latestPreviousPerformanceBuildPlugin() {
  return {
    name: 'latest-previous-performance',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/lib/domain/workoutDisplay.js')) return transformWorkoutDisplay(code, id)
      return null
    },
  }
}
