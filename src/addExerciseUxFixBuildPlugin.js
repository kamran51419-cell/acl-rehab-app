function transformWorkoutScreen(code) {
  let next = code;

  next = next.replace(
    'className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-3 sm:items-center"><section className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl"',
    'className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-slate-900/50 p-3 sm:items-center sm:p-4"><section className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl sm:max-h-[80vh]"',
  );

  next = next.replace(
    '<div className="max-h-[55vh] overflow-y-auto p-3">',
    '<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">',
  );

  return next;
}

function transformHomeScreen(code) {
  let next = code;
  if (!next.includes('function activeHomeWorkout(')) return next;

  const start = next.indexOf('const unfinishedWorkout = useMemo(');
  const endMarker = '\n  const incompleteWorkoutList';
  const end = start >= 0 ? next.indexOf(endMarker, start) : -1;
  if (start >= 0 && end > start) {
    next = `${next.slice(0, start)}const unfinishedWorkout = useMemo(() => activeHomeWorkout(workouts), [workouts]);${next.slice(end)}`;
  }

  return next;
}

export function addExerciseUxFixBuildPlugin() {
  return {
    name: 'add-exercise-ux-fix',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/');
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code);
      if (cleanId.endsWith('/src/features/home/HomeScreen.jsx')) return transformHomeScreen(code);
      return null;
    },
  };
}
