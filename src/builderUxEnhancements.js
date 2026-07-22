const STYLE_ID = 'builder-ux-enhancement-styles'

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

function programmeSession(element) {
  return element?.closest?.('[id^="programme-session-"]') || null
}

function sessionDisclosureButton(session) {
  if (!session) return null
  const header = session.firstElementChild
  const direct = header?.querySelector('button[aria-expanded], button[aria-label*="session" i]')
  if (direct) return direct
  return [...session.querySelectorAll('button[aria-expanded], button[aria-label*="session" i]')].find((button) =>
    programmeSession(button) === session,
  ) || null
}

function collapseButton(button) {
  if (!button) return
  const expanded = button.getAttribute('aria-expanded')
  const label = button.getAttribute('aria-label') || ''
  if (expanded === 'true' || /^Collapse session$/i.test(label)) button.click()
}

function openButton(button) {
  if (!button) return
  const expanded = button.getAttribute('aria-expanded')
  const label = button.getAttribute('aria-label') || ''
  if (expanded === 'false' || /^Expand session$/i.test(label)) button.click()
}

function exerciseCardFor(button) {
  const session = programmeSession(button)
  const candidates = [
    button.closest('[data-exercise-card]'),
    button.closest('article'),
    button.closest('div.space-y-3.rounded-xl.border.bg-white'),
    button.closest('div.rounded-xl.border'),
    button.closest('section.rounded-xl.border'),
  ].filter(Boolean)
  return candidates.find((candidate) => candidate !== session) || null
}

function exerciseDisclosureButtons(root, session = null) {
  const scope = session || root
  return [...scope.querySelectorAll('button[aria-expanded]')].filter((button) => {
    const card = exerciseCardFor(button)
    if (!card) return false
    if (session && programmeSession(button) !== session) return false
    return /Change exercise|Track by|Sets|Reps|Weight|Duration|Distance|Remove/i.test(textOf(card))
  })
}

function collapseExercises(root, session = null) {
  exerciseDisclosureButtons(root, session).forEach(collapseButton)
}

function sessionCards(root) {
  return [...root.querySelectorAll('[id^="programme-session-"]')]
}

function collapseSessions(root) {
  sessionCards(root).forEach((session) => collapseButton(sessionDisclosureButton(session)))
}

function scrollOnce(element, block = 'center') {
  if (!element) return
  requestAnimationFrame(() => requestAnimationFrame(() => {
    element.scrollIntoView({ behavior: 'smooth', block, inline: 'nearest' })
  }))
}

function waitForElement(find, attempts = 18) {
  return new Promise((resolve) => {
    let remaining = attempts
    const check = () => {
      const result = find()
      if (result || remaining <= 0) {
        resolve(result || null)
        return
      }
      remaining -= 1
      setTimeout(check, 40)
    }
    requestAnimationFrame(check)
  })
}

function pickerInSession(session) {
  if (!session) return null
  return [...session.querySelectorAll('div.rounded-xl.border-dashed, [data-exercise-picker]')].find((item) =>
    /Exercise picker|Change exercise|Search exercises/i.test(textOf(item)),
  ) || null
}

function exerciseCards(root) {
  return [...new Set(exerciseDisclosureButtons(root).map(exerciseCardFor).filter(Boolean))]
}

function isRoutineDayCheckbox(input) {
  if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox') return false
  const fieldset = input.closest('fieldset')
  return textOf(fieldset?.querySelector(':scope > legend')) === 'Days'
}

function preserveScrollAfterRoutineDayChange(input) {
  const root = builderRoot()
  if (!root || !root.contains(input)) return
  const rootTop = root.scrollTop
  const pageX = window.scrollX
  const pageY = window.scrollY
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.scrollTop = rootTop
    window.scrollTo(pageX, pageY)
  }))
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = '[data-final-programme-editor="true"] { overflow-y: auto !important; }'
  document.head.appendChild(style)
}

export function installBuilderUxEnhancements() {
  if (typeof document === 'undefined') return () => {}
  installStyles()

  const handleClick = (event) => {
    const input = event.target?.closest?.('input')
    if (isRoutineDayCheckbox(input)) {
      preserveScrollAfterRoutineDayChange(input)
      return
    }

    const button = event.target?.closest?.('button')
    if (!button) return
    const label = textOf(button)
    if (!['Add exercise', 'Change exercise', 'Add session', 'Add', 'Use'].includes(label)) return

    const root = builderRoot()
    if (!root) return

    if (label === 'Add session') {
      const before = new Set(sessionCards(root))
      collapseSessions(root)
      waitForElement(() => sessionCards(root).find((session) => !before.has(session))).then((session) => {
        if (!session) return
        openButton(sessionDisclosureButton(session))
        scrollOnce(session)
      })
      return
    }

    if (label === 'Add exercise' || label === 'Change exercise') {
      const session = programmeSession(button)
      collapseExercises(root, session)
      const picker = pickerInSession(session)
      if (picker) scrollOnce(picker)
      return
    }

    if (label === 'Add' || label === 'Use') {
      const session = programmeSession(button)
      const before = new Set(exerciseCards(session || root))
      waitForElement(() => exerciseCards(session || root).find((card) => !before.has(card))).then((card) => {
        if (!card) return
        const disclosure = card.querySelector('button[aria-expanded]')
        openButton(disclosure)
        scrollOnce(card)
      })
    }
  }

  document.addEventListener('click', handleClick, true)
  return () => document.removeEventListener('click', handleClick, true)
}
