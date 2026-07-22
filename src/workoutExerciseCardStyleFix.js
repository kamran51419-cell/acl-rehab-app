function textOf(element) {
  return (element?.textContent || '').trim()
}

function isWorkoutExerciseCard(section) {
  if (!section.querySelector('h2')) return false
  if (section.querySelector('button[aria-label^="Toggle set"], button[aria-label="Toggle exercise"]')) return true
  return [...section.querySelectorAll('label, span')].some((element) =>
    /^(Reps|Weight \(kg\)|Set \d+|\d+(?:\.\d+)? (?:sec|min|km))$/i.test(textOf(element)),
  )
}

function styleWorkoutExerciseCards() {
  document.querySelectorAll('section.rounded-2xl.border.bg-white.p-4').forEach((section) => {
    if (!isWorkoutExerciseCard(section)) return
    section.style.setProperty('border-color', 'rgb(147 197 253 / 0.82)', 'important')
    section.style.setProperty('background', 'linear-gradient(100deg, rgb(219 234 254 / 0.58) 0%, rgb(239 246 255 / 0.42) 34%, rgb(255 255 255) 82%)', 'important')
    section.style.setProperty('box-shadow', '0 10px 24px rgb(29 78 216 / 0.06), 0 2px 6px rgb(15 23 42 / 0.03)', 'important')
  })
}

export function installWorkoutExerciseCardStyleFix() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {}
  let queued = false
  const schedule = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      styleWorkoutExerciseCards()
    })
  }
  styleWorkoutExerciseCards()
  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}
