function textOf(element) {
  return (element?.textContent || '').trim()
}

function directTaskSection(routine, title) {
  return [...routine.children].find((child) => {
    const heading = [...child.querySelectorAll('h3')].find(
      (element) => textOf(element) === title,
    )
    return Boolean(heading)
  }) || null
}

function compactTaskSection(section) {
  if (!section) return

  section.style.setProperty('gap', '0.375rem')

  const rows = section.querySelectorAll('article')
  rows.forEach((row) => {
    row.style.setProperty('min-height', '3rem')
    row.style.setProperty('padding-top', '0.375rem')
    row.style.setProperty('padding-bottom', '0.375rem')
  })

  const rowList = [...section.children].find((child) => child.querySelector('article'))
  rowList?.style.setProperty('gap', '0.25rem')
}

function applyTodayTaskOrder() {
  const heading = [...document.querySelectorAll('h1, h2, h3')].find((element) => {
    const text = textOf(element)
    return text === "Today's Tasks" || text === 'Routine'
  })
  const routine = heading?.closest('section')
  if (!routine) return

  routine.style.setProperty('gap', '0.75rem')

  const due = directTaskSection(routine, 'Due Today')
  const overdue = directTaskSection(routine, 'Overdue')
  const done = directTaskSection(routine, 'Done')

  ;[due, overdue, done].filter(Boolean).forEach((section) => {
    compactTaskSection(section)
    routine.appendChild(section)
  })
}

export function installTodayTaskOrderFix() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {}

  let queued = false
  const schedule = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      applyTodayTaskOrder()
    })
  }

  applyTodayTaskOrder()
  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}
