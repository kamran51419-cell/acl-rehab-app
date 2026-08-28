function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Seamless tabs transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

function transformApp(code, id) {
  let next = code

  next = replaceRequired(
    next,
    '{activeTab === "home" && <HomeScreen user={user} surgeryDate={surgeryDate} trainingMode={trainingMode} fromProgramme={libraryFromProgramme} onBackToProgramme={() => { setLibraryFromProgramme(false); setActiveTab("programme"); }} onOpenWorkout={(intent) => { setWorkoutIntent({ ...intent, token: Date.now() }); setActiveTab("workout"); }} />}',
    '<div className={activeTab === "home" ? "block" : "hidden"} aria-hidden={activeTab !== "home"}><HomeScreen user={user} surgeryDate={surgeryDate} trainingMode={trainingMode} fromProgramme={libraryFromProgramme} onBackToProgramme={() => { setLibraryFromProgramme(false); setActiveTab("programme"); }} onOpenWorkout={(intent) => { setWorkoutIntent({ ...intent, token: Date.now() }); setActiveTab("workout"); }} /></div>',
    id,
  )

  next = replaceRequired(
    next,
    '{activeTab === "programme" && <PlansScreen user={user} trainingMode={trainingMode} onOpenExerciseLibrary={() => { setLibraryFromProgramme(true); setActiveTab("home"); }} />}',
    '<div className={activeTab === "programme" ? "block" : "hidden"} aria-hidden={activeTab !== "programme"}><PlansScreen user={user} trainingMode={trainingMode} onOpenExerciseLibrary={() => { setLibraryFromProgramme(true); setActiveTab("home"); }} /></div>',
    id,
  )

  next = replaceRequired(
    next,
    '{activeTab === "workout" && <WorkoutScreen user={user} intent={workoutIntent} trainingMode={trainingMode} />}',
    '<div className={activeTab === "workout" ? "block" : "hidden"} aria-hidden={activeTab !== "workout"}><WorkoutScreen user={user} intent={workoutIntent} trainingMode={trainingMode} /></div>',
    id,
  )

  next = replaceRequired(
    next,
    '{activeTab === "progress" && <ProgressScreen user={user} trainingMode={trainingMode} />}',
    '<div className={activeTab === "progress" ? "block" : "hidden"} aria-hidden={activeTab !== "progress"}><ProgressScreen user={user} trainingMode={trainingMode} /></div>',
    id,
  )

  next = replaceRequired(
    next,
    '{activeTab === "more" && <div className="space-y-4"><CardShell title="Settings"><div className="space-y-4"><div><Label>Training mode</Label><div className="mt-2 flex gap-2"><TabButton active={trainingMode === "gym"} onClick={() => { setTrainingMode("gym"); saveAllData(weeks, customExercises, surgeryDate, "gym"); }}>Gym</TabButton><TabButton active={trainingMode === "rehab"} onClick={() => { setTrainingMode("rehab"); saveAllData(weeks, customExercises, surgeryDate, "rehab"); }}>Rehab</TabButton></div></div>{trainingMode === "rehab" ? <div><Label>Surgery date</Label><Input type="date" value={surgeryDate} onChange={(e) => { setSurgeryDate(e.target.value); saveAllData(weeks, customExercises, e.target.value); }} /></div> : null}<Button variant="outline" onClick={handleLogout}>Log out</Button></div></CardShell></div>}',
    '<div className={activeTab === "more" ? "block" : "hidden"} aria-hidden={activeTab !== "more"}><div className="space-y-4"><CardShell title="Settings"><div className="space-y-4"><div><Label>Training mode</Label><div className="mt-2 flex gap-2"><TabButton active={trainingMode === "gym"} onClick={() => { setTrainingMode("gym"); saveAllData(weeks, customExercises, surgeryDate, "gym"); }}>Gym</TabButton><TabButton active={trainingMode === "rehab"} onClick={() => { setTrainingMode("rehab"); saveAllData(weeks, customExercises, surgeryDate, "rehab"); }}>Rehab</TabButton></div></div>{trainingMode === "rehab" ? <div><Label>Surgery date</Label><Input type="date" value={surgeryDate} onChange={(e) => { setSurgeryDate(e.target.value); saveAllData(weeks, customExercises, e.target.value); }} /></div> : null}<Button variant="outline" onClick={handleLogout}>Log out</Button></div></CardShell></div></div>',
    id,
  )

  return next
}

export function seamlessTabsBuildPlugin() {
  return {
    name: 'seamless-tabs',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/App.jsx')) return transformApp(code, id)
      return null
    },
  }
}
