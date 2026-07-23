function text(element) {
  return (element?.textContent || '').trim()
}

function isPhoneViewport() {
  return window.matchMedia('(max-width: 767px)').matches
}

function programmeEditorRoot(element) {
  return element?.closest?.('[data-final-programme-editor="true"]') || null
}

function selectorInSession(session) {
  if (!session) return null
  return [...session.querySelectorAll('div.rounded-xl.border-dashed, [data-exercise-picker]')].find((item) =>
    /Exercise picker|Change exercise|Search exercises/i.test(text(item)),
  ) || null
}

function setSelectorMode(root, enabled) {
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

  const timers = new Set()
  let pending = null
  let desktopSession = null
  let restoreScrollIntoView = null

  const later = (callback, delay) => {
    const timer = window.setTimeout(() => {
      timers.delete(timer)
      callback()
    }, delay)
    timers.add(timer)
  }

  const restoreOpeningPosition = () => {
    if (!pending?.root?.isConnected) return

    const selector = selectorInSession(pending.session)
    if (!selector) return

    const search = selector.querySelector('input[aria-label="Search exercises"]')
    if (search === document.activeElement) search.blur()

    pending.root.scrollTop = pending.rootScrollTop
    window.scrollTo(pending.pageX, pending.pageY)
  }

  const restoreDesktopScroll = () => {
    if (!restoreScrollIntoView) return
    Element.prototype.scrollIntoView = restoreScrollIntoView
    restoreScrollIntoView = null
    desktopSession = null
  }

  const makeDesktopSelectorScrollImmediate = (session) => {
    restoreDesktopScroll()
    desktopSession = session
    const original = Element.prototype.scrollIntoView
    restoreScrollIntoView = original

    Element.prototype.scrollIntoView = function scrollIntoViewWithoutSelectorAnimation(options) {
      const selector = selectorInSession(desktopSession)
      if (selector && this === selector && options && typeof options === 'object') {
        original.call(this, { ...options, behavior: 'auto' })
        restoreDesktopScroll()
        return
      }
      original.call(this, options)
    }

    later(restoreDesktopScroll, 2000)
  }

  const handleClick = (event) => {
    const button = event.target?.closest?.('button')
    if (!button) return

    const label = text(button)
    const root = programmeEditorRoot(button)
    if (!root) return

    if (!isPhoneViewport()) {
      if (label === 'Add exercise' || label === 'Change exercise') {
        makeDesktopSelectorScrollImmediate(button.closest('[id^="programme-session-"]'))
      }
      return
    }

    if (label === 'Add exercise' || label === 'Change exercise') {
      pending = {
        root,
        session: button.closest('[id^="programme-session-"]'),
        rootScrollTop: root.scrollTop,
        pageX: window.scrollX,
        pageY: window.scrollY,
      }
      setSelectorMode(root, true)

      ;[0, 16, 50, 100, 180, 300, 500].forEach((delay) => later(restoreOpeningPosition, delay))
      return
    }

    if (label === 'Add' || label === 'Use' || label === 'Close') {
      pending = null
      requestAnimationFrame(() => setSelectorMode(root, false))
    }
  }

  document.addEventListener('click', handleClick, true)

  return () => {
    document.removeEventListener('click', handleClick, true)
    timers.forEach((timer) => window.clearTimeout(timer))
    timers.clear()
    restoreDesktopScroll()
    pending = null
    document.getElementById(style.id)?.remove()
    document.querySelectorAll('[data-mobile-exercise-selector-open="true"]').forEach((root) => {
      delete root.dataset.mobileExerciseSelectorOpen
    })
  }
}
