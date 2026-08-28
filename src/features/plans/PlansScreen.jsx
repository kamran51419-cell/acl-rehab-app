import React, { useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Plus, Search, Trash2 } from "lucide-react";

import Button from "../../components/ui/Button";
import {
  EXERCISE_LOGGING_METHOD,
  EXERCISE_TYPE,
  INTERVAL_PHASE,
  REP_TARGET_TYPE,
  SIDE,
  createDefaultPrescription,
  createIntervalStage,
  createPlanExercise,
  createPlanSession,
  defaultLoggingMethodForExerciseType,
  duplicatePlan,
  filterExerciseLibrary,
  fixedReps,
  insertItemAfter,
  loggingMethodsForExerciseType,
  nextPlanForSave,
  planPrescriptionSummary,
  repRange,
  reorderItems,
  validatePlan,
} from "../../lib/domain/plans";
import { ROUTINE_TIME, WEEKDAYS, createRoutineTask, routineTasksForPlan } from "../../lib/domain/routineTasks";
import {
  activatePlan,
  createNewPlan,
  deletePlan,
  listPlans,
  savePlan,
} from "../../lib/firebase/plansRepository";
import { listExercises } from "../../lib/firebase/exercisesRepository";
import ProgrammeFormControls from "./ProgrammeFormControls";

const { Field, Input, Select, Textarea } = ProgrammeFormControls;

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function friendlyPlanValidationMessages(errors = []) {
  const messages = [];
  errors.forEach((error) => {
    if (/Plan name is required/i.test(error)) messages.push("Add a programme name.");
    else if (/needs a name/i.test(error)) messages.push("Give each session and exercise a name.");
    else if (/must have at least one target set|must have at least one set/i.test(error)) messages.push("Choose at least one set.");
    else if (/fixed reps must be a positive whole number|rep range is invalid/i.test(error)) messages.push("Enter a valid rep target.");
    else if (/duration must be a positive whole number of seconds|duration must be positive/i.test(error)) messages.push("Enter a valid duration.");
    else if (/distance must be positive/i.test(error)) messages.push("Enter a valid distance.");
    else if (/intervals must include at least one stage/i.test(error)) messages.push("Add at least one interval.");
    else if (/has an unsupported prescription method/i.test(error)) messages.push("Choose a supported tracking method.");
    else messages.push(error);
  });
  return [...new Set(messages)];
}

function IntervalValueInput({ stage, onChange }) {
  const distanceMode = stage.distance !== undefined && stage.distance !== null;
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <Select
        value={distanceMode ? "distance" : "time"}
        onChange={(event) => {
          if (event.target.value === "distance") onChange({ ...stage, distance: 100, distanceUnit: "m", durationSeconds: undefined, durationUnit: undefined });
          else onChange({ ...stage, durationSeconds: 30, durationUnit: "seconds", distance: undefined, distanceUnit: undefined });
        }}
      >
        <option value="time">Time</option>
        <option value="distance">Distance</option>
      </Select>
      {distanceMode ? (
        <div className="grid grid-cols-[1fr_90px] gap-2">
          <Input inputMode="decimal" value={stage.distance ?? ""} onChange={(event) => onChange({ ...stage, distance: Number(event.target.value) })} />
          <Select value={stage.distanceUnit || "m"} onChange={(event) => onChange({ ...stage, distanceUnit: event.target.value })}><option value="m">m</option><option value="km">km</option></Select>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_100px] gap-2">
          <Input inputMode="numeric" value={stage.durationUnit === "minutes" ? Number(stage.durationSeconds || 0) / 60 : stage.durationSeconds ?? ""} onChange={(event) => onChange({ ...stage, durationSeconds: Number(event.target.value) * (stage.durationUnit === "minutes" ? 60 : 1) })} />
          <Select value={stage.durationUnit || "seconds"} onChange={(event) => { const unit = event.target.value; const seconds = Number(stage.durationSeconds || 0); onChange({ ...stage, durationUnit: unit, durationSeconds: unit === "minutes" ? Math.max(60, Math.round(seconds / 60) * 60) : seconds }); }}><option value="seconds">seconds</option><option value="minutes">minutes</option></Select>
        </div>
      )}
    </div>
  );
}

function ExerciseSetupEditor({ exercise, onChange, trainingMode = "gym" }) {
  const selectedMethod = exercise.loggingMethod || defaultLoggingMethodForExerciseType(exercise.exerciseType);
  const methods = loggingMethodsForExerciseType(exercise.exerciseType);
  const changeMethod = (method) => onChange({ ...exercise, loggingMethod: method, prescription: createDefaultPrescription(exercise.exerciseType, method) });
  const updatePrescription = (prescription) => onChange({ ...exercise, prescription });

  const methodField = methods.length ? <Field label="Track by"><Select value={selectedMethod} onChange={(event) => changeMethod(event.target.value)}>{methods.map((method) => <option key={method} value={method}>{method === EXERCISE_LOGGING_METHOD.REPS ? "Reps" : method === EXERCISE_LOGGING_METHOD.REPS_WEIGHT ? "Reps + weight" : method === EXERCISE_LOGGING_METHOD.TIME ? "Time" : method === EXERCISE_LOGGING_METHOD.DISTANCE ? "Distance" : method === EXERCISE_LOGGING_METHOD.INTERVALS ? "Intervals" : method}</option>)}</Select></Field> : null;

  if ([EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT].includes(selectedMethod)) {
    const p = exercise.prescription || {};
    const updateReps = (patch) => updatePrescription({ ...p, targetReps: { ...(p.targetReps || fixedReps(10)), ...patch } });
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {methodField}
          <Field label="Side"><Select value={p.side || SIDE.BOTH} onChange={(event) => updatePrescription({ ...p, side: event.target.value })}><option value={SIDE.BOTH}>Standard</option><option value={SIDE.SEPARATE}>Left & Right</option><option value={SIDE.LEFT}>Left only</option>{trainingMode !== "gym" ? <option value={SIDE.RIGHT}>Right only</option> : null}</Select></Field>
          <Field label="Sets"><Input inputMode="numeric" value={p.targetSets ?? 3} onChange={(event) => updatePrescription({ ...p, targetSets: Number(event.target.value) })} /></Field>
          <Field label="Reps"><Select value={p.targetReps?.type || REP_TARGET_TYPE.FIXED} onChange={(event) => updateReps(event.target.value === REP_TARGET_TYPE.RANGE ? repRange(8, 12) : fixedReps(10))}><option value={REP_TARGET_TYPE.FIXED}>Fixed</option><option value={REP_TARGET_TYPE.RANGE}>Range</option></Select></Field>
        </div>
        {p.targetReps?.type === REP_TARGET_TYPE.RANGE ? <div className="grid grid-cols-2 gap-3"><Field label="Min"><Input inputMode="numeric" value={p.targetReps.min ?? 8} onChange={(event) => updateReps({ min: Number(event.target.value) })} /></Field><Field label="Max"><Input inputMode="numeric" value={p.targetReps.max ?? 12} onChange={(event) => updateReps({ max: Number(event.target.value) })} /></Field></div> : <Field label="Target reps"><Input inputMode="numeric" value={p.targetReps?.value ?? 10} onChange={(event) => updateReps({ type: REP_TARGET_TYPE.FIXED, value: Number(event.target.value) })} /></Field>}
      </div>
    );
  }

  if (selectedMethod === EXERCISE_LOGGING_METHOD.TIME) {
    const p = exercise.prescription || {};
    const duration = <Field label="Duration"><div className="grid grid-cols-[1fr_110px] gap-2"><Input inputMode="numeric" value={p.durationUnit === "minutes" ? Number(p.targetDurationSeconds || 0) / 60 : p.targetDurationSeconds ?? ""} onChange={(event) => updatePrescription({ ...p, targetDurationSeconds: Number(event.target.value) * (p.durationUnit === "minutes" ? 60 : 1) })} /><Select value={p.durationUnit || "seconds"} onChange={(event) => updatePrescription({ ...p, durationUnit: event.target.value })}><option value="seconds">seconds</option><option value="minutes">minutes</option></Select></div></Field>;
    if ([EXERCISE_TYPE.BALANCE, EXERCISE_TYPE.TIMED_HOLD].includes(exercise.exerciseType)) return <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2">{methodField}<Field label="Side"><Select value={p.side || SIDE.BOTH} onChange={(event) => updatePrescription({ ...p, side: event.target.value })}><option value={SIDE.BOTH}>Standard</option><option value={SIDE.SEPARATE}>Left & Right</option><option value={SIDE.LEFT}>Left only</option>{trainingMode !== "gym" ? <option value={SIDE.RIGHT}>Right only</option> : null}</Select></Field><Field label="Sets"><Input inputMode="numeric" value={p.targetSets ?? 3} onChange={(event) => updatePrescription({ ...p, targetSets: Number(event.target.value) })} /></Field></div>{duration}</div>;
    return <div className="space-y-3"><div className="max-w-xs">{methodField}</div>{duration}</div>;
  }

  if (selectedMethod === EXERCISE_LOGGING_METHOD.DISTANCE) {
    const p = exercise.prescription || {};
    return (
      <div className="space-y-3">
        <div className="max-w-xs">{methodField}</div>
        <Field label="Distance (km)"><Input inputMode="decimal" value={p.targetDistance ?? p.distance ?? ""} onChange={(event) => updatePrescription({ ...p, targetDistance: Number(event.target.value) })} /></Field>
      </div>
    );
  }

  if (selectedMethod === EXERCISE_LOGGING_METHOD.INTERVALS) {
    const p = exercise.prescription || {};
    const stages = p.stages || [];
    const updateStages = (next) => updatePrescription({ ...p, stages: next.map((stage, index) => ({ ...stage, sortOrder: index })) });
    return (
      <div className="space-y-3">
        <div className="max-w-xs">{methodField}</div>
        {stages.map((stage, index) => (
          <div key={stage.id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="grid gap-2 md:grid-cols-[140px_1fr_1fr]">
              <Field label="Stage">
                <Select value={stage.phase} onChange={(event) => updateStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, phase: event.target.value } : item))}>
                  <option value={INTERVAL_PHASE.WORK}>Work</option>
                  <option value={INTERVAL_PHASE.REST}>Rest</option>
                </Select>
              </Field>
              <IntervalValueInput stage={stage} onChange={(nextStage) => updateStages(stages.map((item, itemIndex) => itemIndex === index ? nextStage : item))} />
              <Field label="Label (optional)"><Input value={stage.label || ""} onChange={(event) => updateStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} /></Field>
            </div>
            <Button size="sm" variant="danger" onClick={() => updateStages(stages.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => updateStages([...stages, createIntervalStage({ phase: INTERVAL_PHASE.WORK, durationSeconds: 0, durationUnit: "seconds", sortOrder: stages.length })])}>Add work</Button>
          <Button variant="outline" onClick={() => updateStages([...stages, createIntervalStage({ phase: INTERVAL_PHASE.REST, durationSeconds: 0, durationUnit: "seconds", sortOrder: stages.length })])}>Add rest</Button>
        </div>
      </div>
    );
  }

  return <div className="text-sm text-slate-500">No configurable tracking option is available for this legacy exercise type.</div>;
}

function PlanEditor({
  draft,
  setDraft,
  original,
  exercises,
  onSave,
  onClose,
  saving,
  saveMessage,
  onManageExerciseLibrary,
  trainingMode = "gym",
}) {
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [pickerSession, setPickerSession] = useState(null);
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [activeExerciseId, setActiveExerciseId] = useState("");
  const [draggingExercise, setDraggingExercise] = useState(null);
  const [draggingSession, setDraggingSession] = useState(null);
  const [removeSessionIndex, setRemoveSessionIndex] = useState(null);
  const [editingRoutineId, setEditingRoutineId] = useState("");

  const validation = validatePlan(draft);
  const routineValid = routineTasksForPlan(draft).every((task) => task.name?.trim() && task.days?.length);
  const validationMessages = friendlyPlanValidationMessages(validation.errors);
  const filteredExercises = filterExerciseLibrary(exercises, { query: exerciseQuery });

  const setSessions = (sessions) => setDraft({ ...draft, sessions });
  const routineTasks = routineTasksForPlan(draft);
  const setRoutineTasks = (routineTasks) => setDraft({ ...draft, routineTasks });
  const addRoutineTask = () => {
    const now = new Date().toISOString();
    const task = createRoutineTask({ id: `routine-${makeId()}`, name: "", days: [], sortOrder: routineTasks.length, createdAt: now, updatedAt: now });
    setRoutineTasks([...routineTasks, task]);
    setEditingRoutineId(task.id);
  };
  const updateRoutineTask = (taskId, patch) => setRoutineTasks(routineTasks.map((task) => task.id === taskId ? { ...task, ...patch, updatedAt: new Date().toISOString() } : task));
  const updateSession = (sessionIndex, patch) => setSessions(draft.sessions.map((session, index) => index === sessionIndex ? { ...session, ...patch } : session));

  const moveSession = (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    setSessions(reorderItems(draft.sessions, fromIndex, toIndex));
    setDraggingSession(toIndex);
  };

  const moveExercise = (sessionIndex, fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    updateSession(sessionIndex, { exercises: reorderItems(draft.sessions[sessionIndex].exercises, fromIndex, toIndex) });
    setDraggingExercise({ sessionIndex, exerciseIndex: toIndex });
  };

  const addSession = () => setSessions([...draft.sessions, createPlanSession({ name: "New session", sortOrder: draft.sessions.length })]);

  const insertSessionAfter = (sessionIndex) => {
    const session = createPlanSession({ name: "New session", sortOrder: sessionIndex + 1 });
    setSessions(insertItemAfter(draft.sessions, sessionIndex, session));
    requestAnimationFrame(() => document.getElementById(`programme-session-${session.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  function openPickerForAdd(sessionIndex) {
    setReplaceTarget(null);
    setPickerSession(sessionIndex);
    setExerciseQuery("");
  }

  function openPickerForReplace(sessionIndex, exerciseIndex) {
    setReplaceTarget({ sessionIndex, exerciseIndex });
    setPickerSession(sessionIndex);
    setExerciseQuery("");
  }

  function chooseExercise(sessionIndex, libraryExercise) {
    const exerciseType = libraryExercise.exerciseType || libraryExercise.trackingType || EXERCISE_TYPE.STRENGTH;
    const session = draft.sessions[sessionIndex];

    if (replaceTarget?.sessionIndex === sessionIndex) {
      const current = session.exercises[replaceTarget.exerciseIndex];
      const compatible = loggingMethodsForExerciseType(exerciseType).includes(current.loggingMethod);
      const replacement = {
        ...current,
        exerciseId: libraryExercise.id,
        exerciseNameSnapshot: libraryExercise.name,
        exerciseType,
        loggingMethod: compatible ? current.loggingMethod : defaultLoggingMethodForExerciseType(exerciseType),
        prescription: compatible ? current.prescription : createDefaultPrescription(exerciseType),
      };
      updateSession(sessionIndex, {
        exercises: session.exercises.map((item, index) => index === replaceTarget.exerciseIndex ? replacement : item),
      });
      setActiveExerciseId(replacement.id);
    } else {
      const planExercise = createPlanExercise({
        exerciseId: libraryExercise.id,
        exerciseNameSnapshot: libraryExercise.name,
        exerciseType,
        sortOrder: session.exercises.length,
        prescription: createDefaultPrescription(exerciseType),
        loggingMethod: defaultLoggingMethodForExerciseType(exerciseType),
      });
      updateSession(sessionIndex, { exercises: [...session.exercises, planExercise] });
      setActiveExerciseId(planExercise.id);
    }

    setReplaceTarget(null);
    setExerciseQuery("");
    setPickerSession(null);
  }

  return (
    <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{original ? "Edit programme" : "Create programme"}</h2>
          <p className="text-sm text-slate-500">Programme changes do not alter completed workouts.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={onSave} disabled={saving || !validation.valid || !routineValid}>{saving ? "Saving…" : "Save programme"}</Button>
        </div>
      </div>

      {saveMessage ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{saveMessage}</div> : null}
      {!validation.valid ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{validationMessages.slice(0, 4).join(" ")}</div> : null}
      {!routineValid ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Give every routine task a name and select at least one day.</div> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Programme name"><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="My programme" /></Field>
        <Field label="Description"><Input value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Optional" /></Field>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm">
          <input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} />
          Active programme
        </label>
      </div>

      <section className="space-y-3 border-t border-slate-100 pt-5">
        <div className="flex items-center justify-between gap-3">
          <div><h3 className="text-lg font-semibold">Routine Tasks</h3><p className="text-sm text-slate-500">Small tasks scheduled independently of workouts.</p></div>
          <Button variant="outline" onClick={addRoutineTask}><Plus className="mr-1 h-4 w-4" /> Add task</Button>
        </div>
        {routineTasks.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500">No routine tasks.</p> : null}
        {routineTasks.map((task) => {
          const editingTask = editingRoutineId === task.id;
          return <article key={task.id} className="rounded-2xl border border-slate-200 p-3">
            {editingTask ? <div className="space-y-3">
              <Field label="Task name"><Input value={task.name} onChange={(event) => updateRoutineTask(task.id, { name: event.target.value })} placeholder="e.g. Ice knee" /></Field>
              <Field label="Notes (optional)"><Textarea value={task.notes || ""} onChange={(event) => updateRoutineTask(task.id, { notes: event.target.value })} /></Field>
              <fieldset><legend className="mb-2 text-sm font-medium text-slate-700">Days</legend><div className="flex flex-wrap gap-2">{WEEKDAYS.map((day) => <label key={day} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-2 text-xs capitalize"><input type="checkbox" checked={task.days.includes(day)} onChange={() => updateRoutineTask(task.id, { days: task.days.includes(day) ? task.days.filter((item) => item !== day) : [...task.days, day] })} />{day.slice(0, 3)}</label>)}</div></fieldset>
              <Field label="Time of day"><Select value={task.timeOfDay} onChange={(event) => updateRoutineTask(task.id, { timeOfDay: event.target.value })}>{Object.values(ROUTINE_TIME).map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</Select></Field>
              <div className="flex justify-end gap-2"><Button size="sm" variant="danger" onClick={() => { setRoutineTasks(routineTasks.filter((item) => item.id !== task.id).map((item, index) => ({ ...item, sortOrder: index }))); setEditingRoutineId(""); }}>Delete</Button><Button size="sm" disabled={!task.name.trim() || task.days.length === 0} onClick={() => setEditingRoutineId("")}>Done</Button></div>
            </div> : <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="font-medium">{task.name || "Unnamed task"}</div><div className="text-xs capitalize text-slate-500">{task.days.join(", ")} · {task.timeOfDay}</div>{task.notes ? <p className="truncate text-sm text-slate-500">{task.notes}</p> : null}</div><Button size="sm" variant="outline" onClick={() => setEditingRoutineId(task.id)}>Edit</Button></div>}
          </article>;
        })}
      </section>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Sessions</h3>
          <Button variant="outline" onClick={addSession}><Plus className="mr-1 h-4 w-4" /> Add session</Button>
        </div>

        {draft.sessions.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No sessions yet. Add a reusable workout session.</div> : null}

        {draft.sessions.map((session, sessionIndex) => (
          <div
            id={`programme-session-${session.id}`}
            key={session.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => draggingSession !== null && moveSession(draggingSession, sessionIndex)}
            className="scroll-mt-4 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex items-start gap-2">
              <button
                type="button"
                draggable
                onDragStart={() => setDraggingSession(sessionIndex)}
                onDragEnd={() => setDraggingSession(null)}
                className="mt-1 inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-slate-400 hover:bg-white active:cursor-grabbing"
                aria-label="Drag session"
              ><GripVertical className="h-4 w-4" /></button>
              <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
                <Field label="Session name"><Input value={session.name} onChange={(event) => updateSession(sessionIndex, { name: event.target.value })} /></Field>
                <Field label="Notes"><Input value={session.notes || ""} onChange={(event) => updateSession(sessionIndex, { notes: event.target.value })} /></Field>
                <div className="flex items-end gap-2"><Button size="sm" variant="outline" onClick={() => insertSessionAfter(sessionIndex)}>Add below</Button><Button size="sm" variant="danger" onClick={() => setRemoveSessionIndex(sessionIndex)}>Remove</Button></div>
              </div>
            </div>

            <div className="space-y-3">
              {session.exercises.map((exercise, exerciseIndex) => (
                <div
                  key={exercise.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => draggingExercise?.sessionIndex === sessionIndex && moveExercise(sessionIndex, draggingExercise.exerciseIndex, exerciseIndex)}
                  className={cls("space-y-3 rounded-xl border bg-white p-3", activeExerciseId === exercise.id ? "border-slate-400" : "border-slate-200")}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <button type="button" draggable onDragStart={() => setDraggingExercise({ sessionIndex, exerciseIndex })} onDragEnd={() => setDraggingExercise(null)} className="mt-0.5 inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 active:cursor-grabbing" aria-label="Drag exercise"><GripVertical className="h-4 w-4" /></button>
                      <div>
                        <div className="font-semibold">{exercise.exerciseNameSnapshot}</div>
                        <div className="text-sm text-slate-500">{planPrescriptionSummary(exercise)}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => openPickerForReplace(sessionIndex, exerciseIndex)}>Change exercise</Button>
                      <Button size="sm" variant="outline" onClick={() => updateSession(sessionIndex, { exercises: insertItemAfter(session.exercises, exerciseIndex, { ...exercise, id: `plan-exercise-${makeId()}`, sortOrder: exerciseIndex + 1 }) })}>Duplicate</Button>
                      <Button size="sm" variant="danger" onClick={() => updateSession(sessionIndex, { exercises: session.exercises.filter((_, index) => index !== exerciseIndex).map((item, index) => ({ ...item, sortOrder: index })) })}>Remove</Button>
                    </div>
                  </div>

                  <ExerciseSetupEditor
                    exercise={exercise}
                    onChange={(next) => updateSession(sessionIndex, { exercises: session.exercises.map((item, index) => index === exerciseIndex ? next : item) })}
                    trainingMode={trainingMode}
                  />

                  <Field label="Notes">
                    <Textarea value={exercise.notes || ""} onChange={(event) => updateSession(sessionIndex, { exercises: session.exercises.map((item, index) => index === exerciseIndex ? { ...item, notes: event.target.value } : item) })} />
                  </Field>
                </div>
              ))}

              {pickerSession === sessionIndex ? (
                <div className="space-y-3 rounded-xl border border-dashed border-slate-300 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div><div className="font-semibold">{replaceTarget ? "Change exercise" : "Exercise picker"}</div><div className="text-sm text-slate-500">Choose from the shared exercise library.</div></div>
                    <Button size="sm" variant="outline" onClick={() => { setPickerSession(null); setReplaceTarget(null); setExerciseQuery(""); }}>Cancel</Button>
                  </div>
                  <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" value={exerciseQuery} onChange={(event) => setExerciseQuery(event.target.value)} placeholder="Search exercises" /></div>
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {filteredExercises.map((libraryExercise) => <div key={libraryExercise.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div className="min-w-0"><div className="truncate font-medium">{libraryExercise.name}</div><div className="text-xs capitalize text-slate-500">{libraryExercise.exerciseType || libraryExercise.trackingType}</div></div><Button size="sm" onClick={() => chooseExercise(sessionIndex, libraryExercise)}>{replaceTarget ? "Use" : "Add"}</Button></div>)}
                    {filteredExercises.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500">No exercises match this search.</div> : null}
                  </div>
                  <Button variant="outline" onClick={onManageExerciseLibrary}>Manage Exercise Library</Button>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" onClick={() => openPickerForAdd(sessionIndex)}><Plus className="mr-1 h-4 w-4" /> Add exercise</Button>
              <div className="text-xs text-slate-500">{session.exercises.length} exercise{session.exercises.length === 1 ? "" : "s"}</div>
            </div>
          </div>
        ))}
      </div>

      {removeSessionIndex !== null ? <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"><h3 className="text-lg font-semibold">Remove session?</h3><p className="mt-1 text-sm text-slate-500">This removes the session from the programme draft.</p><div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setRemoveSessionIndex(null)}>Cancel</Button><Button variant="danger" onClick={() => { setSessions(draft.sessions.filter((_, index) => index !== removeSessionIndex).map((item, index) => ({ ...item, sortOrder: index }))); setRemoveSessionIndex(null); }}>Remove</Button></div></div></div> : null}
    </div>
  );
}

export default function PlansScreen({ user, trainingMode = "gym", onOpenExerciseLibrary }) {
  const [plans, setPlans] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editor, setEditor] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const activePlan = useMemo(() => plans.find((plan) => plan.isActive) || null, [plans]);
  const inactivePlans = useMemo(() => plans.filter((plan) => !plan.isActive && !plan.isArchived), [plans]);
  const archivedPlans = useMemo(() => plans.filter((plan) => plan.isArchived), [plans]);

  async function refresh() {
    if (!user) return;
    setLoading(true);
    try {
      const [loadedPlans, loadedExercises] = await Promise.all([listPlans(user.uid), listExercises(user.uid)]);
      setPlans(loadedPlans);
      setExercises(loadedExercises);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [user]);

  function beginEdit(plan = null) {
    setEditor(plan || { id: null });
    setDraft(plan ? structuredClone(plan) : createNewPlan({ userId: user.uid }));
    setMessage("");
  }

  function requestEditorClose() {
    if (!draft || !editor) return setEditor(null);
    const original = editor.id ? plans.find((plan) => plan.id === editor.id) : null;
    if (!original || JSON.stringify(original) !== JSON.stringify(draft)) {
      setPendingAction({ type: "close-editor" });
    } else {
      setEditor(null);
      setDraft(null);
    }
  }

  async function commitSave() {
    if (!draft) return;
    const original = editor?.id ? plans.find((plan) => plan.id === editor.id) : null;
    const next = nextPlanForSave(original, draft);
    setSaving(true);
    try {
      await savePlan(user.uid, next, { expectedVersion: original?.version });
      await refresh();
      setMessage("Programme saved.");
      setEditor(next);
      setDraft(structuredClone(next));
    } catch (error) {
      setMessage(error?.message || "Could not save programme.");
    } finally {
      setSaving(false);
    }
  }

  async function commitDelete(plan) {
    await deletePlan(user.uid, plan.id);
    await refresh();
    setPendingAction(null);
  }

  async function commitActivate(plan) {
    await activatePlan(user.uid, plan.id);
    await refresh();
    setPendingAction(null);
  }

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading programmes…</div>;

  if (editor && draft) {
    const original = editor.id ? plans.find((plan) => plan.id === editor.id) : null;
    return <PlanEditor draft={draft} setDraft={setDraft} original={original} exercises={exercises} onSave={commitSave} onClose={requestEditorClose} saving={saving} saveMessage={message} onManageExerciseLibrary={onOpenExerciseLibrary} trainingMode={trainingMode} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Programme</h1><p className="text-sm text-slate-500">Create reusable sessions and keep one active programme.</p></div>
        <Button onClick={() => beginEdit(null)}><Plus className="mr-1 h-4 w-4" /> New programme</Button>
      </div>

      {message ? <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">{message}</div> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Active programme</h2>{activePlan ? <Button size="sm" variant="outline" onClick={() => beginEdit(activePlan)}>Edit</Button> : null}</div>
        {activePlan ? <div className="space-y-2"><div className="text-lg font-semibold">{activePlan.name}</div><div className="text-sm text-slate-500">Version {activePlan.version} · {activePlan.sessions.length} sessions</div>{activePlan.description ? <p className="text-sm text-slate-600">{activePlan.description}</p> : null}<div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setPendingAction({ type: "duplicate", plan: activePlan })}>Duplicate</Button><Button size="sm" variant="danger" onClick={() => setPendingAction({ type: "delete", plan: activePlan })}>Delete</Button></div></div> : <div className="text-sm text-slate-500">No active programme.</div>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Inactive programmes ({inactivePlans.length})</h2></div>
        <div className="space-y-3">{inactivePlans.map((plan) => <div key={plan.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-medium">{plan.name}</div><div className="text-xs text-slate-500">Version {plan.version} · {plan.sessions.length} sessions</div></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => beginEdit(plan)}>Open / edit</Button><Button size="sm" onClick={() => setPendingAction({ type: "activate", plan })}>Activate</Button><Button size="sm" variant="outline" onClick={() => setPendingAction({ type: "duplicate", plan })}>Duplicate</Button><Button size="sm" variant="danger" onClick={() => setPendingAction({ type: "delete", plan })}>Delete</Button></div></div></div>)}</div>
      </section>

      {archivedPlans.length ? <section className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="mb-3 font-semibold">Archived</h2><div className="space-y-3">{archivedPlans.map((plan) => <div key={plan.id} className="rounded-xl border border-slate-200 p-3"><div className="font-medium">{plan.name}</div><div className="text-xs text-slate-500">Version {plan.version} · {plan.sessions.length} sessions</div></div>)}</div></section> : null}

      {pendingAction ? <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"><h3 className="text-lg font-semibold">{pendingAction.type === "delete" ? "Delete programme?" : pendingAction.type === "activate" ? "Activate programme?" : pendingAction.type === "duplicate" ? "Duplicate programme?" : "Discard changes?"}</h3><p className="mt-1 text-sm text-slate-500">{pendingAction.type === "delete" ? "Completed workout history is kept. The programme itself will be removed." : pendingAction.type === "activate" ? "This becomes your active programme. Existing completed workout history is not changed." : pendingAction.type === "duplicate" ? "A new inactive copy will be created." : "Unsaved changes will be lost."}</p><div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setPendingAction(null)}>Cancel</Button>{pendingAction.type === "delete" ? <Button variant="danger" onClick={() => commitDelete(pendingAction.plan)}>Delete</Button> : pendingAction.type === "activate" ? <Button onClick={() => commitActivate(pendingAction.plan)}>Activate</Button> : pendingAction.type === "duplicate" ? <Button onClick={async () => { const copy = duplicatePlan(pendingAction.plan, { userId: user.uid }); await savePlan(user.uid, copy); await refresh(); setPendingAction(null); }}>Duplicate</Button> : <Button variant="danger" onClick={() => { setEditor(null); setDraft(null); setPendingAction(null); }}>Discard</Button>}</div></div></div> : null}
    </div>
  );
}
