function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Deleted exercise stats transform could not find expected source in ${id}`);
  return code.replace(oldText, newText);
}

function transformProgressScreen(code, id) {
  let next = replaceRequired(
    code,
    'import { subscribeWorkouts } from "../../lib/firebase/planRepository";',
    'import { subscribeExerciseDefinitions, subscribeWorkouts } from "../../lib/firebase/planRepository";',
    id,
  );

  next = replaceRequired(
    next,
    'const defaultRepository = { subscribeWorkouts };',
    'const defaultRepository = { subscribeExerciseDefinitions, subscribeWorkouts };',
    id,
  );

  next = replaceRequired(
    next,
    'export function StatsView({ workouts, trainingMode }) {',
    'export function StatsView({ workouts, trainingMode, exerciseIds = null }) {',
    id,
  );

  next = replaceRequired(
    next,
    '  const groups = useMemo(() => completedExerciseGroups(completed).filter((group) => group.weightedEntries.length), [completed]);',
    '  const groups = useMemo(() => completedExerciseGroups(completed).filter((group) => group.weightedEntries.length && (!exerciseIds || exerciseIds.has(group.exerciseId))), [completed, exerciseIds]);',
    id,
  );

  next = replaceRequired(
    next,
    'export function ProgressLayout({ user, workouts, trainingMode, initialTab = "stats" }) {',
    'export function ProgressLayout({ user, workouts, exerciseIds = null, trainingMode, initialTab = "stats" }) {',
    id,
  );

  next = replaceRequired(
    next,
    '<StatsView workouts={workouts} trainingMode={trainingMode}/>',
    '<StatsView workouts={workouts} exerciseIds={exerciseIds} trainingMode={trainingMode}/>',
    id,
  );

  next = replaceRequired(
    next,
    'export default function ProgressScreen({ user, trainingMode, initialTab = "stats", repository = defaultRepository }) {\n  const [workouts, setWorkouts] = useState([]);\n  const [error, setError] = useState("");\n  useEffect(() => repository.subscribeWorkouts(db, user.uid, setWorkouts, (loadError) => { console.error("Could not load progress", loadError); setError("Progress could not be loaded. Check your connection and try again."); }), [repository, user.uid]);\n  return <>{error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}<ProgressLayout user={user} workouts={workouts} trainingMode={trainingMode} initialTab={initialTab}/></>;\n}',
    'export default function ProgressScreen({ user, trainingMode, initialTab = "stats", repository = defaultRepository }) {\n  const [workouts, setWorkouts] = useState([]);\n  const [exerciseIds, setExerciseIds] = useState(new Set());\n  const [error, setError] = useState("");\n  useEffect(() => {\n    const unsubWorkouts = repository.subscribeWorkouts(db, user.uid, setWorkouts, (loadError) => { console.error("Could not load progress", loadError); setError("Progress could not be loaded. Check your connection and try again."); });\n    const unsubExercises = repository.subscribeExerciseDefinitions(db, user.uid, (items) => setExerciseIds(new Set(items.map((exercise) => exercise.id))), (loadError) => { console.error("Could not load exercise library for stats", loadError); setError("Progress could not be loaded. Check your connection and try again."); });\n    return () => { unsubWorkouts?.(); unsubExercises?.(); };\n  }, [repository, user.uid]);\n  return <>{error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}<ProgressLayout user={user} workouts={workouts} exerciseIds={exerciseIds} trainingMode={trainingMode} initialTab={initialTab}/></>;\n}',
    id,
  );

  return next;
}

function transformPlansScreen(code, id) {
  let next = replaceRequired(
    code,
    'setMessage("Exercise permanently deleted from the library. Existing programme and workout records were not changed.");',
    'setMessage("Exercise permanently deleted from the library and removed from Stats. Existing programme entries and workout history remain.");',
    id,
  );

  next = replaceRequired(
    next,
    '<p className="mt-2 text-sm text-slate-600">It will be removed from your Exercise Library. Existing programme and workout records will not be rewritten.</p>',
    '<p className="mt-2 text-sm text-slate-600">It will be removed from your Exercise Library and Stats. Existing programme entries and completed workout history will remain.</p>',
    id,
  );

  return next;
}

export function deletedExerciseStatsBuildPlugin() {
  return {
    name: 'deleted-exercise-stats',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/');
      if (cleanId.endsWith('/src/features/progress/ProgressScreen.jsx')) return transformProgressScreen(code, id);
      if (cleanId.endsWith('/src/features/plans/PlansScreen.jsx')) return transformPlansScreen(code, id);
      return null;
    },
  };
}
