import React, { useEffect, useMemo, useState } from "react";
import { ChevronRight, Dumbbell } from "lucide-react";
import { db } from "../../firebase";
import { planPrescriptionSummary } from "../../lib/domain/plans";
import { durationLabel, groupSessionExercises, previousWeightForExercise, workoutItem } from "../../lib/domain/workoutDisplay";
import { subscribePlans, subscribeWorkouts } from "../../lib/firebase/planRepository";

function CompletionList({ title, exercises, checked, onToggle }) {
  if (!exercises.length) return null;
  return <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><h2 className="font-semibold text-slate-900">{title}</h2><div className="mt-3 space-y-2">{exercises.map((exercise) => { const item = workoutItem(exercise); const done = checked.has(item.id); return <label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3 ${done ? "opacity-60" : ""}`}><input className="mt-1" type="checkbox" checked={done} onChange={() => onToggle(item.id)} /><span className={done ? "line-through" : ""}><span className="block font-medium">{item.name}</span>{item.summary ? <span className="block text-sm text-slate-500">{item.summary}</span> : null}</span></label>; })}</div></section>;
}

function WeightCard({ exercise, value, onChange }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="font-semibold">{exercise.exerciseNameSnapshot}</div><div className="text-sm text-slate-500">{planPrescriptionSummary(exercise)}</div><label className="mt-3 block text-sm font-medium text-slate-700">Weight (kg)<input className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3" inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} /></label></div>;
}

function IntervalCard({ exercise, checked, onToggle }) {
  const stages = (exercise.prescription?.stages || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  return <label className={`block cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 ${checked ? "opacity-60" : ""}`}><span className="flex items-start gap-3"><input className="mt-1" type="checkbox" checked={checked} onChange={onToggle} /><span><span className={`block font-semibold ${checked ? "line-through" : ""}`}>{exercise.exerciseNameSnapshot}</span><span className="text-sm text-slate-500">Intervals</span></span></span><div className="mt-3 space-y-1 pl-7 text-sm text-slate-600">{stages.map((stage) => <div key={stage.id}>{stage.phase === "rest" ? "Rest" : "Work"} · {durationLabel(stage.durationSeconds, stage.durationUnit)}{stage.label ? ` · ${stage.label}` : ""}</div>)}</div></label>;
}

export default function WorkoutScreen({ user }) {
  const [plans, setPlans] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [checked, setChecked] = useState(new Set());
  const [weights, setWeights] = useState({});
  useEffect(() => user?.uid ? subscribePlans(db, user.uid, setPlans, () => {}) : undefined, [user?.uid]);
  useEffect(() => user?.uid ? subscribeWorkouts(db, user.uid, setWorkouts, () => {}) : undefined, [user?.uid]);
  const activeProgrammes = useMemo(() => plans.filter((plan) => plan.isActive && !plan.isArchived).sort((a, b) => String(b.activatedAt?.seconds || b.updatedAtToken || b.id).localeCompare(String(a.activatedAt?.seconds || a.updatedAtToken || a.id))), [plans]);
  const programme = activeProgrammes[0];
  const sessions = useMemo(() => (programme?.sessions || []).slice().sort((a, b) => a.sortOrder - b.sortOrder), [programme]);

  function toggleChecked(id) { setChecked((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function chooseSession(session) {
    setSelectedSession(session);
    const initialWeights = {};
    (session.exercises || []).forEach((exercise) => { const previous = previousWeightForExercise(workouts, exercise.exerciseId); if (previous !== "") initialWeights[exercise.id] = String(previous); });
    setWeights(initialWeights);
  }

  if (selectedSession) {
    const exercises = selectedSession.exercises || [];
    const { mobility, other, standard, weighted, intervals } = groupSessionExercises(exercises);
    return <div className="space-y-5"><button className="text-sm font-medium text-slate-600" onClick={() => { setSelectedSession(null); setChecked(new Set()); setWeights({}); }}>← All sessions</button><div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="text-sm font-medium text-emerald-700">Ready to start</div><h1 className="mt-1 text-2xl font-semibold">{selectedSession.name}</h1><p className="mt-2 text-slate-500">{programme.name} · {exercises.length} exercises</p><div className="mt-5 space-y-3"><CompletionList title="Exercises" exercises={standard} checked={checked} onToggle={toggleChecked} /><CompletionList title="Mobility / Stretch" exercises={mobility} checked={checked} onToggle={toggleChecked} /><CompletionList title="Other" exercises={other} checked={checked} onToggle={toggleChecked} />{weighted.map((exercise) => <WeightCard key={exercise.id} exercise={exercise} value={weights[exercise.id] || ""} onChange={(value) => setWeights((current) => ({ ...current, [exercise.id]: value }))} />)}{intervals.map((exercise) => <IntervalCard key={exercise.id} exercise={exercise} checked={checked.has(exercise.id)} onToggle={() => toggleChecked(exercise.id)} />)}</div><p className="mt-5 text-sm text-slate-500">Workout entries will keep the workout date independent from when the entry is created.</p></div></div>;
  }

  return <div className="space-y-5"><div><p className="text-sm font-medium text-emerald-700">Current Programme</p><h1 className="text-2xl font-semibold">Workout</h1><p className="text-sm text-slate-500">Choose the session you are performing. There is no fixed day or required order.</p></div>{activeProgrammes.length > 1 ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Multiple legacy programmes are active. Activate your preferred programme again to normalize this to one.</div> : null}{!programme ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"><Dumbbell className="mx-auto mb-3 text-slate-400"/><h2 className="font-semibold">No active programme</h2><p className="text-sm text-slate-500">Activate a programme before starting a workout.</p></div> : <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">{programme.name}</h2><div className="mt-4 space-y-2">{sessions.map((session) => <button key={session.id} onClick={() => chooseSession(session)} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50"><span><span className="block font-semibold">{session.name}</span><span className="text-sm text-slate-500">{session.exercises?.length || 0} exercises</span></span><ChevronRight className="h-5 w-5 text-slate-400"/></button>)}</div></div>}</div>;
}
