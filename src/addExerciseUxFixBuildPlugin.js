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

function transformQuickWorkoutBuilder(code) {
  let next = code;

  const pickerStart = next.indexOf('        {pickerOpen ? (');
  const pickerEndMarker = '        ) : null}';
  const pickerEnd = pickerStart >= 0 ? next.indexOf(pickerEndMarker, pickerStart) : -1;

  if (pickerStart >= 0 && pickerEnd > pickerStart) {
    const pickerBlockEnd = pickerEnd + pickerEndMarker.length;
    const addButtonStartCandidates = [
      next.indexOf('        <Button variant="secondary"', pickerBlockEnd),
      next.indexOf('        <Button variant="outline"', pickerBlockEnd),
    ].filter((index) => index >= 0);
    const addButtonStart = addButtonStartCandidates.length ? Math.min(...addButtonStartCandidates) : -1;

    if (addButtonStart >= 0 && addButtonStart - pickerBlockEnd < 400) {
      const addButtonEndMarker = '</Button>';
      const addButtonEndIndex = next.indexOf(addButtonEndMarker, addButtonStart);
      const addButtonEnd = addButtonEndIndex >= 0 ? addButtonEndIndex + addButtonEndMarker.length : -1;
      const addButton = addButtonEnd > addButtonStart ? next.slice(addButtonStart, addButtonEnd) : '';

      if (addButton.includes('Add exercise')) {
        const pickerBlock = next.slice(pickerStart, pickerBlockEnd);
        const between = next.slice(pickerBlockEnd, addButtonStart);
        next = next.slice(0, pickerStart)
          + addButton
          + between
          + pickerBlock
          + next.slice(addButtonEnd);
      }
    }
  }

  return next;
}

function transformBuilderUxEnhancements(code) {
  return code.replace(
    `    if (label === 'Add exercise' || label === 'Change exercise') {
      const session = programmeSession(button)
      collapseExercises(root, session)`,
    `    if (label === 'Add exercise' || label === 'Change exercise') {
      const session = programmeSession(button)
      if (!session) return
      collapseExercises(root, session)`,
  );
}

export function addExerciseUxFixBuildPlugin() {
  return {
    name: 'add-exercise-ux-fix',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/');
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code);
      if (cleanId.endsWith('/src/features/workout/QuickWorkoutBuilder.jsx')) return transformQuickWorkoutBuilder(code);
      if (cleanId.endsWith('/src/builderUxEnhancements.js')) return transformBuilderUxEnhancements(code);
      return null;
    },
  };
}
