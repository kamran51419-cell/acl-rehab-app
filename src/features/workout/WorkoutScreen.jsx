import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Dumbbell } from "lucide-react";
import { db } from "../../firebase";
import { todayString } from "../../lib/domain/date";
import { durationLabel, groupSessionExercises, previousWeightsForExercise, sessionWorkoutStatus, workoutExerciseSideLabel, workoutItem } from "../../lib/domain/workoutDisplay";
import { completeWorkout, createDebouncedSaver, createInProgressWorkout, findInProgressWorkout, isWeightedExerciseComplete, resumeWorkout, updateRecordedSetWeight } from "../../lib/domain/workoutSession";
import { createInProgressWorkoutDocument, deleteWorkoutDocument, finishWorkoutDocument, subscribePlans, subscribeWorkouts, updateInProgressWorkoutDocument } from "../../lib/firebase/planRepository";
import { makeId } from "../../lib/domain/legacyWorkouts";
import Button from "../../components/ui/Button";

const defaultRepository = {
  subscribePlans,
  subscribeWorkouts,
  createInProgressWorkoutDocument,
  updateInProgressWorkoutDocument,
  finishWorkoutDocument,
  deleteWorkoutDocument,
};

// Retain freshly autosaved drafts across tab unmounts until Firestore listeners catch up.
const recentWorkoutDrafts = new Map();
const noop = () => {};

function programmeFromWorkoutSnapshot(workout) {
  const session = { id: workout.sessionId, name: workout.sessionNameSnapshot || "Workout", sortOrder: 0, exercises: workout.exercises || [] };
  return { id: workout.planId, name: workout.programmeNameSnapshot || "Programme", version: workout.planVersion || 1, sessions: [session] };
}

function ExerciseGuidance({ exercise }) {
  const side = workoutExerciseSideLabel(exercise);
  return <>{side ? <span className="block text-xs font-medium text-slate-500">{side}</span> : null}{exercise.programmeNoteSnapshot ? <span className="block text-xs text-slate-500">{exercise.programmeNoteSnapshot}</span> : null}</>;
}

function CompletionList({ title, exercises, onToggle }) {
  if (!exercises.length) return null;
  return <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><h2 className="font-semibold text-slate-900">{title}</h2><div className="mt-3 space-y-2">{exercises.map((exercise) => { const item = workoutItem(exercise); return <label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3 ${exercise.completed ? "opacity-60" : ""}`}><input className="mt-1" type="checkbox" checked={Boolean(exercise.completed)} onChange={() => onToggle(exercise.id)} /><span className={exercise.completed ? "line-through" : ""}><span className="block font-medium">{item.name}</span><ExerciseGuidance exercise={exercise} />{item.summary ? <span className="block text-sm text-slate-500">{item.summary}</span> : null}</span></label>; })}</div></section>;
}

function repsLabel(target = {}) {
  return target.type === "range" ? `${target.min}–${target.max} reps` : `${target.value || "?"} reps`;
}

export function WeightCard({ exercise, onWeight }) {
  const complete = isWeightedExerciseComplete(exercise);
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{exercise.exerciseNameSnapshot}</div><ExerciseGuidance exercise={exercise} /></div>{complete ? <span className="text-xs font-medium text-emerald-700">Complete</span> : null}</div><div className="mt-2 space-y-1.5">{exercise.recordedSets.map((set) => <label key={set.id} className="grid grid-cols-[auto_1fr_minmax(80px,120px)_auto] items-center gap-2 text-sm"><span className="font-medium">Set {set.setNumber}:</span><span className="text-slate-600">{repsLabel(set.prescribedReps)}</span><input aria-label={`${exercise.exerciseNameSnapshot} set ${set.setNumber} weight`} className="h-9 rounded-lg border border-slate-200 px-2" inputMode="decimal" value={set.rawWeight ?? set.weight ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onWeight(exercise.id, set.id, event.target.value)} /><span className="text-slate-500">kg</span></label>)}</div></div>;
}

function IntervalCard({ exercise, onToggle }) {
  const stages = (exercise.prescription?.stages || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  return <label className={`block cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 ${exercise.completed ? "opacity-60" : ""}`}><span className="flex items-start gap-3"><input className="mt-1" type="checkbox" checked={Boolean(exercise.completed)} onChange={() => onToggle(exercise.id)} /><span><span className={`block font-semibold ${exercise.completed ? "line-through" : ""}`}>{exercise.exerciseNameSnapshot}</span><ExerciseGuidance exercise={exercise} /><span className="text-sm text-slate-500">Intervals</span></span></span><div className="mt-3 space-y-1 pl-7 text-sm text-slate-600">{stages.map((stage) => <div key={stage.id}>{stage.phase === "rest" ? "Rest" : "Work"} · {durationLabel(stage.durationSeconds, stage.durationUnit)}{stage.label ? ` · ${stage.label}` : ""}</div>)}</div></label>;
}

export function WorkoutForm({ workout, saveStatus = "", leaving = false, finishing = false, finishError = "", onBack, onToggle, onWeight, onDate, onNotes, onFinish, onDiscard }) {
  const { mobility, other, standard, weighted, intervals } = groupSessionExercises(workout.exercises);
  return <div className="space-y-5"><button disabled={leaving || finishing} className="text-sm font-medium text-slate-600 disabled:opacity-50" onClick={onBack}>{leaving ? "Saving..." : "← All sessions"}</button><div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-medium text-emerald-700">Workout in progress</div><h1 className="mt-1 text-2xl font-semibold">{workout.sessionNameSnapshot}</h1></div><span className={`text-xs ${saveStatus === "error" ? "text-red-600" : "text-slate-500"}`}>{saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Could not save" : ""}</span></div><div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-sm font-medium text-slate-700">Workout date<input type="date" className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3" value={workout.date} onChange={(event) => onDate(event.target.value)} /></label><label className="text-sm font-medium text-slate-700">Workout notes<input className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3" value={workout.notes || ""} onChange={(event) => onNotes(event.target.value)} /></label></div><div className="mt-5 space-y-3"><CompletionList title="Exercises" exercises={standard} onToggle={onToggle} /><CompletionList title="Mobility / Stretch" exercises={mobility} onToggle={onToggle} /><CompletionList title="Other" exercises={other} onToggle={onToggle} />{weighted.map((exercise) => <WeightCard key={exercise.id} exercise={exercise} onWeight={onWeight} />)}{intervals.map((exercise) => <IntervalCard key={exercise.id} exercise={exercise} onToggle={onToggle} />)}</div>{finishError ? <p className="mt-4 text-sm font-medium text-red-600">{finishError}</p> : null}<div className="mt-6 flex flex-wrap gap-2"><Button disabled={finishing} onClick={onFinish}>{finishing ? "Finishing…" : "Finish workout"}</Button>{onDiscard ? <Button variant="danger" disabled={finishing} onClick={onDiscard}>Discard Workout</Button> : null}</div></div></div>;
}

export function DiscardWorkoutDialog({ discarding, error, onCancel, onConfirm }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-5"><h2 className="text-lg font-semibold">Discard Workout?</h2><p className="mt-2 text-sm text-slate-600">This will permanently delete this unfinished workout and its recorded data. Completed workouts will not be affected.</p>{error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}<div className="mt-5 flex justify-end gap-2"><Button variant="outline" disabled={discarding} onClick={onCancel}>Cancel</Button><Button variant="danger" disabled={discarding} onClick={onConfirm}>{discarding ? "Discarding…" : "Discard Workout"}</Button></div></div></div>;
}

export function ProgrammeSessionList({ programme, sessions, workouts, today, onSelect }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">{programme.name}</h2><div className="mt-4 space-y-2">{sessions.map((session) => { const status = sessionWorkoutStatus(programme.id, session.id, workouts, today); return <button key={session.id} onClick={() => onSelect(session)} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50"><span><span className="block font-semibold">{session.name}</span><span className="text-sm text-slate-500">{session.exercises?.length || 0} exercises{status.label ? ` · ${status.label}` : ""}</span></span><ChevronRight className="h-5 w-5 text-slate-400"/></button>; })}</div></div>;
}

export function UnfinishedWorkoutDialog({ unfinishedName, requestedName, confirming, discarding, error, onContinue, onRequestDiscard, onDiscard, onBack, onCancel }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-5"><h2 className="text-lg font-semibold">Unfinished workout in progress</h2><p className="mt-2 text-sm text-slate-600">You currently have:</p><p className="mt-1 font-medium">{unfinishedName}</p>{requestedName ? <p className="mt-2 text-sm text-slate-500">Start instead: {requestedName}</p> : null}{error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}{confirming ? <><p className="mt-4 text-sm font-medium text-red-700">Permanently discard this unfinished workout and its recorded data?</p><div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={discarding} onClick={onBack}>Back</Button><Button variant="danger" disabled={discarding} onClick={onDiscard}>{discarding ? "Discarding…" : "Discard and start"}</Button></div></> : <div className="mt-5 flex flex-col gap-2"><Button onClick={onContinue}>Continue workout</Button><Button variant="danger" onClick={onRequestDiscard}>Discard unfinished workout and start this session</Button><Button variant="outline" onClick={onCancel}>Cancel</Button></div>}</div></div>;
}

export default function WorkoutScreen({ user, repository = defaultRepository, intent = null, onIntentHandled = noop, onFinished = noop, onDiscarded = noop }) {
  const [plans, setPlans] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [workout, setWorkout] = useState(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState("");
  const [requestedSession, setRequestedSession] = useState(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discardingActive, setDiscardingActive] = useState(false);
  const [discardActiveError, setDiscardActiveError] = useState("");
  const localWorkouts = useRef(recentWorkoutDrafts);
  const handledIntent = useRef(null);
  useEffect(() => user?.uid ? repository.subscribePlans(db, user.uid, setPlans, () => {}) : undefined, [repository, user?.uid]);
  useEffect(() => user?.uid ? repository.subscribeWorkouts(db, user.uid, (remote) => { const recent = [...localWorkouts.current.values()].filter((item) => item.userId === user.uid); setWorkouts(remote.map((item) => localWorkouts.current.get(item.id) || item).concat(recent.filter((local) => !remote.some((item) => item.id === local.id)))); }, () => {}) : undefined, [repository, user?.uid]);
  const saver = useMemo(() => createDebouncedSaver((value) => repository.updateInProgressWorkoutDocument(db, user.uid, value), 500, (status) => setSaveStatus(status)), [repository, user.uid]);
  useEffect(() => () => { saver.flush().catch(() => {}); }, [saver]);
  useEffect(() => { if (workout) { localWorkouts.current.set(workout.id, workout); saver.schedule(workout); } }, [workout, saver]);
  const activeProgrammes = useMemo(() => plans.filter((plan) => plan.isActive && !plan.isArchived).sort((a, b) => String(b.activatedAt?.seconds || b.updatedAtToken || b.id).localeCompare(String(a.activatedAt?.seconds || a.updatedAtToken || a.id))), [plans]);
  const programme = activeProgrammes[0];
  const sessions = useMemo(() => (programme?.sessions || []).slice().sort((a, b) => a.sortOrder - b.sortOrder), [programme]);

  const chooseSession = useCallback(async (requestedProgramme, requestedSession, { ignoreUnfinished = false } = {}) => {
    const unfinished = ignoreUnfinished ? null : workouts.find((item) => item.status === "in_progress");
    const workoutProgramme = unfinished ? plans.find((plan) => plan.id === unfinished.planId) || programmeFromWorkoutSnapshot(unfinished) : requestedProgramme;
    const session = unfinished ? workoutProgramme?.sessions?.find((item) => item.id === unfinished.sessionId) : requestedSession;
    if (!workoutProgramme || !session) return;
    const date = unfinished?.date || todayString();
    const previousWeightsByExercise = Object.fromEntries((session.exercises || []).map((exercise) => [exercise.id, previousWeightsForExercise(workouts.filter((item) => item.status === "completed"), exercise)]));
    const template = createInProgressWorkout({ id: `workout-${makeId()}`, userId: user.uid, programme: workoutProgramme, session, date, previousWeightsByExercise });
    const existing = unfinished || findInProgressWorkout(workouts, workoutProgramme.id, session.id, date);
    const next = resumeWorkout(existing, template);
    if (!existing) await repository.createInProgressWorkoutDocument(db, user.uid, next);
    setSelectedSession(session);
    setWorkout(next);
    setSaveStatus("saved");
    onIntentHandled();
  }, [onIntentHandled, plans, repository, user.uid, workouts]);

  function requestSession(session) {
    const unfinished = workouts.find((item) => item.status === "in_progress");
    if (unfinished && unfinished.sessionId !== session.id) {
      setRequestedSession(session);
      setConfirmingDiscard(false);
      setDiscardError("");
      return;
    }
    chooseSession(programme, session);
  }

  async function discardAndStart() {
    const unfinished = workouts.find((item) => item.status === "in_progress");
    if (!unfinished || !requestedSession || discarding) return;
    setDiscarding(true);
    setDiscardError("");
    try {
      await repository.deleteWorkoutDocument(db, user.uid, unfinished.id);
      recentWorkoutDrafts.delete(unfinished.id);
      setWorkouts((current) => current.filter((workout) => workout.id !== unfinished.id));
      const nextSession = requestedSession;
      setRequestedSession(null);
      setConfirmingDiscard(false);
      await chooseSession(programme, nextSession, { ignoreUnfinished: true });
    } catch (error) {
      console.error("Could not discard unfinished workout", error);
      setDiscardError("Could not discard unfinished workout. Please try again.");
    } finally {
      setDiscarding(false);
    }
  }

  useEffect(() => {
    if (!intent || handledIntent.current === intent.token || !plans.length) return;
    const unfinished = workouts.find((item) => item.status === "in_progress");
    if (intent.mode === "continue" && unfinished) {
      const targetProgramme = plans.find((plan) => plan.id === unfinished.planId) || programmeFromWorkoutSnapshot(unfinished);
      const targetSession = targetProgramme?.sessions?.find((session) => session.id === unfinished.sessionId);
      if (targetProgramme && targetSession) { handledIntent.current = intent.token; chooseSession(targetProgramme, targetSession); }
    } else if (intent.mode === "session" && programme) {
      const targetSession = programme.sessions?.find((session) => session.id === intent.sessionId);
      if (targetSession) { handledIntent.current = intent.token; chooseSession(programme, targetSession); }
    }
  }, [chooseSession, intent, plans, programme, workouts]);

  async function returnToSessions() {
    if (leaving) return;
    setLeaving(true);
    try {
      await saver.flush();
      localWorkouts.current.set(workout.id, workout);
      setWorkouts((current) => current.some((item) => item.id === workout.id) ? current.map((item) => item.id === workout.id ? workout : item) : [...current, workout]);
      setSelectedSession(null);
      setWorkout(null);
    } catch {
      setSaveStatus("error");
    } finally {
      setLeaving(false);
    }
  }

  function toggleExercise(id) { setWorkout((current) => ({ ...current, exercises: current.exercises.map((exercise) => exercise.id === id ? { ...exercise, completed: !exercise.completed } : exercise) })); }
  function updateWeight(exerciseId, setId, weight) { setWorkout((current) => updateRecordedSetWeight(current, exerciseId, setId, weight)); }
  async function finishWorkout() {
    if (finishing) return;
    setFinishing(true);
    setFinishError("");
    try {
      const completed = await completeWorkout(workout, saver, (latest) => repository.finishWorkoutDocument(db, user.uid, latest));
      localWorkouts.current.set(workout.id, completed);
      setWorkouts((current) => current.some((item) => item.id === completed.id) ? current.map((item) => item.id === completed.id ? completed : item) : [...current, completed]);
      setWorkout(null);
      setSelectedSession(null);
      setSaveStatus("");
      onFinished(completed);
    } catch (error) {
      console.error("Could not finish workout", error);
      setFinishError("Could not finish workout. Please try again.");
    } finally {
      setFinishing(false);
    }
  }

  async function discardActiveWorkout() {
    if (!workout || discardingActive) return;
    setDiscardingActive(true);
    setDiscardActiveError("");
    try {
      await saver.cancel();
      await repository.deleteWorkoutDocument(db, user.uid, workout.id);
      recentWorkoutDrafts.delete(workout.id);
      setWorkouts((current) => current.filter((item) => item.id !== workout.id));
      setWorkout(null);
      setSelectedSession(null);
      setDiscardOpen(false);
      onDiscarded();
    } catch (error) {
      console.error("Could not discard workout", error);
      setDiscardActiveError("Could not discard workout. Please try again.");
    } finally {
      setDiscardingActive(false);
    }
  }

  if (selectedSession && workout) {
    return <><WorkoutForm workout={workout} saveStatus={saveStatus} leaving={leaving} finishing={finishing} finishError={finishError} onBack={returnToSessions} onToggle={toggleExercise} onWeight={updateWeight} onDate={(date) => setWorkout({ ...workout, date })} onNotes={(notes) => setWorkout({ ...workout, notes })} onFinish={finishWorkout} onDiscard={() => { setDiscardActiveError(""); setDiscardOpen(true); }} />{discardOpen ? <DiscardWorkoutDialog discarding={discardingActive} error={discardActiveError} onCancel={() => !discardingActive && setDiscardOpen(false)} onConfirm={discardActiveWorkout} /> : null}</>;
  }

  const unfinished = workouts.find((item) => item.status === "in_progress");
  const unfinishedProgramme = unfinished ? plans.find((plan) => plan.id === unfinished.planId) || programmeFromWorkoutSnapshot(unfinished) : null;
  const unfinishedSession = unfinishedProgramme?.sessions?.find((session) => session.id === unfinished.sessionId);
  return <div className="space-y-5"><div><p className="text-sm font-medium text-emerald-700">Current Programme</p><h1 className="text-2xl font-semibold">Workout</h1><p className="text-sm text-slate-500">Choose any session from your active programme.</p></div>{activeProgrammes.length > 1 ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Multiple legacy programmes are active. Activate your preferred programme again to normalize this to one.</div> : null}{!programme ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"><Dumbbell className="mx-auto mb-3 text-slate-400"/><h2 className="font-semibold">No active programme</h2><p className="text-sm text-slate-500">Activate a programme before starting a workout.</p></div> : <ProgrammeSessionList programme={programme} sessions={sessions} workouts={workouts} today={todayString()} onSelect={requestSession} />}{requestedSession && unfinished ? <UnfinishedWorkoutDialog unfinishedName={unfinished.sessionNameSnapshot || unfinishedSession?.name || "Workout"} requestedName={requestedSession.name} confirming={confirmingDiscard} discarding={discarding} error={discardError} onContinue={() => chooseSession(unfinishedProgramme, unfinishedSession)} onRequestDiscard={() => setConfirmingDiscard(true)} onDiscard={discardAndStart} onBack={() => setConfirmingDiscard(false)} onCancel={() => setRequestedSession(null)} /> : null}</div>;
}
