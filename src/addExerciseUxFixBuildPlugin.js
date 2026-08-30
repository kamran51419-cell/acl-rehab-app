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

  if (!next.includes('const [pickerCycle, setPickerCycle] = useState(0);')) {
    next = next.replace(
      '  const [replaceIndex, setReplaceIndex] = useState(null);',
      '  const [replaceIndex, setReplaceIndex] = useState(null);\n  const [pickerCycle, setPickerCycle] = useState(0);\n  const pickerRef = React.useRef(null);',
    );
  } else if (!next.includes('const pickerRef = React.useRef(null);')) {
    next = next.replace(
      '  const [pickerCycle, setPickerCycle] = useState(0);',
      '  const [pickerCycle, setPickerCycle] = useState(0);\n  const pickerRef = React.useRef(null);',
    );
  }

  if (!next.includes('React.useEffect(() => {\n    if (!pickerOpen) return undefined;')) {
    next = next.replace(
      '  const update = (index, value) => setSelected((items) => items.map((item, itemIndex) => itemIndex === index ? value : item));',
      `  React.useEffect(() => {
    if (!pickerOpen) return undefined;
    const reveal = () => pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    const firstFrame = requestAnimationFrame(() => requestAnimationFrame(reveal));
    const timer = window.setTimeout(reveal, 140);
    return () => { cancelAnimationFrame(firstFrame); window.clearTimeout(timer); };
  }, [pickerOpen, pickerCycle]);

  const update = (index, value) => setSelected((items) => items.map((item, itemIndex) => itemIndex === index ? value : item));`,
    );
  }

  if (!next.includes('const openExercisePicker = (replacementIndex = null) =>')) {
    next = next.replace(
      '  const update = (index, value) => setSelected((items) => items.map((item, itemIndex) => itemIndex === index ? value : item));',
      `  const update = (index, value) => setSelected((items) => items.map((item, itemIndex) => itemIndex === index ? value : item));
  const openExercisePicker = (replacementIndex = null) => {
    setReplaceIndex(replacementIndex);
    setQuery("");
    setPickerCycle((value) => value + 1);
    setPickerOpen(true);
  };
  const closeExercisePicker = () => {
    setPickerOpen(false);
    setReplaceIndex(null);
    setQuery("");
  };`,
    );
  } else {
    const openStart = next.indexOf('  const revealExercisePicker = () => {');
    const updateMarker = '  const update = (index, value) => setSelected((items) => items.map((item, itemIndex) => itemIndex === index ? value : item));';
    const updateIndex = next.indexOf(updateMarker);
    const chooseIndex = updateIndex >= 0 ? next.indexOf('\n  const chooseExercise =', updateIndex) : -1;
    if (openStart >= 0 && chooseIndex > openStart) {
      const handlers = `${updateMarker}
  const openExercisePicker = (replacementIndex = null) => {
    setReplaceIndex(replacementIndex);
    setQuery("");
    setPickerCycle((value) => value + 1);
    setPickerOpen(true);
  };
  const closeExercisePicker = () => {
    setPickerOpen(false);
    setReplaceIndex(null);
    setQuery("");
  };`;
      next = next.slice(0, updateIndex) + handlers + next.slice(chooseIndex);
    }
  }

  next = next.replaceAll(
    'onClick={() => { setReplaceIndex(index); setPickerOpen(true); setQuery(""); }}',
    'onClick={() => openExercisePicker(index)}',
  );
  next = next.replaceAll(
    'onClick={() => { setPickerOpen(false); setReplaceIndex(null); }}',
    'onClick={closeExercisePicker}',
  );
  next = next.replaceAll(
    'onClick={() => { setPickerOpen(true); setReplaceIndex(null); setQuery(""); }}',
    'onClick={() => openExercisePicker(null)}',
  );

  if (!next.includes('data-quick-exercise-picker="true"')) {
    next = next.replace(
      '<div className="rounded-xl border border-dashed border-slate-300 bg-white p-3">',
      '<div ref={pickerRef} key={pickerCycle} data-quick-exercise-picker="true" className="scroll-mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-3">',
    );
  } else if (!next.includes('ref={pickerRef} key={pickerCycle} data-quick-exercise-picker="true"')) {
    next = next.replace(
      '<div key={pickerCycle} data-quick-exercise-picker="true"',
      '<div ref={pickerRef} key={pickerCycle} data-quick-exercise-picker="true"',
    );
  }

  return next;
}

function transformBuilderUxEnhancements(code) {
  let next = code.replace(
    `    if (label === 'Add exercise' || label === 'Change exercise') {
      const session = programmeSession(button)
      collapseExercises(root, session)`,
    `    if (label === 'Add exercise' || label === 'Change exercise') {
      const session = programmeSession(button)
      if (!session) return
      collapseExercises(root, session)`,
  );

  next = next.replace(
    `    if (label === 'Close') {
      const root = builderRoot()`,
    `    if (label === 'Close') {
      if (button.closest?.('[data-quick-exercise-picker="true"]')) return
      const root = builderRoot()`,
  );

  return next;
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
