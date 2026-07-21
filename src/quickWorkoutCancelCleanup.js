const STORAGE_KEY = 'aclQuickWorkoutCancelled'

function buttonText(element) {
  return (element?.textContent || '').trim()
}

function findQuickWorkoutCancelButton() {
  const hasQuickWorkoutHeading = [...document.querySelectorAll('h1, h2, h3')]
    .some((heading) => /quick workout/i.test(buttonText(heading)))
  if (!hasQuickWorkoutHeading) return null
  return [...document.querySelectorAll('button')]
    .find((button) => buttonText(button) === 'Cancel') || null
}

function dismissStaleBuilder() {
  if (sessionStorage.getItem(STORAGE_KEY) !== 'true') return
  const cancel = findQuickWorkoutCancelButton()
  if (!cancel || cancel.dataset.autoDismissed === 'true') return
  cancel.dataset.autoDismissed = 'true'
  cancel.click()
}

export function installQuickWorkoutCancelCleanup() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {}

  const handleClick = (event) => {
    const button = event.target.closest('button')
    if (!button) return
    const label = buttonText(button)

    if (label === 'Cancel' && findQuickWorkoutCancelButton() === button) {
      sessionStorage.setItem(STORAGE_KEY, 'true')
    } else if (label === 'Quick Workout' && !findQuickWorkoutCancelButton()) {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }

  let queued = false
  const schedule = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      dismissStaleBuilder()
    })
  }

  document.addEventListener('click', handleClick, true)
  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
  dismissStaleBuilder()

  return () => {
    document.removeEventListener('click', handleClick, true)
    observer.disconnect()
  }
}
