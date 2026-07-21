function textOf(element) {
  return (element?.textContent || '').trim()
}

function programmeEditor() {
  const heading = [...document.querySelectorAll('h1, h2, h3')].find((element) =>
    /^(Edit|Create) programme$/i.test(textOf(element)),
  )
  return heading?.closest('[data-final-programme-editor="true"]') || heading?.closest("[class*='rounded-3xl']") || null
}

function exercisePicker(editor) {
  const heading = [...editor.querySelectorAll('strong, h1, h2, h3, div')].find((element) =>
    /^(Exercise picker|Change exercise)$/i.test(textOf(element)),
  )
  return heading?.closest("[class*='rounded-xl']") || null
}

function enableRepeatedExerciseAdds(editor) {
  const picker = exercisePicker(editor)
  if (!picker) return

  picker.querySelectorAll('button').forEach((button) => {
    if (!['Selected', 'Added', 'Add'].includes(textOf(button))) return
    button.disabled = false
    button.removeAttribute('disabled')
    button.setAttribute('aria-disabled', 'false')
    button.textContent = 'Add'
    button.style.pointerEvents = 'auto'
    button.style.opacity = '1'
  })
}

function cleanStandardSummaries(root = document) {
  root.querySelectorAll("[class*='text-slate-500']").forEach((label) => {
    const text = textOf(label)
    if (!/^\d+\s*[×x]\s*(?:\d+|\d+[–-]\d+)\s+both$/i.test(text)) return

    const exerciseCard = label.closest("[class*='rounded-xl'], [class*='rounded-2xl']")
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

function raiseDiscardDialog() {
  const heading = [...document.querySelectorAll('h1, h2, h3')].find((element) => textOf(element) === 'Discard changes?')
  const dialog = heading?.closest('[role="dialog"]')
  const overlay = dialog?.parentElement
  if (!dialog || !overlay) return

  let ancestor = overlay
  while (ancestor) {
    ancestor.hidden = false
    ancestor.style.pointerEvents = 'auto'
    ancestor = ancestor.parentElement
  }

  overlay.style.setProperty('display', 'flex', 'important')
  overlay.style.setProperty('visibility', 'visible', 'important')
  overlay.style.setProperty('opacity', '1', 'important')
  overlay.style.setProperty('pointer-events', 'auto', 'important')
  overlay.style.setProperty('z-index', '2147483647', 'important')

  dialog.style.setProperty('pointer-events', 'auto', 'important')
  dialog.querySelectorAll('button').forEach((button) => {
    button.disabled = false
    button.removeAttribute('disabled')
    button.style.pointerEvents = 'auto'
  })
}

function applyProgrammeCreatorFixes() {
  const editor = programmeEditor()
  if (editor) {
    enableRepeatedExerciseAdds(editor)
    prepareNumericInputs(editor)
  }
  cleanStandardSummaries(document)
  raiseDiscardDialog()
}

export function installProgrammeCreatorInputFixes() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {}

  const selectNumericInput = (event) => {
    const input = event.target
    if (!(input instanceof HTMLInputElement) || input.inputMode !== 'numeric') return
    if (!programmeEditor()?.contains(input)) return
    requestAnimationFrame(() => input.select())
  }

  const unlockPickerButton = (event) => {
    const button = event.target?.closest?.('button')
    if (!button || !['Selected', 'Added', 'Add'].includes(textOf(button))) return
    const editor = programmeEditor()
    if (!editor || !exercisePicker(editor)?.contains(button)) return
    button.disabled = false
    button.removeAttribute('disabled')
    button.setAttribute('aria-disabled', 'false')
  }

  const handleProgrammeClose = (event) => {
    const button = event.target?.closest?.('button')
    if (!button || textOf(button) !== 'Close') return
    const editor = programmeEditor()
    if (!editor || !editor.contains(button)) return

    button.disabled = false
    button.removeAttribute('disabled')
    button.style.pointerEvents = 'auto'

    requestAnimationFrame(() => {
      raiseDiscardDialog()
      setTimeout(raiseDiscardDialog, 0)
      setTimeout(raiseDiscardDialog, 50)
    })
  }

  document.addEventListener('focusin', selectNumericInput)
  document.addEventListener('pointerup', selectNumericInput)
  document.addEventListener('pointerdown', unlockPickerButton, true)
  document.addEventListener('touchstart', unlockPickerButton, true)
  document.addEventListener('click', handleProgrammeClose, true)
  document.addEventListener('pointerup', handleProgrammeClose, true)
  document.addEventListener('touchend', handleProgrammeClose, true)

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
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'style'] })

  return () => {
    observer.disconnect()
    document.removeEventListener('focusin', selectNumericInput)
    document.removeEventListener('pointerup', selectNumericInput)
    document.removeEventListener('pointerdown', unlockPickerButton, true)
    document.removeEventListener('touchstart', unlockPickerButton, true)
    document.removeEventListener('click', handleProgrammeClose, true)
    document.removeEventListener('pointerup', handleProgrammeClose, true)
    document.removeEventListener('touchend', handleProgrammeClose, true)
  }
}
