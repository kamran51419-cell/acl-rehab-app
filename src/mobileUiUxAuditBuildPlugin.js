function transformApp(code) {
  let next = code

  next = next.replace(
    '    if (["programme", "workout"].includes(activeTab)) return;\n\n    return subscribeLegacyRehabData(',
    '    return subscribeLegacyRehabData(',
  )
  next = next.replace(
    '  }, [user, authLoading, activeTab]);',
    '  }, [user, authLoading]);',
  )

  next = next.replace(
    'className={cls("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs", activeTab === "home" ? "bg-slate-100 font-medium" : "text-slate-500")}',
    'className={cls("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs transition-colors duration-150", activeTab === "home" ? "bg-slate-100 font-medium" : "text-slate-500")}',
  )
  next = next.replace(
    'className={cls("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs", activeTab === "programme" ? "bg-slate-100 font-medium" : "text-slate-500")}',
    'className={cls("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs transition-colors duration-150", activeTab === "programme" ? "bg-slate-100 font-medium" : "text-slate-500")}',
  )
  next = next.replace(
    'className={cls("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs", activeTab === "workout" ? "bg-slate-100 font-medium" : "text-slate-500")}',
    'className={cls("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs transition-colors duration-150", activeTab === "workout" ? "bg-slate-100 font-medium" : "text-slate-500")}',
  )
  next = next.replace(
    'className={cls("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs", ["progress", "workout-history", "table", "graphs"].includes(activeTab) ? "bg-slate-100 font-medium" : "text-slate-500")}',
    'className={cls("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs transition-colors duration-150", ["progress", "workout-history", "table", "graphs"].includes(activeTab) ? "bg-slate-100 font-medium" : "text-slate-500")}',
  )
  next = next.replace(
    'className={cls("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs", activeTab === "more" ? "bg-slate-100 font-medium" : "text-slate-500")}',
    'className={cls("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs transition-colors duration-150", activeTab === "more" ? "bg-slate-100 font-medium" : "text-slate-500")}',
  )

  next = next.replace(
    '{trainingMode === "rehab" ? <div><Label>Surgery date</Label><Input type="date" value={surgeryDate}',
    '{trainingMode === "rehab" ? <div className="space-y-1.5"><Label>Surgery date</Label><Input className="date-field-clip" type="date" value={surgeryDate}',
  )

  return next
}

function transformPlansScreen(code) {
  let next = code

  next = next.replace(
    '<div className="flex flex-wrap items-center justify-between gap-3">\n        <div>\n          <h2 className="text-xl font-semibold text-slate-900">{original ? "Edit programme" : "Create programme"}</h2>\n          <p className="text-sm text-slate-500">Programme changes do not alter completed workouts.</p>\n        </div>\n        <div className="flex gap-2">',
    '<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">\n        <div className="min-w-0">\n          <h2 className="text-xl font-semibold leading-tight text-slate-900">{original ? "Edit programme" : "Create programme"}</h2>\n          <p className="mt-1 text-sm leading-5 text-slate-500">Programme changes do not alter completed workouts.</p>\n        </div>\n        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">',
  )

  next = next.replace(
    '<div><h3 className="text-lg font-semibold">Routine Tasks</h3><p className="text-sm text-slate-500">Small tasks scheduled independently of workouts.</p></div>\n          <Button variant="outline" onClick={addRoutineTask}><Plus className="mr-1 h-4 w-4" /> Add task</Button>',
    '<div className="min-w-0"><h3 className="text-lg font-semibold">Daily tasks</h3><p className="text-sm text-slate-500">Small tasks scheduled independently of workouts.</p></div>\n          <Button className="shrink-0 whitespace-nowrap" variant="secondary" onClick={addRoutineTask}><Plus className="mr-1 h-4 w-4" /> Add task</Button>',
  )

  next = next.replace(
    '<div className="flex items-center justify-between">\n          <h3 className="text-lg font-semibold">Sessions</h3>\n          <Button variant="outline" onClick={addSession}><Plus className="mr-1 h-4 w-4" /> Add session</Button>',
    '<div className="flex items-center justify-between gap-3">\n          <h3 className="text-lg font-semibold">Sessions</h3>\n          <Button className="shrink-0 whitespace-nowrap" variant="secondary" onClick={addSession}><Plus className="mr-1 h-4 w-4" /> Add session</Button>',
  )

  next = next.replace(
    '<Input autoFocus value={task.name}',
    '<Input value={task.name}',
  )

  next = next.replace(
    '<Button size="sm" disabled={!task.name.trim() || task.days.length === 0} onClick={() => setEditingRoutineId("")}>Done</Button>',
    '<Button size="sm" variant="outline" disabled={!task.name.trim() || task.days.length === 0} onClick={() => setEditingRoutineId("")}>Done</Button>',
  )

  next = next.replace(
    ' : <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="font-medium">{task.name || "Unnamed task"}</div>',
    ' : <div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="font-medium">{task.name || "Unnamed task"}</div>',
  )

  next = next.replace(
    '<div className="flex flex-wrap items-end gap-2">\n                  <Button size="sm" variant="outline" onClick={() => setSessions([...draft.sessions, { ...duplicatePlan({ ...draft, sessions: [session] }).sessions[0], sortOrder: draft.sessions.length }])}>Duplicate</Button>\n                  <Button size="sm" variant="danger" onClick={() => setRemoveSessionIndex(sessionIndex)}>Remove</Button>\n                </div>',
    '<div className="grid grid-cols-2 items-center gap-2 md:flex md:items-end">\n                  <Button className="w-full whitespace-nowrap md:w-auto" size="sm" variant="outline" onClick={() => setSessions([...draft.sessions, { ...duplicatePlan({ ...draft, sessions: [session] }).sessions[0], sortOrder: draft.sessions.length }])}>Duplicate</Button>\n                  <Button className="w-full whitespace-nowrap md:w-auto" size="sm" variant="danger" onClick={() => setRemoveSessionIndex(sessionIndex)}>Remove</Button>\n                </div>',
  )

  next = next.replace(
    '<div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-medium">{plan.name}</div><div className="text-xs text-slate-500">Version {plan.version} · {plan.sessions.length} sessions</div></div><div className="flex flex-wrap gap-2">',
    '<div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-medium">{plan.name}</div><div className="text-xs text-slate-500">Version {plan.version} · {plan.sessions.length} sessions</div></div><div className="flex flex-wrap items-center gap-2">',
  )

  next = next.replaceAll(
    '<Button variant="outline" onClick={() => openPickerForAdd(sessionIndex)}><Plus className="mr-1 h-4 w-4" /> Add exercise</Button>',
    '<Button variant="secondary" onClick={() => openPickerForAdd(sessionIndex)}><Plus className="mr-1 h-4 w-4" /> Add exercise</Button>',
  )
  next = next.replaceAll(
    '<Button variant="outline" onClick={() => insertSessionAfter(sessionIndex)}><Plus className="mr-1 h-4 w-4" /> Add session</Button>',
    '<Button variant="secondary" onClick={() => insertSessionAfter(sessionIndex)}><Plus className="mr-1 h-4 w-4" /> Add session</Button>',
  )
  next = next.replace(
    '<Button size="sm" onClick={() => setAddingExercise(true)}><Plus className="mr-1 h-4 w-4" /> Add exercise</Button>',
    '<Button size="sm" variant="secondary" onClick={() => setAddingExercise(true)}><Plus className="mr-1 h-4 w-4" /> Add exercise</Button>',
  )

  return next
}

function transformQuickWorkoutBuilder(code) {
  return code.replace(
    '<Button variant="outline" onClick={() => { setPickerOpen(true); setReplaceIndex(null); setQuery(""); }}><Plus className="mr-1 h-4 w-4" /> Add exercise</Button>',
    '<Button variant="secondary" onClick={() => { setPickerOpen(true); setReplaceIndex(null); setQuery(""); }}><Plus className="mr-1 h-4 w-4" /> Add exercise</Button>',
  )
}

function transformRoutineTaskTimeEditor(code) {
  let next = code

  next = next.replace(
    'addCustom.className = "min-h-10 rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800";',
    'addCustom.className = "min-h-10 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors duration-150 hover:border-blue-300 hover:bg-blue-100 active:bg-blue-100";',
  )

  next = next.replace(
    '  const observer = new MutationObserver(() => requestAnimationFrame(enhance));\n  observer.observe(document.body, { childList: true, subtree: true });\n  return () => observer.disconnect();',
    '  let enhanceFrame = 0;\n  const observer = new MutationObserver(() => { cancelAnimationFrame(enhanceFrame); enhanceFrame = requestAnimationFrame(enhance); });\n  observer.observe(document.body, { childList: true, subtree: true });\n  return () => { cancelAnimationFrame(enhanceFrame); observer.disconnect(); };',
  )

  return next
}

function transformBuilderUxEnhancements(code) {
  return code.replace(
    '  const observer = new MutationObserver(() => requestAnimationFrame(handleRender))\n  observer.observe(document.body, { childList: true, subtree: true })',
    '  let renderFrame = 0\n  const observer = new MutationObserver(() => { cancelAnimationFrame(renderFrame); renderFrame = requestAnimationFrame(handleRender) })\n  observer.observe(document.body, { childList: true, subtree: true })',
  ).replace(
    '    observer.disconnect()\n    document.removeEventListener(\'click\', handleClick, true)',
    '    cancelAnimationFrame(renderFrame)\n    observer.disconnect()\n    document.removeEventListener(\'click\', handleClick, true)',
  )
}

function transformIndexCss(code) {
  return `${code}\n\n/* Mobile UI audit: one native-looking date control, one border, one size. */\ninput[type='date'] {\n  -webkit-appearance: none !important;\n  appearance: none !important;\n  position: relative !important;\n  display: block !important;\n  box-sizing: border-box !important;\n  inline-size: 11.5rem !important;\n  width: 11.5rem !important;\n  min-inline-size: 0 !important;\n  min-width: 0 !important;\n  max-inline-size: 100% !important;\n  max-width: 100% !important;\n  block-size: 2.5rem !important;\n  height: 2.5rem !important;\n  min-height: 2.5rem !important;\n  margin: 0 !important;\n  border: 1px solid rgb(203 213 225) !important;\n  outline: 0 !important;\n  border-radius: 0.75rem !important;\n  background-color: #fff !important;\n  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none'%3E%3Crect x='3' y='5' width='18' height='16' rx='2' stroke='%2364758b' stroke-width='1.8'/%3E%3Cpath d='M8 3v4M16 3v4M3 10h18' stroke='%2364758b' stroke-width='1.8' stroke-linecap='round'/%3E%3C/svg%3E") !important;\n  background-repeat: no-repeat !important;\n  background-position: right 0.75rem center !important;\n  background-size: 1rem 1rem !important;\n  box-shadow: none !important;\n  padding: 0 2.5rem !important;\n  color: rgb(15 23 42) !important;\n  font-size: 0.875rem !important;\n  line-height: 1 !important;\n  text-align: center !important;\n  overflow: hidden !important;\n}\n\ninput[type='date']:focus,\ninput[type='date']:focus-visible {\n  border-color: rgb(59 130 246) !important;\n  outline: 0 !important;\n  box-shadow: 0 0 0 2px rgb(59 130 246 / 0.12) !important;\n}\n\ninput[type='date']::-webkit-date-and-time-value {\n  width: 100% !important;\n  min-width: 0 !important;\n  margin: 0 !important;\n  padding: 0 !important;\n  text-align: center !important;\n}\n\ninput[type='date']::-webkit-datetime-edit {\n  display: block !important;\n  width: 100% !important;\n  min-width: 0 !important;\n  margin: 0 !important;\n  padding: 0 !important;\n  text-align: center !important;\n}\n\ninput[type='date']::-webkit-calendar-picker-indicator {\n  position: absolute !important;\n  inset: 0 !important;\n  width: 100% !important;\n  height: 100% !important;\n  margin: 0 !important;\n  padding: 0 !important;\n  opacity: 0 !important;\n  cursor: pointer;\n}\n\n.date-field-clip {\n  inline-size: 11.5rem !important;\n  width: 11.5rem !important;\n  min-inline-size: 0 !important;\n  min-width: 0 !important;\n  max-inline-size: 100% !important;\n  max-width: 100% !important;\n}\n\n/* Do not animate whole screens/cards on tab changes; keep motion on controls only. */\nmain > *,\nmain section > .space-y-3,\nmain section > .space-y-4,\nmain section > .space-y-5,\nmain section > .grid,\nmain section > .rounded-2xl,\nmain section > .rounded-3xl {\n  animation: none !important;\n}\n\n@media (max-width: 639px) {\n  input[type='date'],\n  .date-field-clip {\n    max-inline-size: 100% !important;\n    max-width: 100% !important;\n  }\n\n  [data-programme-task-card='true'] > div:not(.space-y-3) {\n    align-items: center;\n  }\n}\n`
}

export function mobileUiUxAuditBuildPlugin() {
  return {
    name: 'mobile-ui-ux-audit',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/App.jsx')) return transformApp(code)
      if (cleanId.endsWith('/src/features/plans/PlansScreen.jsx')) return transformPlansScreen(code)
      if (cleanId.endsWith('/src/features/workout/QuickWorkoutBuilder.jsx')) return transformQuickWorkoutBuilder(code)
      if (cleanId.endsWith('/src/routineTaskTimeEditor.js')) return transformRoutineTaskTimeEditor(code)
      if (cleanId.endsWith('/src/builderUxEnhancements.js')) return transformBuilderUxEnhancements(code)
      if (cleanId.endsWith('/src/index.css')) return transformIndexCss(code)
      return null
    },
  }
}
