import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, ChevronUp, Dumbbell, Search, Trash2 } from "lucide-react";
import { db } from "../../firebase";
import Button from "../../components/ui/Button";
import { todayString } from "../../lib/domain/date";
import {
  EXERCISE_LOGGING_METHOD,
  filterExerciseLibrary,
  planPrescriptionSummary,
} from "../../lib/domain/plans";
import {
  durationLabel,
  previousWeightsForExercise,
  sessionWorkoutStatus,
  workoutExerciseSideLabel,
} from "../../lib/domain/workoutDisplay";
import { addRecordedSet, completeWorkout, createDebouncedSaver, createInProgressWorkout, createOneOffWorkout, isMeaningfulWorkout, removeRecordedSet, updateRecordedSet } from "../../lib/domain/workoutSession";
import { createInProgressWorkoutDocument, deleteWorkoutDocument, finishWorkoutDocument, subscribeExerciseDefinitions, subscribePlans, subscribeWorkouts, updateInProgressWorkoutDocument } from "../../lib/firebase/planRepository";
import { makeId } from "../../lib/domain/legacyWorkouts";

const noop = () => {};
const defaultRepository = { subscribePlans, subscribeWorkouts, subscribeExerciseDefinitions, createInProgressWorkoutDocument, updateInProgressWorkoutDocument, finishWorkoutDocument, deleteWorkoutDocument };
const ordered = (items = []) => items.slice().sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
const titleFor = (workout) => workout.name || workout.sessionNameSnapshot || "Workout";

export function OneOffWorkoutBuilder({ exercises, onCancel, onStart }) {
  const [name, setName] = useState(""); const [query, setQuery] = useState(""); const [selected, setSelected] = useState([]);
  const available = filterExerciseLibrary(exercises, { query }).filter((item) => !selected.some((chosen) => chosen.id === item.id));
  const move = (index, direction) => { const target = index + direction; if (target < 0 || target >= selected.length) return; const next = selected.slice(); [next[index], next[target]] = [next[target], next[index]]; setSelected(next); };
  return <div className="space-y-5"><button type="button" className="text-sm font-medium text-slate-600" onClick={onCancel}>← Workout options</button><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h1 className="text-2xl font-semibold">Build a One-off Workout</h1><p className="mt-1 text-sm text-slate-500">Choose exercises from your Exercise Library. Your programme will not be changed.</p><label className="mt-5 block text-sm font-medium">Workout name (optional)<input className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3" value={name} placeholder="One-off Workout" onChange={(e) => setName(e.target.value)}/></label><label className="mt-4 block text-sm font-medium">Search Exercise Library<span className="relative mt-1 block"><Search className="absolute left-3 top-3 h-5 w-5 text-slate-400"/><input className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search exercises"/></span></label><div className="mt-3 max-h-56 space-y-2 overflow-y-auto">{available.map((exercise) => <button type="button" key={exercise.id} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-slate-200 px-3 text-left" onClick={() => setSelected((items) => [...items, exercise])}><span>{exercise.name}</span><span className="text-sm font-medium text-emerald-700">Add</span></button>)}</div><h2 className="mt-5 font-semibold">Selected exercises ({selected.length})</h2><div className="mt-2 space-y-2">{selected.map((exercise, index) => <div key={exercise.id} className="flex min-h-12 items-center gap-2 rounded-xl bg-slate-50 px-3"><span className="min-w-0 flex-1 font-medium">{exercise.name}</span><button type="button" aria-label={`Move ${exercise.name} up`} disabled={!index} onClick={() => move(index, -1)} className="p-2 disabled:opacity-30"><ChevronUp className="h-4 w-4"/></button><button type="button" aria-label={`Move ${exercise.name} down`} disabled={index === selected.length - 1} onClick={() => move(index, 1)} className="p-2 disabled:opacity-30"><ChevronDown className="h-4 w-4"/></button><button type="button" aria-label={`Remove ${exercise.name}`} onClick={() => setSelected((items) => items.filter((item) => item.id !== exercise.id))} className="p-2 text-red-600"><Trash2 className="h-4 w-4"/></button></div>)}</div>{!selected.length ? <p className="mt-3 text-sm text-slate-500">Select at least one exercise to start.</p> : null}<div className="mt-6 flex flex-wrap gap-2"><Button disabled={!selected.length} onClick={() => onStart(name, selected)}>Start Workout</Button><Button variant="outline" onClick={onCancel}>Cancel</Button></div></section></div>;
}

function fieldsFor(method) { return { reps: ["reps", "reps_weight"].includes(method), weight: method === "reps_weight", duration: ["time", "time_distance"].includes(method), distance: ["distance", "time_distance"].includes(method) }; }
export function ExerciseCard({
  exercise,
  oneOff,
  onChange,
  onAddSet,
  onRemoveSet,
  onRemoveExercise,
  onMove,
  index,
  total,
}) {
  const fields = fieldsFor(exercise.loggingMethod);
  const side = workoutExerciseSideLabel(exercise);

  const isProgrammeWorkout = !oneOff;
  const isWeighted = exercise.loggingMethod === "reps_weight";
  const isRepsOnly = exercise.loggingMethod === "reps";
  const isTask = exercise.loggingMethod === "completed";
  const isInterval =
  exercise.loggingMethod ===
  EXERCISE_LOGGING_METHOD.INTERVAL;

 const stages = ordered(
  exercise.prescription?.stages ||
    exercise.prescription?.intervals ||
    [],
);

  function toggleCompleted() {
    onChange(
      exercise.id,
      null,
      "completed",
      !exercise.completed,
    );
  }

  function prescribedRepValue(set) {
    if (set.prescribedReps?.type === "fixed") {
      return set.prescribedReps.value;
    }

    if (set.prescribedReps?.type === "range") {
      return set.prescribedReps.min;
    }

    return "";
  }

  function currentRepValue(set) {
    return (
      set.rawReps ??
      set.actualReps ??
      prescribedRepValue(set)
    );
  }

  function CompletionTick() {
    return (
      <button
        type="button"
        aria-label={
          exercise.completed
            ? `Mark ${exercise.exerciseNameSnapshot} incomplete`
            : `Mark ${exercise.exerciseNameSnapshot} complete`
        }
        onClick={toggleCompleted}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition ${
          exercise.completed
            ? "border-emerald-600 bg-emerald-600 text-white"
            : "border-slate-300 bg-white text-transparent hover:border-emerald-500"
        }`}
      >
        <Check className="h-4 w-4" />
      </button>
    );
  }

  function intervalStageLabel(stage) {
    const phase =
      stage.phase === "rest" ? "Rest" : "Work";

    const duration =
      durationLabel(
        stage.durationSeconds,
        stage.durationUnit,
      ) || "—";

    return `${duration} ${phase.toLowerCase()}`;
  }

  function CompactProgrammeContent() {
  if (stages.length > 0) {
    return (
      <div className="min-w-0 flex-1 space-y-1">
        {stages.map((stage, stageIndex) => (
          <div
            key={stage.id || stageIndex}
            className="text-sm font-medium text-slate-700"
          >
            {intervalStageLabel(stage)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <span className="min-w-0 flex-1 text-sm font-medium text-slate-700">
      {planPrescriptionSummary(exercise) ||
        (isTask ? "Complete task" : "Complete exercise")}
    </span>
  );
}

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">
            {exercise.exerciseNameSnapshot}
          </h2>

          {side || exercise.prescription?.targetReps?.type === "range" ? (
  <p className="text-xs text-slate-500">
    {[
      side,
      exercise.prescription?.targetReps?.type === "range"
        ? `Range: ${exercise.prescription.targetReps.min}–${exercise.prescription.targetReps.max} reps`
        : null,
    ]
      .filter(Boolean)
      .join(" · ")}
  </p>
) : null}

          {exercise.programmeNoteSnapshot ? (
            <p className="mt-1 text-xs text-slate-500">
              {exercise.programmeNoteSnapshot}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          aria-label={`Move ${exercise.exerciseNameSnapshot} up`}
          disabled={!index}
          onClick={() => onMove(index, -1)}
          className="p-2 disabled:opacity-30"
        >
          <ChevronUp className="h-4 w-4" />
        </button>

        <button
          type="button"
          aria-label={`Move ${exercise.exerciseNameSnapshot} down`}
          disabled={index === total - 1}
          onClick={() => onMove(index, 1)}
          className="p-2 disabled:opacity-30"
        >
          <ChevronDown className="h-4 w-4" />
        </button>

        {oneOff ? (
          <button
            type="button"
            onClick={() =>
              onRemoveExercise(exercise.id)
            }
            className="min-h-10 px-2 text-sm font-medium text-red-600"
          >
            Remove
          </button>
        ) : null}
      </div>

      {isProgrammeWorkout &&
      !isWeighted &&
      !isRepsOnly ? (
        <div className="mt-3 flex min-h-12 items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
          <CompactProgrammeContent />

          <CompletionTick />
        </div>
      ) : isTask && oneOff ? (
        <div className="mt-3 flex min-h-12 items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
          <CompactProgrammeContent />

          <CompletionTick />
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {(exercise.recordedSets || []).map(
            (set) => (
              <div
                key={set.id}
                className={`grid items-end gap-2 rounded-xl bg-slate-50 p-3 ${
                  isWeighted
                    ? "grid-cols-[3.25rem_minmax(0,1fr)_minmax(0,1fr)]"
                    : "grid-cols-[3.25rem_minmax(0,1fr)]"
                }`}
              >
                <span className="pb-2 text-sm font-medium">
                  Set {set.setNumber}
                </span>

                {fields.reps ? (
                  <label className="min-w-0 text-xs font-medium">
                    Reps

                    {set.prescribedReps?.type === "range" ? (
  <select
    aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} reps`}
    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-slate-900"
    value={currentRepValue(set)}
    onChange={(event) =>
      onChange(
        exercise.id,
        set.id,
        "actualReps",
        event.target.value,
      )
    }
  >
  <option value="" disabled hidden>
  {set.prescribedReps.min}–{set.prescribedReps.max}
</option>

    {Array.from(
      {
        length:
          Number(set.prescribedReps.max) -
          Number(set.prescribedReps.min) +
          1,
      },
      (_, index) =>
        Number(set.prescribedReps.min) + index,
    ).map((rep) => (
      <option key={rep} value={rep}>
        {rep}
      </option>
    ))}
  </select>
) : (
  <input
    aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} reps`}
    inputMode="numeric"
    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-slate-900"
    value={currentRepValue(set)}
    onFocus={(event) =>
      event.currentTarget.select()
    }
    onChange={(event) =>
      onChange(
        exercise.id,
        set.id,
        "actualReps",
        event.target.value,
      )
    }
  />
)}
                  </label>
                ) : null}

                {isWeighted ? (
                  <label className="min-w-0 text-xs font-medium">
                    Weight (kg)

                    <input
                      aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} weight`}
                      inputMode="decimal"
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-slate-900"
                      value={
                        set.rawWeight ??
                        set.weight ??
                        ""
                      }
                      onFocus={(event) =>
                        event.currentTarget.select()
                      }
                      onChange={(event) =>
                        onChange(
                          exercise.id,
                          set.id,
                          "weight",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                ) : null}

                {oneOff &&
                exercise.recordedSets.length > 1 ? (
                  <button
                    type="button"
                    className="col-start-2 min-h-10 justify-self-start text-sm text-red-600"
                    onClick={() =>
                      onRemoveSet(
                        exercise.id,
                        set.id,
                      )
                    }
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ),
          )}

          {isProgrammeWorkout && isRepsOnly ? (
            <div className="flex min-h-10 items-center justify-end pr-1">
              <CompletionTick />
            </div>
          ) : null}

          {oneOff ? (
            <button
              type="button"
              className="min-h-11 text-sm font-medium text-emerald-700"
              onClick={() =>
                onAddSet(exercise.id)
              }
            >
              + Add set
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
export function WorkoutForm({ workout, saveStatus, finishing, finishError, onBack, onChange, onAddSet, onRemoveSet, onRemoveExercise, onReorder, onNotes, onFinish, onDiscard }) { const list = ordered(workout.exercises); const move = (index, direction) => { const target = index + direction; if (target < 0 || target >= list.length) return; const next = list.slice(); [next[index], next[target]] = [next[target], next[index]]; onReorder(next.map((item, i) => ({ ...item, sortOrder: i }))); }; return <div className="space-y-5"><button type="button" className="text-sm font-medium text-slate-600" onClick={onBack}>← Workout options</button><section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="flex justify-between gap-3"><div><p className="text-sm font-medium text-emerald-700">Workout in progress · {workout.sourceType === "one_off" ? "One-off Workout" : "Programme Workout"}</p><h1 className="text-2xl font-semibold">{titleFor(workout)}</h1></div><span className="text-xs text-slate-500">{saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Could not save" : ""}</span></div><label className="mt-4 block text-sm font-medium">Workout date<input type="date" readOnly className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3" value={workout.date || ""}/></label><div className="mt-5 space-y-3">{list.map((exercise, index) => <ExerciseCard key={exercise.id} exercise={exercise} oneOff={workout.sourceType === "one_off"} index={index} total={list.length} onChange={onChange} onAddSet={onAddSet} onRemoveSet={onRemoveSet} onRemoveExercise={onRemoveExercise} onMove={move}/>)}</div><label className="mt-5 block text-sm font-medium">Workout notes<textarea className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 p-3" value={workout.notes || ""} onChange={(e) => onNotes(e.target.value)}/></label>{finishError ? <p className="mt-3 text-sm font-medium text-red-600">{finishError}</p> : null}<div className="mt-6 flex flex-col gap-3 sm:flex-row"><Button disabled={finishing} onClick={onFinish}>{finishing ? "Finishing…" : "Complete Workout"}</Button><Button variant="danger" disabled={finishing} onClick={onDiscard}>Discard Workout</Button></div></section></div>; }
export function DiscardWorkoutDialog({ discarding, error, onCancel, onConfirm }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div role="dialog" aria-modal="true" aria-labelledby="discard-title" className="w-full max-w-md rounded-2xl bg-white p-5"><h2 id="discard-title" className="text-lg font-semibold">Discard Workout?</h2><p className="mt-2 text-sm text-slate-600">This permanently deletes this unfinished workout. Completed workouts will not be affected, and it will not appear in Workout History.</p>{error ? <p className="mt-2 text-red-600">{error}</p> : null}<div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onCancel}>Cancel</Button><Button variant="danger" disabled={discarding} onClick={onConfirm}>{discarding ? "Discarding…" : "Discard Workout"}</Button></div></div></div>; }
export function WeightCard({ exercise, onToggle = noop, onWeight = noop, index = 0, total = 1, onNudge = noop }) { return ExerciseCard({ exercise, index, total, oneOff: false, onChange: (exerciseId, setId, field, value) => field === "completed" ? onToggle(exerciseId) : field === "weight" ? onWeight(exerciseId, setId, value) : noop(), onAddSet: noop, onRemoveSet: noop, onRemoveExercise: noop, onMove: (position, direction) => onNudge(position, direction) }); }
export function UnfinishedWorkoutDialog({ unfinishedName, requestedName, confirming, discarding, error, onContinue, onRequestDiscard, onDiscard, onBack, onCancel }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-5"><h2 className="text-lg font-semibold">Unfinished workout in progress</h2><p className="mt-2">{unfinishedName}</p>{requestedName ? <p>Start instead: {requestedName}</p> : null}{error ? <p>{error}</p> : null}{confirming ? <><p className="mt-4 text-red-700">Permanently discard this unfinished workout?</p><Button variant="outline" onClick={onBack}>Back</Button><Button variant="danger" disabled={discarding} onClick={onDiscard}>Discard and start</Button></> : <div className="mt-4 flex flex-col gap-2"><Button onClick={onContinue}>Continue workout</Button><Button variant="danger" onClick={onRequestDiscard}>Discard unfinished workout and start this session</Button><Button variant="outline" onClick={onCancel}>Cancel</Button></div>}</div></div>; }
export function ProgrammeSessionList({ programme, sessions, workouts, today, onSelect }) { return <section className="rounded-3xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold">Programme Workout</h2><p className="text-sm text-slate-500">{programme.name}</p><div className="mt-3 space-y-2">{sessions.map((session) => { const status = sessionWorkoutStatus(programme.id, session.id, workouts, today); return <button type="button" key={session.id} onClick={() => onSelect(session)} className="flex min-h-14 w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-left"><span><b className="block">{session.name}</b><span className="text-sm text-slate-500">{session.exercises?.length || 0} exercises{status.label ? ` · ${status.label}` : ""}</span></span><ChevronRight className="h-5 w-5"/></button>; })}</div></section>; }

export default function WorkoutScreen({ user, repository = defaultRepository, intent, onIntentHandled = noop, onFinished = noop, onDiscarded = noop }) {
  const [plans, setPlans] = useState([]), [workouts, setWorkouts] = useState([]), [library, setLibrary] = useState([]), [workout, setWorkout] = useState(null), [builder, setBuilder] = useState(false), [saveStatus, setSaveStatus] = useState(""), [finishing, setFinishing] = useState(false), [finishError, setFinishError] = useState(""), [discardOpen, setDiscardOpen] = useState(false), [discarding, setDiscarding] = useState(false); const handled = useRef(null);
  useEffect(() => repository.subscribePlans(db, user.uid, setPlans, noop), [repository, user.uid]); useEffect(() => repository.subscribeWorkouts(db, user.uid, setWorkouts, noop), [repository, user.uid]); useEffect(() => repository.subscribeExerciseDefinitions(db, user.uid, setLibrary, noop), [repository, user.uid]);
  const saver = useMemo(() => createDebouncedSaver((value) => repository.updateInProgressWorkoutDocument(db, user.uid, value), 500, setSaveStatus), [repository, user.uid]); useEffect(() => () => { saver.flush().catch(noop); }, [saver]); useEffect(() => { if (workout) saver.schedule(workout); }, [saver, workout]);
  const programme = useMemo(() => plans.filter((p) => p.isActive && !p.isArchived)[0], [plans]); const unfinished = workouts.find((item) => item.status === "in_progress");
  const openSaved = useCallback((saved) => { setWorkout(saved); setBuilder(false); onIntentHandled(); }, [onIntentHandled]);
  const startProgramme = async (session) => { if (unfinished) return openSaved(unfinished); const previous = Object.fromEntries((session.exercises || []).map((exercise) => [exercise.id, previousWeightsForExercise(workouts.filter((item) => item.status === "completed"), exercise)])); const next = createInProgressWorkout({ id: `workout-${makeId()}`, userId: user.uid, programme, session, date: todayString(), previousWeightsByExercise: previous, createdAt: new Date().toISOString() }); await repository.createInProgressWorkoutDocument(db, user.uid, next); setWorkouts((all) => [...all, next]); openSaved(next); };
  const startOneOff = async (name, exercises) => { if (unfinished) return openSaved(unfinished); const next = createOneOffWorkout({ id: `workout-${makeId()}`, userId: user.uid, name, exercises, date: todayString() }); await repository.createInProgressWorkoutDocument(db, user.uid, next); setWorkouts((all) => [...all, next]); openSaved(next); };
  useEffect(() => { if (!intent || handled.current === intent.token) return; if (intent.mode === "continue" && unfinished) { handled.current = intent.token; openSaved(unfinished); } else if (intent.mode === "one_off") { handled.current = intent.token; unfinished ? openSaved(unfinished) : setBuilder(true); } else if (intent.mode === "session" && programme) { const session = programme.sessions?.find((item) => item.id === intent.sessionId); if (session) { handled.current = intent.token; startProgramme(session); } } }, [intent, unfinished, programme]); // eslint-disable-line react-hooks/exhaustive-deps
  const change = (exerciseId, setId, field, value) => setWorkout((current) => field === "completed" ? { ...current, exercises: current.exercises.map((exercise) => exercise.id === exerciseId ? { ...exercise, completed: value } : exercise) } : updateRecordedSet(current, exerciseId, setId, field, value));
  const finish = async () => { if (!isMeaningfulWorkout(workout)) { setFinishError("Record at least one completed entry before completing this workout."); return; } setFinishing(true); try { const now = new Date(); const started = new Date(workout.startedAt); const latest = { ...workout, durationSeconds: Number.isNaN(started.getTime()) ? undefined : Math.max(0, Math.round((now - started) / 1000)) }; const completed = await completeWorkout(latest, saver, (item) => repository.finishWorkoutDocument(db, user.uid, item)); setWorkout(null); onFinished(completed); } catch { setFinishError("Could not complete workout. Please try again."); } finally { setFinishing(false); } };
  const discard = async () => { setDiscarding(true); try { await saver.cancel(); await repository.deleteWorkoutDocument(db, user.uid, workout.id); setWorkout(null); setDiscardOpen(false); onDiscarded(); } finally { setDiscarding(false); } };
  if (workout) return <><WorkoutForm workout={workout} saveStatus={saveStatus} finishing={finishing} finishError={finishError} onBack={() => setWorkout(null)} onChange={change} onAddSet={(id) => setWorkout((w) => addRecordedSet(w, id))} onRemoveSet={(id, setId) => setWorkout((w) => removeRecordedSet(w, id, setId))} onRemoveExercise={(id) => setWorkout((w) => ({ ...w, exercises: w.exercises.filter((e) => e.id !== id) }))} onReorder={(exercises) => setWorkout((w) => ({ ...w, exercises }))} onNotes={(notes) => setWorkout((w) => ({ ...w, notes }))} onFinish={finish} onDiscard={() => setDiscardOpen(true)}/>{discardOpen ? <DiscardWorkoutDialog discarding={discarding} onCancel={() => setDiscardOpen(false)} onConfirm={discard}/> : null}</>;
  if (builder) return <OneOffWorkoutBuilder exercises={library} onCancel={() => setBuilder(false)} onStart={startOneOff}/>;
  return <div className="space-y-5"><div><h1 className="text-2xl font-semibold">Workout</h1><p className="text-sm text-slate-500">Choose how you want to train today.</p></div>{unfinished ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h2 className="font-semibold">Workout in progress</h2><p className="text-sm text-slate-600">{titleFor(unfinished)}</p><Button className="mt-3 w-full sm:w-auto" onClick={() => openSaved(unfinished)}>Continue Workout</Button></section> : <><Button className="w-full py-3" variant="outline" onClick={() => setBuilder(true)}>One-off Workout</Button>{programme ? <ProgrammeSessionList programme={programme} sessions={ordered(programme.sessions)} workouts={workouts} today={todayString()} onSelect={startProgramme}/> : <section className="rounded-2xl border border-dashed border-slate-300 p-6 text-center"><Dumbbell className="mx-auto text-slate-400"/><p className="mt-2 font-semibold">No active programme</p><p className="text-sm text-slate-500">You can still start a One-off Workout.</p></section>}</>}</div>;
}
