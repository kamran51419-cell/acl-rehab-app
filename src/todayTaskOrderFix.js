function directTaskSection(routine, title) {
  return [...routine.children].find((child) => {
    const heading = child.querySelector(':scope > div > h3')
    return (heading?.textContent || '').trim() === title
  }) || null
}

function applyTodayTaskOrder() {
  const heading = [...document.querySelectorAll('h1, h2, h3')].find(
    (element) => (element.textContent || '').trim() === 'Routine',
  )
  const routine = heading?.closest('section')
  if (!routine) return

  const orderedSections = [
    directTaskSection(routine, 'Due Today'),
    directTaskSection(routine, 'Overdue'),
    directTaskSection(routine, 'Done'),
  ].filter(Boolean)

  orderedSections.forEach((section) => routine.appendChild(section))
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
