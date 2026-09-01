export function sessionTextSelectionBuildPlugin() {
  return {
    name: 'session-text-selection',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (!cleanId.endsWith('/src/features/plans/PlansScreen.jsx')) return null

      const sessionDragStart = '            draggable\n            onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggingSession(sessionIndex); setDragOverSession(sessionIndex); }}'
      if (!code.includes(sessionDragStart)) return code

      const safeSessionDragStart = '            draggable\n            onPointerDownCapture={(event) => { if (event.target.closest("input, textarea, select, button, [contenteditable=\\"true\\"]")) event.currentTarget.draggable = false; }}\n            onPointerUpCapture={(event) => { event.currentTarget.draggable = true; }}\n            onPointerCancelCapture={(event) => { event.currentTarget.draggable = true; }}\n            onFocusCapture={(event) => { if (event.target.closest("input, textarea, select")) event.currentTarget.draggable = false; }}\n            onBlurCapture={(event) => { const next = event.relatedTarget; if (!next || !event.currentTarget.contains(next) || !next.closest?.("input, textarea, select")) event.currentTarget.draggable = true; }}\n            onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggingSession(sessionIndex); setDragOverSession(sessionIndex); }}'

      return code.replace(sessionDragStart, safeSessionDragStart)
    },
  }
}
