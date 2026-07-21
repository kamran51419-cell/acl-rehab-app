import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Search, Trash2 } from "lucide-react";
import Button from "../../components/ui/Button";
import {
  EXERCISE_LOGGING_METHOD,
  EXERCISE_TYPE,
  EXERCISE_TYPE_OPTIONS,
  INTERVAL_PHASE,
  createDefaultPrescription,
  createIntervalStage,
  defaultLoggingMethodForExerciseType,
  filterExerciseLibrary,
  loggingMethodsForExerciseType,
} from "../../lib/domain/plans";
import { SIDE, WORKOUT_STATUS } from "../../lib/domain/v2Models";
import { createWorkoutExerciseSnapshot } from "../../lib/domain/workoutSession";
import { makeId } from "../../lib/domain/legacyWorkouts";

const TYPE_LABELS = {
  [EXERCISE_TYPE.STRENGTH]: "Strength",
  [EXERCISE_TYPE.CARDIO]: "Cardio",
  [EXERCISE_TYPE.PLYOMETRIC]: "Plyometric",
  [EXERCISE_TYPE.BALANCE]: "Balance",
  [EXERCISE_TYPE.MOBILITY]: "Mobility",
  [EXERCISE_TYPE.STRETCH]: "Stretch",
  [EXERCISE_TYPE.OTHER]: "Other",
};

const METHOD_LABELS = {
  [EXERCISE_LOGGING_METHOD.REPS]: "Reps",
  [EXERCISE_LOGGING_METHOD.REPS_WEIGHT]: "Reps + Weight",
  [EXERCISE_LOGGING_METHOD.TIME]: "Time",
  [EXERCISE_LOGGING_METHOD.DISTANCE]: "Distance",
  [EXERCISE_LOGGING_METHOD.TIME_DISTANCE]: "Time + Distance",
  [EXERCISE_LOGGING_METHOD.COMPLETED]: "Task",
  [EXERCISE_LOGGING_METHOD.INTERVALS]: "Intervals",
};

const inputClass = "mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm";

function supportsSides(type) {
  return [EXERCISE_TYPE.STRENGTH, EXERCISE_TYPE.BALANCE].includes(type);
}

function configurableMethods(type) {
  const methods = loggingMethodsForExerciseType(type);
  return methods.length ? methods : [EXERCISE_LOGGING_METHOD.COMPLETED];
}

function createSelectedExercise(definition, index) {
  const exerciseType = definition.exerciseType || EXERCISE_TYPE.STRENGTH;
  const loggingMethod = defaultLoggingMethodForExerciseType(exerciseType);
  return {
    instanceId: `quick-${makeId()}-${index}`,
    exerciseId: definition.id,
    exerciseNameSnapshot: definition.name,
    exerciseType,
    loggingMethod,
    prescription: createDefaultPrescription(exerciseType, loggingMethod),
  };
}

function NumberField({ label, value, onChange, decimal = false }) {
  return <label className="block text-sm font-medium">{label}<input className={inputClass} inputMode={decimal ? "decimal" : "numeric"} value={value ?? ""} onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))} /></label>;
}

function DurationField({ prescription, onChange }) {
  const unit = prescription.durationUnit || "seconds";
  const displayValue = unit === "minutes" ? Number(prescription.targetDurationSeconds || 0) / 60 : prescription.targetDurationSeconds ?? "";
  return <div className="grid grid-cols-[1fr_120px] gap-2"><NumberField label="Time" value={displayValue} onChange={(value) => onChange({ ...prescription, targetDurationSeconds: value === "" ? "" : Number(value) * (unit === "minutes" ? 60 : 1) })} /><label className="block text-sm font-medium">Unit<select className={inputClass} value={unit} onChange={(event) => { const nextUnit = event.target.value; const seconds = Number(prescription.targetDurationSeconds || 0); onChange({ ...prescription, durationUnit: nextUnit, targetDurationSeconds: nextUnit === "minutes" ? Math.max(60, Math.round(seconds / 60) * 60) : seconds }); }}><option value="seconds">Seconds</option><option value="minutes">Minutes</option></select></label></div>;
}

function ExerciseConfiguration({ exercise, trainingMode, onChange }) {
  const methods = configurableMethods(exercise.exerciseType);
  const prescription = exercise.prescription || {};
  const updatePrescription = (next) => onChange({ ...exercise, prescription: next });
  const changeType = (exerciseType) => {
    const loggingMethod = defaultLoggingMethodForExerciseType(exerciseType);
    onChange({ ...exercise, exerciseType, loggingMethod, prescription: createDefaultPrescription(exerciseType, loggingMethod) });
  };
  const changeMethod = (loggingMethod) => onChange({ ...exercise, loggingMethod, prescription: createDefaultPrescription(exercise.exerciseType, loggingMethod) });
  const setBased = [EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT, EXERCISE_LOGGING_METHOD.TIME, EXERCISE_LOGGING_METHOD.DISTANCE, EXERCISE_LOGGING_METHOD.TIME_DISTANCE].includes(exercise.loggingMethod);
  const repBased = [EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT].includes(exercise.loggingMethod);
  const timeBased = [EXERCISE_LOGGING_METHOD.TIME, EXERCISE_LOGGING_METHOD.TIME_DISTANCE].includes(exercise.loggingMethod);
  const distanceBased = [EXERCISE_LOGGING_METHOD.DISTANCE, EXERCISE_LOGGING_METHOD.TIME_DISTANCE].includes(exercise.loggingMethod);

  return <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm font-medium">Exercise type<select className={inputClass} value={exercise.exerciseType} onChange={(event) => changeType(event.target.value)}>{EXERCISE_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}</select></label>
      <label className="block text-sm font-medium">Track by<select className={inputClass} value={exercise.loggingMethod} onChange={(event) => changeMethod(event.target.value)}>{methods.map((method) => <option key={method} value={method}>{METHOD_LABELS[method]}</option>)}</select></label>
    </div>
    {supportsSides(exercise.exerciseType) ? <label className="block text-sm font-medium">Side<select className={inputClass} value={prescription.side || SIDE.BOTH} onChange={(event) => updatePrescription({ ...prescription, side: event.target.value })}><option value={SIDE.BOTH}>Standard</option><option value={SIDE.SEPARATE}>Left & Right</option>{trainingMode === "rehab" ? <><option value={SIDE.LEFT}>Left only</option><option value={SIDE.RIGHT}>Right only</option></> : null}</select></label> : null}
    {setBased ? <NumberField label="Sets" value={prescription.targetSets ?? 1} onChange={(targetSets) => updatePrescription({ ...prescription, targetSets })} /> : null}
    {repBased ? <NumberField label="Reps" value={prescription.targetReps?.value ?? 10} onChange={(value) => updatePrescription({ ...prescription, targetReps: { type: "fixed", value } })} /> : null}
    {timeBased ? <DurationField prescription={prescription} onChange={updatePrescription} /> : null}
    {distanceBased ? <NumberField label="Distance (km)" decimal value={prescription.targetDistance ?? ""} onChange={(targetDistance) => updatePrescription({ ...prescription, targetDistance })} /> : null}
    {exercise.loggingMethod === EXERCISE_LOGGING_METHOD.INTERVALS ? <div className="space-y-2">{(prescription.stages || []).map((stage, stageIndex) => <div key={stage.id || stageIndex} className="grid grid-cols-[100px_1fr_110px_auto] items-end gap-2 rounded-xl bg-slate-50 p-3"><label className="block text-sm font-medium">Stage<select className={inputClass} value={stage.phase} onChange={(event) => updatePrescription({ ...prescription, stages: prescription.stages.map((item, index) => index === stageIndex ? { ...item, phase: event.target.value } : item) })}><option value={INTERVAL_PHASE.WORK}>Work</option><option value={INTERVAL_PHASE.REST}>Rest</option></select></label><NumberField label="Time" value={(stage.durationUnit || "seconds") === "minutes" ? Number(stage.durationSeconds || 0) / 60 : stage.durationSeconds} onChange={(value) => updatePrescription({ ...prescription, stages: prescription.stages.map((item, index) => index === stageIndex ? { ...item, durationSeconds: Number(value) * ((item.durationUnit || "seconds") === "minutes" ? 60 : 1) } : item) })} /><label className="block text-sm font-medium">Unit<select className={inputClass} value={stage.durationUnit || "seconds"} onChange={(event) => updatePrescription({ ...prescription, stages: prescription.stages.map((item, index) => index === stageIndex ? { ...item, durationUnit: event.target.value } : item) })}><option value="seconds">Seconds</option><option value="minutes">Minutes</option></select></label><button type="button" className="mb-1 p-2 text-red-600" onClick={() => updatePrescription({ ...prescription, stages: prescription.stages.filter((_, index) => index !== stageIndex) })}><Trash2 className="h-4 w-4" /></button></div>)}<div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => updatePrescription({ ...prescription, stages: [...(prescription.stages || []), createIntervalStage({ phase: INTERVAL_PHASE.WORK, durationSeconds: 60, sortOrder: prescription.stages?.length || 0 })] })}>Add work</Button><Button variant="outline" size="sm" onClick={() => updatePrescription({ ...prescription, stages: [...(prescription.stages || []), createIntervalStage({ phase: INTERVAL_PHASE.REST, durationSeconds: 60, sortOrder: prescription.stages?.length || 0 })] })}>Add rest</Button></div></div> : null}
  </div>;
}

export function buildQuickWorkout({ id, userId, name, exercises, date, startedAt = new Date().toISOString() }) {
  const title = name.trim() || "Quick Workout";
  const snapshots = exercises.flatMap((exercise, index) => {
    const base = { id: exercise.instanceId, exerciseId: exercise.exerciseId, exerciseNameSnapshot: exercise.exerciseNameSnapshot, exerciseType: exercise.exerciseType, loggingMethod: exercise.loggingMethod, prescription: exercise.prescription, sortOrder: index };
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
  const available = useMemo(() => filterExerciseLibrary(exercises, { query }), [exercises, query]);
  const move = (index, direction) => { const target = index + direction; if (target < 0 || target >= selected.length) return; const next = selected.slice(); [next[index], next[target]] = [next[target], next[index]]; setSelected(next); };
  const update = (index, value) => setSelected((items) => items.map((item, itemIndex) => itemIndex === index ? value : item));

  return <div className="space-y-5"><button type="button" className="text-sm font-medium text-slate-600" onClick={onCancel}>← Workout options</button><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h1 className="text-2xl font-semibold">Build a Quick Workout</h1><p className="mt-1 text-sm text-slate-500">Configure this workout independently. Your Programme and Exercise Library will not be changed.</p><label className="mt-5 block text-sm font-medium">Workout name (optional)<input className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3" value={name} placeholder="Quick Workout" onChange={(event) => setName(event.target.value)} /></label><label className="mt-4 block text-sm font-medium">Search Exercise Library<span className="relative mt-1 block"><Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><input className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exercises" /></span></label><div className="mt-3 max-h-56 space-y-2 overflow-y-auto">{available.map((exercise) => <button type="button" key={exercise.id} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-slate-200 px-3 text-left" onClick={() => setSelected((items) => [...items, createSelectedExercise(exercise, items.length)])}><span>{exercise.name}</span><span className="text-sm font-medium text-emerald-700">Add</span></button>)}</div><h2 className="mt-5 font-semibold">Selected exercises ({selected.length})</h2><div className="mt-2 space-y-3">{selected.map((exercise, index) => <div key={exercise.instanceId} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2"><span className="min-w-0 flex-1 font-semibold">{exercise.exerciseNameSnapshot}</span><button type="button" aria-label={`Move ${exercise.exerciseNameSnapshot} up`} disabled={!index} onClick={() => move(index, -1)} className="p-2 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button><button type="button" aria-label={`Move ${exercise.exerciseNameSnapshot} down`} disabled={index === selected.length - 1} onClick={() => move(index, 1)} className="p-2 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button><button type="button" aria-label={`Remove ${exercise.exerciseNameSnapshot}`} onClick={() => setSelected((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="p-2 text-red-600"><Trash2 className="h-4 w-4" /></button></div><ExerciseConfiguration exercise={exercise} trainingMode={trainingMode} onChange={(value) => update(index, value)} /></div>)}</div>{!selected.length ? <p className="mt-3 text-sm text-slate-500">Select at least one exercise to start.</p> : null}<div className="mt-6 flex flex-wrap gap-2"><Button disabled={!selected.length} onClick={() => onStart(name, selected)}>Start Workout</Button><Button variant="outline" onClick={onCancel}>Cancel</Button></div></section></div>;
}
