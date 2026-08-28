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

  return next
}

export function mobileUiUxAuditBuildPlugin() {
  return {
    name: 'mobile-ui-ux-audit',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/App.jsx')) return transformApp(code)
      if (cleanId.endsWith('/src/features/plans/PlansScreen.jsx')) return transformPlansScreen(code)
      return null
    },
  }
}
