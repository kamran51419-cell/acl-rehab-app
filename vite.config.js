import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { timeWeightTrackingBuildPlugin } from './src/timeWeightTrackingBuildPlugin.js'
import { equipmentTrackingBuildPlugin } from './src/equipmentTrackingBuildPlugin.js'
import { latestPreviousPerformanceBuildPlugin } from './src/latestPreviousPerformanceBuildPlugin.js'
import { timedPreviousPerformanceBuildPlugin } from './src/timedPreviousPerformanceBuildPlugin.js'
import { workoutExerciseEditBuildPlugin } from './src/workoutExerciseEditBuildPlugin.js'
import { workoutUiPolishBuildPlugin } from './src/workoutUiPolishBuildPlugin.js'
import { exercisePickerConsistencyBuildPlugin } from './src/exercisePickerConsistencyBuildPlugin.js'
import { reorderUxBuildPlugin } from './src/reorderUxBuildPlugin.js'
import { wholeCardDragBuildPlugin } from './src/wholeCardDragBuildPlugin.js'
import { exerciseNotesBuildPlugin } from './src/exerciseNotesBuildPlugin.js'
import { mobileInteractionFixesBuildPlugin } from './src/mobileInteractionFixesBuildPlugin.js'
import { catchUpParityBuildPlugin } from './src/catchUpParityBuildPlugin.js'
import { exerciseFlagBuildPlugin } from './src/exerciseFlagBuildPlugin.js'
import { flaggedGraphInteractionFixBuildPlugin } from './src/flaggedGraphInteractionFixBuildPlugin.js'
import { programmeCollapseBuildPlugin } from './src/programmeCollapseBuildPlugin.js'
import { leftRightWorkoutGroupingBuildPlugin } from './src/leftRightWorkoutGroupingBuildPlugin.js'
import { catchUpLeftRightGroupingBuildPlugin } from './src/catchUpLeftRightGroupingBuildPlugin.js'
import { programmeWorkoutVisualPolishBuildPlugin } from './src/programmeWorkoutVisualPolishBuildPlugin.js'
import { mobileUiUxAuditBuildPlugin } from './src/mobileUiUxAuditBuildPlugin.js'
import { seamlessTabsBuildPlugin } from './src/seamlessTabsBuildPlugin.js'
import { workoutCardAlignmentBuildPlugin } from './src/workoutCardAlignmentBuildPlugin.js'
import { setFieldFloatingLabelsBuildPlugin } from './src/setFieldFloatingLabelsBuildPlugin.js'
import { exerciseMetaHierarchyBuildPlugin } from './src/exerciseMetaHierarchyBuildPlugin.js'
import { workoutActionTextBuildPlugin } from './src/workoutActionTextBuildPlugin.js'
import { repeatedIntervalBlocksPlugin } from './src/repeatedIntervalBlocksPlugin.js'
import { intervalSummaryGrammarBuildPlugin } from './src/intervalSummaryGrammarBuildPlugin.js'
import { verticalIntervalWorkoutDisplayPlugin } from './src/verticalIntervalWorkoutDisplayPlugin.js'
import { unifiedAddExerciseSetupBuildPlugin } from './src/unifiedAddExerciseSetupBuildPlugin.js'
import { intervalMeasurementChoiceBuildPlugin } from './src/intervalMeasurementChoiceBuildPlugin.js'
import { quickWorkoutPreviousPerformanceBuildPlugin } from './src/quickWorkoutPreviousPerformanceBuildPlugin.js'
import { addExerciseUxFixBuildPlugin } from './src/addExerciseUxFixBuildPlugin.js'
import { quickWorkoutExerciseHistoryBuildPlugin } from './src/quickWorkoutExerciseHistoryBuildPlugin.js'
import { deletedExerciseStatsBuildPlugin } from './src/deletedExerciseStatsBuildPlugin.js'
import { statsImprovementPercentageBuildPlugin } from './src/statsImprovementPercentageBuildPlugin.js'
import { inProgressWorkoutCleanupBuildPlugin } from './src/inProgressWorkoutCleanupBuildPlugin.js'

export default defineConfig({
  plugins: [
    inProgressWorkoutCleanupBuildPlugin(),
    timeWeightTrackingBuildPlugin(),
    equipmentTrackingBuildPlugin(),
    latestPreviousPerformanceBuildPlugin(),
    timedPreviousPerformanceBuildPlugin(),
    workoutExerciseEditBuildPlugin(),
    workoutUiPolishBuildPlugin(),
    repeatedIntervalBlocksPlugin(),
    intervalSummaryGrammarBuildPlugin(),
    verticalIntervalWorkoutDisplayPlugin(),
    exercisePickerConsistencyBuildPlugin(),
    reorderUxBuildPlugin(),
    wholeCardDragBuildPlugin(),
    exerciseNotesBuildPlugin(),
    mobileInteractionFixesBuildPlugin(),
    catchUpParityBuildPlugin(),
    exerciseFlagBuildPlugin(),
    flaggedGraphInteractionFixBuildPlugin(),
    programmeCollapseBuildPlugin(),
    leftRightWorkoutGroupingBuildPlugin(),
    catchUpLeftRightGroupingBuildPlugin(),
    programmeWorkoutVisualPolishBuildPlugin(),
    mobileUiUxAuditBuildPlugin(),
    seamlessTabsBuildPlugin(),
    workoutCardAlignmentBuildPlugin(),
    setFieldFloatingLabelsBuildPlugin(),
    exerciseMetaHierarchyBuildPlugin(),
    workoutActionTextBuildPlugin(),
    unifiedAddExerciseSetupBuildPlugin(),
    intervalMeasurementChoiceBuildPlugin(),
    quickWorkoutPreviousPerformanceBuildPlugin(),
    addExerciseUxFixBuildPlugin(),
    quickWorkoutExerciseHistoryBuildPlugin(),
    deletedExerciseStatsBuildPlugin(),
    statsImprovementPercentageBuildPlugin(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ACL Rehab Tracker',
        short_name: 'ACL Rehab',
        description: 'Track ACL rehab progress',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
