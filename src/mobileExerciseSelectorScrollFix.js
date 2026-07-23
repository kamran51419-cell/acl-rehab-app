function text(element) {
  return (element?.textContent || '').trim()
}

function isPhoneViewport() {
  return window.matchMedia('(max-width: 767px)').matches
}

function programmeEditorRoot(element) {
  return element?.closest?.('[data-final-programme-editor="true"]') || null
}

function setMobileExerciseSelectorMode(root, enabled) {
  if (!root) return
  if (enabled) root.dataset.mobileExerciseSelectorOpen = 'true'
  else delete root.dataset.mobileExerciseSelectorOpen
}

export function installMobileExerciseSelectorScrollFix() {
  if (typeof document === 'undefined') return () => {}

  const style = document.createElement('style')
  style.id = 'mobile-exercise-selector-scroll-fix'
  style.textContent = `
    @media (max-width: 767px) {
      [data-final-programme-editor="true"][data-mobile-exercise-selector-open="true"] {
        overflow-y: visible !important;
        max-height: none !important;
      }
    }
  `
  document.head.appendChild(style)

  const handleClick = (event) => {
    const button = event.target?.closest?.('button')
    if (!button || !isPhoneViewport()) return

    const label = text(button)
    const root = programmeEditorRoot(button)
    if (!root) return

    if (label === 'Add exercise' || label === 'Change exercise') {
      setMobileExerciseSelectorMode(root, true)
      return
    }

    if (label === 'Add' || label === 'Use' || label === 'Close') {
      requestAnimationFrame(() => setMobileExerciseSelectorMode(root, false))
    }
  }

  document.addEventListener('click', handleClick, true)

  return () => {
    document.removeEventListener('click', handleClick, true)
    document.getElementById(style.id)?.remove()
    document.querySelectorAll('[data-mobile-exercise-selector-open="true"]').forEach((root) => {
      delete root.dataset.mobileExerciseSelectorOpen
    })
  }
}
