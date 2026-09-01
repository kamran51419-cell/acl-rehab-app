function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Session text-selection transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

export function sessionTextSelectionBuildPlugin() {
  return {
    name: 'session-text-selection',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (!cleanId.endsWith('/src/features/plans/PlansScreen.jsx')) return null

      let next = replaceRequired(
        code,
        '            draggable\n            onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggingSession(sessionIndex); setDragOverSession(sessionIndex); }}\n            onDragEnd={() => { setDraggingSession(null); setDragOverSession(null); }}\n            onDragOver={(event) => { event.preventDefault(); setDragOverSession(sessionIndex); }}',
        '            onDragOver={(event) => { event.preventDefault(); setDragOverSession(sessionIndex); }}',
        id,
      )

      next = replaceRequired(
        next,
        '            <div className="flex items-start gap-2">\n              <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[1fr_1fr_auto]">',
        '            <div className="flex items-start gap-2">\n              <button\n                type="button"\n                draggable\n                onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.effectAllowed = "move"; setDraggingSession(sessionIndex); setDragOverSession(sessionIndex); }}\n                onDragEnd={(event) => { event.stopPropagation(); setDraggingSession(null); setDragOverSession(null); }}\n                className="mt-6 cursor-grab rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-600 active:cursor-grabbing"\n                aria-label={`Drag ${session.name || "session"}`}\n              >\n                <GripVertical className="h-5 w-5" />\n              </button>\n              <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[1fr_1fr_auto]">',
        id,
      )

      return next
    },
  }
}
