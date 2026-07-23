function textOf(element) {
  return (element?.textContent || '').trim()
}

function programmeSession(element) {
  return element?.closest?.('[id^="programme-session-"]') || null
}

function exerciseCards(session) {
  const exerciseList = session?.children?.[1]
  if (!exerciseList) return []
  return [...exerciseList.children].filter((card) =>
    card.matches?.('div.rounded-xl.border') && !card.classList.contains('border-dashed'),
  )
}

function expandNewExercise(sessionId, attempts = 50) {
  const session = document.getElementById(sessionId)
  const cards = exerciseCards(session)
  const card = cards.find((item) => item.classList.contains('ring-2')) || cards.at(-1)
  const disclosure = card?.querySelector('button[aria-expanded]')

  if (!card || !disclosure) {
    if (attempts > 0) window.setTimeout(() => expandNewExercise(sessionId, attempts - 1), 40)
    return
  }

  if (disclosure.getAttribute('aria-expanded') === 'false') disclosure.click()
}

export function installNewProgrammeExerciseExpandFix() {
  if (typeof document === 'undefined') return () => {}

  const handleClick = (event) => {
    const button = event.target?.closest?.('button')
    if (!button || textOf(button) !== 'Add') return

    const picker = button.closest('div.rounded-xl.border-dashed')
    const session = programmeSession(picker)
    if (!picker || !session) return

    const sessionId = session.id
    window.setTimeout(() => expandNewExercise(sessionId), 0)
  }

  document.addEventListener('click', handleClick, true)
  return () => document.removeEventListener('click', handleClick, true)
}
