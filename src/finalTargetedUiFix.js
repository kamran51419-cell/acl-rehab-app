function textOf(element) {
  return (element?.textContent || '').trim()
}

function closestRoundedCard(element) {
  if (!element) return null
  return (
    element.closest('button') ||
    element.closest("[class*='rounded-xl'], [class*='rounded-2xl'], [class*='rounded-3xl']")
  )
}

function markProgrammeEditor() {
  document.querySelectorAll('[data-final-programme-editor]').forEach((element) => {
    element.removeAttribute('data-final-programme-editor')
  })

  const heading = [...document.querySelectorAll('h1, h2, h3')].find((element) =>
    /^(Edit|Create) programme$/i.test(textOf(element)),
  )
  if (!heading) return

  let candidate = heading.parentElement
  while (candidate && candidate !== document.body && candidate !== document.documentElement) {
    const text = textOf(candidate)
    const hasSaveButton = [...candidate.querySelectorAll('button')].some(
      (button) => textOf(button) === 'Save programme',
    )
    const hasSessions = /\bSessions\b/.test(text)
    const hasProgrammeInput = candidate.querySelector('input')

    if (hasSaveButton && hasSessions && hasProgrammeInput) {
      candidate.dataset.finalProgrammeEditor = 'true'
      return
    }
    candidate = candidate.parentElement
  }
}

function markStatsExerciseCards() {
  document.querySelectorAll('[data-final-stats-card]').forEach((element) => {
    element.removeAttribute('data-final-stats-card')
  })

  ;[...document.querySelectorAll('button, a, div, span')]
    .filter((element) => textOf(element) === 'View stats')
    .forEach((label) => {
      const card = closestRoundedCard(label)
      if (card) card.dataset.finalStatsCard = 'true'
    })
}

function markHomeSummaryCards() {
  document.querySelectorAll('[data-final-summary-card]').forEach((element) => {
    element.removeAttribute('data-final-summary-card')
  })

  ;['ACTIVE PROGRAMME', 'LAST WORKOUT'].forEach((label) => {
    const match = [...document.querySelectorAll('h1, h2, h3, h4, p, span, div')].find(
      (element) => textOf(element).toUpperCase() === label,
    )
    const card = closestRoundedCard(match)
    if (card) card.dataset.finalSummaryCard = 'true'
  })
}

function applyFinalTargetedUiFixes() {
  markProgrammeEditor()
  markStatsExerciseCards()
  markHomeSummaryCards()
}

export function installFinalTargetedUiFixes() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {}

  let queued = false
  const schedule = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      applyFinalTargetedUiFixes()
    })
  }

  applyFinalTargetedUiFixes()
  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}
