function textOf(element) {
  return (element?.textContent || '').trim()
}

function programmeEditor() {
  const heading = [...document.querySelectorAll('h1, h2, h3')].find((element) =>
    /^(Edit|Create) programme$/i.test(textOf(element)),
  )
  return heading?.closest('[data-final-programme-editor="true"]') || heading?.closest("[class*='rounded-3xl']") || null
}

function enableRepeatedExerciseAdds(editor) {
  editor.querySelectorAll('button').forEach((button) => {
    if (textOf(button) !== 'Selected') return
    button.disabled = false
    button.removeAttribute('disabled')
    button.textContent = 'Add'
  })
}

function cleanStandardSummaries(editor) {
  editor.querySelectorAll("[class*='text-slate-500']").forEach((label) => {
    const text = textOf(label)
    if (!/^\d+\s*[×x]\s*(?:\d+|\d+[–-]\d+)\s+both$/i.test(text)) return

    const exerciseCard = label.closest("[class*='rounded-xl']")
    const sideSelect = [...(exerciseCard?.querySelectorAll('select') || [])].find((select) =>
      [...select.options].some((option) => option.textContent === 'Standard'),
    )

    if (sideSelect?.selectedOptions?.[0]?.textContent === 'Standard') {
      label.textContent = text.replace(/\s+both$/i, '')
    }
  })
}

function prepareNumericInputs(editor) {
  editor.querySelectorAll('input[inputmode="numeric"]').forEach((input) => {
    input.autocomplete = 'off'
    input.setAttribute('enterkeyhint', 'done')
    input.style.touchAction = 'manipulation'
  })
}

function applyProgrammeCreatorFixes() {
  const editor = programmeEditor()
  if (!editor) return
  enableRepeatedExerciseAdds(editor)
  cleanStandardSummaries(editor)
  prepareNumericInputs(editor)
}

export function installProgrammeCreatorInputFixes() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {}

  const selectNumericInput = (event) => {
    const input = event.target
    if (!(input instanceof HTMLInputElement) || input.inputMode !== 'numeric') return
    if (!programmeEditor()?.contains(input)) return
    requestAnimationFrame(() => input.select())
  }

  document.addEventListener('focusin', selectNumericInput)
  document.addEventListener('pointerup', selectNumericInput)

  let queued = false
  const schedule = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      applyProgrammeCreatorFixes()
    })
  }

  applyProgrammeCreatorFixes()
  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })

  return () => {
    observer.disconnect()
    document.removeEventListener('focusin', selectNumericInput)
    document.removeEventListener('pointerup', selectNumericInput)
  }
}
