# Workout Plan Refactor Implementation Plan

## 1. Current architecture

### Project structure

- `src/main.jsx` mounts the React app, imports Tailwind CSS, and registers the PWA service worker through `virtual:pwa-register`.
- `src/App.jsx` contains almost the entire application: UI primitives, auth screens, tab navigation, workout logging state, Firestore reads/writes, summaries, tables, and charts.
- `src/firebase.js` initializes Firebase Auth and Firestore against the existing `acl-rehab-tracker-514c9` project.
- `src/index.css` only imports Tailwind. `src/App.css` appears to be unused template CSS.
- `vite.config.js`, `package.json`, and `eslint.config.js` provide Vite, PWA, Tailwind, React, Firebase, Recharts, and lint/build tooling.

### Routing and navigation

There is no URL router. Navigation is local component state in `App.jsx` through `activeTab`, with four tabs: `home`, `log`, `table`, and `graphs`. Desktop tabs and the mobile bottom navigation both update that same state.

### Important components

All components are local to `src/App.jsx`:

- `Button`, `Input`, `Label`, `TabButton`, `CardShell`, and `SummaryCard` are reusable UI primitives.
- `SetsInput` edits a mutable array of `{ reps, weight }` sets and can add/remove rows.
- `ExerciseGraph` renders one Recharts line graph for symmetry.
- The default export `ACLTrackerApp` owns all app state, Firebase subscriptions, transformations, save/delete handlers, and tab rendering.

### Firebase structure

The app currently stores each user's full dataset in a single Firestore document:

```txt
rehabData/{uid}
```

That document is written with `setDoc(..., { merge: true })` and currently contains:

```js
{
  weeks: [...],
  customExercises: [...],
  surgeryDate: "YYYY-MM-DD" | ""
}
```

The app subscribes to the document with `onSnapshot`, so every change replaces the local `weeks`, `customExercises`, and `surgeryDate` state from the snapshot. Production data should not be touched during planning or migration design.

### Data flow

1. Firebase Auth resolves the current user.
2. If there is no user, local workout state is cleared and the auth screen is shown.
3. If there is a user, the app subscribes to `rehabData/{uid}`.
4. Snapshot data is copied into React state.
5. User actions mutate local state arrays and call `saveAllData`, which overwrites the arrays back into the same Firestore document.
6. Derived summaries and graphs are recomputed from the `weeks` array on render.

## 2. Current workout system

### Exercise catalog

The app has three built-in exercises:

```js
[
  { id: "lp", label: "Leg Press", singleLeg: true, builtIn: true },
  { id: "le", label: "Leg Extension", singleLeg: true, builtIn: true },
  { id: "hc", label: "Hamstring Curl", singleLeg: true, builtIn: true }
]
```

Users can add `customExercises`, each shaped as:

```js
{ id, label, singleLeg, builtIn: false }
```

`singleLeg` is a global exercise property. An exercise is either single-leg, storing left/right sets, or bilateral, storing one sets array. The current model cannot naturally represent mixed prescriptions such as Leg Extension with two bilateral sets plus two left-only sets.

### Workout logs

The core historical structure is grouped by rehab week:

```js
{
  week: "12",
  sessions: [session]
}
```

A single-leg session is stored as:

```js
{
  id,
  exerciseId,
  date: "YYYY-MM-DD",
  singleLeg: true,
  leftSets: [{ reps, weight }],
  rightSets: [{ reps, weight }],
  notes
}
```

A bilateral session is stored as:

```js
{
  id,
  exerciseId,
  date: "YYYY-MM-DD",
  singleLeg: false,
  sets: [{ reps, weight }],
  notes
}
```

Despite the UI label "Add Session", a saved item is really an exercise log entry, not a whole workout containing multiple exercises. A workout day with several exercises becomes several independent entries grouped only by `week` and date.

### History and statistics

History is derived directly from `weeks[].sessions[]`:

- Weekly overview finds the last session for each exercise within each week.
- Built-in and custom progress views list sessions per exercise and week.
- Graphs track symmetry only, using best set volume per side: `min(bestLeftVolume, bestRightVolume) / max(...) * 100`.
- Personal bests and progress since first log are not yet implemented as first-class views.

## 3. Weaknesses

- **Single-file app:** `src/App.jsx` mixes UI, Firebase, domain logic, charts, auth, and data migration concerns, making large changes risky.
- **No reusable plans:** There is no plan/session template model. Every exercise must be recreated or selected and entered at logging time.
- **Exercise log is not a workout:** Current `sessions` are individual exercise entries. There is no workout object that captures a whole day, selected plan session, completion status, or snapshot of intended targets.
- **History is coupled to mutable catalog data:** Logs reference `exerciseId` and depend on current exercise labels/configuration. Deleting a custom exercise currently removes its sessions, which violates the requirement to preserve history.
- **Side model is too rigid:** `singleLeg` only supports either left/right or bilateral for the entire exercise. It cannot represent Both + Left-only blocks as one prescribed exercise.
- **Targets are absent:** Sets contain only actual `reps` and `weight`. Target sets/reps are not modeled, so the app cannot preload the desired workout.
- **Firestore document may grow indefinitely:** Storing all history in one document risks Firestore document-size limits and causes every update to rewrite all history.
- **Deletes are destructive:** `deleteCustomExercise` removes historical sessions for that exercise. Future archive/soft-delete behavior is needed.
- **Persistence bugs/risk:** `deleteSession` updates local state but does not call `saveAllData`, so deletes may not persist reliably. The current `App.jsx` also contains an orphaned `getDoc`/`loadUserData` block after the snapshot effect, which likely prevents a successful production build.
- **No explicit schema version:** There is no migration metadata, migration status, or backup marker.

## 4. Proposed architecture

### Guiding philosophy

This is a personal workout app, not a commercial SaaS product. The v2 architecture should be deliberately simple: add structure where it makes the app safer or faster to work on, but avoid enterprise-style layers, excessive nesting, or abstractions that do not directly help reusable plans, fast logging, migration safety, or exercise statistics. If a future implementation discovers a simpler way to satisfy these requirements, document the reasoning before changing direction. Ambiguous decisions should be clarified before implementation rather than guessed.

### Code architecture

Refactor incrementally toward these modules:

```txt
src/
  app/                 # App shell and lightweight screen/tab coordination
  components/          # Shared UI primitives and layout
  features/auth/       # Auth screen and auth hooks
  features/exercises/  # Exercise library, exercise history, stats
  features/plans/      # Plan list, plan editor, duplicate/archive controls
  features/workouts/   # Start workout, active workout, complete workout
  lib/firebase/        # Small repository functions for Firestore reads/writes
  lib/domain/          # Pure calculations, model helpers, migration transforms
  migrations/          # Versioned idempotent migration helpers
```

A router is optional at first. Keep navigation simple unless URL-addressable screens become clearly useful. The app should still separate screens conceptually: Home, Plans, Start Workout, Active Workout, History, Exercise Detail/Stats, Settings.

### Firestore architecture

Move away from one giant user document to a small number of user-scoped collections while initially preserving the legacy document untouched. Only add collections or nesting when there is a clear long-term benefit: independent growth, easier querying, safer writes, or migration verification.

```txt
users/{uid}
  settings              # schema version, surgery date, UI preferences
  exercises/{exerciseId}
  plans/{planId}
  workouts/{workoutId}
  migrationRuns/{migrationId}
legacy source remains: rehabData/{uid}
```

During migration verification, `rehabData/{uid}` remains read-only legacy source and rollback anchor. New writes should go to `users/{uid}/...` documents. Avoid deeper nesting unless needed later; for example, workouts can remain a flat user subcollection because they are queried by user/date/exercise and can grow independently from plans. If a dual-read phase is needed, prefer the new schema when `schemaVersion >= 2`, else legacy.

### Data models

#### Workout Plan

```ts
type WorkoutPlan = {
  id: string;
  userId: string;
  name: string;
  description?: string;
  status: "draft" | "active" | "archived";
  isActive: boolean;          // multiple plans may be active at the same time
  version: number;
  progression?: {
    strategy: "manual" | "increase_weight" | "increase_reps";
    enabled: boolean;
    notes?: string;
  };
  sourcePlanId?: string;       // populated when duplicated
  createdAt: Timestamp;
  updatedAt: Timestamp;
  archivedAt?: Timestamp;
  activatedAt?: Timestamp;
  sessions: PlanSession[];
};
```

Plans own named session templates and can be duplicated, edited, archived, and activated without deleting history. Multiple plans can be active at once, such as Gym Plan and ACL Rehab Plan; starting a workout is simply choosing a plan and then one of its sessions. `version` allows future plan edits to be distinguished from earlier workout snapshots.

#### Session

```ts
type PlanSession = {
  id: string;
  name: string;                // e.g. Push, Pull, Lower, ACL Rehab A
  notes?: string;
  sortOrder: number;            // enables drag-and-drop reordering later
  exercises: PlanExercise[];
};
```

Sessions are named and ordered but not tied to weekdays. The `sortOrder` field keeps the model ready for drag-and-drop reordering without requiring that UI immediately. The user chooses a session at workout start.

#### Exercise

```ts
type ExerciseDefinition = {
  id: string;
  userId: string;
  name: string;
  defaultSideConfig: "both" | "left" | "right" | "mixed";
  category?: "strength" | "rehab" | "mobility" | "conditioning" | "other";
  notes?: string;             // cues such as tempo, pause, slow eccentric, physio note
  isArchived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
```

Exercise definitions are reusable catalog entries. Definition-level notes capture stable cues such as slow eccentric, pause at top, tempo, or physio instructions so the workout flow does not require retyping them. Archive replaces destructive deletion, preserving historical references.

#### Prescription Block

```ts
type PrescriptionBlock = {
  id: string;
  side: "both" | "left" | "right";
  targetSets: number;
  targetReps: {
    type: "fixed" | "range";
    value?: number;
    min?: number;
    max?: number;
  };
  targetWeight?: {
    mode: "previous" | "manual" | "none";
    value?: number;
    unit?: "kg" | "lb";
  };
  restSeconds?: number;
  notes?: string;
  sortOrder: number;            // enables drag-and-drop reordering later
};
```

Blocks make mixed prescriptions natural and keep future drag-and-drop reordering straightforward. Example: Leg Extension can have one `both` block with `targetSets: 2`, then one `left` block with `targetSets: 2`, while remaining a single exercise in the plan.

#### Plan Exercise

```ts
type PlanExercise = {
  id: string;
  exerciseId: string;
  exerciseNameSnapshot: string;
  sortOrder: number;            // enables drag-and-drop reordering later
  prescriptionBlocks: PrescriptionBlock[];
  notes?: string;
};
```

The `exerciseNameSnapshot` protects workout readability if the catalog name changes later. The canonical `exerciseId` still supports exercise-level history. `sortOrder` prepares exercises for drag-and-drop reordering inside a session.

#### Workout

```ts
type Workout = {
  id: string;
  userId: string;
  date: string;                // YYYY-MM-DD for display/query
  startedAt: Timestamp;
  completedAt?: Timestamp;
  status: "in_progress" | "completed" | "cancelled";
  planId?: string;
  planVersion?: number;
  sessionId?: string;
  sessionNameSnapshot: string;
  exercises: WorkoutExercise[];
  notes?: string;
  legacy?: {
    migratedFrom?: "rehabData.weeks.sessions";
    legacyWeek?: string;
    legacySessionId?: string;
  };
};

type WorkoutExercise = {
  id: string;
  exerciseId: string;
  exerciseNameSnapshot: string;
  sortOrder: number;
  prescriptionBlocks: WorkoutPrescriptionBlock[];
  notes?: string;
};

type WorkoutPrescriptionBlock = PrescriptionBlock & {
  actualSets: WorkoutSet[];
};

type WorkoutSet = {
  id: string;
  setNumber: number;
  side: "both" | "left" | "right";
  setType: "warmup" | "working";
  targetReps: PrescriptionBlock["targetReps"];
  actualReps?: number;
  weight?: number;
  unit: "kg" | "lb";
  completed: boolean;
  previous?: {
    actualReps?: number;
    weight?: number;
    workoutId?: string;
    date?: string;
  };
};
```

A workout stores a snapshot of the plan/session as it existed when the workout started. Later plan edits never mutate completed workout history. Prefilling previous values can happen when generating `actualSets` from the selected session. Warm-up sets are first-class sets so they are quick to log in the same screen, but statistics selectors must exclude `setType: "warmup"` by default so warm-ups do not affect PBs, progress graphs, or rehab symmetry calculations.

#### Dashboard/Home readiness

No dashboard rebuild is required in Phase 0, but the proposed collections should make a future home screen straightforward: `workouts` can power Continue Workout and Recent Workouts, derived exercise selectors can power Recent Exercise Progress and Quick Statistics, and optional rehab metadata can power Rehab Progress without making the entire app ACL-only.

#### Exercise History

Exercise history should primarily be derived from completed `workouts`, not duplicated as a separate source of truth. The statistics layer should be flexible enough to support multiple graphs over time, including weight, estimated strength, total volume, and personal-best progression. For performance, optional cached summaries can be added later:

```ts
type ExerciseHistorySummary = {
  exerciseId: string;
  firstLoggedAt?: string;
  latestLoggedAt?: string;
  metrics: {
    maxWeight?: MetricPoint;
    bestVolumeSet?: MetricPoint;
    estimatedStrength?: MetricPoint;
    totalVolume?: MetricPoint;
    personalBestProgression?: MetricPoint[];
  };
  personalBests: {
    bestVolumeSet?: WorkoutSet;
    estimatedOneRepMax?: number;
    maxWeight?: WorkoutSet;
    maxRepsAtWeight?: Record<string, WorkoutSet>;
  };
  progressSinceFirstLog: {
    firstBestVolume?: number;
    latestBestVolume?: number;
    absoluteChange?: number;
    percentChange?: number;
  };
  symmetry?: {
    calculation: "volume" | "weight" | "reps" | "custom";
    latestPercent?: number;
    trend: Array<{ date: string; leftValue: number; rightValue: number; symmetryPercent: number }>;
  };
  updatedAt: Timestamp;
};

type MetricPoint = {
  date: string;
  value: number;
  unit?: string;
  workoutId: string;
  exerciseId: string;
  side?: "both" | "left" | "right";
};
```

Derived history avoids inconsistencies. Cached summaries can be regenerated from workouts if needed. Symmetry only applies when an exercise has left/right logged data, and the `calculation` field avoids hard-coding symmetry to volume forever.

## 5. Migration strategy

1. **Add schema versioning without changing legacy data.** Add or update the simple `users/{uid}/settings` document with `schemaVersion: 2`, migration status, and timestamps. Leave `rehabData/{uid}` untouched.
2. **Create an export/backup path.** Before writing transformed data, read `rehabData/{uid}` and store a migration backup under `users/{uid}/migrationRuns/{runId}` or export JSON locally/admin-side. Include counts and hashes of legacy sessions.
3. **Idempotent transform.** Convert each legacy `weeks[].sessions[]` item into one completed workout in `users/{uid}/workouts/{deterministicId}`. Use a deterministic ID such as `legacy-${week}-${session.id}`. Re-running the migration overwrites the same migrated document instead of duplicating it. Legacy sets should be migrated as `setType: "working"`; warm-up sets only appear in newly logged v2 workouts unless an old field explicitly identifies them.
4. **Preserve old fields.** Store `legacy.week`, `legacy.sessionId`, original `singleLeg`, original sets arrays, and original notes on migrated workouts or in a `legacyRaw` field until verification is complete.
5. **Create exercise definitions.** Upsert built-ins and legacy custom exercises into `exercises`. Do not delete or overwrite legacy custom exercise data. If a custom exercise name is missing, preserve the ID and mark the name as `Unknown legacy exercise`.
6. **Represent legacy sessions safely.** Because each legacy entry is one exercise log, create migrated workouts with `sessionNameSnapshot: "Legacy log"` and a single workout exercise. Left/right legacy sessions become two blocks (`left`, `right`); bilateral sessions become one `both` block. Target reps are unknown, so mark target reps as empty/legacy-derived and preserve actual reps.
7. **Verification step.** Compare counts before switching UI reads: number of weeks, sessions, exercises, dates, notes, set counts, and non-empty actual values must match. Show a migration report in development/admin logs.
8. **Dual-read rollout.** In the app, if `schemaVersion >= 2` and migrated workouts exist, read from the new collections. Otherwise, continue legacy reads. Do not remove the legacy system until the new system has been fully verified.
9. **Rollback.** Rollback is switching the app back to legacy reads because `rehabData/{uid}` was never mutated. New-schema collections can be ignored or cleaned up later after verification.
10. **Only after verification:** stop writing legacy fields. Do not remove obsolete fields until enough migrated data has been validated.

## 6. Implementation roadmap

### Phase 0 — Stabilize and document current behavior

- **Changes:** Fix build-blocking syntax/import issues without changing functionality, add lightweight tests for pure helpers if practical, document the legacy schema, and update the plan with approved model refinements for progression, reordering, and future dashboard readiness.
- **Files:** `src/App.jsx`, `docs/legacy-schema.md`, `docs/workout-plan-refactor-plan.md`, test config if introduced.
- **Why:** The refactor needs a stable baseline.
- **Risks:** Accidental behavior changes in the large app component; keep edits minimal.

### Phase 1 — Extract pure domain helpers and Firebase repositories

- **Changes:** Move date helpers, set calculations, summary helpers, and Firebase reads/writes into separate modules.
- **Files:** `src/lib/domain/*`, `src/lib/firebase/*`, `src/App.jsx`.
- **Why:** Migration and plan features need reusable, testable logic.
- **Risks:** Import mistakes or changed render timing; mitigate with build/lint and focused manual checks.

### Phase 2 — Introduce v2 model types and migration transforms

- **Changes:** Add model definitions, deterministic ID helpers, and pure legacy-to-v2 transform functions. Do not switch the UI yet.
- **Files:** `src/lib/domain/models.*`, `src/migrations/legacyToV2.*`, tests.
- **Why:** Allows migration behavior to be verified before data writes.
- **Risks:** Misinterpreting legacy sessions; preserve raw legacy payloads and counts.

### Phase 3 — Add safe migration runner

- **Changes:** Add an authenticated migration service that reads legacy data, writes v2 collections with deterministic IDs, records migration metadata, and can be re-run safely.
- **Files:** `src/lib/firebase/migrations.*`, `src/migrations/*`, optional admin/dev-only UI in settings.
- **Why:** Existing history must be preserved before the UI switches schemas.
- **Risks:** Firestore permissions, partial writes, or network failures; use batched writes where possible and migration status docs.

### Phase 4 — Build plan management UI

- **Changes:** Add plan list, plan editor, duplicate/archive/activate actions, session editor, exercise picker, and prescription block editor. Support multiple active plans; the start flow chooses plan first, then session.
- **Files:** `src/features/plans/*`, `src/features/exercises/*`, shared components, app navigation.
- **Why:** Reusable workout plans are the central product goal.
- **Risks:** Complex mobile UI; keep initial editor simple and reliable.

### Phase 5 — Build quick workout flow

- **Changes:** Add start workout screen, plan/session chooser, active workout screen, previous-value prefill, target set generation, warm-up set support, and completion flow.
- **Files:** `src/features/workouts/*`, `src/lib/domain/workoutFactory.*`, Firebase workout repository.
- **Why:** Workout logging should mostly require weight and actual reps, with the fewest possible taps. Exercise names, targets, side setup, notes, and set structure should come from the saved plan.
- **Risks:** Preserving in-progress workouts, avoiding duplicate submissions, handling plan edits during active workouts, and keeping warm-up logging fast without polluting stats.

### Phase 6 — Exercise history and statistics

- **Changes:** Add exercise detail pages with multiple graph selectors, PBs, progress since first log, and symmetry for exercises with left/right data. Exclude consistency tracking and exclude warm-up sets from default statistics.
- **Files:** `src/features/exercises/history/*`, `src/lib/domain/stats.*`, chart components.
- **Why:** Required analytics should be exercise-centered rather than week-centered.
- **Risks:** PB and symmetry calculation definitions must be clear; derive from completed working sets only by default.

### Phase 7 — Legacy cleanup after approval/verification

- **Changes:** Hide legacy UI paths, remove destructive custom exercise deletion, optionally archive obsolete fields in code after data validation.
- **Files:** `src/App.jsx` or retired legacy files, repositories, docs.
- **Why:** Reduce maintenance burden once migration is trusted.
- **Risks:** Removing fallback too early; keep rollback path until explicitly approved.

### Phase 8 — Usability polish without feature creep

- **Changes:** Tighten mobile-first layouts, reduce taps, improve input focus behavior, keep core screens clean, and avoid adding low-priority features that slow logging.
- **Files:** `src/features/workouts/*`, `src/features/plans/*`, shared UI components.
- **Why:** The primary product value is speed and ease of logging.
- **Risks:** Over-polishing before core data correctness is proven; keep changes incremental and functional after each phase.

## 7. Potential concerns

- The current code appears to have a build-breaking duplicate data-loading block in `src/App.jsx`, including `await getDoc(ref)` outside a declared async function and no `getDoc` import.
- All application logic lives in one large component, so even small changes can have broad impact.
- Firestore data is stored in one document, which may become too large as history grows.
- Legacy custom exercise deletion currently removes logged sessions, so preserving history requires changing deletion semantics to archive/soft-delete.
- Because legacy logs do not have plan/session context or target prescriptions, migrated workouts can preserve actual history but cannot reconstruct original intended targets.
- Current week-based grouping is rehab-specific. The new model should retain optional surgery/week metadata for ACL use but make date/session selection primary for general training.
- Existing graph logic only handles single-leg symmetry. General exercise progress and mixed side blocks require new stats selectors.
- Firebase security rules are not present in the repository, so schema changes may require out-of-repo rule updates before deployment.
- Multiple active plans make the start-workout flow slightly more complex, but they better match real usage than a single active-plan assumption. Keep the UI simple: choose plan, choose session, start.
