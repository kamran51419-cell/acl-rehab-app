function transformApp(code) {
  let next = code

  next = next.replace(
    '{activeTab === "home" && <HomeScreen user={user} surgeryDate={surgeryDate} trainingMode={trainingMode} fromProgramme={libraryFromProgramme} onBackToProgramme={() => { setLibraryFromProgramme(false); setActiveTab("programme"); }} onOpenWorkout={(intent) => { setWorkoutIntent({ ...intent, token: Date.now() }); setActiveTab("workout"); }} />}',
    '<div className={activeTab === "home" ? "block" : "hidden"} aria-hidden={activeTab !== "home"}><HomeScreen user={user} surgeryDate={surgeryDate} trainingMode={trainingMode} fromProgramme={libraryFromProgramme} onBackToProgramme={() => { setLibraryFromProgramme(false); setActiveTab("programme"); }} onOpenWorkout={(intent) => { setWorkoutIntent({ ...intent, token: Date.now() }); setActiveTab("workout"); }} /></div>',
  )

  next = next.replace(
    '{activeTab === "programme" && <PlansScreen user={user} trainingMode={trainingMode} onOpenExerciseLibrary={() => { setLibraryFromProgramme(true); setActiveTab("home"); }} />}',
    '<div className={activeTab === "programme" ? "block" : "hidden"} aria-hidden={activeTab !== "programme"}><PlansScreen user={user} trainingMode={trainingMode} onOpenExerciseLibrary={() => { setLibraryFromProgramme(true); setActiveTab("home"); }} /></div>',
  )

  next = next.replace(
    '{activeTab === "workout" && <WorkoutScreen user={user} intent={workoutIntent} trainingMode={trainingMode} />}',
    '<div className={activeTab === "workout" ? "block" : "hidden"} aria-hidden={activeTab !== "workout"}><WorkoutScreen user={user} intent={workoutIntent} trainingMode={trainingMode} /></div>',
  )

  next = next.replace(
    '{activeTab === "progress" && <ProgressScreen user={user} trainingMode={trainingMode} />}',
    '<div className={activeTab === "progress" ? "block" : "hidden"} aria-hidden={activeTab !== "progress"}><ProgressScreen user={user} trainingMode={trainingMode} onEditWorkout={(workout) => { sessionStorage.removeItem("completedWorkoutIntent"); setWorkoutIntent({ mode: "edit_completed", workoutId: workout.id, token: Date.now() }); setActiveTab("workout"); }} /></div>',
  )

  next = next.replace(
    '{activeTab === "more" && <div className="space-y-4"><CardShell title="Settings"><div className="space-y-4"><div><Label>Training mode</Label><div className="mt-2 flex gap-2"><TabButton active={trainingMode === "gym"} onClick={() => { setTrainingMode("gym"); saveAllData(weeks, customExercises, surgeryDate, "gym"); }}>Gym</TabButton><TabButton active={trainingMode === "rehab"} onClick={() => { setTrainingMode("rehab"); saveAllData(weeks, customExercises, surgeryDate, "rehab"); }}>Rehab</TabButton></div></div>{trainingMode === "rehab" ? <div className="space-y-1.5"><Label>Surgery date</Label><Input className="date-field-clip" type="date" value={surgeryDate} onChange={(e) => { setSurgeryDate(e.target.value); saveAllData(weeks, customExercises, e.target.value); }} /></div> : null}<Button variant="outline" onClick={handleLogout}>Log out</Button></div></CardShell></div>}',
    '<div className={activeTab === "more" ? "block" : "hidden"} aria-hidden={activeTab !== "more"}><div className="space-y-4"><CardShell title="Settings"><div className="space-y-4"><div><Label>Training mode</Label><div className="mt-2 flex gap-2"><TabButton active={trainingMode === "gym"} onClick={() => { setTrainingMode("gym"); saveAllData(weeks, customExercises, surgeryDate, "gym"); }}>Gym</TabButton><TabButton active={trainingMode === "rehab"} onClick={() => { setTrainingMode("rehab"); saveAllData(weeks, customExercises, surgeryDate, "rehab"); }}>Rehab</TabButton></div></div>{trainingMode === "rehab" ? <div className="space-y-1.5"><Label>Surgery date</Label><Input className="date-field-clip" type="date" value={surgeryDate} onChange={(e) => { setSurgeryDate(e.target.value); saveAllData(weeks, customExercises, e.target.value); }} /></div> : null}<Button variant="outline" onClick={handleLogout}>Log out</Button></div></CardShell></div></div>',
  )

  return next
}

function transformProgressScreen(code) {
  let next = code
  next = next.replace(
    'export function ProgressLayout({ user, workouts, trainingMode, initialTab = "stats" }) {',
    'export function ProgressLayout({ user, workouts, trainingMode, initialTab = "stats", onEditWorkout }) {',
  )
  next = next.replace(
    '<WorkoutHistoryScreen user={user} showNavigation={false}/>',
    '<WorkoutHistoryScreen user={user} showNavigation={false} onEditWorkout={onEditWorkout}/>',
  )
  next = next.replace(
    'export default function ProgressScreen({ user, trainingMode, initialTab = "stats", repository = defaultRepository }) {',
    'export default function ProgressScreen({ user, trainingMode, initialTab = "stats", onEditWorkout, repository = defaultRepository }) {',
  )
  next = next.replace(
    '<ProgressLayout user={user} workouts={workouts} trainingMode={trainingMode} initialTab={initialTab}/>',
    '<ProgressLayout user={user} workouts={workouts} trainingMode={trainingMode} initialTab={initialTab} onEditWorkout={onEditWorkout}/>',
  )
  return next
}

function transformWorkoutHistoryScreen(code) {
  let next = code
  next = next.replace(
    'export function WorkoutHistoryView({ workouts, deletingId, deleteError, onRequestDelete, onCancelDelete, onConfirmDelete, showNavigation = true }) {',
    'export function WorkoutHistoryView({ workouts, deletingId, deleteError, onRequestDelete, onCancelDelete, onConfirmDelete, onEditWorkout, showNavigation = true }) {',
  )
  next = next.replace(
    'onClick={() => editWorkout(workout)}>Edit</Button>',
    'onClick={() => onEditWorkout ? onEditWorkout(workout) : editWorkout(workout)}>Edit</Button>',
  )
  next = next.replace(
    'export default function WorkoutHistoryScreen({ user, repository = defaultRepository, showNavigation = true }) {',
    'export default function WorkoutHistoryScreen({ user, repository = defaultRepository, showNavigation = true, onEditWorkout }) {',
  )
  next = next.replace(
    'onConfirmDelete={confirmDelete} showNavigation={showNavigation}/>;',
    'onConfirmDelete={confirmDelete} onEditWorkout={onEditWorkout} showNavigation={showNavigation}/>;',
  )
  return next
}

export function seamlessTabsBuildPlugin() {
  return {
    name: 'seamless-tabs',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/App.jsx')) return transformApp(code)
      if (cleanId.endsWith('/src/features/progress/ProgressScreen.jsx')) return transformProgressScreen(code)
      if (cleanId.endsWith('/src/features/workout/WorkoutHistoryScreen.jsx')) return transformWorkoutHistoryScreen(code)
      return null
    },
  }
}
