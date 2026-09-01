export function sessionTextSelectionBuildPlugin() {
  return {
    name: 'session-text-selection',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (!cleanId.endsWith('/src/features/plans/PlansScreen.jsx')) return null

      const dragHandlers = 'onPointerDown={(event) => { const card = event.currentTarget.closest("[draggable=\\"true\\"]"); if (card) card.draggable = false; }} onPointerUp={(event) => { const card = event.currentTarget.closest("[draggable=\\"true\\"]"); if (card) card.draggable = true; }} onPointerCancel={(event) => { const card = event.currentTarget.closest("[draggable=\\"true\\"]"); if (card) card.draggable = true; }} onBlur={(event) => { const card = event.currentTarget.closest("[draggable=\\"true\\"]"); if (card) card.draggable = true; }}'

      let next = code.replace(
        '<Field label="Session name"><Input value={session.name}',
        `<Field label="Session name"><Input className="cursor-text" ${dragHandlers} value={session.name}`,
      )

      next = next.replace(
        '<Field label="Notes"><Input value={session.notes || ""}',
        `<Field label="Notes"><Input className="cursor-text" ${dragHandlers} value={session.notes || ""}`,
      )

      return next
    },
  }
}
