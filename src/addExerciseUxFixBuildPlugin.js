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

function transformBuilderUxEnhancements(code) {
  return code.replace(
    `function pickerInSession(session) {
  if (!session) return null
  return [...session.querySelectorAll('div.rounded-xl.border-dashed, [data-exercise-picker]')].find((item) =>
    /Exercise picker|Change exercise|Search exercises/i.test(textOf(item)),
  ) || null
}`,
    `function pickerInSession(session) {
  const scope = session || builderRoot()
  if (!scope) return null
  return [...scope.querySelectorAll('div.rounded-xl.border-dashed, [data-exercise-picker]')].find((item) =>
    /Exercise picker|Change exercise|Search exercises/i.test(textOf(item)),
  ) || null
}`,
  );
}

export function addExerciseUxFixBuildPlugin() {
  return {
    name: 'add-exercise-ux-fix',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/');
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code);
      if (cleanId.endsWith('/src/builderUxEnhancements.js')) return transformBuilderUxEnhancements(code);
      return null;
    },
  };
}
