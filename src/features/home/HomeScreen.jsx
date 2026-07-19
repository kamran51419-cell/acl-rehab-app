import React, { useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import { db } from "../../firebase";
import { rehabTimeline } from "../../lib/domain/homeDashboard";
import { todayString } from "../../lib/domain/date";
import { subscribePlans, subscribeWorkouts } from "../../lib/firebase/planRepository";
import PlansScreen from "../plans/PlansScreen";

const defaultRepository = { subscribePlans, subscribeWorkouts };

export function HomeDashboard({ programme, unfinishedWorkout, surgeryDate, trainingMode = "gym", today, showSessions, onStart, onContinue, onChooseSession, onProgramme }) {
  const sessions = (programme?.sessions || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const timeline = trainingMode === "rehab" && surgeryDate ? rehabTimeline(surgeryDate, today) : null;
  return <div className="mx-auto max-w-2xl space-y-8"><div><p className="text-sm font-medium text-emerald-700">{trainingMode === "rehab" ? "Rehab training" : "Gym training"}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Home</h1></div><section className="space-y-2"><p className="text-sm text-slate-500">Current programme</p><h2 className="text-xl font-semibold">{programme?.name || "No active programme"}</h2>{!programme ? <Button variant="outline" onClick={onProgramme}>Create or activate a programme</Button> : null}</section><div className="border-t border-slate-200"/><section className="space-y-4">{unfinishedWorkout ? <Button className="w-full py-3 text-base" onClick={onContinue}>Continue Workout</Button> : <Button className="w-full py-3 text-base" disabled={!programme} onClick={onStart}>Start Workout</Button>}{showSessions && programme && !unfinishedWorkout ? <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-semibold">Choose a session</h2><div className="mt-3 space-y-2">{sessions.map((session) => <button type="button" key={session.id} onClick={() => onChooseSession(session.id)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left font-medium hover:bg-slate-50">{session.name}</button>)}</div></div> : null}</section>{timeline ? <><div className="border-t border-slate-200"/><section><h2 className="text-sm font-medium text-slate-500">Rehab timeline</h2><div className="mt-3 grid grid-cols-3 gap-2">{Object.values(timeline).map((label) => <div key={label} className="rounded-xl bg-white p-3 text-center text-sm font-medium shadow-sm">{label}</div>)}</div></section></> : null}</div>;
}

export default function HomeScreen({ user, surgeryDate, trainingMode = "gym", onOpenWorkout, onOpenProgramme, fromProgramme = false, onBackToProgramme, repository = defaultRepository }) {
  const [plans, setPlans] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [showSessions, setShowSessions] = useState(false);
  useEffect(() => repository.subscribePlans(db, user.uid, setPlans, () => {}), [repository, user.uid]);
  useEffect(() => repository.subscribeWorkouts(db, user.uid, setWorkouts, () => {}), [repository, user.uid]);
  const programme = useMemo(() => plans.filter((plan) => plan.isActive && !plan.isArchived).sort((a, b) => String(b.updatedAtToken || b.id).localeCompare(String(a.updatedAtToken || a.id)))[0] || null, [plans]);
  const unfinishedWorkout = useMemo(() => workouts.find((workout) => workout.status === "in_progress") || null, [workouts]);
  return <div className="space-y-10">{fromProgramme ? <Button variant="outline" onClick={onBackToProgramme}>← Back to programme</Button> : null}<HomeDashboard programme={programme} unfinishedWorkout={unfinishedWorkout} surgeryDate={surgeryDate} trainingMode={trainingMode} today={todayString()} showSessions={showSessions} onStart={() => setShowSessions(true)} onContinue={() => onOpenWorkout({ mode: "continue", workoutId: unfinishedWorkout.id })} onChooseSession={(sessionId) => onOpenWorkout({ mode: "session", sessionId })} onProgramme={onOpenProgramme} /><section id="exercise-library" className="scroll-mt-6"><PlansScreen user={user} view="exercises" /></section></div>;
}
