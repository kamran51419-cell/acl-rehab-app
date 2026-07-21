import React, { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Button from "../../components/ui/Button";
import { db } from "../../firebase";
import { completedExerciseGroups, dailyHeaviest, PROGRESS_SIDE_MODE, resultLabel, sideModeEntries, symmetryEntries, weightedPersonalBests } from "../../lib/domain/exerciseProgress";
import { completedWorkoutHistory } from "../../lib/domain/workoutDisplay";
import { SIDE } from "../../lib/domain/v2Models";
import { subscribeWorkouts } from "../../lib/firebase/planRepository";
import WorkoutHistoryScreen from "../workout/WorkoutHistoryScreen";

const defaultRepository = { subscribeWorkouts };
const SIDE_MODE_ORDER = [PROGRESS_SIDE_MODE.STANDARD, PROGRESS_SIDE_MODE.LEFT_RIGHT, PROGRESS_SIDE_MODE.LEFT_ONLY, PROGRESS_SIDE_MODE.RIGHT_ONLY];
const SIDE_MODE_LABELS = {
  [PROGRESS_SIDE_MODE.STANDARD]: "Standard",
  [PROGRESS_SIDE_MODE.LEFT_RIGHT]: "Left & Right",
  [PROGRESS_SIDE_MODE.LEFT_ONLY]: "Left only",
  [PROGRESS_SIDE_MODE.RIGHT_ONLY]: "Right only",
};

function StatCard({ label, value, detail }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-sm text-slate-500">{label}</div><div className="mt-1 text-lg font-semibold">{value || "—"}</div>{detail ? <div className="text-sm text-slate-500">{detail}</div> : null}</div>;
}

function WeightTooltip({ active, payload }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg"><div className="font-medium">{point.displayDate}</div>{payload.filter((item) => item.value !== undefined).map((item) => <div key={item.dataKey}>{item.name}: {item.value} kg{point[`${item.dataKey}Reps`] ? ` × ${point[`${item.dataKey}Reps`]}` : ""}</div>)}</div>;
}

function graphKey(entry) {
  if (entry.sideMode === PROGRESS_SIDE_MODE.LEFT_RIGHT) return entry.side === SIDE.RIGHT ? "leftRightRight" : "leftRightLeft";
  if (entry.sideMode === PROGRESS_SIDE_MODE.LEFT_ONLY) return "leftOnly";
  if (entry.sideMode === PROGRESS_SIDE_MODE.RIGHT_ONLY) return "rightOnly";
  return "standard";
}

const GRAPH_SERIES = {
  standard: "Standard",
  leftRightLeft: "Left & Right · Left",
  leftRightRight: "Left & Right · Right",
  leftOnly: "Left only",
  rightOnly: "Right only",
};

function WeightGraph({ entries }) {
  const { points, series } = useMemo(() => {
    const dates = new Map();
    dailyHeaviest(entries).forEach((entry) => {
      if (!dates.has(entry.date)) dates.set(entry.date, { date: entry.date, displayDate: entry.displayDate });
      const point = dates.get(entry.date);
      const key = graphKey(entry);
      point[key] = entry.weight;
      point[`${key}Reps`] = entry.reps;
    });
    const activeKeys = [...new Set(dailyHeaviest(entries).map(graphKey))];
    return { points: [...dates.values()].sort((a, b) => a.date.localeCompare(b.date)), series: activeKeys };
  }, [entries]);
  if (!points.length) return null;
  return <section className="space-y-2"><h3 className="font-semibold">Weight progress</h3><div className="h-64 rounded-2xl border border-slate-200 bg-white p-3"><ResponsiveContainer width="100%" height="100%"><LineChart data={points}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="displayDate"/><YAxis unit=" kg" width={55}/><Tooltip content={<WeightTooltip />}/>{series.map((key) => <Line key={key} type="monotone" dataKey={key} name={GRAPH_SERIES[key]} strokeWidth={2} connectNulls/>)}</LineChart></ResponsiveContainer></div></section>;
}

function SymmetryStats({ group }) {
  const points = symmetryEntries(group);
  if (!points.length) return null;
  const latest = points.at(-1);
  return <section className="space-y-3"><div><h2 className="text-lg font-semibold">Symmetry</h2><p className="text-sm text-slate-500">Latest {latest.symmetry}% · Left {latest.left} kg · Right {latest.right} kg</p></div><div className="h-56 rounded-2xl border border-slate-200 bg-white p-3"><ResponsiveContainer width="100%" height="100%"><LineChart data={points}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="displayDate"/><YAxis domain={[0, 100]} unit="%"/><Tooltip/><Line type="monotone" dataKey="symmetry" name="Symmetry" strokeWidth={2}/></LineChart></ResponsiveContainer></div></section>;
}

function variantSummary(entries) {
  const daily = dailyHeaviest(entries);
  const byDate = new Map();
  daily.forEach((entry) => { const current = byDate.get(entry.date); if (!current || entry.weight > current.weight || (entry.weight === current.weight && entry.reps > current.reps)) byDate.set(entry.date, entry); });
  const performances = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const first = performances[0] || null;
  const latest = performances.at(-1) || null;
  return { first, latest, improvement: first && latest ? latest.weight - first.weight : null };
}

function WeightedStats({ group, trainingMode }) {
  const availableModes = SIDE_MODE_ORDER.filter((mode) => sideModeEntries(group, mode).length);
  const [mode, setMode] = useState(availableModes.length > 1 ? "all" : availableModes[0]);
  useEffect(() => {
    const valid = mode === "all" ? availableModes.length > 1 : availableModes.includes(mode);
    if (!valid) setMode(availableModes.length > 1 ? "all" : availableModes[0]);
  }, [availableModes.join("|"), mode]);
  const selectedEntries = mode === "all" ? group.entries : sideModeEntries(group, mode);
  const bests = weightedPersonalBests(selectedEntries);
  if (!selectedEntries.length || !bests) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">No valid weighted data is available for this exercise.</div>;
  const summary = variantSummary(selectedEntries);
  const showSymmetry = trainingMode === "rehab" && (mode === "all" || mode === PROGRESS_SIDE_MODE.LEFT_RIGHT) && symmetryEntries(group).length > 0;
  return <div className="space-y-5">{availableModes.length > 1 ? <div className="flex flex-wrap gap-2"><Button variant={mode === "all" ? "primary" : "outline"} onClick={() => setMode("all")}>All</Button>{availableModes.map((item) => <Button key={item} variant={mode === item ? "primary" : "outline"} onClick={() => setMode(item)}>{SIDE_MODE_LABELS[item]}</Button>)}</div> : <p className="text-sm font-medium text-slate-600">{SIDE_MODE_LABELS[availableModes[0]]}</p>}<section className="grid gap-3 sm:grid-cols-3"><StatCard label="Improvement" value={summary.improvement === null ? "Not available" : `${summary.improvement >= 0 ? "+" : ""}${summary.improvement} kg`} detail={summary.first && summary.latest ? `${summary.first.weight} kg to ${summary.latest.weight} kg` : null}/><StatCard label="Latest performance" value={resultLabel(summary.latest)} detail={summary.latest?.displayDate}/><StatCard label="Best set" value={resultLabel(bests.bestSet)} detail={bests.bestSet.displayDate}/></section><WeightGraph entries={selectedEntries}/>{showSymmetry ? <SymmetryStats group={group}/> : null}</div>;
}

export function ExerciseStats({ group, trainingMode, onBack }) {
  return <div className="space-y-5"><button type="button" onClick={onBack} className="text-sm font-medium text-slate-600">← Choose another exercise</button><div><h2 className="text-xl font-semibold">{group.name}</h2><p className="text-sm text-slate-500">Completed weighted workout data only</p></div><WeightedStats group={{ ...group, entries: group.weightedEntries }} trainingMode={trainingMode}/></div>;
}

function typeLabel(value) {
  return String(value || "Other").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function StatsView({ workouts, trainingMode }) {
  const completed = useMemo(() => completedWorkoutHistory(workouts), [workouts]);
  const groups = useMemo(() => completedExerciseGroups(completed).filter((group) => group.weightedEntries.length), [completed]);
  const [query, setQuery] = useState("");
  const [exerciseId, setExerciseId] = useState(null);
  const selected = groups.find((group) => group.exerciseId === exerciseId);
  if (!completed.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><h2 className="font-semibold">No completed workouts yet</h2><p className="mt-1 text-sm text-slate-500">Complete a workout to start building your stats.</p></div>;
  if (!groups.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><h2 className="font-semibold">No weighted exercise stats yet</h2><p className="mt-1 text-sm text-slate-500">Complete an exercise tracked by Reps + Weight to start building stats.</p></div>;
  if (selected) return <ExerciseStats group={selected} trainingMode={trainingMode} onBack={() => setExerciseId(null)}/>;
  const filtered = groups.filter((group) => group.name.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="mx-auto max-w-3xl space-y-4"><div><h2 className="text-lg font-semibold">Choose an exercise</h2><p className="text-sm text-slate-500">Weighted exercises from your completed workouts.</p></div><div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"/><input className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-base" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search weighted exercises" aria-label="Search weighted exercises"/></div><div className="max-h-[28rem] space-y-1.5 overflow-y-auto pr-1">{filtered.length ? filtered.map((group) => <button key={group.exerciseId} type="button" onClick={() => setExerciseId(group.exerciseId)} className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"><span><span className="block font-medium text-slate-900">{group.name}</span><span className="block text-xs text-slate-500">{typeLabel(group.exerciseType)}</span></span><span className="text-sm font-medium text-slate-500">View stats</span></button>) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">No weighted exercises match your search.</div>}</div></div>;
}

export function ProgressLayout({ user, workouts, trainingMode, initialTab = "stats" }) {
  const [tab, setTab] = useState(initialTab);
  return <div className="space-y-5"><div className="flex gap-2 border-b border-slate-200 pb-3"><Button variant={tab === "stats" ? "primary" : "outline"} onClick={() => setTab("stats")}>Stats</Button><Button variant={tab === "history" ? "primary" : "outline"} onClick={() => setTab("history")}>Workout History</Button></div>{tab === "history" ? <WorkoutHistoryScreen user={user} showNavigation={false}/> : <StatsView workouts={workouts} trainingMode={trainingMode}/>}</div>;
}

export default function ProgressScreen({ user, trainingMode, initialTab = "stats", repository = defaultRepository }) {
  const [workouts, setWorkouts] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => repository.subscribeWorkouts(db, user.uid, setWorkouts, (loadError) => { console.error("Could not load progress", loadError); setError("Progress could not be loaded. Check your connection and try again."); }), [repository, user.uid]);
  return <>{error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}<ProgressLayout user={user} workouts={workouts} trainingMode={trainingMode} initialTab={initialTab}/></>;
}
