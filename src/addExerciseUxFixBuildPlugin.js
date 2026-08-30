function transformWorkoutScreen(code) {
  let next = code;

  next = next.replace(
    'className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-3 sm:items-center"><section className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-5"',
    'className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-slate-900/50 p-3 sm:items-center sm:p-4"><section className="max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-xl sm:max-h-[88vh] sm:p-5"',
  );

  next = next.replace(
    'onCancel={() => setAdding(null)} onSave=',
    'onCancel={() => { setAdding(null); setPicker(null); }} onSave=',
  );

  return next;
}

function transformQuickWorkoutBuilder(code) {
  let next = code;

  if (!next.includes('const [pickerCycle, setPickerCycle] = useState(0);')) {
    next = next.replace(
      '  const [replaceIndex, setReplaceIndex] = useState(null);',
      `  const [replaceIndex, setReplaceIndex] = useState(null);\n  const [pickerCycle, setPickerCycle] = useState(0);`,
    );
  }

  if (!next.includes('const openExercisePicker = (replacementIndex = null) =>')) {
    next = next.replace(
      '  const update = (index, value) => setSelected((items) => items.map((item, itemIndex) => itemIndex === index ? value : item));',
      `  const update = (index, value) => setSelected((items) => items.map((item, itemIndex) => itemIndex === index ? value : item));\n  const openExercisePicker = (replacementIndex = null) => {\n    setReplaceIndex(replacementIndex);\n    setQuery(\"\");\n    setPickerCycle((value) => value + 1);\n    setPickerOpen(true);\n  };\n  const closeExercisePicker = () => {\n    setPickerOpen(false);\n    setReplaceIndex(null);\n    setQuery(\"\");\n  };`,
    );
  }

  next = next.replace(
    'onClick={() => { setReplaceIndex(index); setPickerOpen(true); setQuery(""); }}',
    'onClick={() => openExercisePicker(index)}',
  );
  next = next.replace(
    'onClick={() => { setPickerOpen(false); setReplaceIndex(null); }}>Close</Button>',
    'onClick={closeExercisePicker}>Close</Button>',
  );
  next = next.replace(
    'onClick={() => { setPickerOpen(true); setReplaceIndex(null); setQuery(""); }}><Plus',
    'onClick={() => openExercisePicker(null)}><Plus',
  );

  if (!next.includes('key={pickerCycle} className="rounded-xl border border-dashed border-slate-300 bg-white p-3"')) {
    next = next.replace(
      '<div className="rounded-xl border border-dashed border-slate-300 bg-white p-3">',
      '<div key={pickerCycle} className="rounded-xl border border-dashed border-slate-300 bg-white p-3">',
    );
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
      if (cleanId.endsWith('/src/features/workout/QuickWorkoutBuilder.jsx')) return transformQuickWorkoutBuilder(code);
      return null;
    },
  };
}
