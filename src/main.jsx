import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import { installUiRuntimeFixes } from './uiRuntimeFixes'
import { installProgrammeButtonLabels } from './programmeButtonLabels'
import { installWorkoutFlowUiFixes } from './workoutFlowUiFixes'
import { installRoutineTaskTimeEditor } from './routineTaskTimeEditor'

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true)
  },
})

installUiRuntimeFixes()
installProgrammeButtonLabels()
installWorkoutFlowUiFixes()
installRoutineTaskTimeEditor()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
