import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, ChevronUp, Dumbbell, Search, Trash2 } from "lucide-react";
import { db } from "../../firebase";
import Button from "../../components/ui/Button";
import { todayString } from "../../lib/domain/date";
import {
  EXERCISE_LOGGING_METHOD,
  EXERCISE_TYPE,
  filterExerciseLibrary,
  planPrescriptionSummary,
} from "../../lib/domain/plans";
import { SIDE } from "../../lib/domain/v2Models";
import {
  durationLabel,
  previousWeightsForExercise,
  resolveWorkoutExerciseSide,
  sessionWorkoutStatus,
  workoutExerciseSideLabel,
} from "../../lib/domain/workoutDisplay";
import {
  addRecordedSet,
  completeWorkout,
  createDebouncedSaver,
  createInProgressWorkout,
  createOneOffWorkout,
  isMeaningfulWorkout,
  removeRecordedSet,
  resumeWorkout,
  updateRecordedSet,
} from "../../lib/domain/workoutSession";
import {
  createInProgressWorkoutDocument,
  deleteWorkoutDocument,
  finishWorkoutDocument,
  subscribeExerciseDefinitions,
  subscribePlans,
  subscribeWorkouts,
  updateInProgressWorkoutDocument,
} from "../../lib/firebase/planRepository";
import { makeId } from "../../lib/domain/legacyWorkouts";

const noop = () => {};
const defaultRepository = {
  subscribePlans,
  subscribeWorkouts,
  subscribeExerciseDefinitions,
  createInProgressWorkoutDocument,
  updateInProgressWorkoutDocument,
  finishWorkoutDocument,
  deleteWorkoutDocument,
};
const ordered = (items = []) => items.slice().sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
const titleFor = (workout) => workout.name || workout.sessionNameSnapshot || "Workout";
const supportsSides = (exercise) => [EXERCISE_TYPE.STRENGTH, EXERCISE_TYPE.BALANCE].includes(exercise?.exerciseType);

function cleanUnsupportedSideExercise(exercise) {
  if (supportsSides(exercise)) return exercise;
  const prescription = { ...(exercise.prescription || {}) };
  delete prescription.side;
  return { ...exercise, id: String(exercise.id || "").replace(/-(left|right)$/, ""), sideSnapshot: undefined, prescription };
}

export function normalizeWorkoutForDisplay(saved) {
  if (!saved?.exercises?.length) return saved;
  const seen = new Set();
  const exercises = [];
  ordered(saved.exercises).forEach((original) => {
    const exercise = cleanUnsupportedSideExercise(original);
    const key = supportsSides(exercise) ? exercise.id : `${exercise.exerciseId || exercise.exerciseNameSnapshot}:${exercise.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    exercises.push({ ...exercise, sortOrder: exercises.length });
  });
  return { ...saved, exercises };
}

function programmeSummary(exercise) {
  const summary = planPrescriptionSummary(exercise);
  const standardSide = resolveWorkoutExerciseSide(exercise) === SIDE.BOTH;
  return standardSide && supportsSides(exercise) ? summary.replace(/\s+both$/i, "") : summary;
}

export function OneOffWorkoutBuilder({ exercises, onCancel, onStart }) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const available = filterExerciseLibrary(exercises, { query });
  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= selected.length) return;
    const next = selected.slice();
    [next[index], next[target]] = [next[target], next[index]];
    setSelected(next);
  };

  return (
    <div className="space-y-5">
      <button type="button" className="text-sm font-medium text-slate-600" onClick={onCancel}>← Workout options</button>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold">Build a One-off Workout</h1>
        <p className="mt-1 text-sm text-slate-500">Choose exercises from your Exercise Library. Your programme will not be changed.</p>
        <label className="mt-5 block text-sm font-medium">Workout name (optional)<input className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3" value={name} placeholder="One-off Workout" onChange={(event) => setName(event.target.value)} /></label>
        <label className="mt-4 block text-sm font-medium">Search Exercise Library<span className="relative mt-1 block"><Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><input className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exercises" /></span></label>
        <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">{available.map((exercise) => <button type="button" key={exercise.id} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-slate-200 px-3 text-left" onClick={() => setSelected((items) => [...items, exercise])}><span>{exercise.name}</span><span className="text-sm font-medium text-emerald-700">Add</span></button>)}</div>
        <h2 className="mt-5 font-semibold">Selected exercises ({selected.length})</h2>
        <div className="mt-2 space-y-2">{selected.map((exercise, index) => <div key={`${exercise.id}-${index}`} className="flex min-h-12 items-center gap-2 rounded-xl bg-slate-50 px-3"><span className="min-w-0 flex-1 font-medium">{exercise.name}</span><button type="button" aria-label={`Move ${exercise.name} up`} disabled={!index} onClick={() => move(index, -1)} className="p-2 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button><button type="button" aria-label={`Move ${exercise.name} down`} disabled={index === selected.length - 1} onClick={() => move(index, 1)} className="p-2 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button><button type="button" aria-label={`Remove ${exercise.name}`} onClick={() => setSelected((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="p-2 text-red-600"><Trash2 className="h-4 w-4" /></button></div>)}</div>
        {!selected.length ? <p className="mt-3 text-sm text-slate-500">Select at least one exercise to start.</p> : null}
        <div className="mt-6 flex flex-wrap gap-2"><Button disabled={!selected.length} onClick={() => onStart(name, selected)}>Start Workout</Button><Button variant="outline" onClick={onCancel}>Cancel</Button></div>
      </section>
    </div>
  );
}

function fieldsFor(method) {
  return {
    reps: [EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT].includes(method),
    weight: method === EXERCISE_LOGGING_METHOD.REPS_WEIGHT,
    time: method === EXERCISE_LOGGING_METHOD.TIME,
  };
}

function SetTick({ checked, label, onClick }) {
  return <button type="button" aria-label={label} onClick={onClick} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition ${checked ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-transparent hover:border-emerald-500"}`}><Check className="h-4 w-4" /></button>;
}

function RepsInput({ exercise, set, onChange }) {
  const prescribed = set.prescribedReps || {};
  const prescribedValue = prescribed.type === "range" ? prescribed.min : prescribed.value ?? "";
  const value = set.rawReps ?? set.actualReps ?? prescribedValue;
  if (prescribed.type === "range") {
    return <select aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} reps`} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-slate-900" value={value} onChange={(event) => onChange(exercise.id, set.id, "actualReps", event.target.value)}>{Array.from({ length: Number(prescribed.max) - Number(prescribed.min) + 1 }, (_, index) => Number(prescribed.min) + index).map((rep) => <option key={rep} value={rep}>{rep}</option>)}</select>;
  }
  return <input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} reps`} inputMode="numeric" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-slate-900" value={value} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(exercise.id, set.id, "actualReps", event.target.value)} />;
}

function displaySideLabel(exercise, hideExerciseName) {
  const label = workoutExerciseSideLabel(exercise);
  if (!hideExerciseName) return label;
  if (resolveWorkoutExerciseSide(exercise) === SIDE.LEFT) return "Left";
  if (resolveWorkoutExerciseSide(exercise) === SIDE.RIGHT) return "Right";
  return label;
}

export function ExerciseCard({ exercise, oneOff, onChange, onAddSet, onRemoveSet, onRemoveExercise, onMove, index, total, hideExerciseName = false }) {
  const fields = fieldsFor(exercise.loggingMethod);
  const side = displaySideLabel(exercise, hideExerciseName);
  const isProgrammeWorkout = !oneOff;
  const isWeighted = exercise.loggingMethod === EXERCISE_LOGGING_METHOD.REPS_WEIGHT;
  const isRepsOnly = exercise.loggingMethod === EXERCISE_LOGGING_METHOD.REPS;
  const isSetTickExercise = isProgrammeWorkout && !isWeighted && (isRepsOnly || fields.time) && (exercise.recordedSets || []).length > 0;
  const isTask = exercise.loggingMethod === EXERCISE_LOGGING_METHOD.COMPLETED;
  const stages = ordered(exercise.prescription?.stages || exercise.prescription?.intervals || []);
  const prescribedDuration = durationLabel(exercise.prescription?.targetDurationSeconds, exercise.prescription?.durationUnit) || "—";
  const toggleCompleted = () => onChange(exercise.id, null, "completed", !exercise.completed);

  function CompactProgrammeContent() {
    if (stages.length) return <div className="min-w-0 flex-1 space-y-1">{stages.map((stage, stageIndex) => <div key={stage.id || stageIndex} className="text-sm font-medium text-slate-700">{`${durationLabel(stage.durationSeconds, stage.durationUnit) || "—"} ${stage.phase === "rest" ? "rest" : "work"}`}</div>)}</div>;
    return <span className="min-w-0 flex-1 text-sm font-medium text-slate-700">{programmeSummary(exercise) || (isTask ? "Complete task" : "Complete exercise")}</span>;
  }

  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 ${hideExerciseName ? "shadow-none" : ""}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {!hideExerciseName ? <h2 className="font-semibold">{exercise.exerciseNameSnapshot}</h2> : null}
          {side || exercise.prescription?.targetReps?.type === "range" ? <p className={hideExerciseName ? "text-sm font-semibold text-slate-700" : "text-xs text-slate-500"}>{[side, exercise.prescription?.targetReps?.type === "range" ? `Range: ${exercise.prescription.targetReps.min}–${exercise.prescription.targetReps.max} reps` : null].filter(Boolean).join(" · ")}</p> : null}
          {exercise.programmeNoteSnapshot ? <p className="mt-1 text-xs text-slate-500">{exercise.programmeNoteSnapshot}</p> : null}
        </div>
        {!hideExerciseName ? <><button type="button" aria-label={`Move ${exercise.exerciseNameSnapshot} up`} disabled={!index} onClick={() => onMove(index, -1)} className="p-2 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button><button type="button" aria-label={`Move ${exercise.exerciseNameSnapshot} down`} disabled={index === total - 1} onClick={() => onMove(index, 1)} className="p-2 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button></> : null}
        {oneOff ? <button type="button" onClick={() => onRemoveExercise(exercise.id)} className="min-h-10 px-2 text-sm font-medium text-red-600">Remove</button> : null}
      </div>

      {isSetTickExercise ? <div className="mt-3 space-y-2">{(exercise.recordedSets || []).map((set) => <div key={set.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)_2rem] items-center gap-3 rounded-xl bg-slate-50 p-3"><span className="text-sm font-medium">Set {set.setNumber}</span>{isRepsOnly ? <div className="flex min-w-0 items-center gap-2"><RepsInput exercise={exercise} set={set} onChange={onChange} /><span className="shrink-0 text-sm font-medium text-slate-600">reps</span></div> : <span className="text-sm font-medium text-slate-700">{prescribedDuration}</span>}<SetTick checked={Boolean(set.completed)} label={set.completed ? `Mark set ${set.setNumber} incomplete` : `Mark set ${set.setNumber} complete`} onClick={() => onChange(exercise.id, set.id, "setCompleted", !set.completed)} /></div>)}</div>
      : isProgrammeWorkout && !isWeighted && !isRepsOnly ? <div className="mt-3 flex min-h-12 items-center gap-3 rounded-xl bg-slate-50 px-3 py-2"><CompactProgrammeContent /><SetTick checked={exercise.completed} label={exercise.completed ? `Mark ${exercise.exerciseNameSnapshot} incomplete` : `Mark ${exercise.exerciseNameSnapshot} complete`} onClick={toggleCompleted} /></div>
      : isTask && oneOff ? <div className="mt-3 flex min-h-12 items-center gap-3 rounded-xl bg-slate-50 px-3 py-2"><CompactProgrammeContent /><SetTick checked={exercise.completed} label={exercise.completed ? `Mark ${exercise.exerciseNameSnapshot} incomplete` : `Mark ${exercise.exerciseNameSnapshot} complete`} onClick={toggleCompleted} /></div>
      : <div className="mt-3 space-y-2">{(exercise.recordedSets || []).map((set) => <div key={set.id} className={`grid items-end gap-2 rounded-xl bg-slate-50 p-3 ${isWeighted ? "grid-cols-[3.25rem_minmax(0,1fr)_minmax(0,1fr)]" : "grid-cols-[3.25rem_minmax(0,1fr)]"}`}><span className="pb-2 text-sm font-medium">Set {set.setNumber}</span>{fields.reps ? <label className="min-w-0 text-xs font-medium">Reps<RepsInput exercise={exercise} set={set} onChange={onChange} /></label> : null}{isWeighted ? <label className="min-w-0 text-xs font-medium">Weight (kg)<input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} weight`} inputMode="decimal" className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-slate-900" value={set.rawWeight ?? set.weight ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(exercise.id, set.id, "weight", event.target.value)} /></label> : null}{oneOff && exercise.recordedSets.length > 1 ? <button type="button" className="col-start-2 min-h-10 justify-self-start text-sm text-red-600" onClick={() => onRemoveSet(exercise.id, set.id)}>Remove</button> : null}</div>)}{oneOff ? <button type="button" className="min-h-11 text-sm font-medium text-emerald-700" onClick={() => onAddSet(exercise.id)}>+ Add set</button> : null}</div>}
    </section>
  );
}

function buildWorkoutGroups(list) {
  const groups = [];
  for (let index = 0; index < list.length; index += 1) {
    const exercise = list[index];
    const side = resolveWorkoutExerciseSide(exercise);
    const next = list[index + 1];
    const nextSide = resolveWorkoutExerciseSide(next);
    const pair = supportsSides(exercise) && next && exercise.exerciseId === next.exerciseId && ((side === SIDE.LEFT && nextSide === SIDE.RIGHT) || (side === SIDE.RIGHT && nextSide === SIDE.LEFT));
    if (pair) { groups.push({ type: "separate", exercises: side === SIDE.LEFT ? [exercise, next] : [next, exercise] }); index += 1; }
    else groups.push({ type: "single", exercises: [exercise] });
  }
  return groups;
}

export function WorkoutForm({ workout, saveStatus, finishing, finishError, onBack, onChange, onAddSet, onRemoveSet, onRemoveExercise, onReorder, onNotes, onFinish, onDiscard }) {
  const list = ordered(workout.exercises);
  const groups = buildWorkoutGroups(list);
  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const next = list.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next.map((item, itemIndex) => ({ ...item, sortOrder: itemIndex })));
  };
  return <div className="space-y-5"><button type="button" className="text-sm font-medium text-slate-600" onClick={onBack}>← Workout options</button><section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="flex justify-between gap-3"><div><p className="text-sm font-medium text-emerald-700">Workout in progress · {workout.sourceType === "one_off" ? "One-off Workout" : "Programme Workout"}</p><h1 className="text-2xl font-semibold">{titleFor(workout)}</h1></div><span className="text-xs text-slate-500">{saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Could not save" : ""}</span></div><label className="mt-4 block text-sm font-medium">Workout date<input type="date" readOnly className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3" value={workout.date || ""} /></label><div className="mt-5 space-y-3">{groups.map((group) => { if (group.type === "separate") { const firstIndex = list.findIndex((item) => item.id === group.exercises[0].id); return <section key={`${group.exercises[0].id}-separate`} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-semibold">{group.exercises[0].exerciseNameSnapshot}</h2><div className="flex"><button type="button" disabled={!firstIndex} onClick={() => move(firstIndex, -1)} className="p-2 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button><button type="button" disabled={firstIndex + 1 >= list.length - 1} onClick={() => move(firstIndex + 1, 1)} className="p-2 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button></div></div><div className="grid gap-3 md:grid-cols-2">{group.exercises.map((exercise) => <ExerciseCard key={exercise.id} exercise={exercise} oneOff={false} index={firstIndex} total={list.length} onChange={onChange} onAddSet={onAddSet} onRemoveSet={onRemoveSet} onRemoveExercise={onRemoveExercise} onMove={move} hideExerciseName />)}</div></section>; } const exercise = group.exercises[0]; const exerciseIndex = list.findIndex((item) => item.id === exercise.id); return <ExerciseCard key={exercise.id} exercise={exercise} oneOff={workout.sourceType === "one_off"} index={exerciseIndex} total={list.length} onChange={onChange} onAddSet={onAddSet} onRemoveSet={onRemoveSet} onRemoveExercise={onRemoveExercise} onMove={move} />; })}</div><label className="mt-5 block text-sm font-medium">Workout notes<textarea className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 p-3" value={workout.notes || ""} onChange={(event) => onNotes(event.target.value)} /></label>{finishError ? <p className="mt-3 text-sm font-medium text-red-600">{finishError}</p> : null}<div className="mt-6 flex flex-col gap-3 sm:flex-row"><Button disabled={finishing} onClick={onFinish}>{finishing ? "Finishing…" : "Complete Workout"}</Button><Button variant="danger" disabled={finishing} onClick={onDiscard}>Discard Workout</Button></div></section></div>;
}

export function DiscardWorkoutDialog({ discarding, error, onCancel, onConfirm }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-5"><h2 className="text-lg font-semibold">Discard Workout?</h2><p className="mt-2 text-sm text-slate-600">This permanently deletes this unfinished workout.</p>{error ? <p className="mt-2 text-red-600">{error}</p> : null}<div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onCancel}>Cancel</Button><Button variant="danger" disabled={discarding} onClick={onConfirm}>{discarding ? "Discarding…" : "Discard Workout"}</Button></div></div></div>; }
export function WeightCard({ exercise, onToggle = noop, onWeight = noop, index = 0, total = 1, onNudge = noop }) { return <ExerciseCard exercise={exercise} index={index} total={total} oneOff={false} onChange={(exerciseId, setId, field, value) => field === "completed" ? onToggle(exerciseId) : field === "weight" ? onWeight(exerciseId, setId, value) : noop()} onAddSet={noop} onRemoveSet={noop} onRemoveExercise={noop} onMove={(position, direction) => onNudge(position, direction)} />; }
export function UnfinishedWorkoutDialog({ unfinishedName, requestedName, confirming, discarding, error, onContinue, onRequestDiscard, onDiscard, onBack, onCancel }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-5"><h2 className="text-lg font-semibold">Unfinished workout in progress</h2><p className="mt-2">{unfinishedName}</p>{requestedName ? <p>Start instead: {requestedName}</p> : null}{error ? <p>{error}</p> : null}{confirming ? <><p className="mt-4 text-red-700">Permanently discard this unfinished workout?</p><Button variant="outline" onClick={onBack}>Back</Button><Button variant="danger" disabled={discarding} onClick={onDiscard}>Discard and start</Button></> : <div className="mt-4 flex flex-col gap-2"><Button onClick={onContinue}>Continue workout</Button><Button variant="danger" onClick={onRequestDiscard}>Discard unfinished workout and start this session</Button><Button variant="outline" onClick={onCancel}>Cancel</Button></div>}</div></div>; }
export function ProgrammeSessionList({ programme, sessions, workouts, today, onSelect }) { return <section className="rounded-3xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold">Programme Workout</h2><p className="text-sm text-slate-500">{programme.name}</p><div className="mt-3 space-y-2">{sessions.map((session) => { const status = sessionWorkoutStatus(programme.id, session.id, workouts, today); return <button type="button" key={session.id} onClick={() => onSelect(session)} className="flex min-h-14 w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-left"><span><b className="block">{session.name}</b><span className="text-sm text-slate-500">{session.exercises?.length || 0} exercises{status.label ? ` · ${status.label}` : ""}</span></span><ChevronRight className="h-5 w-5" /></button>; })}</div></section>; }

export default function WorkoutScreen({ user, repository = defaultRepository, intent, onIntentHandled = noop, onFinished = noop, onDiscarded = noop }) {
  const [plans, setPlans] = useState([]); const [workouts, setWorkouts] = useState([]); const [library, setLibrary] = useState([]); const [workout, setWorkout] = useState(null); const [builder, setBuilder] = useState(false); const [saveStatus, setSaveStatus] = useState(""); const [finishing, setFinishing] = useState(false); const [finishError, setFinishError] = useState(""); const [discardOpen, setDiscardOpen] = useState(false); const [discarding, setDiscarding] = useState(false); const handled = useRef(null);
  useEffect(() => repository.subscribePlans(db, user.uid, setPlans, noop), [repository, user.uid]); useEffect(() => repository.subscribeWorkouts(db, user.uid, setWorkouts, noop), [repository, user.uid]); useEffect(() => repository.subscribeExerciseDefinitions(db, user.uid, setLibrary, noop), [repository, user.uid]);
  const saver = useMemo(() => createDebouncedSaver((value) => repository.updateInProgressWorkoutDocument(db, user.uid, value), 500, setSaveStatus), [repository, user.uid]); useEffect(() => () => { saver.flush().catch(noop); }, [saver]); useEffect(() => { if (workout) saver.schedule(workout); }, [saver, workout]);
  const programme = useMemo(() => plans.filter((plan) => plan.isActive && !plan.isArchived)[0], [plans]); const unfinished = workouts.find((item) => item.status === "in_progress");
  const syncSavedWithProgramme = useCallback((saved) => { if (!saved || saved.sourceType !== "programme" || !programme || saved.planId !== programme.id) return saved; const session = programme.sessions?.find((item) => item.id === saved.sessionId); if (!session) return saved; const previous = Object.fromEntries((session.exercises || []).map((exercise) => [exercise.id, previousWeightsForExercise(workouts.filter((item) => item.status === "completed"), exercise)])); return resumeWorkout(saved, createInProgressWorkout({ id: saved.id, userId: user.uid, programme, session, date: saved.date || todayString(), previousWeightsByExercise: previous, createdAt: saved.createdAt || saved.startedAt || new Date().toISOString() })); }, [programme, user.uid, workouts]);
  const openSaved = useCallback((saved) => { setWorkout(normalizeWorkoutForDisplay(syncSavedWithProgramme(saved))); setBuilder(false); onIntentHandled(); }, [onIntentHandled, syncSavedWithProgramme]);
  const startProgramme = async (session) => { if (unfinished) return openSaved(unfinished); const previous = Object.fromEntries((session.exercises || []).map((exercise) => [exercise.id, previousWeightsForExercise(workouts.filter((item) => item.status === "completed"), exercise)])); const next = createInProgressWorkout({ id: `workout-${makeId()}`, userId: user.uid, programme, session, date: todayString(), previousWeightsByExercise: previous, createdAt: new Date().toISOString() }); await repository.createInProgressWorkoutDocument(db, user.uid, next); setWorkouts((all) => [...all, next]); openSaved(next); };
  const startOneOff = async (name, exercises) => { if (unfinished) return openSaved(unfinished); const next = createOneOffWorkout({ id: `workout-${makeId()}`, userId: user.uid, name, exercises, date: todayString() }); await repository.createInProgressWorkoutDocument(db, user.uid, next); setWorkouts((all) => [...all, next]); openSaved(next); };
  useEffect(() => { if (!intent || handled.current === intent.token) return; if (intent.mode === "continue" && unfinished) { handled.current = intent.token; openSaved(unfinished); } else if (intent.mode === "one_off") { handled.current = intent.token; unfinished ? openSaved(unfinished) : setBuilder(true); } else if (intent.mode === "session" && programme) { const session = programme.sessions?.find((item) => item.id === intent.sessionId); if (session) { handled.current = intent.token; startProgramme(session); } } }, [intent, unfinished, programme]); // eslint-disable-line react-hooks/exhaustive-deps
  const change = (exerciseId, setId, field, value) => setWorkout((current) => { if (field === "completed") return { ...current, exercises: current.exercises.map((exercise) => exercise.id === exerciseId ? { ...exercise, completed: value } : exercise) }; if (field === "setCompleted") return { ...current, exercises: current.exercises.map((exercise) => { if (exercise.id !== exerciseId) return exercise; const recordedSets = (exercise.recordedSets || []).map((set) => set.id === setId ? { ...set, completed: value } : set); return { ...exercise, recordedSets, completed: recordedSets.some((set) => set.completed) }; }) }; return updateRecordedSet(current, exerciseId, setId, field, value); });
  const finish = async () => { if (!isMeaningfulWorkout(workout)) { setFinishError("Record at least one completed entry before completing this workout."); return; } setFinishing(true); try { const now = new Date(); const started = new Date(workout.startedAt); const latest = { ...workout, durationSeconds: Number.isNaN(started.getTime()) ? undefined : Math.max(0, Math.round((now - started) / 1000)) }; const completed = await completeWorkout(latest, saver, (item) => repository.finishWorkoutDocument(db, user.uid, item)); setWorkout(null); onFinished(completed); } catch { setFinishError("Could not complete workout. Please try again."); } finally { setFinishing(false); } };
  const discard = async () => { setDiscarding(true); try { await saver.cancel(); await repository.deleteWorkoutDocument(db, user.uid, workout.id); setWorkouts((items) => items.filter((item) => item.id !== workout.id)); setWorkout(null); setDiscardOpen(false); onDiscarded(); } finally { setDiscarding(false); } };
  const discardFromOverview = async () => { if (!unfinished || !window.confirm("Discard this unfinished workout? This cannot be undone.")) return; setDiscarding(true); try { await repository.deleteWorkoutDocument(db, user.uid, unfinished.id); setWorkouts((items) => items.filter((item) => item.id !== unfinished.id)); onDiscarded(); } finally { setDiscarding(false); } };
  if (workout) return <><WorkoutForm workout={workout} saveStatus={saveStatus} finishing={finishing} finishError={finishError} onBack={() => setWorkout(null)} onChange={change} onAddSet={(id) => setWorkout((current) => addRecordedSet(current, id))} onRemoveSet={(id, setId) => setWorkout((current) => removeRecordedSet(current, id, setId))} onRemoveExercise={(id) => setWorkout((current) => ({ ...current, exercises: current.exercises.filter((exercise) => exercise.id !== id) }))} onReorder={(exercises) => setWorkout((current) => ({ ...current, exercises }))} onNotes={(notes) => setWorkout((current) => ({ ...current, notes }))} onFinish={finish} onDiscard={() => setDiscardOpen(true)} />{discardOpen ? <DiscardWorkoutDialog discarding={discarding} onCancel={() => setDiscardOpen(false)} onConfirm={discard} /> : null}</>;
  if (builder) return <OneOffWorkoutBuilder exercises={library} onCancel={() => setBuilder(false)} onStart={startOneOff} />;
  return <div className="space-y-5">{unfinished ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h2 className="font-semibold">Workout in progress</h2><p className="text-sm text-slate-600">{titleFor(unfinished)}</p><div className="mt-3 flex flex-wrap gap-2"><Button onClick={() => openSaved(unfinished)}>Continue Workout</Button><Button variant="danger" disabled={discarding} onClick={discardFromOverview}>{discarding ? "Discarding…" : "Discard Workout"}</Button></div></section> : <><Button className="w-full py-3" variant="outline" onClick={() => setBuilder(true)}>One-off Workout</Button>{programme ? <ProgrammeSessionList programme={programme} sessions={ordered(programme.sessions)} workouts={workouts} today={todayString()} onSelect={startProgramme} /> : <section className="rounded-2xl border border-dashed border-slate-300 p-6 text-center"><Dumbbell className="mx-auto text-slate-400" /><p className="mt-2 font-semibold">No active programme</p><p className="text-sm text-slate-500">You can still start a One-off Workout.</p></section>}</>}</div>;
}
