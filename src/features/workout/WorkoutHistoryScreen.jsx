import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronDown, ChevronRight } from "lucide-react";
import Button from "../../components/ui/Button";
import { db } from "../../firebase";
import { formatDate } from "../../lib/domain/date";
import { completedWorkoutHistory, durationLabel, resolveWorkoutExerciseSide, workoutExerciseSideLabel, workoutItem } from "../../lib/domain/workoutDisplay";
import { SIDE } from "../../lib/domain/v2Models";
import { deleteWorkoutDocument, subscribeWorkouts } from "../../lib/firebase/planRepository";

const defaultRepository = { deleteWorkoutDocument, subscribeWorkouts };
const TYPE_ORDER = { strength: 0, other: 1, plyometric: 1, balance: 2, cardio: 3, mobility: 4, stretch: 4 };

function actualRepsLabel(set = {}) {
  const value = set.actualReps ?? set.rawReps ?? set.reps ?? set.prescribedReps?.value;
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
  const start = new Date(`${value}T12:00:00`);
  if (Number.isNaN(start.getTime())) return value;
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const formatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${formatter.format(start)}–${formatter.format(end)}`;
}

function hasEnteredWeight(set) {
  const value = set?.weight ?? set?.rawWeight;
  return value !== "" && value !== undefined && value !== null && Number.isFinite(Number(value));
}

function setDone(exercise, set) {
  if (exercise?.loggingMethod === "reps_weight") return hasEnteredWeight(set);
  return Boolean(set?.completed);
}

function exerciseProgress(exercise) {
  const sets = exercise?.recordedSets || [];
  if (sets.length) return { completed: sets.filter((set) => setDone(exercise, set)).length, total: sets.length };
  const completed = exercise?.completed || exercise?.intervalProgress?.completed || exercise?.intervalProgress?.completedBlocks?.length ? 1 : 0;
  return { completed, total: 1 };
}

function workoutStats(workout) {
  const progress = (workout.exercises || []).map(exerciseProgress);
  const completedSets = progress.reduce((total, item) => total + item.completed, 0);
  const totalSets = progress.reduce((total, item) => total + item.total, 0);
  return { completedSets, totalSets, incomplete: totalSets > 0 && completedSets < totalSets };
}

function sortedExercises(workout) {
  return (workout.exercises || []).slice().sort((a, b) => (TYPE_ORDER[a.exerciseType] ?? 99) - (TYPE_ORDER[b.exerciseType] ?? 99) || Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

function pairBaseId(exercise) {
  return String(exercise.id || "").replace(/-(left|right)$/, "");
}

function historyItems(workout) {
  const exercises = sortedExercises(workout);
  const result = [];
  for (let index = 0; index < exercises.length; index += 1) {
    const current = exercises[index];
    const next = exercises[index + 1];
    const currentSide = resolveWorkoutExerciseSide(current);
    const nextSide = resolveWorkoutExerciseSide(next);
    const paired = next
      && current.exerciseId === next.exerciseId
      && pairBaseId(current) === pairBaseId(next)
      && currentSide === SIDE.LEFT
      && nextSide === SIDE.RIGHT;
    if (paired) {
      result.push({ type: "pair", left: current, right: next, key: `${current.id}:${next.id}` });
      index += 1;
    } else {
      result.push({ type: "single", exercise: current, key: current.id });
    }
  }
  return result;
}

function setContent(exercise, set) {
  if (exercise.loggingMethod === "reps_weight") return `${actualRepsLabel(set)} · ${hasEnteredWeight(set) ? `${set.weight ?? set.rawWeight} kg` : "—"}`;
  if (exercise.loggingMethod === "reps") return actualRepsLabel(set);
  const duration = durationLabel(exercise.prescription?.targetDurationSeconds, exercise.prescription?.durationUnit);
  const distance = exercise.prescription?.targetDistance ?? exercise.prescription?.distance;
  if (exercise.loggingMethod === "time") return duration || "Time —";
  if (exercise.loggingMethod === "distance") return distance !== undefined ? `${distance} km` : "Distance —";
  if (exercise.loggingMethod === "time_distance") return [duration, distance !== undefined ? `${distance} km` : null].filter(Boolean).join(" · ");
  return workoutItem(exercise).summary || "Exercise";
}

function SetRows({ exercise, compact = false }) {
  return exercise.recordedSets?.length ? <div className={`mt-2 space-y-1.5 ${compact ? "text-xs" : "text-sm"}`}>{exercise.recordedSets.map((set) => { const done = setDone(exercise, set); return <div key={set.id} className={`rounded-lg px-2 py-1.5 leading-snug ${done ? "bg-emerald-50 text-emerald-900" : "bg-orange-50 text-orange-900"}`}><span className="font-medium">Set {set.setNumber}:</span> {setContent(exercise, set)} <span className="font-semibold">{done ? "✓" : "Not completed"}</span></div>; })}</div> : null;
}

function SideHistoryColumn({ exercise, label }) {
  const summary = workoutItem(exercise).summary;
  const progress = exerciseProgress(exercise);
  return <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-2 sm:p-3"><div className="text-sm font-semibold text-slate-700">{label}</div>{summary ? <div className="mt-1 text-xs text-slate-500">{summary.replace(/\s+(left|right)$/i, "")}</div> : null}<SetRows exercise={exercise} compact/>{progress.completed < progress.total ? <div className="mt-2 text-xs font-medium text-orange-700">{progress.completed}/{progress.total} sets completed</div> : null}</div>;
}

function PairedExerciseDetails({ left, right, workoutDate }) {
  const completionDate = left.completedDate && left.completedDate !== workoutDate ? formatDate(left.completedDate) : right.completedDate && right.completedDate !== workoutDate ? formatDate(right.completedDate) : "";
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="font-medium">{left.exerciseNameSnapshot}</div>{completionDate ? <div className="mt-1 text-xs text-slate-400">Completed {completionDate}</div> : null}{left.programmeNoteSnapshot ? <div className="text-xs text-slate-500">{left.programmeNoteSnapshot}</div> : null}<div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3"><SideHistoryColumn exercise={left} label="Left"/><SideHistoryColumn exercise={right} label="Right"/></div></div>;
}

function ExerciseDetails({ exercise, workoutDate }) {
  const side = workoutExerciseSideLabel(exercise);
  const summary = workoutItem(exercise).summary;
  const stages = (exercise.prescription?.stages || exercise.prescription?.intervals || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const progress = exerciseProgress(exercise);
  const completionDate = exercise.completedDate && exercise.completedDate !== workoutDate ? formatDate(exercise.completedDate) : "";
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="font-medium">{exercise.exerciseNameSnapshot}</div>{side ? <div className="text-xs font-medium text-slate-500">{side}</div> : null}{completionDate ? <div className="mt-1 text-xs text-slate-400">Completed {completionDate}</div> : null}{exercise.programmeNoteSnapshot ? <div className="text-xs text-slate-500">{exercise.programmeNoteSnapshot}</div> : null}{summary ? <div className="mt-1 text-sm text-slate-600">{summary}</div> : null}<SetRows exercise={exercise}/>{stages.length ? <div className={`mt-2 rounded-lg px-2 py-1.5 text-sm ${exercise.completed ? "bg-emerald-50 text-emerald-900" : "bg-orange-50 text-orange-900"}`}>{stages.map((stage, index) => <span key={stage.id || index}>{index ? " · " : ""}{stage.phase === "rest" ? "Rest" : "Work"} {durationLabel(stage.durationSeconds, stage.durationUnit)}</span>)} <span className="font-semibold">{exercise.completed ? "✓" : "Not completed"}</span></div> : null}{progress.completed < progress.total ? <div className="mt-2 text-xs font-medium text-orange-700">{progress.completed}/{progress.total} sets completed</div> : null}</div>;
}

function openProgress() { [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === "Progress")?.click(); }
function editWorkout(workout) {
  sessionStorage.setItem("completedWorkoutIntent", JSON.stringify({ mode: "edit_completed", workoutId: workout.id }));
  [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === "Workout")?.click();
}

export function WorkoutHistoryView({ workouts, deletingId, deleteError, onRequestDelete, onCancelDelete, onConfirmDelete, showNavigation = true }) {
  const completed = completedWorkoutHistory(workouts);
  const [expandedId, setExpandedId] = useState(completed[0]?.id || null);
  const visibleExpandedId = expandedId && completed.some((workout) => workout.id === expandedId) ? expandedId : null;
  const weeks = useMemo(() => {
    const grouped = new Map();
    completed.forEach((workout) => { const key = weekStart(workout.date || workout.workoutDate); if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(workout); });
    return [...grouped.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [completed]);

  return <div className="space-y-5">{showNavigation ? <div className="flex gap-2"><Button>Workout history</Button><Button variant="outline" onClick={openProgress}><BarChart3 className="mr-2 h-4 w-4"/>Progress</Button></div> : null}{deleteError ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{deleteError}</div> : null}{weeks.length ? weeks.map(([start, weekWorkouts]) => <section key={start} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="border-b border-slate-100 pb-3"><h2 className="text-lg font-semibold">{weekHeading(start)}</h2><p className="text-sm text-slate-500">{weekWorkouts.length} session{weekWorkouts.length === 1 ? "" : "s"}</p></div><div className="mt-3 space-y-2">{weekWorkouts.map((workout) => { const expanded = visibleExpandedId === workout.id; const stats = workoutStats(workout); return <article key={workout.id} className={`overflow-hidden rounded-xl border ${stats.incomplete ? "border-orange-200" : "border-slate-200"}`}><div className="flex items-center gap-2 p-2"><button type="button" onClick={() => setExpandedId(expanded ? null : workout.id)} className="flex min-w-0 flex-1 items-center gap-3 p-2 text-left">{expanded ? <ChevronDown className="h-5 w-5 shrink-0 text-slate-400"/> : <ChevronRight className="h-5 w-5 shrink-0 text-slate-400"/>}<span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="block font-semibold">{workout.sessionNameSnapshot || workout.name || "Workout"}</span>{stats.incomplete ? <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">Incomplete</span> : null}</span><span className={`block text-sm ${stats.incomplete ? "font-medium text-orange-700" : "text-slate-500"}`}>{formatDate(workout.date || workout.workoutDate)} · {stats.completedSets}/{stats.totalSets} sets completed{workout.programmeNameSnapshot ? ` · ${workout.programmeNameSnapshot}` : ""}</span></span></button><Button variant="outline" size="sm" onClick={() => editWorkout(workout)}>Edit</Button><Button variant="danger" size="sm" onClick={() => onRequestDelete(workout)}>Delete</Button></div>{expanded ? <div className="border-t border-slate-100 bg-slate-50 p-3 sm:p-4"><div className="space-y-2">{historyItems(workout).map((item) => item.type === "pair" ? <PairedExerciseDetails key={item.key} left={item.left} right={item.right} workoutDate={workout.date || workout.workoutDate}/> : <ExerciseDetails key={item.key} exercise={item.exercise} workoutDate={workout.date || workout.workoutDate}/>)}</div>{workout.notes ? <div className="mt-4 rounded-xl bg-white p-3"><div className="text-sm font-medium">Workout notes</div><p className="text-sm text-slate-600">{workout.notes}</p></div> : null}{completionTimeLabel(workout.completedAt) ? <div className="mt-3 text-xs text-slate-500">Completed {completionTimeLabel(workout.completedAt)}</div> : null}</div> : null}</article>; })}</div></section>) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No completed workouts yet</div>}{deletingId ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-5"><h2 className="text-lg font-semibold">Delete workout?</h2><p className="mt-2 text-sm text-slate-600">This will permanently remove this workout and its recorded data.</p>{deleteError ? <p className="mt-3 text-sm font-medium text-red-600">{deleteError}</p> : null}<div className="mt-5 flex justify-end gap-2"><Button variant="outline" disabled={deletingId === "pending"} onClick={onCancelDelete}>Cancel</Button><Button variant="danger" disabled={deletingId === "pending"} onClick={onConfirmDelete}>{deletingId === "pending" ? "Deleting…" : "Delete Workout"}</Button></div></div></div> : null}</div>;
}

export default function WorkoutHistoryScreen({ user, repository = defaultRepository, showNavigation = true }) {
  const [workouts, setWorkouts] = useState([]); const [deleteCandidate, setDeleteCandidate] = useState(null); const [deleting, setDeleting] = useState(false); const [deleteError, setDeleteError] = useState("");
  useEffect(() => repository.subscribeWorkouts(db, user.uid, setWorkouts, () => setDeleteError("Could not load workout history.")), [repository, user.uid]);
  async function confirmDelete() { if (!deleteCandidate || deleting) return; setDeleting(true); setDeleteError(""); try { await repository.deleteWorkoutDocument(db, user.uid, deleteCandidate.id); setWorkouts((current) => current.filter((workout) => workout.id !== deleteCandidate.id)); setDeleteCandidate(null); } catch (error) { console.error(error); setDeleteError("Could not delete workout. Please try again."); } finally { setDeleting(false); } }
  return <WorkoutHistoryView workouts={workouts} deletingId={deleteCandidate ? deleting ? "pending" : deleteCandidate.id : null} deleteError={deleteError} onRequestDelete={setDeleteCandidate} onCancelDelete={() => !deleting && setDeleteCandidate(null)} onConfirmDelete={confirmDelete} showNavigation={showNavigation}/>;
}
