function replaceIfPresent(code, oldText, newText) {
  return code.includes(oldText) ? code.replace(oldText, newText) : code;
}

function transformPlanRepository(code) {
  const oldStart = `export async function createInProgressWorkoutDocument(db, uid, workout) {
  const existing = await getDocs(collection(db, "users", uid, "workouts"));
  if (existing.docs.some((item) => item.data()?.status === "in_progress" && item.id !== workout.id)) {`;

  const newStart = `function inProgressWorkoutHasProgress(workout) {
  return (workout?.exercises || []).some((exercise) => {
    if (exercise?.flaggedSkipped || exercise?.completed) return true;
    const sets = exercise?.recordedSets || [];
    if (exercise?.loggingMethod === "reps_weight" || exercise?.loggingMethod === "time_weight") {
      return sets.some((set) => {
        const weight = set?.weight ?? set?.rawWeight;
        return weight !== "" && weight !== undefined && weight !== null && Number.isFinite(Number(weight));
      });
    }
    if (sets.some((set) => Boolean(set?.completed))) return true;
    return Boolean(exercise?.intervalProgress?.completed || exercise?.intervalProgress?.completedBlocks?.length);
  });
}

export async function createInProgressWorkoutDocument(db, uid, workout) {
  const existing = await getDocs(collection(db, "users", uid, "workouts"));
  const untouched = existing.docs.filter((item) => {
    const saved = item.data();
    return item.id !== workout.id && saved?.status === "in_progress" && saved?.completed !== true && !saved?.completedAt && !inProgressWorkoutHasProgress(saved);
  });
  if (untouched.length) {
    await Promise.all(untouched.map((item) => deleteDoc(item.ref)));
    untouched.forEach((item) => {
      recentWorkoutSnapshots.delete(workoutCacheKey(uid, item.id));
      deletedWorkoutIds.add(workoutCacheKey(uid, item.id));
    });
  }
  if (existing.docs.some((item) => {
    const saved = item.data();
    return item.id !== workout.id && saved?.status === "in_progress" && saved?.completed !== true && !saved?.completedAt && inProgressWorkoutHasProgress(saved);
  })) {`;

  return replaceIfPresent(code, oldStart, newStart);
}

export function inProgressWorkoutCleanupBuildPlugin() {
  return {
    name: 'in-progress-workout-cleanup',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/');
      if (cleanId.endsWith('/src/lib/firebase/planRepository.js')) return transformPlanRepository(code);
      return null;
    },
  };
}
