function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Session text selection transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

export function sessionTextSelectionBuildPlugin() {
  return {
    name: 'session-text-selection',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (!cleanId.endsWith('/src/features/plans/PlansScreen.jsx')) return null

      let next = replaceRequired(
        code,
        '            draggable\n            onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggingSession(sessionIndex); setDragOverSession(sessionIndex); }}',
        '            draggable\n            data-session-draggable\n            onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggingSession(sessionIndex); setDragOverSession(sessionIndex); }}',
        id,
      )

      const disableSessionDrag = 'onPointerDown={(event) => { const card = event.currentTarget.closest("[data-session-draggable]"); if (card) card.draggable = false; }} onPointerUp={(event) => { const card = event.currentTarget.closest("[data-session-draggable]"); if (card) card.draggable = true; }} onPointerCancel={(event) => { const card = event.currentTarget.closest("[data-session-draggable]"); if (card) card.draggable = true; }} onBlur={(event) => { const card = event.currentTarget.closest("[data-session-draggable]"); if (card) card.draggable = true; }}'

      next = replaceRequired(
        next,
        '<Field label="Session name"><Input value={session.name} onChange={(event) => updateSession(sessionIndex, { name: event.target.value })} /></Field>',
        `<Field label="Session name"><Input className="cursor-text" ${disableSessionDrag} value={session.name} onChange={(event) => updateSession(sessionIndex, { name: event.target.value })} /></Field>`,
        id,
      )

      next = replaceRequired(
        next,
        '<Field label="Notes"><Input value={session.notes || ""} onChange={(event) => updateSession(sessionIndex, { notes: event.target.value })} /></Field>',
        `<Field label="Notes"><Input className="cursor-text" ${disableSessionDrag} value={session.notes || ""} onChange={(event) => updateSession(sessionIndex, { notes: event.target.value })} /></Field>`,
        id,
      )

      return next
    },
  }
}
