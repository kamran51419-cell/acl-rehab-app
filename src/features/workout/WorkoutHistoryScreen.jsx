import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronDown, ChevronRight } from "lucide-react";
import Button from "../../components/ui/Button";
import { db } from "../../firebase";
import { formatDate } from "../../lib/domain/date";
import { completedWorkoutHistory, durationLabel, workoutExerciseSideLabel, workoutItem } from "../../lib/domain/workoutDisplay";
import { deleteWorkoutDocument, subscribeWorkouts } from "../../lib/firebase/planRepository";

const defaultRepository = { deleteWorkoutDocument, subscribeWorkouts };
const TYPE_ORDER = { strength: 0, other: 1, plyometric: 1, balance: 2, cardio: 3, mobility: 4, stretch: 4 };

function repsLabel(reps = {}, set = {}) {
  if (reps.type === "range") return `${reps.min}–${reps.max} reps`;
  const value = set.actualReps ?? set.reps ?? set.rawReps ?? reps.value;
  return value !== undefined && value !== "" ? `${value} reps` : "Reps —";
}

function completionTimeLabel(value) {
  const date = value?.toDate ? value.toDate() : value?.seconds ? new Date(value.seconds * 1000) : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function weekStart(dateValue) {
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue || "Unknown date";
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function weekHeading(value) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function workoutStats(workout) {
  const exercises = workout.exercises || [];
  const sets = exercises.reduce((total, exercise) => total + (exercise.recordedSets?.length || 0), 0);
  const completed = exercises.filter((exercise) => exercise.completed || exercise.recordedSets?.length).length;
  return { exercises: exercises.length, sets, completed };
}

function sortedExercises(workout) {
  return (workout.exercises || []).slice().sort((a, b) => {
    const typeDifference = (TYPE_ORDER[a.exerciseType] ?? 99) - (TYPE_ORDER[b.exerciseType] ?? 99);
    return typeDifference || Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });
}

function ExerciseDetails({ exercise }) {
  const side = workoutExerciseSideLabel(exercise);
  const summary = workoutItem(exercise).summary;
  const stages = (exercise.prescription?.stages || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="font-medium">{exercise.exerciseNameSnapshot}</div>{side ? <div className="text-xs font-medium text-slate-500">{side}</div> : null}{exercise.programmeNoteSnapshot ? <div className="text-xs text-slate-500">{exercise.programmeNoteSnapshot}</div> : null}{summary ? <div className="mt-1 text-sm text-slate-600">{summary}</div> : null}{exercise.recordedSets?.length ? <div className="mt-2 space-y-1 text-sm">{exercise.recordedSets.map((set) => <div key={set.id}>Set {set.setNumber}: {repsLabel(set.prescribedReps, set)} · {set.weight === "" || set.weight === undefined ? "—" : `${set.weight} kg`}</div>)}</div> : null}{stages.length ? <div className="mt-2 space-y-1 text-sm">{stages.map((stage) => <div key={stage.id}>{stage.phase === "rest" ? "Rest" : "Work"} · {durationLabel(stage.durationSeconds, stage.durationUnit)}</div>)}</div> : null}<div className="mt-2 text-xs text-slate-500">{exercise.completed ? "Completed" : exercise.recordedSets?.length ? "Recorded" : "Not completed"}</div></div>;
}

function openGraphs() {
  const clickByText = (text) => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === text);
    if (button) { button.click(); return true; }
    return false;
  };
  clickByText("Progress");
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (clickByText("Progress graphs") || attempts >= 12) window.clearInterval(timer);
  }, 100);
}

export function WorkoutHistoryView({ workouts, deletingId, deleteError, onRequestDelete, onCancelDelete, onConfirmDelete }) {
  const completed = completedWorkoutHistory(workouts);
  const [expandedId, setExpandedId] = useState(completed[0]?.id || null);
  useEffect(() => { if (expandedId && !completed.some((workout) => workout.id === expandedId)) setExpandedId(completed[0]?.id || null); }, [completed, expandedId]);
  const weeks = useMemo(() => {
    const grouped = new Map();
    completed.forEach((workout) => { const key = weekStart(workout.date || workout.workoutDate); if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(workout); });
    return [...grouped.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [completed]);

  return <div className="space-y-5"><div><h1 className="text-2xl font-semibold">Progress</h1><p className="text-sm text-slate-500">Review your completed sessions and progress over time.</p></div><div className="flex gap-2"><Button>Workout history</Button><Button variant="outline" onClick={openGraphs}><BarChart3 className="mr-2 h-4 w-4" />Progress graphs</Button></div>{deleteError ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{deleteError}</div> : null}{weeks.length ? weeks.map(([start, weekWorkouts]) => { const totalExercises = weekWorkouts.reduce((sum, workout) => sum + workoutStats(workout).exercises, 0); const totalSets = weekWorkouts.reduce((sum, workout) => sum + workoutStats(workout).sets, 0); return <section key={start} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="border-b border-slate-100 pb-3"><h2 className="text-lg font-semibold">Week commencing {weekHeading(start)}</h2><p className="text-sm text-slate-500">{weekWorkouts.length} session{weekWorkouts.length === 1 ? "" : "s"} · {totalExercises} exercises{totalSets ? ` · ${totalSets} recorded sets` : ""}</p></div><div className="mt-3 space-y-2">{weekWorkouts.map((workout) => { const expanded = expandedId === workout.id; const stats = workoutStats(workout); return <article key={workout.id} className="overflow-hidden rounded-xl border border-slate-200"><div className="flex items-center gap-2 p-2"><button type="button" onClick={() => setExpandedId(expanded ? null : workout.id)} className="flex min-w-0 flex-1 items-center gap-3 p-2 text-left">{expanded ? <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" /> : <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />}<span className="min-w-0"><span className="block font-semibold">{workout.sessionNameSnapshot || "Workout"}</span><span className="block text-sm text-slate-500">{formatDate(workout.date || workout.workoutDate)} · {stats.completed}/{stats.exercises} exercises recorded{workout.programmeNameSnapshot ? ` · ${workout.programmeNameSnapshot}` : ""}</span></span></button><Button variant="danger" size="sm" onClick={() => onRequestDelete(workout)}>Delete</Button></div>{expanded ? <div className="border-t border-slate-100 bg-slate-50 p-4"><div className="space-y-2">{sortedExercises(workout).map((exercise) => <ExerciseDetails key={exercise.id} exercise={exercise} />)}</div>{workout.notes ? <div className="mt-4 rounded-xl bg-white p-3"><div className="text-sm font-medium">Workout notes</div><p className="text-sm text-slate-600">{workout.notes}</p></div> : null}{completionTimeLabel(workout.completedAt) ? <div className="mt-3 text-xs text-slate-500">Completed {completionTimeLabel(workout.completedAt)}</div> : null}</div> : null}</article>; })}</div></section>; }) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No completed workouts yet</div>}{deletingId ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-5"><h2 className="text-lg font-semibold">Delete workout?</h2><p className="mt-2 text-sm text-slate-600">This will permanently remove this workout and its recorded data.</p>{deleteError ? <p className="mt-3 text-sm font-medium text-red-600">{deleteError}</p> : null}<div className="mt-5 flex justify-end gap-2"><Button variant="outline" disabled={deletingId === "pending"} onClick={onCancelDelete}>Cancel</Button><Button variant="danger" disabled={deletingId === "pending"} onClick={onConfirmDelete}>{deletingId === "pending" ? "Deleting…" : "Delete Workout"}</Button></div></div></div> : null}</div>;
}

export default function WorkoutHistoryScreen({ user, repository = defaultRepository }) {
  const [workouts, setWorkouts] = useState([]); const [deleteCandidate, setDeleteCandidate] = useState(null); const [deleting, setDeleting] = useState(false); const [deleteError, setDeleteError] = useState("");
  useEffect(() => repository.subscribeWorkouts(db, user.uid, setWorkouts, () => setDeleteError("Could not load workout history.")), [repository, user.uid]);
  async function confirmDelete() { if (!deleteCandidate || deleting) return; setDeleting(true); setDeleteError(""); try { await repository.deleteWorkoutDocument(db, user.uid, deleteCandidate.id); setWorkouts((current) => current.filter((workout) => workout.id !== deleteCandidate.id)); setDeleteCandidate(null); } catch (error) { console.error("Could not delete workout", error); setDeleteError("Could not delete workout. Please try again."); } finally { setDeleting(false); } }
  return <WorkoutHistoryView workouts={workouts} deletingId={deleteCandidate ? deleting ? "pending" : deleteCandidate.id : null} deleteError={deleteError} onRequestDelete={setDeleteCandidate} onCancelDelete={() => !deleting && setDeleteCandidate(null)} onConfirmDelete={confirmDelete} />;
}
