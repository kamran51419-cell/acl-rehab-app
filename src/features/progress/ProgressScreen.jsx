import React, { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Button from "../../components/ui/Button";
import { db } from "../../firebase";
import { dailyHeaviest, EXERCISE_VARIANT, groupExerciseProgress, heaviestEntry, resultLabel, symmetryEntries, variantEntries } from "../../lib/domain/exerciseProgress";
import { SIDE } from "../../lib/domain/v2Models";
import { subscribeWorkouts } from "../../lib/firebase/planRepository";

const defaultRepository = { subscribeWorkouts };

function MetricCard({ label, entry }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-sm text-slate-500">{label}</div><div className="mt-1 text-lg font-semibold">{resultLabel(entry)}</div><div className="text-sm text-slate-500">{entry?.displayDate || ""}</div></div>;
}

function WeightTooltip({ active, payload }) {
  const entry = payload?.[0]?.payload;
  if (!active || !entry) return null;
  const series = payload.filter((item) => item.value !== undefined);
  return <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg"><div className="font-medium">{entry.displayDate}</div>{series.map((item) => <div key={item.dataKey}>{item.name}: {item.value} kg{entry[`${item.dataKey}Reps`] ? ` × ${entry[`${item.dataKey}Reps`]}` : ""}</div>)}</div>;
}

function WeightGraph({ entries, single }) {
  const points = useMemo(() => {
    const daily = dailyHeaviest(entries);
    if (!single) return daily.map((entry) => ({ ...entry, value: entry.weight, valueReps: entry.reps }));
    const dates = new Map();
    daily.forEach((entry) => { if (!dates.has(entry.date)) dates.set(entry.date, { date: entry.date, displayDate: entry.displayDate }); const point = dates.get(entry.date); const key = entry.side === SIDE.RIGHT ? "right" : "left"; point[key] = entry.weight; point[`${key}Reps`] = entry.reps; });
    return [...dates.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [entries, single]);
  return <div className="h-64 rounded-2xl border border-slate-200 bg-white p-3"><ResponsiveContainer width="100%" height="100%"><LineChart data={points}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="displayDate"/><YAxis unit=" kg" width={55}/><Tooltip content={<WeightTooltip />}/>{single ? <><Line type="monotone" dataKey="left" name="Left" stroke="#2563eb" strokeWidth={2} connectNulls/><Line type="monotone" dataKey="right" name="Right" stroke="#059669" strokeWidth={2} connectNulls/></> : <Line type="monotone" dataKey="value" name="Weight" stroke="#2563eb" strokeWidth={2}/>}</LineChart></ResponsiveContainer></div>;
}

function ExerciseHistory({ entries, single }) {
  return <section><h2 className="mb-3 text-lg font-semibold">Exercise history</h2><div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">{entries.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3"><div><div className="font-medium">{entry.displayDate}</div>{single ? <div className="text-xs text-slate-500">{entry.side === SIDE.RIGHT ? "Right" : "Left"}</div> : null}</div><div className="font-medium">{resultLabel(entry)}</div></div>)}</div></section>;
}

function SymmetryView({ entries }) {
  const newest = entries.slice().reverse();
  return <div className="space-y-5"><div className="h-64 rounded-2xl border border-slate-200 bg-white p-3"><ResponsiveContainer width="100%" height="100%"><LineChart data={entries}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="displayDate"/><YAxis domain={[0, 100]} unit="%"/><Tooltip/><Line type="monotone" dataKey="symmetry" name="Symmetry" stroke="#059669" strokeWidth={2}/></LineChart></ResponsiveContainer></div><section><h2 className="mb-3 text-lg font-semibold">Symmetry history</h2><div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">{newest.map((entry) => <div key={entry.date} className="flex items-center justify-between px-4 py-3"><div><div className="font-medium">{entry.displayDate}</div><div className="text-xs text-slate-500">Left {entry.left} kg · Right {entry.right} kg</div></div><div className="font-semibold">{entry.symmetry}%</div></div>)}</div></section></div>;
}

export function ExerciseProgressPage({ group, trainingMode, onBack }) {
  const doubles = variantEntries(group, EXERCISE_VARIANT.DOUBLE);
  const singles = variantEntries(group, EXERCISE_VARIANT.SINGLE);
  const symmetry = trainingMode === "rehab" ? symmetryEntries(group) : [];
  const tabs = [...(doubles.length ? [{ id: EXERCISE_VARIANT.DOUBLE, label: "Double" }] : []), ...(singles.length ? [{ id: EXERCISE_VARIANT.SINGLE, label: "Single" }] : []), ...(symmetry.length ? [{ id: EXERCISE_VARIANT.SYMMETRY, label: "Symmetry" }] : [])];
  const [tab, setTab] = useState(tabs[0]?.id);
  const entries = tab === EXERCISE_VARIANT.SINGLE ? singles : doubles;
  return <div className="mx-auto max-w-3xl space-y-5"><button type="button" onClick={onBack} className="text-sm font-medium text-slate-600">← Progress</button><div><h1 className="text-2xl font-semibold">{group.name}</h1></div><div className="flex gap-2 overflow-x-auto">{tabs.map((item) => <Button key={item.id} variant={tab === item.id ? "primary" : "outline"} onClick={() => setTab(item.id)}>{item.label}</Button>)}</div>{tab === EXERCISE_VARIANT.SYMMETRY ? <SymmetryView entries={symmetry}/> : <><WeightGraph entries={entries} single={tab === EXERCISE_VARIANT.SINGLE}/><div className="grid grid-cols-2 gap-3"><MetricCard label="Latest" entry={entries[0]}/><MetricCard label="Heaviest" entry={heaviestEntry(entries)}/></div><ExerciseHistory entries={entries} single={tab === EXERCISE_VARIANT.SINGLE}/></>}</div>;
}

export function ProgressBrowser({ workouts, trainingMode, onWorkoutHistory }) {
  const groups = useMemo(() => groupExerciseProgress(workouts), [workouts]);
  const [selectedId, setSelectedId] = useState(null);
  const selected = groups.find((group) => group.exerciseId === selectedId);
  if (selected) return <ExerciseProgressPage group={selected} trainingMode={trainingMode} onBack={() => setSelectedId(null)}/>;
  return <div className="mx-auto max-w-3xl space-y-5"><div className="flex items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">Progress</h1><p className="text-sm text-slate-500">Track your weighted exercises.</p></div><Button variant="outline" onClick={onWorkoutHistory}>Workout history</Button></div>{groups.length ? <div className="space-y-2">{groups.map((group) => <button key={group.exerciseId} type="button" onClick={() => setSelectedId(group.exerciseId)} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"><span><span className="block font-semibold">{group.name}</span><span className="mt-1 block text-xs text-slate-500">Latest</span><span className="block font-medium">{resultLabel(group.latest)}</span><span className="block text-sm text-slate-500">{group.latest.displayDate}</span></span><ChevronRight className="h-5 w-5 text-slate-400"/></button>)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Complete a Reps + Weight exercise to see progress here.</div>}</div>;
}

export default function ProgressScreen({ user, trainingMode, onWorkoutHistory, repository = defaultRepository }) {
  const [workouts, setWorkouts] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => repository.subscribeWorkouts(db, user.uid, setWorkouts, (loadError) => { console.error("Could not load progress", loadError); setError("Progress could not be loaded. Check your connection and try again."); }), [repository, user.uid]);
  return <>{error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}<ProgressBrowser workouts={workouts} trainingMode={trainingMode} onWorkoutHistory={onWorkoutHistory}/></>;
}
