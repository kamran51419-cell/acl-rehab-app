const COLLAPSE_STORAGE_KEY = 'builder-collapse-state-v1'

function textOf(element) {
  return (element?.textContent || '').trim()
}

function builderRoot() {
  const heading = [...document.querySelectorAll('h1, h2, h3')].find((element) =>
    /^(Edit programme|Create programme|Quick Workout|Build a Quick Workout)$/i.test(textOf(element)),
  )
  if (!heading) return null
  return heading.closest('[data-final-programme-editor="true"], [data-quick-workout-builder="true"], .space-y-5, .space-y-6') || heading.parentElement
}

function builderKind(root) {
  return /programme/i.test(textOf(root.querySelector('h1, h2, h3'))) ? 'programme' : 'quick-workout'
}

function loadCollapseState() {
  try {
    return JSON.parse(sessionStorage.getItem(COLLAPSE_STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveCollapseState(state) {
  sessionStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(state))
}

function cardForDisclosure(button) {
  return button.closest('[data-exercise-card], article, section, div.rounded-xl.border, div.rounded-2xl.border')
}

function disclosureKey(button, root) {
  const card = cardForDisclosure(button)
  if (!card) return ''
  const session = card.closest('[id^="programme-session-"]')
  const title = textOf(card.querySelector('h2, h3, .font-semibold, .font-medium')) || 'item'
  const peers = [...root.querySelectorAll('button[aria-expanded]')].filter((candidate) => {
    const candidateCard = cardForDisclosure(candidate)
    const candidateTitle = textOf(candidateCard?.querySelector('h2, h3, .font-semibold, .font-medium')) || 'item'
    return candidateTitle === title
  })
  const occurrence = Math.max(0, peers.indexOf(button))
  return `${builderKind(root)}|${session?.id || 'root'}|${title}|${occurrence}`
}

function rememberDisclosure(button, root) {
  const key = disclosureKey(button, root)
  if (!key) return
  const state = loadCollapseState()
  state[key] = button.getAttribute('aria-expanded') === 'true'
  saveCollapseState(state)
}

function restoreDisclosureState(root) {
  const state = loadCollapseState()
  root.querySelectorAll('button[aria-expanded]').forEach((button) => {
    const key = disclosureKey(button, root)
    if (!(key in state) || button.dataset.collapseRestored === 'true') return
    const shouldBeExpanded = Boolean(state[key])
    const currentlyExpanded = button.getAttribute('aria-expanded') === 'true'
    button.dataset.collapseRestored = 'true'
    if (shouldBeExpanded !== currentlyExpanded) button.click()
  })
}

function exerciseDisclosureButtons(root) {
  return [...root.querySelectorAll('button[aria-expanded]')].filter((button) => {
    const card = cardForDisclosure(button)
    if (!card) return false
    const text = textOf(card)
    return /Change exercise|Track by|Sets|Reps|Weight|Duration|Remove/i.test(text)
  })
}

function collapseExistingExercises(root) {
  exerciseDisclosureButtons(root).forEach((button) => {
    if (button.getAttribute('aria-expanded') !== 'true') return
    button.click()
    requestAnimationFrame(() => rememberDisclosure(button, root))
  })
}

function newestRelevantItem(root, action) {
  if (action === 'Add task') {
    const taskInputs = [...root.querySelectorAll('input[placeholder*="Ice knee"], input[placeholder*="task" i]')]
    return taskInputs.at(-1)?.closest('article, .rounded-2xl, .rounded-xl') || taskInputs.at(-1)
  }

  if (action === 'Add session') {
    const sessions = [...root.querySelectorAll('[id^="programme-session-"]')]
    return sessions.at(-1) || null
  }

  const exerciseButtons = exerciseDisclosureButtons(root)
  return cardForDisclosure(exerciseButtons.at(-1)) || [...root.querySelectorAll('div.rounded-xl.border.bg-white, section.rounded-2xl.border')].at(-1) || null
}

function scrollToAndFocus(element) {
  if (!element) return
  element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  const input = element.querySelector?.('input:not([type="checkbox"]):not([type="radio"]), select, textarea, button[aria-expanded]')
  if (input instanceof HTMLElement) {
    setTimeout(() => input.focus({ preventScroll: true }), 250)
  }
}

function queueScrollToNewItem(root, action) {
  let attempts = 0
  const find = () => {
    attempts += 1
    const item = newestRelevantItem(root, action)
    if (item) {
      if (action === 'Add exercise') {
        const button = item.querySelector?.('button[aria-expanded]')
        if (button && button.getAttribute('aria-expanded') !== 'true') button.click()
        if (button) requestAnimationFrame(() => rememberDisclosure(button, root))
      }
      scrollToAndFocus(item)
      return
    }
    if (attempts < 12) setTimeout(find, 50)
  }
  setTimeout(find, 0)
}

function styleExerciseLibrarySaveButton() {
  const heading = [...document.querySelectorAll('h1, h2, h3')].find((element) => textOf(element) === 'Add exercise')
  const dialog = heading?.closest('[role="dialog"]')
  if (!dialog) return
  const buttons = [...dialog.querySelectorAll('button')]
  const save = buttons.find((button) => /^(Add exercise|Save)$/i.test(textOf(button)))
  if (!save) return
  save.textContent = 'Save'
  save.dataset.exerciseLibrarySave = 'true'
  save.style.setProperty('background', '#2563eb', 'important')
  save.style.setProperty('background-image', 'none', 'important')
  save.style.setProperty('color', '#fff', 'important')
  save.style.setProperty('border-color', '#2563eb', 'important')
  save.style.setProperty('box-shadow', '0 4px 10px rgb(37 99 235 / 0.18)', 'important')
}

function applyBuilderUx() {
  styleExerciseLibrarySaveButton()
  const root = builderRoot()
  if (root) restoreDisclosureState(root)
}

export function installBuilderUxEnhancements() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {}

  const handleClick = (event) => {
    const button = event.target?.closest?.('button')
    if (!button) return
    const label = textOf(button)
    const root = builderRoot()

    if (root && button.matches('[aria-expanded]')) {
      setTimeout(() => rememberDisclosure(button, root), 0)
      return
    }

    if (!root || !['Add exercise', 'Add session', 'Add task'].includes(label)) return
    if (label === 'Add exercise') collapseExistingExercises(root)
    queueScrollToNewItem(root, label)
  }

  document.addEventListener('click', handleClick, true)

  let queued = false
  const schedule = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      applyBuilderUx()
    })
  }

  applyBuilderUx()
  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-expanded'] })

  return () => {
    document.removeEventListener('click', handleClick, true)
    observer.disconnect()
  }
}
