import React, { useEffect, useMemo, useState } from "react";
import { ChevronRight, Dumbbell } from "lucide-react";
import { db } from "../../firebase";
import { subscribePlans } from "../../lib/firebase/planRepository";

export default function WorkoutScreen({ user }) {
  const [plans, setPlans] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  useEffect(() => user?.uid ? subscribePlans(db, user.uid, setPlans, () => {}) : undefined, [user?.uid]);
  const programme = useMemo(() => plans.find((plan) => plan.isActive && !plan.isArchived), [plans]);
  const sessions = useMemo(() => (programme?.sessions || []).slice().sort((a, b) => a.sortOrder - b.sortOrder), [programme]);

  if (selectedSession) return <div className="space-y-5"><button className="text-sm font-medium text-slate-600" onClick={() => setSelectedSession(null)}>← All sessions</button><div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="text-sm font-medium text-emerald-700">Ready to start</div><h1 className="mt-1 text-2xl font-semibold">{selectedSession.name}</h1><p className="mt-2 text-slate-500">{programme.name} · {selectedSession.exercises?.length || 0} exercises</p><div className="mt-5 space-y-2">{selectedSession.exercises?.map((exercise) => <div key={exercise.id} className="rounded-xl bg-slate-50 p-3"><div className="font-medium">{exercise.exerciseNameSnapshot}</div>{exercise.notes ? <div className="text-sm text-slate-500">{exercise.notes}</div> : null}</div>)}</div><p className="mt-5 text-sm text-slate-500">Detailed workout logging will be added here. Workout dates will be independent of entry dates.</p></div></div>;

  return <div className="space-y-5"><div><p className="text-sm font-medium text-emerald-700">Current Programme</p><h1 className="text-2xl font-semibold">Workout</h1><p className="text-sm text-slate-500">Choose the session you are performing. There is no fixed day or required order.</p></div>{!programme ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"><Dumbbell className="mx-auto mb-3 text-slate-400"/><h2 className="font-semibold">No active programme</h2><p className="text-sm text-slate-500">Activate a programme before starting a workout.</p></div> : <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">{programme.name}</h2><div className="mt-4 space-y-2">{sessions.map((session) => <button key={session.id} onClick={() => setSelectedSession(session)} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50"><span><span className="block font-semibold">{session.name}</span><span className="text-sm text-slate-500">{session.exercises?.length || 0} exercises</span></span><ChevronRight className="h-5 w-5 text-slate-400"/></button>)}</div></div>}</div>;
}
