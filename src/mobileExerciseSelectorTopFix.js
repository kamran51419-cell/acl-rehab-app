function textOf(element) {
  return (element?.textContent || '').trim()
}

function isPhoneViewport() {
  return window.matchMedia('(max-width: 767px)').matches
}

function programmeSession(element) {
  return element?.closest?.('[id^="programme-session-"]') || null
}

function pickerInSession(session) {
  if (!session) return null
  return [...session.querySelectorAll('div.rounded-xl.border-dashed, [data-exercise-picker]')].find((item) =>
    /Exercise picker|Change exercise|Search exercises/i.test(textOf(item)),
  ) || null
}

export function installMobileExerciseSelectorTopFix() {
  if (typeof document === 'undefined') return () => {}

  const timers = new Set()
  let openingSession = null
  let suppressFocusUntil = 0

  const openAtTop = (session) => {
    const picker = pickerInSession(session)
    if (!picker) return

    const search = picker.querySelector('input[aria-label="Search exercises"]')
    if (search === document.activeElement) search.blur()
    picker.scrollIntoView({ behavior: 'auto', block: 'start', inline: 'nearest' })
  }

  const handleFocus = (event) => {
    if (!openingSession || performance.now() > suppressFocusUntil) return

    const search = event.target?.closest?.('input[aria-label="Search exercises"]')
    if (!search || !openingSession.contains(search)) return

    search.blur()
    requestAnimationFrame(() => openAtTop(openingSession))
  }

  const handleClick = (event) => {
    const button = event.target?.closest?.('button')
    if (!button || !isPhoneViewport()) return

    const label = textOf(button)
    if (label !== 'Add exercise' && label !== 'Change exercise') return

    const session = programmeSession(button)
    openingSession = session
    suppressFocusUntil = performance.now() + 700

    ;[0, 40, 120, 260, 450].forEach((delay) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer)
        openAtTop(session)
      }, delay)
      timers.add(timer)
    })

    const clearTimer = window.setTimeout(() => {
      timers.delete(clearTimer)
      if (openingSession === session) openingSession = null
    }, 700)
    timers.add(clearTimer)
  }

  document.addEventListener('focusin', handleFocus, true)
  document.addEventListener('click', handleClick, true)

  return () => {
    document.removeEventListener('focusin', handleFocus, true)
    document.removeEventListener('click', handleClick, true)
    timers.forEach((timer) => window.clearTimeout(timer))
    timers.clear()
    openingSession = null
  }
}
