function renameExerciseSnapshot(exercise, exerciseId, exerciseName) {
  if (!exercise || typeof exercise !== "object") return { value: exercise, changed: false };
  let value = exercise;
  let changed = false;

  if (String(exercise.exerciseId || "") === String(exerciseId) && exercise.exerciseNameSnapshot !== exerciseName) {
    value = { ...value, exerciseNameSnapshot: exerciseName };
    changed = true;
  }

  if (String(exercise.substitutedForExerciseId || "") === String(exerciseId) && exercise.substitutedForExerciseName !== exerciseName) {
    value = { ...value, substitutedForExerciseName: exerciseName };
    changed = true;
  }

  return { value, changed };
}

export function renameExerciseNameSnapshots(record, exerciseId, exerciseName) {
  const name = String(exerciseName || "").trim();
  if (!record || !exerciseId || !name) return record;

  let changed = false;
  let value = record;

  if (Array.isArray(record.sessions)) {
    const sessions = record.sessions.map((session) => {
      if (!Array.isArray(session?.exercises)) return session;
      let sessionChanged = false;
      const exercises = session.exercises.map((exercise) => {
        const renamed = renameExerciseSnapshot(exercise, exerciseId, name);
        sessionChanged = sessionChanged || renamed.changed;
        return renamed.value;
      });
      if (!sessionChanged) return session;
      changed = true;
      return { ...session, exercises };
    });
    if (changed) value = { ...value, sessions };
  }

  if (Array.isArray(record.exercises)) {
    let exercisesChanged = false;
    const exercises = record.exercises.map((exercise) => {
      const renamed = renameExerciseSnapshot(exercise, exerciseId, name);
      exercisesChanged = exercisesChanged || renamed.changed;
      return renamed.value;
    });
    if (exercisesChanged) {
      changed = true;
      value = { ...value, exercises };
    }
  }

  return changed ? value : record;
}
