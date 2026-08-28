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
    '<div className="min-w-0"><h3 className="text-lg font-semibold">Daily tasks</h3><p className="text-sm text-slate-500">Small tasks scheduled independently of workouts.</p></div>\n          <Button className="shrink-0 whitespace-nowrap" variant="outline" onClick={addRoutineTask}><Plus className="mr-1 h-4 w-4" /> Add task</Button>',
  )

  next = next.replace(
    '<div className="flex items-center justify-between">\n          <h3 className="text-lg font-semibold">Sessions</h3>\n          <Button variant="outline" onClick={addSession}><Plus className="mr-1 h-4 w-4" /> Add session</Button>',
    '<div className="flex items-center justify-between gap-3">\n          <h3 className="text-lg font-semibold">Sessions</h3>\n          <Button className="shrink-0 whitespace-nowrap" variant="outline" onClick={addSession}><Plus className="mr-1 h-4 w-4" /> Add session</Button>',
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

  return next
}

function transformIndexCss(code) {
  return `${code}\n\n/* Mobile UI audit: one consistent date control across the app. */\ninput[type='date'] {\n  position: relative;\n  display: block;\n  box-sizing: border-box;\n  inline-size: 11.5rem;\n  width: 11.5rem;\n  min-inline-size: 0;\n  min-width: 0;\n  max-inline-size: 100%;\n  max-width: 100%;\n  block-size: 2.5rem;\n  height: 2.5rem;\n  margin: 0;\n  border: 1px solid rgb(226 232 240);\n  border-radius: 0.75rem;\n  background: white;\n  padding: 0 2.5rem;\n  color: rgb(15 23 42);\n  font-size: 0.875rem;\n  line-height: 1;\n  text-align: center;\n  overflow: hidden;\n}\n\ninput[type='date']::-webkit-date-and-time-value {\n  width: 100%;\n  min-width: 0;\n  margin: 0;\n  text-align: center;\n}\n\ninput[type='date']::-webkit-datetime-edit {\n  display: flex;\n  width: 100%;\n  min-width: 0;\n  justify-content: center;\n  padding: 0;\n}\n\ninput[type='date']::-webkit-calendar-picker-indicator {\n  position: absolute;\n  right: 0.75rem;\n  width: 1.1rem;\n  height: 1.1rem;\n  margin: 0;\n  padding: 0;\n  opacity: 0.65;\n}\n\n.date-field-clip {\n  box-sizing: border-box;\n  inline-size: 11.5rem !important;\n  width: 11.5rem !important;\n  min-inline-size: 0 !important;\n  min-width: 0 !important;\n  max-inline-size: 100% !important;\n  max-width: 100% !important;\n}\n\n@media (max-width: 639px) {\n  input[type='date'],\n  .date-field-clip {\n    max-inline-size: 100% !important;\n    max-width: 100% !important;\n  }\n\n  /* Buttons next to card/header copy should sit at the visual middle of the row. */\n  [data-programme-task-card='true'] > div:not(.space-y-3) {\n    align-items: center;\n  }\n}\n`
}

export function mobileUiUxAuditBuildPlugin() {
  return {
    name: 'mobile-ui-ux-audit',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/App.jsx')) return transformApp(code)
      if (cleanId.endsWith('/src/features/plans/PlansScreen.jsx')) return transformPlansScreen(code)
      if (cleanId.endsWith('/src/index.css')) return transformIndexCss(code)
      return null
    },
  }
}
