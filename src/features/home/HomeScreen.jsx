import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import Button from "../../components/ui/Button";
import { db } from "../../firebase";
import { rehabTimeline } from "../../lib/domain/homeDashboard";
import { todayString } from "../../lib/domain/date";
import { ROUTINE_STATUS, occurrenceId, scheduledRoutineTasks } from "../../lib/domain/routineTasks";
import { setRoutineOccurrenceStatus, subscribePlans, subscribeWorkouts } from "../../lib/firebase/planRepository";
import PlansScreen from "../plans/PlansScreen";

const defaultRepository = { subscribePlans, subscribeWorkouts, setRoutineOccurrenceStatus };
const VISIBLE_TASKS = 3;
const VISIBLE_INCOMPLETE_WORKOUTS = 3;

function timestampDate(value) {
  const date = value?.toDate ? value.toDate() : value?.seconds ? new Date(value.seconds * 1000) : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function dateString(date) {
  return date.toISOString().slice(0, 10);
}

function routineStartDate(programme, today) {
  const created = timestampDate(programme?.activatedAt) || timestampDate(programme?.createdAt);
  const fallback = new Date(`${today}T12:00:00`);
  fallback.setDate(fallback.getDate() - 42);
  if (!created) return fallback;
  const start = new Date(created);
  start.setHours(12, 0, 0, 0);
  return start > fallback ? start : fallback;
}

function routineGroups(programme, occurrences, today) {
  if (!programme) return { overdue: [], due: [], done: [] };
  const byId = new Map(occurrences.map((item) => [item.id || occurrenceId(item.programmeId, item.scheduledDate, item.taskId), item]));
  const todayDate = new Date(`${today}T12:00:00`);
  const due = scheduledRoutineTasks(programme, todayDate).map((task) => {
    const id = occurrenceId(programme.id, today, task.id);
    const occurrence = byId.get(id);
    return { ...task, scheduledDate: today, status: occurrence?.status || ROUTINE_STATUS.PENDING, occurrence };
  });
  const done = due.filter((task) => task.status === ROUTINE_STATUS.COMPLETED);
  const pendingDue = due.filter((task) => task.status !== ROUTINE_STATUS.COMPLETED);
  const latestMissedByTask = new Map();
  const cursor = routineStartDate(programme, today);
  while (cursor < todayDate) {
    const scheduledDate = dateString(cursor);
    scheduledRoutineTasks(programme, cursor).forEach((task) => {
      const id = occurrenceId(programme.id, scheduledDate, task.id);
      const occurrence = byId.get(id);
      if (occurrence?.status === ROUTINE_STATUS.COMPLETED) return;
      latestMissedByTask.set(task.id, { ...task, scheduledDate, status: ROUTINE_STATUS.PENDING, occurrence });
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  const overdue = [...latestMissedByTask.values()].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  return { overdue, due: pendingDue, done };
}

function hasEnteredWeight(set) {
  const value = set?.weight ?? set?.rawWeight;
  return value !== "" && value !== undefined && value !== null && Number.isFinite(Number(value));
}

function exerciseAttempted(exercise) {
  if (exercise?.completed) return true;
  const sets = exercise?.recordedSets || [];
  if (exercise?.loggingMethod === "reps_weight") return sets.some(hasEnteredWeight);
  if (sets.length) return sets.some((set) => Boolean(set.completed));
  return Boolean(exercise?.intervalProgress?.completed || exercise?.intervalProgress?.completedBlocks?.length);
}

function missingExercises(workout) {
  return (workout?.exercises || []).filter((exercise) => !exerciseAttempted(exercise));
}

function incompleteWorkouts(workouts) {
  return workouts
    .filter((workout) => workout.status === "completed" && !workout.dismissedIncompleteAt && missingExercises(workout).length > 0)
    .sort((a, b) => String(b.completedAt || b.updatedAt || b.date || "").localeCompare(String(a.completedAt || a.updatedAt || a.date || "")));
}

function TaskRow({ task, overdue = false, completed = false, onStatus }) {
  return <article className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2 ${overdue ? "border-orange-200 bg-orange-50" : completed ? "border-emerald-100 bg-slate-50" : "border-slate-200 bg-white"}`}>
    {completed ? <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">✓</span> : <button type="button" aria-label={`Complete ${task.name}`} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold text-transparent hover:text-emerald-600 ${overdue ? "border-orange-400 hover:border-emerald-600" : "border-slate-300 hover:border-emerald-600"}`} onClick={() => onStatus(task, ROUTINE_STATUS.COMPLETED)}>✓</button>}
    <div className="min-w-0 flex-1">
      <div className={`font-medium ${completed ? "text-slate-500 line-through" : ""}`}>{task.name}</div>
      <div className={`flex min-w-0 gap-2 text-xs capitalize ${overdue ? "text-orange-700" : completed ? "text-slate-400" : "text-slate-500"}`}>
        {overdue ? <span>{task.scheduledDate}</span> : <span>{task.timeOfDay}</span>}
        {task.notes ? <span className="truncate">· {task.notes}</span> : null}
      </div>
    </div>
  </article>;
}

function TaskSection({ title, tasks, tone, expanded, onToggle, onStatus, completed = false }) {
  if (!tasks.length) return null;
  const visible = expanded ? tasks : tasks.slice(0, VISIBLE_TASKS);
  return <div className="space-y-2">
    <div className="flex items-center justify-between"><h3 className={`text-sm font-semibold ${tone}`}>{title}</h3>{tasks.length > VISIBLE_TASKS ? <button type="button" className="text-sm font-medium text-slate-600" onClick={onToggle}>{expanded ? "Show Less" : "Show All"}</button> : null}</div>
    <div className="space-y-1.5">{visible.map((task) => <TaskRow key={`${task.id}-${task.scheduledDate}`} task={task} overdue={title === "Overdue"} completed={completed} onStatus={onStatus}/>)}</div>
  </div>;
}

export function TodayRoutine({ groups, expanded = false, onToggle, onStatus }) {
  const count = groups.overdue.length + groups.due.length + groups.done.length;
  return <section aria-labelledby="today-routine-title" className="space-y-4">
    <h2 id="today-routine-title" className="text-base font-semibold">Routine</h2>
    {!count ? <p className="text-sm text-slate-500">No routine tasks due today or overdue.</p> : null}
    <TaskSection title="Overdue" tasks={groups.overdue} tone="text-orange-700" expanded={expanded} onToggle={onToggle} onStatus={onStatus}/>
    <TaskSection title="Due Today" tasks={groups.due} tone="text-slate-700" expanded={expanded} onToggle={onToggle} onStatus={onStatus}/>
    <TaskSection title="Done" tasks={groups.done} tone="text-emerald-700" expanded={expanded} onToggle={onToggle} onStatus={onStatus} completed/>
  </section>;
}

function IncompleteWorkoutCard({ workout, onContinue, onDismiss }) {
  const missing = missingExercises(workout);
  const visibleMissing = missing.slice(0, 3);
  return <article className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
    <div className="text-sm font-semibold uppercase tracking-wide text-orange-700">Incomplete workout</div>
    <h2 className="mt-1 text-lg font-semibold text-slate-900">{workout.sessionNameSnapshot || workout.name || "Workout"}</h2>
    <div className="mt-2 text-sm font-medium text-orange-800">Missing:</div>
    <ul className="mt-1 space-y-1 text-sm text-orange-900">
      {visibleMissing.map((exercise) => <li key={exercise.id}>• {exercise.exerciseNameSnapshot || exercise.name || "Exercise"}</li>)}
      {missing.length > visibleMissing.length ? <li>• +{missing.length - visibleMissing.length} more</li> : null}
    </ul>
    <div className="mt-4 flex gap-2"><Button onClick={() => onContinue(workout)}>Continue</Button><Button variant="outline" onClick={() => onDismiss(workout)}>Dismiss</Button></div>
  </article>;
}

function IncompleteWorkouts({ workouts, expanded, onToggle, onContinue, onDismiss }) {
  if (!workouts.length) return null;
  const visible = expanded ? workouts : workouts.slice(0, VISIBLE_INCOMPLETE_WORKOUTS);
  return <section className="space-y-3">
    <div className="flex items-center justify-between">
      <h2 className="text-base font-semibold">Incomplete workouts</h2>
      {workouts.length > VISIBLE_INCOMPLETE_WORKOUTS ? <button type="button" className="text-sm font-medium text-slate-600" onClick={onToggle}>{expanded ? "Show less" : `Show all (${workouts.length})`}</button> : null}
    </div>
    <div className="space-y-3">{visible.map((workout) => <IncompleteWorkoutCard key={workout.id} workout={workout} onContinue={onContinue} onDismiss={onDismiss}/>)}</div>
  </section>;
}

export function HomeDashboard({ programme, unfinishedWorkout, incompleteWorkoutList, incompleteExpanded, surgeryDate, trainingMode = "gym", today, showSessions, onStart, onContinue, onContinueIncomplete, onDismissIncomplete, onToggleIncomplete, onChooseSession, onOneOff, routineGroups: groups, routineExpanded = false, onToggleRoutine, onRoutineStatus }) {
  const sessions = (programme?.sessions || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const timeline = trainingMode === "rehab" && surgeryDate ? rehabTimeline(surgeryDate, today) : null;
  return <div className="mx-auto max-w-2xl space-y-5">
    <TodayRoutine groups={groups} expanded={routineExpanded} onToggle={onToggleRoutine} onStatus={onRoutineStatus}/>
    <IncompleteWorkouts workouts={incompleteWorkoutList} expanded={incompleteExpanded} onToggle={onToggleIncomplete} onContinue={onContinueIncomplete} onDismiss={onDismissIncomplete}/>
    <section className="space-y-4">{unfinishedWorkout ? <Button className="w-full py-3 text-base" onClick={onContinue}>Continue Workout</Button> : <Button className="w-full py-3 text-base" disabled={!programme} onClick={onStart}>Start Workout</Button>}{!unfinishedWorkout ? <Button className="w-full py-3 text-base" variant="outline" onClick={onOneOff}>Quick Workout</Button> : null}{showSessions && programme && !unfinishedWorkout ? <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-semibold">Choose a session</h2><div className="mt-3 space-y-2">{sessions.map((session) => <button type="button" key={session.id} onClick={() => onChooseSession(session.id)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left font-medium hover:bg-slate-50">{session.name}</button>)}</div></div> : null}</section>
    {timeline ? <><div className="border-t border-slate-200"/><section><h2 className="text-sm font-medium text-slate-500">Rehab timeline</h2><div className="mt-3 grid grid-cols-3 gap-2">{Object.values(timeline).map((label) => <div key={label} className="rounded-xl bg-white p-3 text-center text-sm font-medium shadow-sm">{label}</div>)}</div></section></> : null}
  </div>;
}

export default function HomeScreen({ user, surgeryDate, trainingMode = "gym", onOpenWorkout, fromProgramme = false, onBackToProgramme, repository = defaultRepository }) {
  const [plans, setPlans] = useState([]); const [workouts, setWorkouts] = useState([]); const [occurrences, setOccurrences] = useState([]); const [showSessions, setShowSessions] = useState(false); const [routineExpanded, setRoutineExpanded] = useState(false); const [incompleteExpanded, setIncompleteExpanded] = useState(false);
  const today = todayString();
  useEffect(() => repository.subscribePlans(db, user.uid, setPlans, () => {}), [repository, user.uid]);
  useEffect(() => repository.subscribeWorkouts(db, user.uid, setWorkouts, () => {}), [repository, user.uid]);
  const programme = useMemo(() => plans.filter((plan) => plan.isActive && !plan.isArchived).sort((a, b) => String(b.updatedAtToken || b.id).localeCompare(String(a.updatedAtToken || a.id)))[0] || null, [plans]);
  useEffect(() => { if (!programme) { setOccurrences([]); return undefined; } return onSnapshot(collection(db, "users", user.uid, "routineTaskOccurrences"), (snapshot) => setOccurrences(snapshot.docs.map((item) => item.data()).filter((item) => item.programmeId === programme.id)), () => {}); }, [programme, user.uid]);
  const unfinishedWorkout = useMemo(() => workouts.find((workout) => workout.status === "in_progress") || null, [workouts]);
  const incompleteWorkoutList = useMemo(() => incompleteWorkouts(workouts), [workouts]);
  const groups = useMemo(() => routineGroups(programme, occurrences, today), [programme, occurrences, today]);
  async function setStatus(task, status) { const saved = await repository.setRoutineOccurrenceStatus(db, user.uid, { id: occurrenceId(programme.id, task.scheduledDate, task.id), programmeId: programme.id, taskId: task.id, scheduledDate: task.scheduledDate, status }); setOccurrences((current) => [...current.filter((item) => item.id !== saved.id), saved]); }
  async function continueIncomplete(workout) { await updateDoc(doc(db, "users", user.uid, "workouts", workout.id), { status: "in_progress", completed: false, completedAt: null, dismissedIncompleteAt: null, updatedAt: serverTimestamp() }); onOpenWorkout({ mode: "continue", workoutId: workout.id }); }
  async function dismissIncomplete(workout) { await updateDoc(doc(db, "users", user.uid, "workouts", workout.id), { dismissedIncompleteAt: serverTimestamp(), updatedAt: serverTimestamp() }); }
  return <div className="space-y-8">{fromProgramme ? <Button variant="outline" onClick={onBackToProgramme}>← Back to programme</Button> : null}<HomeDashboard programme={programme} unfinishedWorkout={unfinishedWorkout} incompleteWorkoutList={incompleteWorkoutList} incompleteExpanded={incompleteExpanded} surgeryDate={surgeryDate} trainingMode={trainingMode} today={today} routineGroups={groups} routineExpanded={routineExpanded} onToggleRoutine={() => setRoutineExpanded((value) => !value)} onRoutineStatus={setStatus} showSessions={showSessions} onStart={() => setShowSessions(true)} onContinue={() => onOpenWorkout({ mode: "continue", workoutId: unfinishedWorkout.id })} onContinueIncomplete={continueIncomplete} onDismissIncomplete={dismissIncomplete} onToggleIncomplete={() => setIncompleteExpanded((value) => !value)} onChooseSession={(sessionId) => onOpenWorkout({ mode: "session", sessionId })} onOneOff={() => onOpenWorkout({ mode: "one_off" })}/><section id="exercise-library" className="scroll-mt-6"><PlansScreen user={user} view="exercises" trainingMode={trainingMode}/></section></div>;
}
