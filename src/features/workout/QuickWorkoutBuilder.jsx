import React, { useMemo, useState } from "react";
import { GripVertical, Plus, Search, Trash2 } from "lucide-react";
import Button from "../../components/ui/Button";
import {
  EXERCISE_LOGGING_METHOD,
  EXERCISE_TYPE,
  INTERVAL_PHASE,
  createDefaultPrescription,
  createIntervalStage,
  defaultLoggingMethodForExerciseType,
  filterExerciseLibrary,
  loggingMethodsForExerciseType,
  planPrescriptionSummary,
} from "../../lib/domain/plans";
import { SIDE, WORKOUT_STATUS } from "../../lib/domain/v2Models";
import { createWorkoutExerciseSnapshot } from "../../lib/domain/workoutSession";
import { makeId } from "../../lib/domain/legacyWorkouts";
import { DirectStrengthPrescription, DurationInput, Field, Input, Select, Textarea } from "../plans/ProgrammeFormControls";

const METHOD_LABELS = {
  [EXERCISE_LOGGING_METHOD.REPS]: "Reps",
  [EXERCISE_LOGGING_METHOD.REPS_WEIGHT]: "Reps + Weight",
  [EXERCISE_LOGGING_METHOD.TIME]: "Time",
  [EXERCISE_LOGGING_METHOD.DISTANCE]: "Distance",
  [EXERCISE_LOGGING_METHOD.TIME_DISTANCE]: "Time + Distance",
  [EXERCISE_LOGGING_METHOD.COMPLETED]: "Task",
  [EXERCISE_LOGGING_METHOD.INTERVALS]: "Intervals",
};

const TYPE_LABELS = {
  [EXERCISE_TYPE.STRENGTH]: "Strength",
  [EXERCISE_TYPE.CARDIO]: "Cardio",
  [EXERCISE_TYPE.PLYOMETRIC]: "Plyometric",
  [EXERCISE_TYPE.BALANCE]: "Balance",
  [EXERCISE_TYPE.MOBILITY]: "Mobility / Stretch",
  [EXERCISE_TYPE.STRETCH]: "Stretch",
  [EXERCISE_TYPE.OTHER]: "Other",
};

function supportsSides(type) {
  return [EXERCISE_TYPE.STRENGTH, EXERCISE_TYPE.BALANCE].includes(type);
}

function createSelectedExercise(definition, index) {
  const exerciseType = definition.exerciseType || definition.trackingType || EXERCISE_TYPE.STRENGTH;
  const loggingMethod = defaultLoggingMethodForExerciseType(exerciseType);
  return {
    instanceId: `quick-${makeId()}-${index}`,
    exerciseId: definition.id,
    exerciseNameSnapshot: definition.name,
    exerciseType,
    loggingMethod,
    prescription: createDefaultPrescription(exerciseType, loggingMethod),
    notes: "",
  };
}

function zeroIntervalPrescription() {
  return {
    stages: [
      createIntervalStage({ phase: INTERVAL_PHASE.WORK, durationSeconds: 0, durationUnit: "seconds", sortOrder: 0 }),
      createIntervalStage({ phase: INTERVAL_PHASE.REST, durationSeconds: 0, durationUnit: "seconds", sortOrder: 1 }),
    ],
  };
}

function QuickExerciseSetupEditor({ exercise, onChange, trainingMode }) {
  const updatePrescription = (prescription) => onChange({ ...exercise, prescription });
  const methods = loggingMethodsForExerciseType(exercise.exerciseType);
  const selectedMethod = methods.includes(exercise.loggingMethod) ? exercise.loggingMethod : methods[0];

  const changeLoggingMethod = (loggingMethod) => {
    const prescription = loggingMethod === EXERCISE_LOGGING_METHOD.INTERVALS
      ? zeroIntervalPrescription()
      : createDefaultPrescription(exercise.exerciseType, loggingMethod);
    onChange({ ...exercise, loggingMethod, prescription });
  };

  const methodField = (
    <Field label="Track by">
      <Select value={selectedMethod} onChange={(event) => changeLoggingMethod(event.target.value)}>
        {methods.map((method) => <option key={method} value={method}>{METHOD_LABELS[method] || "Task"}</option>)}
      </Select>
    </Field>
  );

  if (!methods.length || exercise.loggingMethod === EXERCISE_LOGGING_METHOD.COMPLETED) {
    return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">This exercise is completed as a task.</div>;
  }

  if ([EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT].includes(selectedMethod)) {
    return (
      <div className="space-y-3">
        <div className="max-w-xs">{methodField}</div>
        <DirectStrengthPrescription
          prescription={exercise.prescription || {}}
          onChange={updatePrescription}
          showNotes={false}
          bothLabel="Standard"
          trainingMode={trainingMode}
        />
      </div>
    );
  }

  if (selectedMethod === EXERCISE_LOGGING_METHOD.TIME) {
    const p = exercise.prescription || {};
    const duration = <DurationInput seconds={p.targetDurationSeconds} durationUnit={p.durationUnit} onChange={({ seconds, unit }) => updatePrescription({ ...p, targetDurationSeconds: seconds, durationUnit: unit })} />;
    if (exercise.exerciseType === EXERCISE_TYPE.BALANCE) {
      return (
        <div className="space-y-3">
          <div className="max-w-xs">{methodField}</div>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Side">
              <Select value={p.side || SIDE.BOTH} onChange={(event) => updatePrescription({ ...p, side: event.target.value })}>
                <option value={SIDE.BOTH}>Standard</option>
                <option value={SIDE.SEPARATE}>Left & right</option>
                {trainingMode === "rehab" ? <><option value={SIDE.LEFT}>Left only</option><option value={SIDE.RIGHT}>Right only</option></> : null}
              </Select>
            </Field>
            <Field label="Sets"><Input inputMode="numeric" value={p.targetSets || ""} onChange={(event) => updatePrescription({ ...p, targetSets: Number(event.target.value) })} /></Field>
            {duration}
          </div>
        </div>
      );
    }
    return <div className="space-y-3"><div className="max-w-xs">{methodField}</div>{duration}</div>;
  }

  if (selectedMethod === EXERCISE_LOGGING_METHOD.DISTANCE) {
    const p = exercise.prescription || {};
    return <div className="space-y-3"><div className="max-w-xs">{methodField}</div><Field label="Distance (km)"><Input inputMode="decimal" value={p.targetDistance ?? p.distance ?? ""} onChange={(event) => updatePrescription({ ...p, targetDistance: Number(event.target.value) })} /></Field></div>;
  }

  if (selectedMethod === EXERCISE_LOGGING_METHOD.INTERVALS) {
    const p = exercise.prescription || {};
    const stages = p.stages || [];
    const updateStages = (next) => updatePrescription({ ...p, stages: next.map((stage, index) => ({ ...stage, sortOrder: index })) });
    return (
      <div className="space-y-3">
        <div className="max-w-xs">{methodField}</div>
        {stages.map((stage, index) => (
          <div key={stage.id || index} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="grid gap-2 md:grid-cols-[140px_1fr_1fr]">
              <Field label="Stage"><Select value={stage.phase} onChange={(event) => updateStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, phase: event.target.value } : item))}><option value={INTERVAL_PHASE.WORK}>Work</option><option value={INTERVAL_PHASE.REST}>Rest</option></Select></Field>
              <DurationInput seconds={stage.durationSeconds} durationUnit={stage.durationUnit} onChange={({ seconds, unit }) => updateStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, durationSeconds: seconds, durationUnit: unit } : item))} />
              <Field label="Label (optional)"><Input value={stage.label || ""} onChange={(event) => updateStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} /></Field>
            </div>
            <Button size="sm" variant="danger" onClick={() => updateStages(stages.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => updateStages([...stages, createIntervalStage({ phase: INTERVAL_PHASE.WORK, durationSeconds: 0, durationUnit: "seconds", sortOrder: stages.length })])}>Add work</Button>
          <Button variant="outline" onClick={() => updateStages([...stages, createIntervalStage({ phase: INTERVAL_PHASE.REST, durationSeconds: 0, durationUnit: "seconds", sortOrder: stages.length })])}>Add rest</Button>
        </div>
      </div>
    );
  }

  return <div className="text-sm text-slate-500">No configurable tracking option is available for this exercise.</div>;
}

export function buildQuickWorkout({ id, userId, name, exercises, date, startedAt = new Date().toISOString() }) {
  const title = name.trim() || "Quick Workout";
  const snapshots = exercises.flatMap((exercise, index) => {
    const base = { id: exercise.instanceId, exerciseId: exercise.exerciseId, exerciseNameSnapshot: exercise.exerciseNameSnapshot, exerciseType: exercise.exerciseType, loggingMethod: exercise.loggingMethod, prescription: exercise.prescription, notes: exercise.notes, sortOrder: index };
    if (supportsSides(exercise.exerciseType) && exercise.prescription?.side === SIDE.SEPARATE) {
      return [SIDE.LEFT, SIDE.RIGHT].map((side, sideIndex) => createWorkoutExerciseSnapshot({ ...base, id: `${exercise.instanceId}-${side}`, prescription: { ...exercise.prescription, side }, sortOrder: index * 2 + sideIndex }, {}));
    }
    return [createWorkoutExerciseSnapshot(base, {})];
  }).map((exercise, index) => ({ ...exercise, sortOrder: index }));
  return { id, userId, date, createdAt: null, updatedAt: null, completedAt: null, startedAt, status: WORKOUT_STATUS.IN_PROGRESS, sourceType: "one_off", name: title, sessionNameSnapshot: title, exercises: snapshots, notes: "" };
}

export default function QuickWorkoutBuilder({ exercises, trainingMode = "gym", onCancel, onStart }) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState(null);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const available = useMemo(() => filterExerciseLibrary(exercises, { query }), [exercises, query]);

  const update = (index, value) => setSelected((items) => items.map((item, itemIndex) => itemIndex === index ? value : item));
  const chooseExercise = (definition) => {
    if (replaceIndex !== null) {
      setSelected((items) => items.map((item, index) => index === replaceIndex ? { ...createSelectedExercise(definition, index), instanceId: item.instanceId } : item));
    } else {
      setSelected((items) => [...items, createSelectedExercise(definition, items.length)]);
    }
    setReplaceIndex(null);
    setPickerOpen(false);
    setQuery("");
  };
  const moveExercise = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex === null) return;
    setSelected((items) => {
      const next = items.slice();
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
    setDraggingIndex(toIndex);
  };

  return (
    <div className="space-y-5">
      <button type="button" className="text-sm font-medium text-slate-600" onClick={onCancel}>← Workout options</button>
      <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-md">
        <div>
          <h1 className="text-2xl font-semibold">Build a Quick Workout</h1>
          <p className="mt-1 text-sm text-slate-500">Configure this workout independently. Your Programme and Exercise Library will not be changed.</p>
        </div>
        <Field label="Workout name (optional)"><Input value={name} placeholder="Quick Workout" onChange={(event) => setName(event.target.value)} /></Field>

        <div className="space-y-3">
          {selected.map((exercise, index) => (
            <div
              key={exercise.instanceId}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => moveExercise(draggingIndex, index)}
              className="space-y-3 rounded-xl border border-slate-200 bg-white p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-start gap-2">
                  <button type="button" draggable onDragStart={() => setDraggingIndex(index)} onDragEnd={() => setDraggingIndex(null)} className="cursor-grab rounded p-1 text-slate-400" aria-label={`Drag ${exercise.exerciseNameSnapshot}`}><GripVertical className="h-5 w-5" /></button>
                  <div><div className="font-semibold">{exercise.exerciseNameSnapshot}</div><div className="text-sm text-slate-500">{planPrescriptionSummary(exercise)}</div></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setReplaceIndex(index); setPickerOpen(true); setQuery(""); }}>Change exercise</Button>
                  <Button size="sm" variant="danger" onClick={() => setSelected((items) => items.filter((_, itemIndex) => itemIndex !== index).map((item) => item))}><Trash2 className="mr-1 h-4 w-4" /> Remove</Button>
                </div>
              </div>
              <QuickExerciseSetupEditor exercise={exercise} trainingMode={trainingMode} onChange={(value) => update(index, value)} />
              <Field label="Notes"><Textarea value={exercise.notes || ""} onChange={(event) => update(index, { ...exercise, notes: event.target.value })} /></Field>
            </div>
          ))}
        </div>

        {pickerOpen ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3">
            <div className="mb-3 flex items-center justify-between"><strong>{replaceIndex !== null ? "Change exercise" : "Exercise picker"}</strong><Button size="sm" variant="outline" onClick={() => { setPickerOpen(false); setReplaceIndex(null); }}>Close</Button></div>
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><Input className="h-12 rounded-xl pl-10 text-base" autoFocus aria-label="Search exercises" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exercises" /></div>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {available.length ? available.map((libraryExercise) => <div key={libraryExercise.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div className="min-w-0"><div className="truncate font-medium">{libraryExercise.name}</div><div className="text-xs text-slate-500">{TYPE_LABELS[libraryExercise.exerciseType || libraryExercise.trackingType] || "Strength"}</div></div><Button size="sm" onClick={() => chooseExercise(libraryExercise)}>{replaceIndex !== null ? "Use" : "Add"}</Button></div>) : <div className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">No matching exercises.</div>}
            </div>
          </div>
        ) : null}

        <Button variant="outline" onClick={() => { setPickerOpen(true); setReplaceIndex(null); setQuery(""); }}><Plus className="mr-1 h-4 w-4" /> Add exercise</Button>
        {!selected.length ? <p className="text-sm text-slate-500">Select at least one exercise to start.</p> : null}
        <div className="flex flex-wrap gap-2"><Button disabled={!selected.length} onClick={() => onStart(name, selected)}>Start Workout</Button><Button variant="outline" onClick={onCancel}>Cancel</Button></div>
      </section>
    </div>
  );
}
