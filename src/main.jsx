import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import './uiPolish.css'
import './finalUxPolish.css'
import './workoutFlowConsistency.css'
import './finalTargetedUiFix.css'
import App from './App.jsx'
import { installUiRuntimeFixes } from './uiRuntimeFixes'
import { installProgrammeButtonLabels } from './programmeButtonLabels'
import { installWorkoutFlowUiFixes } from './workoutFlowUiFixes'
import { installRoutineTaskTimeEditor } from './routineTaskTimeEditor'
import { installRoutineCustomTimePersistenceFix } from './routineCustomTimePersistenceFix'
import { installProgrammeScreenNavigation } from './programmeScreenNavigation'
import { installDuplicateAndPairedExerciseFix } from './duplicateAndPairedExerciseFix'
import { installHomeSummaryAndSettingsFix } from './homeSummaryAndSettingsFix'
import { installTaskAndVariationLabels } from './taskAndVariationLabels'
import { installQuickWorkoutCancelCleanup } from './quickWorkoutCancelCleanup'
import { installWorkoutFlowConsistencyFix } from './workoutFlowConsistencyFix'
import { installFinalTargetedUiFixes } from './finalTargetedUiFix'
import { installTodayTaskOrderFix } from './todayTaskOrderFix'
import { installProgrammeCreatorInputFixes } from './programmeCreatorInputFixes'

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true)
  },
})

installUiRuntimeFixes()
installProgrammeButtonLabels()
installWorkoutFlowUiFixes()
installRoutineCustomTimePersistenceFix()
installRoutineTaskTimeEditor()
installProgrammeScreenNavigation()
installDuplicateAndPairedExerciseFix()
installHomeSummaryAndSettingsFix()
installTaskAndVariationLabels()
installQuickWorkoutCancelCleanup()
installWorkoutFlowConsistencyFix()
installFinalTargetedUiFixes()
installTodayTaskOrderFix()
installProgrammeCreatorInputFixes()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
