import React, { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Button from "../../components/ui/Button";
import { db } from "../../firebase";
import { completedExerciseGroups, dailyHeaviest, exerciseProgressSummary, EXERCISE_VARIANT, resultLabel, symmetryEntries, variantEntries, weightedPersonalBests } from "../../lib/domain/exerciseProgress";
import { completedWorkoutHistory } from "../../lib/domain/workoutDisplay";
import { SIDE } from "../../lib/domain/v2Models";
import { subscribeWorkouts } from "../../lib/firebase/planRepository";
import WorkoutHistoryScreen from "../workout/WorkoutHistoryScreen";

const defaultRepository = { subscribeWorkouts };

function StatCard({ label, value, detail }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-sm text-slate-500">{label}</div><div className="mt-1 text-lg font-semibold">{value || "—"}</div>{detail ? <div className="text-sm text-slate-500">{detail}</div> : null}</div>;
}

function WeightTooltip({ active, payload }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg"><div className="font-medium">{point.displayDate}</div>{payload.filter((item) => item.value !== undefined).map((item) => <div key={item.dataKey}>{item.name}: {item.value} kg{point[`${item.dataKey}Reps`] ? ` × ${point[`${item.dataKey}Reps`]}` : ""}</div>)}</div>;
}

function WeightGraph({ entries, single }) {
  const points = useMemo(() => {
    const daily = dailyHeaviest(entries);
    if (!single) return daily.map((entry) => ({ ...entry, weightReps: entry.reps }));
    const dates = new Map();
    daily.forEach((entry) => { if (!dates.has(entry.date)) dates.set(entry.date, { date: entry.date, displayDate: entry.displayDate }); const point = dates.get(entry.date); const key = entry.side === SIDE.RIGHT ? "right" : "left"; point[key] = entry.weight; point[`${key}Reps`] = entry.reps; });
    return [...dates.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [entries, single]);
  if (!points.length) return null;
  return <section className="space-y-2"><h3 className="font-semibold">Weight progress</h3><div className="h-64 rounded-2xl border border-slate-200 bg-white p-3"><ResponsiveContainer width="100%" height="100%"><LineChart data={points}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="displayDate"/><YAxis unit=" kg" width={55}/><Tooltip content={<WeightTooltip />}/>{single ? <><Line type="monotone" dataKey="left" name="Left" stroke="#2563eb" strokeWidth={2} connectNulls/><Line type="monotone" dataKey="right" name="Right" stroke="#059669" strokeWidth={2} connectNulls/></> : <Line type="monotone" dataKey="weight" name="Weight" stroke="#2563eb" strokeWidth={2}/>}</LineChart></ResponsiveContainer></div></section>;
}

function SymmetryStats({ group }) {
  const points = symmetryEntries(group);
  if (!points.length) return null;
  const latest = points.at(-1);
  return <section className="space-y-3"><div><h2 className="text-lg font-semibold">Symmetry</h2><p className="text-sm text-slate-500">Latest {latest.symmetry}% · Left {latest.left} kg · Right {latest.right} kg</p></div><div className="h-56 rounded-2xl border border-slate-200 bg-white p-3"><ResponsiveContainer width="100%" height="100%"><LineChart data={points}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="displayDate"/><YAxis domain={[0, 100]} unit="%"/><Tooltip/><Line type="monotone" dataKey="symmetry" name="Symmetry" stroke="#059669" strokeWidth={2}/></LineChart></ResponsiveContainer></div></section>;
}

function WeightedStats({ group, trainingMode }) {
  const doubles = variantEntries(group, EXERCISE_VARIANT.DOUBLE);
  const singles = variantEntries(group, EXERCISE_VARIANT.SINGLE);
  const variants = [...(doubles.length ? [{ id: EXERCISE_VARIANT.DOUBLE, label: "Double", entries: doubles }] : []), ...(singles.length ? [{ id: EXERCISE_VARIANT.SINGLE, label: "Single", entries: singles }] : [])];
  const [variant, setVariant] = useState(variants[0]?.id);
  const selected = variants.find((item) => item.id === variant) || variants[0];
  const bests = weightedPersonalBests(selected?.entries || []);
  if (!selected || !bests) return null;
  return <div className="space-y-5">{variants.length > 1 ? <div className="flex gap-2">{variants.map((item) => <Button key={item.id} variant={selected.id === item.id ? "primary" : "outline"} onClick={() => setVariant(item.id)}>{item.label}</Button>)}</div> : null}<WeightGraph entries={selected.entries} single={selected.id === EXERCISE_VARIANT.SINGLE}/><section className="space-y-3"><h2 className="text-lg font-semibold">Personal bests</h2><div className="grid gap-3 sm:grid-cols-3"><StatCard label="Heaviest weight" value={`${bests.heaviest.weight} kg`} detail={`${bests.heaviest.reps || "—"} reps · ${bests.heaviest.displayDate}`}/><StatCard label="Best set" value={resultLabel(bests.bestSet)} detail={bests.bestSet.displayDate}/><StatCard label="Highest volume" value={`${Math.round(bests.highestVolume.volume)} kg`} detail={bests.highestVolume.displayDate}/></div></section>{trainingMode === "rehab" && singles.length ? <SymmetryStats group={group}/> : null}</div>;
}

export function ExerciseStats({ group, trainingMode }) {
  const summary = exerciseProgressSummary(group);
  const latestExercise = summary.latest?.exercise;
  const latestPerformance = summary.latestBest ? resultLabel(summary.latestBest) : latestExercise?.completed ? "Completed" : "Recorded";
  return <div className="space-y-5"><div><h2 className="text-xl font-semibold">{group.name}</h2><p className="text-sm text-slate-500">Completed workout data only</p></div><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="First recorded workout" value={summary.first?.displayDate}/><StatCard label="Latest workout" value={summary.latest?.displayDate}/><StatCard label="Improvement" value={summary.improvement === null ? "Not available" : `${summary.improvement >= 0 ? "+" : ""}${summary.improvement} kg`} detail={summary.firstBest && summary.latestBest ? `${summary.firstBest.weight} kg to ${summary.latestBest.weight} kg` : "Requires weighted results"}/><StatCard label="Latest performance" value={latestPerformance} detail={summary.latest?.displayDate}/></section>{group.weightedEntries.length ? <WeightedStats group={{ ...group, entries: group.weightedEntries }} trainingMode={trainingMode}/> : <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">This exercise is not recorded with Reps + Weight, so weight graphs and personal bests are not applicable.</div>}</div>;
}

export function StatsView({ workouts, trainingMode }) {
  const completed = useMemo(() => completedWorkoutHistory(workouts), [workouts]);
  const groups = useMemo(() => completedExerciseGroups(completed), [completed]);
  const [exerciseId, setExerciseId] = useState("all");
  const selected = groups.find((group) => group.exerciseId === exerciseId);
  if (!completed.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><h2 className="font-semibold">No completed workouts yet</h2><p className="mt-1 text-sm text-slate-500">Complete a workout to start building your stats.</p></div>;
  const first = completed.at(-1);
  const latest = completed[0];
  return <div className="space-y-5"><label className="block max-w-sm text-sm font-medium text-slate-700">Exercise<select className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3" value={exerciseId} onChange={(event) => setExerciseId(event.target.value)}><option value="all">All Exercises</option>{groups.map((group) => <option key={group.exerciseId} value={group.exerciseId}>{group.name}</option>)}</select></label>{selected ? <ExerciseStats group={selected} trainingMode={trainingMode}/> : <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="Completed workouts" value={String(completed.length)}/><StatCard label="Exercises tracked" value={String(groups.length)}/><StatCard label="First recorded workout" value={first?.date ? first.date.split("-").reverse().join("/") : "—"}/><StatCard label="Latest workout" value={latest?.date ? latest.date.split("-").reverse().join("/") : "—"}/></section>}</div>;
}

export function ProgressLayout({ user, workouts, trainingMode, initialTab = "stats" }) {
  const [tab, setTab] = useState(initialTab);
  return <div className="space-y-5"><h1 className="text-2xl font-semibold">Progress</h1><div className="flex gap-2 border-b border-slate-200 pb-3"><Button variant={tab === "history" ? "primary" : "outline"} onClick={() => setTab("history")}>Workout History</Button><Button variant={tab === "stats" ? "primary" : "outline"} onClick={() => setTab("stats")}>Stats</Button></div>{tab === "history" ? <WorkoutHistoryScreen user={user} showNavigation={false}/> : <StatsView workouts={workouts} trainingMode={trainingMode}/>}</div>;
}

export default function ProgressScreen({ user, trainingMode, initialTab = "stats", repository = defaultRepository }) {
  const [workouts, setWorkouts] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => repository.subscribeWorkouts(db, user.uid, setWorkouts, (loadError) => { console.error("Could not load progress", loadError); setError("Progress could not be loaded. Check your connection and try again."); }), [repository, user.uid]);
  return <>{error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}<ProgressLayout user={user} workouts={workouts} trainingMode={trainingMode} initialTab={initialTab}/></>;
}
