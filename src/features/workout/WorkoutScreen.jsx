import React, { useEffect, useMemo, useState } from "react";
import { ChevronRight, Dumbbell } from "lucide-react";
import { db } from "../../firebase";
import { planPrescriptionSummary } from "../../lib/domain/plans";
import { checklistItems, groupSessionExercises } from "../../lib/domain/workoutDisplay";
import { subscribePlans } from "../../lib/firebase/planRepository";

function Checklist({ title, exercises, checked, onToggle }) {
  const items = exercises.flatMap(checklistItems);
  if (!items.length) return null;
  return <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><h2 className="font-semibold text-slate-900">{title}</h2><div className="mt-3 space-y-2">{items.map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-xl bg-white p-3"><input type="checkbox" checked={checked.has(item.id)} onChange={() => onToggle(item.id)} /><span className={checked.has(item.id) ? "text-slate-400 line-through" : "text-slate-800"}>{item.name}{item.duration ? ` — ${item.duration}` : ""}</span></label>)}</div></section>;
}

export default function WorkoutScreen({ user }) {
  const [plans, setPlans] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [checked, setChecked] = useState(new Set());
  useEffect(() => user?.uid ? subscribePlans(db, user.uid, setPlans, () => {}) : undefined, [user?.uid]);
  const programme = useMemo(() => plans.find((plan) => plan.isActive && !plan.isArchived), [plans]);
  const sessions = useMemo(() => (programme?.sessions || []).slice().sort((a, b) => a.sortOrder - b.sortOrder), [programme]);

  function toggleChecked(id) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (selectedSession) {
    const exercises = selectedSession.exercises || [];
    const { mobility, tasks, regular } = groupSessionExercises(exercises);
    return <div className="space-y-5"><button className="text-sm font-medium text-slate-600" onClick={() => { setSelectedSession(null); setChecked(new Set()); }}>← All sessions</button><div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="text-sm font-medium text-emerald-700">Ready to start</div><h1 className="mt-1 text-2xl font-semibold">{selectedSession.name}</h1><p className="mt-2 text-slate-500">{programme.name} · {exercises.length} exercises</p><div className="mt-5 space-y-3">{regular.map((exercise) => <div key={exercise.id} className="rounded-xl bg-slate-50 p-3"><div className="font-medium">{exercise.exerciseNameSnapshot}</div><div className="text-sm text-slate-500">{planPrescriptionSummary(exercise)}</div>{exercise.notes ? <div className="text-sm text-slate-500">{exercise.notes}</div> : null}</div>)}<Checklist title="Mobility / Stretch" exercises={mobility} checked={checked} onToggle={toggleChecked} /><Checklist title="Tasks" exercises={tasks} checked={checked} onToggle={toggleChecked} /></div><p className="mt-5 text-sm text-slate-500">Checklist progress is a workout preview. Persistent logging will keep the workout date independent from the entry date.</p></div></div>;
  }

  return <div className="space-y-5"><div><p className="text-sm font-medium text-emerald-700">Current Programme</p><h1 className="text-2xl font-semibold">Workout</h1><p className="text-sm text-slate-500">Choose the session you are performing. There is no fixed day or required order.</p></div>{!programme ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"><Dumbbell className="mx-auto mb-3 text-slate-400"/><h2 className="font-semibold">No active programme</h2><p className="text-sm text-slate-500">Activate a programme before starting a workout.</p></div> : <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">{programme.name}</h2><div className="mt-4 space-y-2">{sessions.map((session) => <button key={session.id} onClick={() => setSelectedSession(session)} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50"><span><span className="block font-semibold">{session.name}</span><span className="text-sm text-slate-500">{session.exercises?.length || 0} exercises</span></span><ChevronRight className="h-5 w-5 text-slate-400"/></button>)}</div></div>}</div>;
}
