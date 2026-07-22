const COLLAPSE_STORAGE_KEY = 'builder-collapse-state-v2'

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

function programmeSession(element) {
  return element?.closest?.('[id^="programme-session-"]') || null
}

function exerciseCardFor(button) {
  const session = programmeSession(button)
  const card = button.closest('[data-exercise-card], div.space-y-3.rounded-xl.border.bg-white, section.rounded-2xl.border.bg-white')
  if (!card || card === session) return null
  return card
}

function sessionDisclosureButton(session) {
  if (!session) return null
  return [...session.querySelectorAll('button[aria-expanded]')].find((button) => {
    const closestSession = programmeSession(button)
    return closestSession === session && !exerciseCardFor(button)
  }) || null
}

function exerciseDisclosureButtons(root, session = null) {
  const scope = session || root
  return [...scope.querySelectorAll('button[aria-expanded]')].filter((button) => {
    const card = exerciseCardFor(button)
    if (!card) return false
    const content = textOf(card)
    return /Change exercise|Track by|Sets|Reps|Weight|Duration|Remove|Duplicate/i.test(content)
  })
}

function disclosureCard(button) {
  return exerciseCardFor(button) || programmeSession(button) || button.closest('article, section, div.rounded-xl.border, div.rounded-2xl.border')
}

function disclosureKey(button, root) {
  const card = disclosureCard(button)
  if (!card) return ''
  const session = programmeSession(card)
  const type = exerciseCardFor(button) ? 'exercise' : session === card ? 'session' : 'item'
  const title = textOf(card.querySelector('h2, h3, .font-semibold, .font-medium, input')) || type
  const peers = [...root.querySelectorAll('button[aria-expanded]')].filter((candidate) => {
    const candidateCard = disclosureCard(candidate)
    if (!candidateCard) return false
    const candidateType = exerciseCardFor(candidate) ? 'exercise' : programmeSession(candidate) === candidateCard ? 'session' : 'item'
    const candidateTitle = textOf(candidateCard.querySelector('h2, h3, .font-semibold, .font-medium, input')) || candidateType
    return candidateType === type && candidateTitle === title
  })
  return `${builderKind(root)}|${session?.id || 'root'}|${type}|${title}|${Math.max(0, peers.indexOf(button))}`
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
    button.dataset.collapseRestored = 'true'
    const shouldBeExpanded = Boolean(state[key])
    const currentlyExpanded = button.getAttribute('aria-expanded') === 'true'
    if (shouldBeExpanded !== currentlyExpanded) button.click()
  })
}

function collapseExerciseButtons(root, session) {
  exerciseDisclosureButtons(root, session).forEach((button) => {
    if (button.getAttribute('aria-expanded') !== 'true') return
    button.click()
    requestAnimationFrame(() => rememberDisclosure(button, root))
  })
}

function collapseExistingSessions(root) {
  root.querySelectorAll('[id^="programme-session-"]').forEach((session) => {
    const button = sessionDisclosureButton(session)
    if (!button || button.getAttribute('aria-expanded') !== 'true') return
    button.click()
    requestAnimationFrame(() => rememberDisclosure(button, root))
  })
}

function scrollToAndFocus(element) {
  if (!element) return
  element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  const control = element.querySelector?.('input:not([type="checkbox"]):not([type="radio"]), select, textarea, button[aria-expanded]')
  if (control instanceof HTMLElement) setTimeout(() => control.focus({ preventScroll: true }), 250)
}

function waitForNewItem(findItem, previousCount, onFound) {
  let attempts = 0
  const check = () => {
    attempts += 1
    const items = findItem()
    if (items.length > previousCount) {
      onFound(items.at(-1))
      return
    }
    if (attempts < 20) setTimeout(check, 50)
  }
  setTimeout(check, 0)
}

function styleExerciseLibrarySaveButton() {
  const heading = [...document.querySelectorAll('h1, h2, h3')].find((element) => textOf(element) === 'Add exercise')
  const dialog = heading?.closest('[role="dialog"]')
  if (!dialog) return
  const save = [...dialog.querySelectorAll('button')].find((button) => /^(Add exercise|Save)$/i.test(textOf(button)))
  if (!save) return
  save.textContent = 'Save'
  save.style.setProperty('background', '#2563eb', 'important')
  save.style.setProperty('background-image', 'none', 'important')
  save.style.setProperty('color', '#fff', 'important')
  save.style.setProperty('border-color', '#2563eb', 'important')
  save.style.setProperty('box-shadow', '0 4px 10px rgb(37 99 235 / 0.18)', 'important')
}

function styleRoutineTaskCards(root) {
  const heading = [...root.querySelectorAll('h2, h3')].find((element) => /^(Routine Tasks|Daily & Weekly Tasks)$/i.test(textOf(element)))
  const section = heading?.closest('section')
  if (!section) return
  section.querySelectorAll(':scope article, :scope > div > article').forEach((card) => {
    card.style.setProperty('background', '#fff', 'important')
    card.style.setProperty('background-image', 'none', 'important')
  })
}

function applyBuilderUx() {
  styleExerciseLibrarySaveButton()
  const root = builderRoot()
  if (!root) return
  styleRoutineTaskCards(root)
  restoreDisclosureState(root)
}

export function installBuilderUxEnhancements() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {}

  const handleClick = (event) => {
    const button = event.target?.closest?.('button')
    if (!button) return
    const root = builderRoot()
    if (!root) return
    const label = textOf(button)

    if (button.matches('[aria-expanded]')) {
      setTimeout(() => rememberDisclosure(button, root), 0)
      return
    }

    if (label === 'Add session') {
      const before = root.querySelectorAll('[id^="programme-session-"]').length
      collapseExistingSessions(root)
      waitForNewItem(
        () => [...root.querySelectorAll('[id^="programme-session-"]')],
        before,
        (session) => {
          const disclosure = sessionDisclosureButton(session)
          if (disclosure && disclosure.getAttribute('aria-expanded') !== 'true') disclosure.click()
          scrollToAndFocus(session)
        },
      )
      return
    }

    if (label === 'Add task') {
      const findTasks = () => [...root.querySelectorAll('input[placeholder*="Ice knee"], input[placeholder*="task" i]')]
      const before = findTasks().length
      waitForNewItem(findTasks, before, (input) => scrollToAndFocus(input.closest('article, .rounded-2xl, .rounded-xl') || input))
      return
    }

    const picker = button.closest('div.rounded-xl.border-dashed')
    const pickerHeading = picker?.querySelector('strong')
    if (label === 'Add' && picker && /Exercise picker/i.test(textOf(pickerHeading))) {
      const session = programmeSession(picker)
      const findCards = () => exerciseDisclosureButtons(root, session).map(exerciseCardFor).filter(Boolean)
      const before = findCards().length
      collapseExerciseButtons(root, session)
      waitForNewItem(findCards, before, (card) => {
        const disclosure = card.querySelector('button[aria-expanded]')
        if (disclosure && disclosure.getAttribute('aria-expanded') !== 'true') disclosure.click()
        if (disclosure) requestAnimationFrame(() => rememberDisclosure(disclosure, root))
        scrollToAndFocus(card)
      })
    }
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
