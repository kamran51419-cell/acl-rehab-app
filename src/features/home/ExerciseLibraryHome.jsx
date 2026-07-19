import React, { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import Button from "../../components/ui/Button";
import { db } from "../../firebase";
import {
  EXERCISE_LOGGING_METHOD,
  EXERCISE_TYPE,
  EXERCISE_TYPE_OPTIONS,
  createLibraryExercise,
  defaultLoggingMethodForExerciseType,
  loggingMethodsForExerciseType,
} from "../../lib/domain/plans";
import { makeId } from "../../lib/domain/legacyWorkouts";
import { deleteExerciseDefinition, saveExerciseDefinition, subscribeExerciseDefinitions } from "../../lib/firebase/planRepository";

const TYPE_LABELS = {
  strength: "Strength", cardio: "Cardio", plyometric: "Plyometric", balance: "Balance",
  mobility: "Mobility", stretch: "Stretch", other: "Other",
};
const RECORDING_LABELS = {
  [EXERCISE_LOGGING_METHOD.REPS]: "Reps",
  [EXERCISE_LOGGING_METHOD.REPS_WEIGHT]: "Reps + Weight",
  [EXERCISE_LOGGING_METHOD.TIME]: "Time",
  [EXERCISE_LOGGING_METHOD.DISTANCE]: "Distance",
  [EXERCISE_LOGGING_METHOD.TIME_DISTANCE]: "Time + Distance",
  [EXERCISE_LOGGING_METHOD.COMPLETED]: "Task",
  [EXERCISE_LOGGING_METHOD.INTERVALS]: "Intervals",
};
const token = () => `token-${makeId()}`;
const inputClass = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm";

function methodsFor(type) {
  const methods = loggingMethodsForExerciseType(type);
  if (type === EXERCISE_TYPE.PLYOMETRIC) return [EXERCISE_LOGGING_METHOD.COMPLETED];
  return methods.length ? methods : [defaultLoggingMethodForExerciseType(type)];
}

export default function ExerciseLibraryHome({ user, onBackToProgramme }) {
  const [exercises, setExercises] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", exerciseType: EXERCISE_TYPE.STRENGTH, loggingMethod: EXERCISE_LOGGING_METHOD.REPS_WEIGHT });
  const [message, setMessage] = useState("");
  const returning = sessionStorage.getItem(`programme-library-return:${user.uid}`) === "1";

  useEffect(() => subscribeExerciseDefinitions(db, user.uid, setExercises, () => setMessage("We could not load your exercise library.")), [user.uid]);

  const visible = useMemo(() => exercises
    .filter((exercise) => !exercise.isArchived)
    .filter((exercise) => category === "all" || (exercise.exerciseType || exercise.trackingType) === category)
    .filter((exercise) => exercise.name.toLowerCase().includes(query.trim().toLowerCase())), [exercises, category, query]);
  const displayed = showAll || query || category !== "all" ? visible : visible.slice(0, 6);

  function updateType(nextType, target = form, setter = setForm) {
    const nextMethods = methodsFor(nextType);
    setter({ ...target, exerciseType: nextType, loggingMethod: nextMethods.includes(target.loggingMethod) ? target.loggingMethod : nextMethods[0] });
  }

  async function saveNew() {
    if (!form.name.trim()) return;
    const exercise = { ...createLibraryExercise({ name: form.name, exerciseType: form.exerciseType }), loggingMethod: form.loggingMethod };
    await saveExerciseDefinition(db, user.uid, exercise, { updatedAtToken: token() });
    setForm({ name: "", exerciseType: EXERCISE_TYPE.STRENGTH, loggingMethod: EXERCISE_LOGGING_METHOD.REPS_WEIGHT });
    setCreating(false);
    setMessage("Exercise added.");
  }

  async function saveEdit() {
    if (!editing?.name.trim()) return;
    await saveExerciseDefinition(db, user.uid, { ...editing, name: editing.name.trim(), trackingType: editing.exerciseType }, { updatedAtToken: token() });
    setEditing(null);
    setMessage("Exercise updated.");
  }

  async function remove(exercise) {
    if (!window.confirm(`Delete ${exercise.name}? Existing programme and workout records will stay unchanged.`)) return;
    await deleteExerciseDefinition(db, user.uid, exercise.id);
    setEditing(null);
    setMessage("Exercise deleted.");
  }

  function backToProgramme() {
    sessionStorage.removeItem(`programme-library-return:${user.uid}`);
    onBackToProgramme();
  }

  return (
    <section id="exercise-library" className="mx-auto max-w-2xl space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-semibold text-slate-900">Exercise Library</h2><p className="text-sm text-slate-500">{exercises.filter((item) => !item.isArchived).length} exercises</p></div>
        <div className="flex gap-2">{returning ? <Button variant="outline" onClick={backToProgramme}>Back to programme</Button> : null}<Button onClick={() => setCreating((value) => !value)}>{creating ? "Cancel" : "Add exercise"}</Button></div>
      </div>
      {message ? <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{message}</div> : null}
      {creating ? <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3"><label className="text-sm font-medium">Exercise name<input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label className="text-sm font-medium">Exercise type<select className={inputClass} value={form.exerciseType} onChange={(e) => updateType(e.target.value)}>{EXERCISE_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}</select></label><label className="text-sm font-medium">Recording<select className={inputClass} value={form.loggingMethod} onChange={(e) => setForm({ ...form, loggingMethod: e.target.value })}>{methodsFor(form.exerciseType).map((method) => <option key={method} value={method}>{RECORDING_LABELS[method]}</option>)}</select></label><div className="md:col-span-3"><Button onClick={saveNew}>Save</Button></div></div> : null}
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className={`${inputClass} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search exercises" /></div>
      <div className="flex flex-wrap gap-2">{["all", ...EXERCISE_TYPE_OPTIONS].map((type) => <button type="button" key={type} onClick={() => setCategory(type)} className={`rounded-full border px-3 py-1.5 text-sm ${category === type ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{type === "all" ? "All" : TYPE_LABELS[type]}</button>)}</div>
      <div className="space-y-2">{displayed.map((exercise) => {
        const type = exercise.exerciseType || exercise.trackingType || EXERCISE_TYPE.STRENGTH;
        const method = exercise.loggingMethod || defaultLoggingMethodForExerciseType(type);
        return <div key={exercise.id} className="rounded-2xl border border-slate-200 p-3">{editing?.id === exercise.id ? <div className="grid gap-2 md:grid-cols-3"><input className={inputClass} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /><select className={inputClass} value={editing.exerciseType} onChange={(e) => updateType(e.target.value, editing, setEditing)}>{EXERCISE_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{TYPE_LABELS[option]}</option>)}</select><select className={inputClass} value={editing.loggingMethod} onChange={(e) => setEditing({ ...editing, loggingMethod: e.target.value })}>{methodsFor(editing.exerciseType).map((option) => <option key={option} value={option}>{RECORDING_LABELS[option]}</option>)}</select><div className="flex gap-2 md:col-span-3"><Button size="sm" onClick={saveEdit}>Save</Button><Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button size="sm" variant="danger" onClick={() => remove(exercise)}>Delete</Button></div></div> : <div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="truncate font-medium">{exercise.name}</div><div className="text-xs text-slate-500">{TYPE_LABELS[type]} • {RECORDING_LABELS[method] || "Task"}</div></div><Button size="sm" variant="outline" onClick={() => setEditing({ ...exercise, exerciseType: type, loggingMethod: method })}>Edit</Button></div>}</div>;
      })}{displayed.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">No exercises match your search.</div> : null}</div>
      {!query && category === "all" && visible.length > 6 ? <Button variant="outline" onClick={() => setShowAll((value) => !value)}>{showAll ? "Show less" : `View all ${visible.length} exercises`}</Button> : null}
    </section>
  );
}
