function assertTransformed(code, marker, id) {
  if (!code.includes(marker)) throw new Error(`Deleted exercise stats transform did not apply in ${id}`);
}

function transformProgressScreen(code, id) {
  let next = code
    .replace(
      'import { subscribeWorkouts } from "../../lib/firebase/planRepository";',
      'import { subscribeExerciseDefinitions, subscribeWorkouts } from "../../lib/firebase/planRepository";',
    )
    .replace(
      'const defaultRepository = { subscribeWorkouts };',
      'const defaultRepository = { subscribeExerciseDefinitions, subscribeWorkouts };',
    )
    .replace(
      'export function StatsView({ workouts, trainingMode }) {',
      'export function StatsView({ workouts, trainingMode, exerciseIds = null }) {',
    )
    .replace(
      '  const groups = useMemo(() => completedExerciseGroups(completed).filter((group) => group.weightedEntries.length), [completed]);',
      '  const groups = useMemo(() => completedExerciseGroups(completed).filter((group) => group.weightedEntries.length && (!exerciseIds || exerciseIds.has(group.exerciseId))), [completed, exerciseIds]);',
    )
    .replace(
      'export function ProgressLayout({ user, workouts, trainingMode, initialTab = "stats" }) {',
      'export function ProgressLayout({ user, workouts, exerciseIds = null, trainingMode, initialTab = "stats" }) {',
    )
    .replace(
      '<StatsView workouts={workouts} trainingMode={trainingMode}/>',
      '<StatsView workouts={workouts} exerciseIds={exerciseIds} trainingMode={trainingMode}/>',
    )
    .replace(
      '  const [workouts, setWorkouts] = useState([]);\n  const [error, setError] = useState("");',
      '  const [workouts, setWorkouts] = useState([]);\n  const [exerciseIds, setExerciseIds] = useState(new Set());\n  const [error, setError] = useState("");',
    )
    .replace(
      '  useEffect(() => repository.subscribeWorkouts(db, user.uid, setWorkouts, (loadError) => { console.error("Could not load progress", loadError); setError("Progress could not be loaded. Check your connection and try again."); }), [repository, user.uid]);',
      '  useEffect(() => { const unsubWorkouts = repository.subscribeWorkouts(db, user.uid, setWorkouts, (loadError) => { console.error("Could not load progress", loadError); setError("Progress could not be loaded. Check your connection and try again."); }); const unsubExercises = repository.subscribeExerciseDefinitions(db, user.uid, (items) => setExerciseIds(new Set(items.map((exercise) => exercise.id))), (loadError) => { console.error("Could not load exercise library for stats", loadError); setError("Progress could not be loaded. Check your connection and try again."); }); return () => { unsubWorkouts?.(); unsubExercises?.(); }; }, [repository, user.uid]);',
    )
    .replace(
      '<ProgressLayout user={user} workouts={workouts} trainingMode={trainingMode} initialTab={initialTab}/>',
      '<ProgressLayout user={user} workouts={workouts} exerciseIds={exerciseIds} trainingMode={trainingMode} initialTab={initialTab}/>',
    );

  assertTransformed(next, 'subscribeExerciseDefinitions, subscribeWorkouts', id);
  assertTransformed(next, 'exerciseIds.has(group.exerciseId)', id);
  assertTransformed(next, 'repository.subscribeExerciseDefinitions(db, user.uid', id);
  assertTransformed(next, 'exerciseIds={exerciseIds}', id);
  return next;
}

function transformPlansScreen(code, id) {
  const next = code
    .replace(
      'setMessage("Exercise permanently deleted from the library. Existing programme and workout records were not changed.");',
      'setMessage("Exercise permanently deleted from the library and removed from Stats. Existing programme entries and workout history remain.");',
    )
    .replace(
      '<p className="mt-2 text-sm text-slate-600">It will be removed from your Exercise Library. Existing programme and workout records will not be rewritten.</p>',
      '<p className="mt-2 text-sm text-slate-600">It will be removed from your Exercise Library and Stats. Existing programme entries and completed workout history will remain.</p>',
    );

  assertTransformed(next, 'removed from your Exercise Library and Stats', id);
  assertTransformed(next, 'removed from Stats. Existing programme entries and workout history remain.', id);
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
