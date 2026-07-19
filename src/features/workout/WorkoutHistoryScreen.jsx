import React, { useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import { db } from "../../firebase";
import { formatDate } from "../../lib/domain/date";
import { completedWorkoutHistory, durationLabel, workoutExerciseSideLabel, workoutItem } from "../../lib/domain/workoutDisplay";
import { deleteWorkoutDocument, subscribeWorkouts } from "../../lib/firebase/planRepository";

const defaultRepository = { deleteWorkoutDocument, subscribeWorkouts };

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

function ExerciseDetails({ exercise }) {
  const side = workoutExerciseSideLabel(exercise);
  const summary = workoutItem(exercise).summary;
  const stages = (exercise.prescription?.stages || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  return <div className="rounded-xl border border-slate-200 p-3"><div className="font-medium">{exercise.exerciseNameSnapshot}</div>{side ? <div className="text-xs font-medium text-slate-500">{side}</div> : null}{exercise.programmeNoteSnapshot ? <div className="text-xs text-slate-500">{exercise.programmeNoteSnapshot}</div> : null}{summary ? <div className="mt-1 text-sm text-slate-600">{summary}</div> : null}{exercise.recordedSets?.length ? <div className="mt-2 space-y-1 text-sm">{exercise.recordedSets.map((set) => <div key={set.id}>Set {set.setNumber}: {repsLabel(set.prescribedReps, set)} · {set.weight === "" || set.weight === undefined ? "—" : `${set.weight} kg`}</div>)}</div> : null}{stages.length ? <div className="mt-2 space-y-1 text-sm">{stages.map((stage) => <div key={stage.id}>{stage.phase === "rest" ? "Rest" : "Work"} · {durationLabel(stage.durationSeconds, stage.durationUnit)}</div>)}</div> : null}<div className="mt-2 text-xs text-slate-500">{exercise.completed ? "Completed" : exercise.recordedSets?.length ? "Recorded" : "Not completed"}</div></div>;
}

export function WorkoutHistoryView({ workouts, selectedId, deletingId, deleteError, onSelect, onRequestDelete, onCancelDelete, onConfirmDelete }) {
  const completed = completedWorkoutHistory(workouts);
  const selected = completed.find((workout) => workout.id === selectedId) || null;
  return <div className="space-y-5"><div><p className="text-sm font-medium text-emerald-700">Progress</p><h1 className="text-2xl font-semibold">Workout History</h1></div>{deleteError ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{deleteError}</div> : null}{completed.length ? <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"><div className="space-y-2">{completed.map((workout) => <div key={workout.id} className={`flex items-center gap-2 rounded-2xl border p-2 ${selectedId === workout.id ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white"}`}><button type="button" onClick={() => onSelect(workout.id)} className="min-w-0 flex-1 p-2 text-left"><div className="font-semibold">{workout.sessionNameSnapshot || "Workout"}</div><div className="text-sm text-slate-500">{formatDate(workout.date || workout.workoutDate)}{workout.programmeNameSnapshot ? ` · ${workout.programmeNameSnapshot}` : ""}</div></button><Button variant="danger" size="sm" onClick={() => onRequestDelete(workout)}>Delete</Button></div>)}</div>{selected ? <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{selected.sessionNameSnapshot || "Workout"}</h2><p className="text-sm text-slate-500">{formatDate(selected.date || selected.workoutDate)}{selected.programmeNameSnapshot ? ` · ${selected.programmeNameSnapshot}` : ""}</p></div><Button variant="danger" size="sm" onClick={() => onRequestDelete(selected)}>Delete workout</Button></div><div className="mt-4 space-y-2">{(selected.exercises || []).slice().sort((a, b) => a.sortOrder - b.sortOrder).map((exercise) => <ExerciseDetails key={exercise.id} exercise={exercise} />)}</div>{selected.notes ? <div className="mt-4"><div className="text-sm font-medium">Workout notes</div><p className="text-sm text-slate-600">{selected.notes}</p></div> : null}{completionTimeLabel(selected.completedAt) ? <div className="mt-4 text-xs text-slate-500">Completed {completionTimeLabel(selected.completedAt)}</div> : null}</div> : <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-slate-500">Select a workout to view its details.</div>}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No completed workouts yet</div>}{deletingId ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-5"><h2 className="text-lg font-semibold">Delete workout?</h2><p className="mt-2 text-sm text-slate-600">This will permanently remove this workout and its recorded data.</p>{deleteError ? <p className="mt-3 text-sm font-medium text-red-600">{deleteError}</p> : null}<div className="mt-5 flex justify-end gap-2"><Button variant="outline" disabled={deletingId === "pending"} onClick={onCancelDelete}>Cancel</Button><Button variant="danger" disabled={deletingId === "pending"} onClick={onConfirmDelete}>{deletingId === "pending" ? "Deleting…" : "Delete Workout"}</Button></div></div></div> : null}</div>;
}

export default function WorkoutHistoryScreen({ user, highlightId = null, repository = defaultRepository }) {
  const [workouts, setWorkouts] = useState([]);
  const [selectedId, setSelectedId] = useState(highlightId);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  useEffect(() => repository.subscribeWorkouts(db, user.uid, setWorkouts, () => {}), [repository, user.uid]);
  const completed = useMemo(() => completedWorkoutHistory(workouts), [workouts]);
  const effectiveSelectedId = selectedId || completed[0]?.id || null;
  async function confirmDelete() {
    if (!deleteCandidate || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await repository.deleteWorkoutDocument(db, user.uid, deleteCandidate.id);
      setWorkouts((current) => current.filter((workout) => workout.id !== deleteCandidate.id));
      setSelectedId((current) => current === deleteCandidate.id ? null : current);
      setDeleteCandidate(null);
    } catch (error) {
      console.error("Could not delete workout", error);
      setDeleteError("Could not delete workout. Please try again.");
    } finally {
      setDeleting(false);
    }
  }
  return <WorkoutHistoryView workouts={workouts} selectedId={effectiveSelectedId} deletingId={deleteCandidate ? deleting ? "pending" : deleteCandidate.id : null} deleteError={deleteError} onSelect={setSelectedId} onRequestDelete={setDeleteCandidate} onCancelDelete={() => !deleting && setDeleteCandidate(null)} onConfirmDelete={confirmDelete} />;
}
