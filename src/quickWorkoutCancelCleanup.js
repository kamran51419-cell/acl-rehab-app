const STORAGE_KEY = 'aclQuickWorkoutCancelled'

function buttonText(element) {
  return (element?.textContent || '').trim()
}

function findQuickWorkoutBuilder() {
  const heading = [...document.querySelectorAll('h1, h2, h3')]
    .find((item) => buttonText(item) === 'Build a Quick Workout')
  if (!heading) return null
  return heading.closest('[data-quick-workout-builder="true"], .space-y-5, .space-y-6') || heading.parentElement
}

function findQuickWorkoutCancelButton() {
  const builder = findQuickWorkoutBuilder()
  if (!builder) return null
  return [...builder.querySelectorAll('button')]
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
