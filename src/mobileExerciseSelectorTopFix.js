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

  const openAtTop = (session) => {
    const picker = pickerInSession(session)
    if (!picker) return

    const search = picker.querySelector('input[aria-label="Search exercises"]')
    if (search === document.activeElement) search.blur()
    picker.scrollIntoView({ behavior: 'auto', block: 'start', inline: 'nearest' })
  }

  const handleClick = (event) => {
    const button = event.target?.closest?.('button')
    if (!button || !isPhoneViewport()) return

    const label = textOf(button)
    if (label !== 'Add exercise' && label !== 'Change exercise') return

    const session = programmeSession(button)
    ;[0, 40, 120, 260, 450].forEach((delay) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer)
        openAtTop(session)
      }, delay)
      timers.add(timer)
    })
  }

  document.addEventListener('click', handleClick, true)

  return () => {
    document.removeEventListener('click', handleClick, true)
    timers.forEach((timer) => window.clearTimeout(timer))
    timers.clear()
  }
}
