import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import Button from "../../components/ui/Button";
import { db } from "../../firebase";
import { rehabTimeline } from "../../lib/domain/homeDashboard";
import { todayString } from "../../lib/domain/date";
import { ROUTINE_STATUS, occurrenceId, routineTimeMinutes, scheduledRoutineTasks } from "../../lib/domain/routineTasks";
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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function taskOccurrenceId(programme, scheduledDate, task) {
  return occurrenceId(programme.id, scheduledDate, task.baseTaskId || task.id, task.occurrenceTimeKey || "");
}

function sameTaskOccurrence(a, b) {
  return (a.baseTaskId || a.id) === (b.baseTaskId || b.id) && (a.occurrenceTimeKey || "") === (b.occurrenceTimeKey || "");
}

function customTimeHasPassed(task, now) {
  if (!/^\d{2}:\d{2}$/.test(task.occurrenceTimeKey || "")) return false;
  return now.getHours() * 60 + now.getMinutes() >= routineTimeMinutes(task.occurrenceTimeKey);
}

function routineGroups(programme, occurrences, today) {
  if (!programme) return { overdue: [], due: [], done: [] };
  const byId = new Map(occurrences.map((item) => [item.id || occurrenceId(item.programmeId, item.scheduledDate, item.taskId, item.occurrenceTimeKey), item]));
  const now = new Date();
  const todayDate = new Date(`${today}T12:00:00`);
  const scheduledToday = scheduledRoutineTasks(programme, todayDate).map((task) => {
    const occurrence = byId.get(taskOccurrenceId(programme, today, task));
    return { ...task, scheduledDate: today, status: occurrence?.status || ROUTINE_STATUS.PENDING, occurrence };
  });
  const done = scheduledToday.filter((task) => task.status === ROUTINE_STATUS.COMPLETED);
  const overdueToday = scheduledToday.filter((task) => task.status !== ROUTINE_STATUS.COMPLETED && customTimeHasPassed(task, now));
  const pendingDue = scheduledToday.filter((task) => task.status !== ROUTINE_STATUS.COMPLETED && !customTimeHasPassed(task, now));
  const latestMissedByTaskTime = new Map();
  const cursor = routineStartDate(programme, today);
  while (cursor < todayDate) {
    const scheduledDate = dateString(cursor);
    const nextDate = new Date(cursor);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDayTasks = scheduledRoutineTasks(programme, nextDate);
    scheduledRoutineTasks(programme, cursor).forEach((task) => {
      const occurrence = byId.get(taskOccurrenceId(programme, scheduledDate, task));
      if (occurrence?.status === ROUTINE_STATUS.COMPLETED) return;
      if (nextDayTasks.some((nextTask) => sameTaskOccurrence(task, nextTask))) return;
      const key = `${task.baseTaskId || task.id}_${task.occurrenceTimeKey || ""}`;
      latestMissedByTaskTime.set(key, { ...task, scheduledDate, status: ROUTINE_STATUS.PENDING, occurrence });
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  const overdue = [...latestMissedByTaskTime.values(), ...overdueToday]
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || routineTimeMinutes(a.occurrenceTimeKey) - routineTimeMinutes(b.occurrenceTimeKey));
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

function missingExercises(workout) { return (workout?.exercises || []).filter((exercise) => !exerciseAttempted(exercise)); }

function incompleteWorkouts(workouts) {
  return workouts.filter((workout) => workout.status === "completed" && !workout.dismissedIncompleteAt && missingExercises(workout).length > 0)
    .sort((a, b) => String(b.completedAt || b.updatedAt || b.date || "").localeCompare(String(a.completedAt || a.updatedAt || a.date || "")));
}

function taskKey(task) {
  return `${task.baseTaskId || task.id}-${task.scheduledDate}-${task.occurrenceTimeKey || ""}`;
}

function TaskRow({ task, overdue = false, onStatus }) {
  const [completing, setCompleting] = useState(false);

  async function completeTask() {
    if (completing) return;
    setCompleting(true);
    await new Promise((resolve) => window.setTimeout(resolve, 420));
    try {
      await onStatus(task, ROUTINE_STATUS.COMPLETED);
    } catch {
      setCompleting(false);
    }
  }

  return <article className={`flex min-h-14 items-center gap-3 overflow-hidden rounded-xl border px-3 py-2 transition-all duration-300 ${overdue ? "border-orange-200 bg-orange-50" : "border-slate-200 bg-white"} ${completing ? "max-h-0 min-h-0 -translate-y-1 scale-[0.98] border-transparent py-0 opacity-0" : "max-h-24 opacity-100"}`}>
    <button type="button" aria-label={`Complete ${task.name}`} disabled={completing} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-200 ${completing ? "scale-110 border-emerald-600 bg-emerald-600 text-white" : overdue ? "border-orange-400 text-transparent hover:border-emerald-600 hover:text-emerald-600" : "border-slate-300 text-transparent hover:border-emerald-600 hover:text-emerald-600"}`} onClick={completeTask}>✓</button>
    <div className="min-w-0 flex-1"><div className="font-medium">{task.name}</div><div className={`flex min-w-0 gap-2 text-xs ${overdue ? "text-orange-700" : "text-slate-500"}`}>{overdue && task.scheduledDate !== todayString() ? <span>{task.scheduledDate}</span> : <span>{task.timeLabel || task.timeOfDay}</span>}{task.notes ? <span className="truncate">· {task.notes}</span> : null}</div></div>
  </article>;
}

function TaskSection({ title, tasks, tone, onStatus }) {
  const [expanded, setExpanded] = useState(false);
  if (!tasks.length) return null;
  const visible = expanded ? tasks : tasks.slice(0, VISIBLE_TASKS);
  return <div className="space-y-2"><div className="flex items-center justify-between"><h3 className={`text-sm font-semibold ${tone}`}>{title}</h3>{tasks.length > VISIBLE_TASKS ? <button type="button" className="text-sm font-medium text-slate-600" onClick={() => setExpanded((value) => !value)}>{expanded ? "Show Less" : "Show All"}</button> : null}</div><div className="space-y-1.5">{visible.map((task) => <TaskRow key={taskKey(task)} task={task} overdue={title === "Overdue"} onStatus={onStatus}/>)}</div></div>;
}

function CompletedTasks({ tasks }) {
  const [expanded, setExpanded] = useState(false);
  if (!tasks.length) return null;
  const names = tasks.map((task) => task.name);
  const summary = names.length <= 2 ? names.join(", ") : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
  return <div className="rounded-xl border border-emerald-100 bg-emerald-50/60">
    <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
      <span className="min-w-0"><span className="block text-sm font-semibold text-emerald-700">Completed</span><span className="block truncate text-xs text-emerald-700/80">{summary}</span></span>
      <span className="shrink-0 text-sm font-medium text-emerald-700">{expanded ? "Hide" : "View"}</span>
    </button>
    {expanded ? <div className="border-t border-emerald-100 px-3 py-2"><div className="space-y-1">{tasks.map((task) => <div key={taskKey(task)} className="flex items-center gap-2 text-sm text-slate-600"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">✓</span><span className="truncate">{task.name}</span></div>)}</div></div> : null}
  </div>;
}

export function TodayRoutine({ groups, onStatus }) {
  const count = groups.overdue.length + groups.due.length + groups.done.length;
  return <section aria-labelledby="today-routine-title" className="space-y-4"><h2 id="today-routine-title" className="text-base font-semibold">Routine</h2>{!count ? <p className="text-sm text-slate-500">No routine tasks due today or overdue.</p> : null}<TaskSection title="Due Today" tasks={groups.due} tone="text-slate-700" onStatus={onStatus}/><TaskSection title="Overdue" tasks={groups.overdue} tone="text-orange-700" onStatus={onStatus}/><CompletedTasks tasks={groups.done}/></section>;
}

function IncompleteWorkoutCard({ workout, onContinue, onDismiss }) {
  const missing = missingExercises(workout);
  const visibleMissing = missing.slice(0, 3);
  return <article className="rounded-2xl border border-orange-200 bg-orange-50 p-4"><div className="text-sm font-semibold uppercase tracking-wide text-orange-700">Incomplete workout</div><h2 className="mt-1 text-lg font-semibold text-slate-900">{workout.sessionNameSnapshot || workout.name || "Workout"}</h2><div className="mt-2 text-sm font-medium text-orange-800">Missing:</div><ul className="mt-1 space-y-1 text-sm text-orange-900">{visibleMissing.map((exercise) => <li key={exercise.id}>• {exercise.exerciseNameSnapshot || exercise.name || "Exercise"}</li>)}{missing.length > visibleMissing.length ? <li>• +{missing.length - visibleMissing.length} more</li> : null}</ul><div className="mt-4 flex gap-2"><Button onClick={() => onContinue(workout)}>Log missing exercises</Button><Button variant="outline" onClick={() => onDismiss(workout)}>Dismiss</Button></div></article>;
}

function IncompleteWorkouts({ workouts, expanded, onToggle, onContinue, onDismiss }) {
  if (!workouts.length) return null;
  const visible = expanded ? workouts : workouts.slice(0, VISIBLE_INCOMPLETE_WORKOUTS);
  return <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-base font-semibold">Incomplete workouts</h2>{workouts.length > VISIBLE_INCOMPLETE_WORKOUTS ? <button type="button" className="text-sm font-medium text-slate-600" onClick={onToggle}>{expanded ? "Show less" : `Show all (${workouts.length})`}</button> : null}</div><div className="space-y-3">{visible.map((workout) => <IncompleteWorkoutCard key={workout.id} workout={workout} onContinue={onContinue} onDismiss={onDismiss}/>)}</div></section>;
}

export function HomeDashboard({ programme, unfinishedWorkout, incompleteWorkoutList, incompleteExpanded, surgeryDate, trainingMode = "gym", today, showSessions, onStart, onContinue, onContinueIncomplete, onDismissIncomplete, onToggleIncomplete, onChooseSession, onOneOff, routineGroups: groups, onRoutineStatus }) {
  const sessions = (programme?.sessions || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const timeline = trainingMode === "rehab" && surgeryDate ? rehabTimeline(surgeryDate, today) : null;
  return <div className="mx-auto max-w-2xl space-y-5"><TodayRoutine groups={groups} onStatus={onRoutineStatus}/><IncompleteWorkouts workouts={incompleteWorkoutList} expanded={incompleteExpanded} onToggle={onToggleIncomplete} onContinue={onContinueIncomplete} onDismiss={onDismissIncomplete}/><section className="space-y-4">{unfinishedWorkout ? <Button className="w-full py-3 text-base" onClick={onContinue}>Continue Workout</Button> : <><Button className="w-full py-3 text-base" disabled={!programme} onClick={onStart}>Start Workout</Button>{showSessions && programme ? <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-semibold">Choose a session</h2><div className="mt-3 space-y-2">{sessions.map((session) => <button type="button" key={session.id} onClick={() => onChooseSession(session.id)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left font-medium hover:bg-slate-50">{session.name}</button>)}</div></div> : null}<Button className="w-full py-3 text-base" variant="outline" onClick={onOneOff}>Quick Workout</Button></>}</section>{timeline ? <><div className="border-t border-slate-200"/><section><h2 className="text-sm font-medium text-slate-500">Rehab timeline</h2><div className="mt-3 grid grid-cols-3 gap-2">{Object.values(timeline).map((label) => <div key={label} className="rounded-xl bg-white p-3 text-center text-sm font-medium shadow-sm">{label}</div>)}</div></section></> : null}</div>;
}

export default function HomeScreen({ user, surgeryDate, trainingMode = "gym", onOpenWorkout, fromProgramme = false, onBackToProgramme, repository = defaultRepository }) {
  const [plans, setPlans] = useState([]); const [workouts, setWorkouts] = useState([]); const [occurrences, setOccurrences] = useState([]); const [showSessions, setShowSessions] = useState(false); const [incompleteExpanded, setIncompleteExpanded] = useState(false);
  const today = todayString();
  useEffect(() => repository.subscribePlans(db, user.uid, setPlans, () => {}), [repository, user.uid]);
  useEffect(() => repository.subscribeWorkouts(db, user.uid, setWorkouts, () => {}), [repository, user.uid]);
  const programme = useMemo(() => plans.filter((plan) => plan.isActive && !plan.isArchived).sort((a, b) => String(b.updatedAtToken || b.id).localeCompare(String(a.updatedAtToken || a.id)))[0] || null, [plans]);
  useEffect(() => { if (!programme) { setOccurrences([]); return undefined; } return onSnapshot(collection(db, "users", user.uid, "routineTaskOccurrences"), (snapshot) => setOccurrences(snapshot.docs.map((item) => item.data()).filter((item) => item.programmeId === programme.id)), () => {}); }, [programme, user.uid]);
  const unfinishedWorkout = useMemo(() => workouts.find((item) => item.status === "in_progress") || null, [workouts]);
  const incompleteWorkoutList = useMemo(() => incompleteWorkouts(workouts), [workouts]);
  const groups = useMemo(() => routineGroups(programme, occurrences, today), [programme, occurrences, today]);
  async function setStatus(task, status) {
    if (!programme) return;
    const taskId = task.baseTaskId || task.id;
    const id = occurrenceId(programme.id, task.scheduledDate, taskId, task.occurrenceTimeKey);
    const optimistic = { id, programmeId: programme.id, taskId, occurrenceTimeKey: task.occurrenceTimeKey || "", scheduledDate: task.scheduledDate, status };
    setOccurrences((current) => [...current.filter((item) => item.id !== id), optimistic]);
    try {
      const actionAt = new Date().toISOString();
      const saved = { ...optimistic, userId: user.uid, actionAt, updatedAt: actionAt };
      await setDoc(doc(db, "users", user.uid, "routineTaskOccurrences", id), { ...optimistic, userId: user.uid, actionAt, updatedAt: serverTimestamp() }, { merge: true });
      setOccurrences((current) => [...current.filter((item) => item.id !== id), saved]);
    } catch (error) {
      setOccurrences((current) => current.filter((item) => item.id !== id));
      console.error("Could not update routine task", error);
      throw error;
    }
  }
  function continueIncomplete(workout) { onOpenWorkout({ mode: "catch_up", workoutId: workout.id }); }
  async function dismissIncomplete(workout) { await updateDoc(doc(db, "users", user.uid, "workouts", workout.id), { dismissedIncompleteAt: serverTimestamp(), updatedAt: serverTimestamp() }); }
  return <div className="space-y-8">{fromProgramme ? <Button variant="outline" onClick={onBackToProgramme}>← Back to programme</Button> : null}<HomeDashboard programme={programme} unfinishedWorkout={unfinishedWorkout} incompleteWorkoutList={incompleteWorkoutList} incompleteExpanded={incompleteExpanded} surgeryDate={surgeryDate} trainingMode={trainingMode} today={today} routineGroups={groups} onRoutineStatus={setStatus} showSessions={showSessions} onStart={() => setShowSessions(true)} onContinue={() => onOpenWorkout({ mode: "continue", workoutId: unfinishedWorkout.id })} onContinueIncomplete={continueIncomplete} onDismissIncomplete={dismissIncomplete} onToggleIncomplete={() => setIncompleteExpanded((value) => !value)} onChooseSession={(sessionId) => onOpenWorkout({ mode: "session", sessionId })} onOneOff={() => onOpenWorkout({ mode: "one_off" })}/><section id="exercise-library" className="scroll-mt-6"><PlansScreen user={user} view="exercises" trainingMode={trainingMode}/></section></div>;
}
