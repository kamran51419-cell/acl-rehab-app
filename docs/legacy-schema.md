# Legacy Workout Schema

This document captures the pre-refactor data shape used by the app so Phase 0 has a stable baseline for migration work. It is documentation only; production Firebase data must not be modified during planning or Phase 0 stabilization.

## Firestore location

Legacy user data is stored in one Firestore document:

```txt
rehabData/{uid}
```

The app subscribes to this document with `onSnapshot` and saves the same top-level fields with `setDoc(..., { merge: true })`.

## Top-level document shape

```js
{
  weeks: LegacyWeek[],
  customExercises: LegacyExercise[],
  surgeryDate: "YYYY-MM-DD" | ""
}
```

## Built-in exercises

The current built-in catalog is defined in app code rather than Firestore:

```js
[
  { id: "lp", label: "Leg Press", singleLeg: true, builtIn: true },
  { id: "le", label: "Leg Extension", singleLeg: true, builtIn: true },
  { id: "hc", label: "Hamstring Curl", singleLeg: true, builtIn: true }
]
```

## Custom exercises

```ts
type LegacyExercise = {
  id: string;
  label: string;
  singleLeg: boolean;
  builtIn: false;
};
```

Custom exercise IDs are generated as `custom-${Date.now()}`. Legacy deletion removes the custom exercise and filters out sessions using that exercise ID, so the v2 implementation must replace this with archive/soft-delete behavior before removing legacy UI paths.

## Weeks

```ts
type LegacyWeek = {
  week: string;
  sessions: LegacySession[];
};
```

Weeks are sorted numerically by `week`. When a surgery date exists, the week can be derived from the workout date. Without a surgery date, the week is user-entered and then incremented after save.

## Sessions

Despite the UI name, a legacy `session` represents one logged exercise entry rather than a full workout day.

### Single-leg session

```ts
type LegacySingleLegSession = {
  id: string;
  exerciseId: string;
  date: string;
  singleLeg: true;
  leftSets: LegacySet[];
  rightSets: LegacySet[];
  notes: string;
};
```

### Bilateral session

```ts
type LegacyBilateralSession = {
  id: string;
  exerciseId: string;
  date: string;
  singleLeg: false;
  sets: LegacySet[];
  notes: string;
};
```

### Set

```ts
type LegacySet = {
  reps: string;
  weight: string;
};
```

Legacy set values are strings because they are stored directly from form inputs. Migration should preserve the raw string values until verification is complete, even if v2 also normalizes numeric values for statistics.

## Derived legacy statistics

- Best set uses `Number(reps) * Number(weight)`.
- Single-leg symmetry currently uses best left-side set volume and best right-side set volume.
- Graphs currently show symmetry only.
- Personal bests, progress since first log, multiple graph metrics, and warm-up exclusion are not first-class legacy concepts.

## Phase 0 stabilization note

The app previously contained a duplicate, orphaned one-time `getDoc` loading block after the realtime `onSnapshot` effect. That block caused the production build and ESLint parse step to fail because it used `await` outside an async function. Phase 0 removes that orphaned block and keeps the realtime subscription as the single legacy data-loading path.
