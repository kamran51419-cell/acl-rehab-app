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

function removeVerticalSpace(element) {
  if (!element) return
  element.style.setProperty('margin-top', '0', 'important')
  element.style.setProperty('margin-bottom', '0', 'important')
}

function compactTaskSection(section) {
  if (!section) return

  section.style.setProperty('gap', '0.25rem', 'important')
  removeVerticalSpace(section)

  ;[...section.children].forEach(removeVerticalSpace)

  const header = [...section.children].find((child) => child.querySelector('h3'))
  if (header) {
    header.style.setProperty('min-height', 'auto', 'important')
    removeVerticalSpace(header)
  }

  const rowList = [...section.children].find((child) => child.querySelector('article'))
  if (rowList) {
    rowList.style.setProperty('gap', '0.25rem', 'important')
    removeVerticalSpace(rowList)
    ;[...rowList.children].forEach(removeVerticalSpace)
  }

  section.querySelectorAll('article').forEach((row) => {
    row.style.setProperty('min-height', '2.75rem', 'important')
    row.style.setProperty('padding-top', '0.25rem', 'important')
    row.style.setProperty('padding-bottom', '0.25rem', 'important')
    removeVerticalSpace(row)
  })
}

function applyTodayTaskOrder() {
  const heading = [...document.querySelectorAll('h1, h2, h3')].find((element) => {
    const text = textOf(element)
    return text === "Today's Tasks" || text === 'Routine'
  })
  const routine = heading?.closest('section')
  if (!routine) return

  routine.style.setProperty('gap', '0.625rem', 'important')
  ;[...routine.children].forEach(removeVerticalSpace)

  const due = directTaskSection(routine, 'Due Today')
  const overdue = directTaskSection(routine, 'Overdue')
  const done = directTaskSection(routine, 'Done')

  ;[due, overdue, done].filter(Boolean).forEach((section) => {
    compactTaskSection(section)
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
