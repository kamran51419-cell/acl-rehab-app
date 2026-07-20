import React, { useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import { db } from "../../firebase";
import { rehabTimeline } from "../../lib/domain/homeDashboard";
import { todayString } from "../../lib/domain/date";
import { ROUTINE_STATUS, mergeRoutineOccurrences, occurrenceId, scheduledRoutineTasks } from "../../lib/domain/routineTasks";
import { setRoutineOccurrenceStatus, subscribePlans, subscribeRoutineOccurrences, subscribeWorkouts } from "../../lib/firebase/planRepository";
import PlansScreen from "../plans/PlansScreen";

const defaultRepository = { subscribePlans, subscribeWorkouts, subscribeRoutineOccurrences, setRoutineOccurrenceStatus };
const VISIBLE_TASKS = 3;

export function TodayRoutine({
  tasks = [],
  expanded = false,
  onToggle,
  onStatus,
}) {
  const pendingTasks = tasks.filter(
    (task) => task.status !== ROUTINE_STATUS.COMPLETED,
  );

  const completedTasks = tasks.filter(
    (task) => task.status === ROUTINE_STATUS.COMPLETED,
  );

  const visiblePendingTasks = expanded
    ? pendingTasks
    : pendingTasks.slice(0, VISIBLE_TASKS);

  const allCompleted = tasks.length > 0 && pendingTasks.length === 0;

  return (
    <section
      aria-labelledby="today-routine-title"
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <h2
          id="today-routine-title"
          className="text-base font-semibold"
        >
          Today’s Routine
        </h2>

        {pendingTasks.length > VISIBLE_TASKS ? (
          <button
            type="button"
            className="text-sm font-medium text-slate-600"
            onClick={onToggle}
          >
            {expanded ? "Show Less" : "Show All"}
          </button>
        ) : null}
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-slate-500">
          No routine tasks scheduled today.
        </p>
      ) : null}

      {allCompleted ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="font-medium text-emerald-800">
            ✓ Today’s routine complete
          </p>

          <p className="mt-1 text-sm text-emerald-700">
            {completedTasks.length} of {tasks.length} tasks completed
          </p>
        </div>
      ) : null}

      {visiblePendingTasks.length > 0 ? (
        <div className="space-y-1.5">
          {visiblePendingTasks.map((task) => (
  <article
  key={task.id}
  className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
>
            
              <button
                type="button"
                aria-label={`Complete ${task.name}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 text-sm font-bold text-transparent hover:border-emerald-600 hover:text-emerald-600"
                onClick={() =>
                  onStatus(task, ROUTINE_STATUS.COMPLETED)
                }
              >
                ✓
              </button>

              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {task.name}
                </div>

                <div className="flex min-w-0 gap-2 text-xs capitalize text-slate-500">
                  <span>{task.timeOfDay}</span>

                  {task.notes ? (
                    <span className="truncate">
                      · {task.notes}
                    </span>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {completedTasks.length > 0 && !allCompleted ? (
        <div className="border-t border-slate-200 pt-3">
          <h3 className="mb-2 text-sm font-semibold text-emerald-700">
            Completed
          </h3>

          <div className="space-y-1.5">
            {completedTasks.map((task) => (
              <article
                key={task.id}
                className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                  ✓
                </span>

                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-500 line-through">
                    {task.name}
                  </div>

                  <div className="flex min-w-0 gap-2 text-xs capitalize text-slate-400">
                    <span>{task.timeOfDay}</span>

                    {task.notes ? (
                      <span className="truncate">
                        · {task.notes}
                      </span>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function HomeDashboard({ programme, unfinishedWorkout, surgeryDate, trainingMode = "gym", today, showSessions, onStart, onContinue, onChooseSession, onOneOff, routineTasks = [], routineExpanded = false, onToggleRoutine, onRoutineStatus }) {
  const sessions = (programme?.sessions || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const timeline = trainingMode === "rehab" && surgeryDate ? rehabTimeline(surgeryDate, today) : null;
  return <div className="mx-auto max-w-2xl space-y-5"><TodayRoutine tasks={routineTasks} expanded={routineExpanded} onToggle={onToggleRoutine} onStatus={onRoutineStatus}/><section className="space-y-4">{unfinishedWorkout ? <Button className="w-full py-3 text-base" onClick={onContinue}>Continue Workout</Button> : <Button className="w-full py-3 text-base" disabled={!programme} onClick={onStart}>Start Workout</Button>}{!unfinishedWorkout ? <Button className="w-full py-3 text-base" variant="outline" onClick={onOneOff}>One-off Workout</Button> : null}{showSessions && programme && !unfinishedWorkout ? <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-semibold">Choose a session</h2><div className="mt-3 space-y-2">{sessions.map((session) => <button type="button" key={session.id} onClick={() => onChooseSession(session.id)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left font-medium hover:bg-slate-50">{session.name}</button>)}</div></div> : null}</section>{timeline ? <><div className="border-t border-slate-200"/><section><h2 className="text-sm font-medium text-slate-500">Rehab timeline</h2><div className="mt-3 grid grid-cols-3 gap-2">{Object.values(timeline).map((label) => <div key={label} className="rounded-xl bg-white p-3 text-center text-sm font-medium shadow-sm">{label}</div>)}</div></section></> : null}</div>;
}

export default function HomeScreen({ user, surgeryDate, trainingMode = "gym", onOpenWorkout, fromProgramme = false, onBackToProgramme, repository = defaultRepository }) {
  const [plans, setPlans] = useState([]); const [workouts, setWorkouts] = useState([]); const [occurrences, setOccurrences] = useState([]); const [showSessions, setShowSessions] = useState(false); const [routineExpanded, setRoutineExpanded] = useState(false);
  const today = todayString();
  useEffect(() => repository.subscribePlans(db, user.uid, setPlans, () => {}), [repository, user.uid]);
  useEffect(() => repository.subscribeWorkouts(db, user.uid, setWorkouts, () => {}), [repository, user.uid]);
  const programme = useMemo(() => plans.filter((plan) => plan.isActive && !plan.isArchived).sort((a, b) => String(b.updatedAtToken || b.id).localeCompare(String(a.updatedAtToken || a.id)))[0] || null, [plans]);
  useEffect(() => { if (!programme || !repository.subscribeRoutineOccurrences) return undefined; return repository.subscribeRoutineOccurrences(db, user.uid, programme.id, today, setOccurrences, () => {}); }, [programme, repository, today, user.uid]);
  const unfinishedWorkout = useMemo(() => workouts.find((workout) => workout.status === "in_progress") || null, [workouts]);
  const routineTasks = useMemo(() => mergeRoutineOccurrences(scheduledRoutineTasks(programme, new Date(`${today}T00:00:00`)), occurrences), [programme, occurrences, today]);
  async function setStatus(task, status) { const saved = await repository.setRoutineOccurrenceStatus(db, user.uid, { id: occurrenceId(programme.id, today, task.id), programmeId: programme.id, taskId: task.id, scheduledDate: today, status }); setOccurrences((current) => [...current.filter((item) => item.taskId !== task.id), saved]); }
  return <div className="space-y-8">{fromProgramme ? <Button variant="outline" onClick={onBackToProgramme}>← Back to programme</Button> : null}<HomeDashboard programme={programme} unfinishedWorkout={unfinishedWorkout} surgeryDate={surgeryDate} trainingMode={trainingMode} today={today} routineTasks={routineTasks} routineExpanded={routineExpanded} onToggleRoutine={() => setRoutineExpanded((value) => !value)} onRoutineStatus={setStatus} showSessions={showSessions} onStart={() => setShowSessions(true)} onContinue={() => onOpenWorkout({ mode: "continue", workoutId: unfinishedWorkout.id })} onChooseSession={(sessionId) => onOpenWorkout({ mode: "session", sessionId })} onOneOff={() => onOpenWorkout({ mode: "one_off" })} /><section id="exercise-library" className="scroll-mt-6"><PlansScreen user={user} view="exercises" /></section></div>;
}
