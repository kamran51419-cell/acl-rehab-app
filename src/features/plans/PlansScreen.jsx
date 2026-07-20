import React, { useEffect, useMemo, useState } from "react";
import { GripVertical, Plus, Search, Trash2 } from "lucide-react";
import { db } from "../../firebase";
import Button from "../../components/ui/Button";
import {
  EXERCISE_LOGGING_METHOD,
  EXERCISE_TYPE,
  INTERVAL_PHASE,
  LIBRARY_EXERCISE_TYPE_OPTIONS,
  REP_TARGET_TYPE,
  createBlankPlan,
  createDefaultPrescription,
  createIntervalStage,
  createLibraryExercise,
  createPlanExercise,
  createPlanSession,
  defaultLoggingMethodForExerciseType,
  duplicatePlanExercise,
  duplicatePlan,
  filterExerciseLibrary,
  insertItemAfter,
  loggingMethodsForExerciseType,
  nextPlanForSave,
  planPrescriptionSummary,
  reorderItems,
  validatePlan,
} from "../../lib/domain/plans";
import { SIDE } from "../../lib/domain/v2Models";
import { makeId } from "../../lib/domain/legacyWorkouts";
import { DirectStrengthPrescription, DurationInput, Field, Input, Select, Textarea } from "./ProgrammeFormControls";
import {
  createPlan,
  duplicatePlanDocument,
  deletePlan,
  deleteExerciseDefinition,
  saveExerciseDefinition,
  setPlanActive,
  subscribeExerciseDefinitions,
  subscribePlans,
  updatePlan,
} from "../../lib/firebase/planRepository";

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function token() {
  return `token-${makeId()}`;
}

const EXERCISE_TYPE_LABELS = {
  [EXERCISE_TYPE.STRENGTH]: "Strength",
  [EXERCISE_TYPE.CARDIO]: "Cardio",
  [EXERCISE_TYPE.PLYOMETRIC]: "Plyometric",
  [EXERCISE_TYPE.BALANCE]: "Balance",
  [EXERCISE_TYPE.MOBILITY]: "Mobility",
  [EXERCISE_TYPE.STRETCH]: "Stretch",
  [EXERCISE_TYPE.OTHER]: "Other",
  [EXERCISE_TYPE.TIMED_HOLD]: "Timed",
  [EXERCISE_TYPE.FOAM_ROLLING]: "Foam rolling",
};

const LOGGING_METHOD_LABELS = {
  [EXERCISE_LOGGING_METHOD.REPS]: "Reps",
  [EXERCISE_LOGGING_METHOD.REPS_WEIGHT]: "Reps + Weight",
  [EXERCISE_LOGGING_METHOD.TIME]: "Time",
  [EXERCISE_LOGGING_METHOD.DISTANCE]: "Distance",
  [EXERCISE_LOGGING_METHOD.COMPLETED]: "Task",
  [EXERCISE_LOGGING_METHOD.INTERVALS]: "Intervals",
};

function exerciseTypeLabel(type) {
  if (type === EXERCISE_TYPE.MOBILITY) return "Mobility / Stretch";
  return EXERCISE_TYPE_LABELS[type] || "Strength";
}

function loggingMethodLabel(method) {
  return LOGGING_METHOD_LABELS[method] || "Task";
}

function friendlyErrorMessage(error, fallback, resource = "rehab data") {
  const code = error?.code || "";
  const message = error?.message || "";
  if (code.includes("permission-denied") || /permission/i.test(message)) {
    return `We could not access your ${resource} right now. Please check that you are signed in and try again.`;
  }
  if (/network|offline|unavailable/i.test(message)) {
    return "We could not reach the server. Please check your connection and try again.";
  }
  return fallback;
}

function friendlyPlanValidationMessages(errors) {
  return errors.map((error) => {
    if (error === "Plan name is required.") return "Enter a programme name.";
    if (error === "Active plans must include at least one valid session.") return "Add and name at least one session before activating this programme.";
    const sessionNumber = Number(error.match(/sessions\[(\d+)\]/)?.[1] || 0) + 1;
    const exerciseNumber = Number(error.match(/exercises\[(\d+)\]/)?.[1] || 0) + 1;
    if (/sessions\[\d+\] needs a name/.test(error)) return `Enter a name for session ${sessionNumber}.`;
    if (/needs an exercise|exercise name snapshot/.test(error)) return `Choose an exercise for item ${exerciseNumber} in session ${sessionNumber}.`;
    if (/unsupported prescription method/.test(error)) return `Choose how exercise ${exerciseNumber} in session ${sessionNumber} is recorded.`;
    if (/duration must be positive/.test(error)) return `Enter a duration greater than zero for exercise ${exerciseNumber} in session ${sessionNumber}.`;
    if (/target sets|target reps|rep range/.test(error)) return `Check the sets and reps for exercise ${exerciseNumber} in session ${sessionNumber}.`;
    if (/duplicate/i.test(error)) return "Remove duplicated items before saving the programme.";
    return `Review exercise ${exerciseNumber} in session ${sessionNumber}.`;
  });
}

function sectionPlans(plans, predicate) {
  return plans.filter(predicate);
}

function PlanCard({ plan, onEdit, onDuplicate, onToggleActive, onDelete }) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="text-lg font-semibold text-slate-900">{plan.name || "Untitled programme"}</div>
        <span className={cls("rounded-full px-2 py-1 text-xs font-medium", plan.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>
          {plan.isActive ? "Active" : "Inactive"}
        </span>
      </div>
      <div className="text-xs text-slate-500">{plan.sessions?.length || 0} sessions</div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onEdit(plan)}>Open / edit</Button>
        <Button size="sm" variant="outline" onClick={() => onDuplicate(plan)}>Duplicate</Button>
        <Button size="sm" variant="outline" onClick={() => onToggleActive(plan)}>{plan.isActive ? "Deactivate" : "Activate"}</Button>
        <Button size="sm" variant="danger" onClick={() => onDelete(plan)}>Delete programme</Button>
      </div>
    </div>
  );
}

function zeroIntervalPrescription() {
  return {
    stages: [
      createIntervalStage({ phase: INTERVAL_PHASE.WORK, durationSeconds: 0, durationUnit: "seconds", sortOrder: 0 }),
      createIntervalStage({ phase: INTERVAL_PHASE.REST, durationSeconds: 0, durationUnit: "seconds", sortOrder: 1 }),
    ],
  };
}

function ExerciseSetupEditor({ exercise, onChange }) {
  const updatePrescription = (prescription) => onChange({ ...exercise, prescription });
  const methods = loggingMethodsForExerciseType(exercise.exerciseType);
  const isLegacyCompleted = exercise.loggingMethod === EXERCISE_LOGGING_METHOD.COMPLETED;
  const selectedMethod = methods.includes(exercise.loggingMethod) ? exercise.loggingMethod : methods[0];

  const changeLoggingMethod = (loggingMethod) => {
    const prescription = loggingMethod === EXERCISE_LOGGING_METHOD.INTERVALS
      ? zeroIntervalPrescription()
      : createDefaultPrescription(exercise.exerciseType, loggingMethod);
    onChange({ ...exercise, loggingMethod, prescription });
  };

  const methodField = (
    <Field label="Track by">
      <Select value={selectedMethod} onChange={(event) => changeLoggingMethod(event.target.value)}>
        {methods.map((method) => <option key={method} value={method}>{loggingMethodLabel(method)}</option>)}
      </Select>
    </Field>
  );

  if (isLegacyCompleted) {
    return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">This existing task-based exercise remains available in workouts.</div>;
  }

  if (exercise.exerciseType === EXERCISE_TYPE.PLYOMETRIC) {
    return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Existing Plyometric exercise: {planPrescriptionSummary(exercise)}</div>;
  }

  if (exercise.exerciseType === EXERCISE_TYPE.STRENGTH && exercise.prescription?.blocks) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">This existing exercise uses the earlier multi-block format. It remains readable below.</div>
        {exercise.prescription.blocks.map((item, index) => (
          <div key={item.id || index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="font-medium">Set-up {index + 1}</div>
            <div className="text-sm text-slate-600">
              {item.side === SIDE.LEFT ? "Left only" : item.side === SIDE.RIGHT ? "Right only" : "Both legs"} · {item.targetSets} × {item.targetReps?.type === REP_TARGET_TYPE.RANGE ? `${item.targetReps.min}–${item.targetReps.max}` : item.targetReps?.value}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if ([EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT].includes(selectedMethod)) {
    return (
      <div className="space-y-3">
        <div className="max-w-xs">{methodField}</div>
        <DirectStrengthPrescription
          prescription={exercise.prescription || {}}
          onChange={updatePrescription}
          showNotes={false}
          bothLabel={exercise.exerciseType === EXERCISE_TYPE.BALANCE ? "Both sides" : "Both legs"}
        />
      </div>
    );
  }

  if (selectedMethod === EXERCISE_LOGGING_METHOD.TIME) {
    const p = exercise.prescription || {};
    const duration = (
      <DurationInput
        seconds={p.targetDurationSeconds}
        durationUnit={p.durationUnit}
        onChange={({ seconds, unit }) => updatePrescription({ ...p, targetDurationSeconds: seconds, durationUnit: unit })}
      />
    );
    if (exercise.exerciseType === EXERCISE_TYPE.BALANCE || exercise.exerciseType === EXERCISE_TYPE.TIMED_HOLD) {
      return (
        <div className="space-y-3">
          <div className="max-w-xs">{methodField}</div>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Side">
              <Select value={p.side || SIDE.BOTH} onChange={(event) => updatePrescription({ ...p, side: event.target.value })}>
                <option value={SIDE.BOTH}>Both sides</option>
                <option value={SIDE.LEFT}>Left only</option>
                <option value={SIDE.RIGHT}>Right only</option>
              </Select>
            </Field>
            <Field label="Sets"><Input inputMode="numeric" value={p.targetSets || ""} onChange={(event) => updatePrescription({ ...p, targetSets: Number(event.target.value) })} /></Field>
            {duration}
          </div>
        </div>
      );
    }
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
              <DurationInput
                seconds={stage.durationSeconds}
                durationUnit={stage.durationUnit}
                onChange={({ seconds, unit }) => updateStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, durationSeconds: seconds, durationUnit: unit } : item))}
              />
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

function PlanEditor({ draft, setDraft, original, exercises, onSave, onClose, onManageExerciseLibrary, saving, saveMessage }) {
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [pickerSession, setPickerSession] = useState(null);
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [activeExerciseId, setActiveExerciseId] = useState("");
  const [draggingExercise, setDraggingExercise] = useState(null);
  const [draggingSession, setDraggingSession] = useState(null);
  const [removeSessionIndex, setRemoveSessionIndex] = useState(null);

  const validation = validatePlan(draft);
  const validationMessages = friendlyPlanValidationMessages(validation.errors);
  const filteredExercises = filterExerciseLibrary(exercises, { query: exerciseQuery });

  const setSessions = (sessions) => setDraft({ ...draft, sessions });
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
          <Button onClick={onSave} disabled={saving || !validation.valid}>{saving ? "Saving…" : "Save programme"}</Button>
        </div>
      </div>

      {saveMessage ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{saveMessage}</div> : null}
      {!validation.valid ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{validationMessages.slice(0, 4).join(" ")}</div> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Programme name"><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="My programme" /></Field>
        <Field label="Description"><Input value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Optional" /></Field>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm">
          <input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} />
          Active programme
        </label>
      </div>

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
                className="mt-6 cursor-grab rounded p-1 text-slate-400"
                aria-label={`Drag ${session.name || "session"}`}
              >
                <GripVertical className="h-5 w-5" />
              </button>
              <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
                <Field label="Session name"><Input value={session.name} onChange={(event) => updateSession(sessionIndex, { name: event.target.value })} /></Field>
                <Field label="Notes"><Input value={session.notes || ""} onChange={(event) => updateSession(sessionIndex, { notes: event.target.value })} /></Field>
                <div className="flex flex-wrap items-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSessions([...draft.sessions, { ...duplicatePlan({ ...draft, sessions: [session] }).sessions[0], sortOrder: draft.sessions.length }])}>Duplicate</Button>
                  <Button size="sm" variant="danger" onClick={() => setRemoveSessionIndex(sessionIndex)}>Remove</Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {session.exercises.map((exercise, exerciseIndex) => (
                <div
                  key={exercise.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => draggingExercise?.sessionIndex === sessionIndex && moveExercise(sessionIndex, draggingExercise.exerciseIndex, exerciseIndex)}
                  className={cls("space-y-3 rounded-xl border bg-white p-3", activeExerciseId === exercise.id ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200")}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        draggable
                        onDragStart={() => setDraggingExercise({ sessionIndex, exerciseIndex })}
                        onDragEnd={() => setDraggingExercise(null)}
                        className="cursor-grab rounded p-1 text-slate-400"
                        aria-label={`Drag ${exercise.exerciseNameSnapshot}`}
                      >
                        <GripVertical className="h-5 w-5" />
                      </button>
                      <div>
                        <div className="font-semibold">{exercise.exerciseNameSnapshot}</div>
                        <div className="text-sm text-slate-500">{planPrescriptionSummary(exercise)}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => openPickerForReplace(sessionIndex, exerciseIndex)}>Change exercise</Button>
                      <Button size="sm" variant="outline" onClick={() => updateSession(sessionIndex, { exercises: [...session.exercises, duplicatePlanExercise(exercise, { sortOrder: session.exercises.length })] })}>Duplicate</Button>
                      <Button size="sm" variant="danger" onClick={() => updateSession(sessionIndex, { exercises: session.exercises.filter((_, index) => index !== exerciseIndex).map((item, index) => ({ ...item, sortOrder: index })) })}>
                        <Trash2 className="mr-1 h-4 w-4" /> Remove
                      </Button>
                    </div>
                  </div>

                  <ExerciseSetupEditor
                    exercise={exercise}
                    onChange={(next) => updateSession(sessionIndex, { exercises: session.exercises.map((item, index) => index === exerciseIndex ? next : item) })}
                  />

                  <Field label="Notes">
                    <Textarea value={exercise.notes || ""} onChange={(event) => updateSession(sessionIndex, { exercises: session.exercises.map((item, index) => index === exerciseIndex ? { ...item, notes: event.target.value } : item) })} />
                  </Field>
                </div>
              ))}

              {pickerSession === sessionIndex ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <strong>{replaceTarget ? "Change exercise" : "Exercise picker"}</strong>
                    <Button size="sm" variant="outline" onClick={() => { setPickerSession(null); setReplaceTarget(null); }}>Close</Button>
                  </div>

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <Input className="h-12 rounded-xl pl-10 text-base" autoFocus aria-label="Search exercises" value={exerciseQuery} onChange={(event) => setExerciseQuery(event.target.value)} placeholder="Search exercises" />
                  </div>
                      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                        {filteredExercises.length ? filteredExercises.map((libraryExercise) => {
                          const selected = session.exercises.some((item) => item.exerciseId === libraryExercise.id);
                          return (
                          <div key={libraryExercise.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                            <div className="min-w-0">
                              <div className="truncate font-medium">{libraryExercise.name}</div>
                              <div className="text-xs text-slate-500">{exerciseTypeLabel(libraryExercise.exerciseType || libraryExercise.trackingType)}</div>
                            </div>
                            <Button size="sm" variant={selected && !replaceTarget ? "outline" : "primary"} disabled={selected && !replaceTarget} onClick={() => chooseExercise(sessionIndex, libraryExercise)}>{replaceTarget ? "Use" : selected ? "Selected" : "Add"}</Button>
                          </div>
                          );
                        }) : <div className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">No matching exercises.</div>}
                      </div>
                      <Button className="mt-3 w-full" variant="outline" onClick={onManageExerciseLibrary}>Manage Exercise Library</Button>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" onClick={() => openPickerForAdd(sessionIndex)}><Plus className="mr-1 h-4 w-4" /> Add exercise</Button>
              <Button variant="outline" onClick={() => insertSessionAfter(sessionIndex)}><Plus className="mr-1 h-4 w-4" /> Add session</Button>
            </div>
          </div>
        ))}
      </div>
      {removeSessionIndex !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Remove session?</h3>
            <p className="mt-2 text-sm text-slate-600">This session will be removed from the programme. Your other changes will not be saved until you save the programme.</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRemoveSessionIndex(null)}>Keep session</Button>
              <Button variant="danger" onClick={() => { setSessions(draft.sessions.filter((_, index) => index !== removeSessionIndex).map((item, index) => ({ ...item, sortOrder: index }))); setRemoveSessionIndex(null); }}>Remove</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ExerciseLibrary({ user, exercises, onChanged }) {
  const [name, setName] = useState("");
  const [exerciseType, setExerciseType] = useState(EXERCISE_TYPE.STRENGTH);
  const [addingExercise, setAddingExercise] = useState(false);
  const [editingExercise, setEditingExercise] = useState(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  const visibleExercises = filterExerciseLibrary(exercises, { query }).filter((exercise) => typeFilter === "all" || (exercise.exerciseType || exercise.trackingType) === typeFilter);
  const activeCount = exercises.filter((exercise) => !exercise.isArchived).length;

  async function saveNewExercise() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setMessage("");
    try {
      await saveExerciseDefinition(db, user.uid, createLibraryExercise({ name, exerciseType }), { updatedAtToken: token() });
      setName("");
      setExerciseType(EXERCISE_TYPE.STRENGTH);
      setAddingExercise(false);
      setMessage("Exercise added to your library.");
      onChanged?.();
    } catch (error) {
      console.error("Could not add exercise", error);
      setMessage(friendlyErrorMessage(error, "We could not save that exercise. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  async function saveEditedExercise() {
    if (!editingExercise?.name.trim()) return;
    try {
      await saveExerciseDefinition(db, user.uid, { ...editingExercise, name: editingExercise.name.trim(), exerciseType: editingExercise.exerciseType, trackingType: editingExercise.exerciseType }, { updatedAtToken: token() });
      setEditingExercise(null);
      setMessage("Exercise updated.");
    } catch (error) {
      console.error("Could not update exercise", error);
      setMessage(friendlyErrorMessage(error, "We could not update that exercise. Please try again."));
    }
  }

  async function deleteExercise() {
    if (!deleteCandidate) return;
    try {
      await deleteExerciseDefinition(db, user.uid, deleteCandidate.id);
      setEditingExercise(null);
      setDeleteCandidate(null);
      setMessage("Exercise permanently deleted from the library. Existing programme and workout records were not changed.");
    } catch (error) {
      console.error("Could not delete exercise", error);
      setMessage(friendlyErrorMessage(error, "We could not delete that exercise. Please try again.", "exercise library"));
    }
  }

  return (
    <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Exercise library</h2>
          <p className="text-sm text-slate-500">Define what an exercise is. Configure it inside a programme.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{activeCount} exercises</div>
          <Button size="sm" onClick={() => setAddingExercise(true)}><Plus className="mr-1 h-4 w-4" /> Add exercise</Button>
        </div>
      </div>

      {message ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{message}</div> : null}

      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <Input className="h-12 rounded-xl pl-11 text-base" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exercises" aria-label="Search exercise library" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button size="sm" variant={typeFilter === "all" ? "primary" : "outline"} onClick={() => setTypeFilter("all")}>All</Button>
          {LIBRARY_EXERCISE_TYPE_OPTIONS.map((type) => <Button key={type} size="sm" variant={typeFilter === type ? "primary" : "outline"} onClick={() => setTypeFilter(type)}>{exerciseTypeLabel(type)}</Button>)}
        </div>
      </div>

      <div className="h-64 space-y-3 overflow-y-auto pr-1 md:h-72">
        {exercises.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
            <div className="font-semibold text-slate-900">No reusable exercises yet</div>
            <p className="mt-1 text-sm text-slate-500">Add your common gym, rehab and mobility exercises here.</p>
          </div>
        ) : visibleExercises.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">No exercises match your search.</div>
        ) : (
          <div className="space-y-1.5">
            {visibleExercises.map((exercise) => (
              <div key={exercise.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900">{exercise.name}</div>
                  <div className="truncate text-xs text-slate-500">{exerciseTypeLabel(exercise.exerciseType || exercise.trackingType)}</div>
                </div>
                <Button className="shrink-0 px-3 py-1.5" size="sm" variant="outline" onClick={() => setEditingExercise({ ...exercise, exerciseType: exercise.exerciseType || exercise.trackingType || EXERCISE_TYPE.STRENGTH })}>Edit</Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {addingExercise ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="add-exercise-title" className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <h3 id="add-exercise-title" className="text-lg font-semibold">Add exercise</h3>
            <div className="mt-4 space-y-4">
              <Field label="Exercise name"><Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Leg extension" /></Field>
              <Field label="Exercise type"><Select value={exerciseType} onChange={(event) => setExerciseType(event.target.value)}>{LIBRARY_EXERCISE_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{exerciseTypeLabel(type)}</option>)}</Select></Field>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" disabled={saving} onClick={() => { setAddingExercise(false); setName(""); setExerciseType(EXERCISE_TYPE.STRENGTH); }}>Cancel</Button>
              <Button onClick={saveNewExercise} disabled={saving || !name.trim()}>{saving ? "Saving…" : "Add exercise"}</Button>
            </div>
          </div>
        </div>
      ) : null}

      {editingExercise ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="edit-exercise-title" className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <h3 id="edit-exercise-title" className="text-lg font-semibold">Edit exercise</h3>
            <div className="mt-4 space-y-4">
              <Field label="Exercise name"><Input autoFocus value={editingExercise.name} onChange={(event) => setEditingExercise({ ...editingExercise, name: event.target.value })} /></Field>
              <Field label="Exercise type"><Select value={editingExercise.exerciseType || editingExercise.trackingType} onChange={(event) => setEditingExercise({ ...editingExercise, exerciseType: event.target.value })}>{!LIBRARY_EXERCISE_TYPE_OPTIONS.includes(editingExercise.exerciseType) ? <option value={editingExercise.exerciseType}>{exerciseTypeLabel(editingExercise.exerciseType)} (existing)</option> : null}{LIBRARY_EXERCISE_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{exerciseTypeLabel(type)}</option>)}</Select></Field>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button variant="danger" onClick={() => setDeleteCandidate(editingExercise)}>Delete</Button>
              <Button variant="outline" onClick={() => setEditingExercise(null)}>Cancel</Button>
              <Button onClick={saveEditedExercise} disabled={!editingExercise.name.trim()}>Save</Button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteCandidate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Delete {deleteCandidate.name} permanently?</h3>
            <p className="mt-2 text-sm text-slate-600">It will be removed from your Exercise Library. Existing programme and workout records will not be rewritten.</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteCandidate(null)}>Cancel</Button>
              <Button variant="danger" onClick={deleteExercise}>Delete permanently</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function PlansScreen({ user, view = "programme", onManageExerciseLibrary }) {
  const [plans, setPlans] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [plansLoading, setPlansLoading] = useState(view === "programme");
  const [exercisesLoading, setExercisesLoading] = useState(true);
  const [plansError, setPlansError] = useState("");
  const [exercisesError, setExercisesError] = useState("");
  const [draft, setDraft] = useState(null);
  const [original, setOriginal] = useState(null);
  const [loadedToken, setLoadedToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [programmeNotice, setProgrammeNotice] = useState("");
  const [deleteProgrammeCandidate, setDeleteProgrammeCandidate] = useState(null);
  const [discardDraftOpen, setDiscardDraftOpen] = useState(false);
  const draftStorageKey = `programme-draft:${user.uid}`;

  useEffect(() => {
    if (view !== "programme") return;
    const saved = sessionStorage.getItem(draftStorageKey);
    if (!saved) return;
    try {
      const restored = JSON.parse(saved);
      setDraft(restored.draft);
      setOriginal(restored.original);
      setLoadedToken(restored.loadedToken || "");
    } catch {
      sessionStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey, view]);

  useEffect(() => {
    if (view !== "programme" || !draft) return;
    sessionStorage.setItem(draftStorageKey, JSON.stringify({ draft, original, loadedToken }));
  }, [draft, original, loadedToken, draftStorageKey, view]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    setExercisesLoading(true);
    setExercisesError("");
    const unsubExercises = subscribeExerciseDefinitions(
      db,
      user.uid,
      (next) => { setExercises(next); setExercisesLoading(false); },
      (error) => { console.error("Could not load exercise library", error); setExercisesError(friendlyErrorMessage(error, "We could not load your exercise library. Please try again.", "exercise library")); setExercisesLoading(false); },
    );
    if (view === "exercises") return unsubExercises;

    setPlansLoading(true);
    setPlansError("");
    const unsubPlans = subscribePlans(
      db,
      user.uid,
      (next) => { setPlans(next); setPlansLoading(false); },
      (error) => { console.error("Could not load programmes", error); setPlansError(friendlyErrorMessage(error, "We could not load your programmes. Please try again.", "programmes")); setPlansLoading(false); },
    );
    return () => { unsubPlans(); unsubExercises(); };
  }, [user?.uid, view]);

  const activePlans = useMemo(() => sectionPlans(plans, (plan) => plan.isActive), [plans]);
  const inactivePlans = useMemo(() => sectionPlans(plans, (plan) => !plan.isActive), [plans]);

  function openNewPlan() {
    setOriginal(null);
    setLoadedToken("");
    setDraft(createBlankPlan({ userId: user.uid, name: "New programme" }));
    setSaveMessage("");
  }

  function openPlan(plan) {
    setOriginal(structuredClone(plan));
    setLoadedToken(plan.updatedAtToken || "");
    setDraft(structuredClone(plan));
    setSaveMessage("");
  }

  function closeEditor() {
    if ((draft && original && JSON.stringify(draft) !== JSON.stringify(original)) || (draft && !original)) {
      setDiscardDraftOpen(true);
      return;
    }
    discardDraft();
  }

  function discardDraft() {
    setDraft(null);
    setOriginal(null);
    setSaveMessage("");
    setDiscardDraftOpen(false);
    sessionStorage.removeItem(draftStorageKey);
  }

  async function saveDraft() {
    if (!draft || saving) return;
    const validation = validatePlan(draft);
    if (!validation.valid) {
      setSaveMessage(friendlyPlanValidationMessages(validation.errors).join(" "));
      return;
    }
    setSaving(true);
    setSaveMessage("");
    try {
      const saveToken = token();
      const planToSave = nextPlanForSave(original, draft);
      const saved = original
        ? await updatePlan(db, user.uid, original, planToSave, { expectedUpdatedAtToken: loadedToken, updatedAtToken: saveToken })
        : await createPlan(db, user.uid, planToSave, { updatedAtToken: saveToken });
      if (saved.isActive) await setPlanActive(db, user.uid, saved, true, { updatedAtToken: saveToken });
      setOriginal(null);
      setDraft(null);
      setLoadedToken("");
      setSaveMessage("");
      setProgrammeNotice("Programme saved.");
      sessionStorage.removeItem(draftStorageKey);
    } catch (error) {
      console.error("Could not save programme", error);
      setSaveMessage(friendlyErrorMessage(error, "Your changes were not saved. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate(plan) {
    if (saving) return;
    setSaving(true);
    try {
      await duplicatePlanDocument(db, user.uid, plan, { newPlanId: `plan-${makeId()}`, updatedAtToken: token() });
      setProgrammeNotice("Programme duplicated.");
    } catch (error) {
      console.error("Could not duplicate programme", error);
      setPlansError(friendlyErrorMessage(error, "We could not duplicate that programme. Please try again.", "programmes"));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(plan) {
    try {
      await setPlanActive(db, user.uid, plan, !plan.isActive, { updatedAtToken: token() });
      setProgrammeNotice(plan.isActive ? "Programme deactivated." : "Programme activated.");
    } catch (error) {
      console.error("Could not update programme status", error);
      setPlansError(friendlyErrorMessage(error, "We could not update that programme. Please try again.", "programmes"));
    }
  }

  async function handleDeleteProgramme() {
    if (!deleteProgrammeCandidate) return;
    try {
      await deletePlan(db, user.uid, deleteProgrammeCandidate.id);
      setPlans((current) => current.filter((plan) => plan.id !== deleteProgrammeCandidate.id));
      setDeleteProgrammeCandidate(null);
      setProgrammeNotice("Programme permanently deleted. Completed workouts were not changed.");
    } catch (error) {
      console.error("Could not delete programme", error);
      setPlansError(friendlyErrorMessage(error, "We could not delete that programme. Please try again.", "programmes"));
    }
  }

  const renderSection = (title, items, empty) => (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {items.length === 0
        ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">{empty}</div>
        : <div className="grid gap-3 lg:grid-cols-2">{items.map((plan) => <PlanCard key={plan.id} plan={plan} onEdit={openPlan} onDuplicate={handleDuplicate} onToggleActive={handleToggleActive} onDelete={setDeleteProgrammeCandidate} />)}</div>}
    </section>
  );

  return (
    <div className="space-y-6">
      {view === "exercises" ? (
        <>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Manage Exercises</h1>
            <p className="text-sm text-slate-500">Create, search and manage your reusable exercise library.</p>
          </div>
          {exercisesError ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{exercisesError}</div> : null}
          {exercisesLoading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">Loading exercise library…</div> : <ExerciseLibrary user={user} exercises={exercises} />}
        </>
      ) : (
        <>
          <div className="space-y-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Programme</h1>
              <p className="text-sm text-slate-500">Build reusable, named sessions and train them in any order.</p>
            </div>
            <Button className="w-fit" onClick={openNewPlan}><Plus className="mr-1 h-4 w-4" /> Create programme</Button>
          </div>

          {programmeNotice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{programmeNotice}</div> : null}
          {plansError ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{plansError}</div> : null}
          {exercisesError ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">The exercise library could not be loaded. Programme exercises already saved remain editable.</div> : null}
          {plansLoading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">Loading programmes…</div> : null}
          {!plansLoading && plans.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <div className="font-semibold text-slate-900">No programmes yet</div>
              <p className="mt-1 text-sm text-slate-500">Create your first programme and give each workout session a useful name.</p>
              <Button className="mt-4" onClick={openNewPlan}>Create first programme</Button>
            </div>
          ) : null}

          {draft ? <PlanEditor draft={draft} setDraft={setDraft} original={original} exercises={exercises} onSave={saveDraft} onClose={closeEditor} onManageExerciseLibrary={onManageExerciseLibrary} saving={saving} saveMessage={saveMessage} /> : null}
          {renderSection("Active", activePlans, "Activate any programme when you are ready to use it regularly.")}
          {renderSection("Inactive", inactivePlans, "Programmes you deactivate will remain here and can be activated later.")}

          {deleteProgrammeCandidate ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
              <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
                <h3 className="text-lg font-semibold">Delete "{deleteProgrammeCandidate.name}" permanently?</h3>
                <p className="mt-2 text-sm text-slate-600">This programme will be removed permanently. Completed workouts will remain untouched.</p>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDeleteProgrammeCandidate(null)}>Cancel</Button>
                  <Button variant="danger" onClick={handleDeleteProgramme}>Delete permanently</Button>
                </div>
              </div>
            </div>
          ) : null}
          {discardDraftOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
              <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
                <h3 className="text-lg font-semibold">Discard changes?</h3>
                <p className="mt-2 text-sm text-slate-600">Your changes have not been saved.</p>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDiscardDraftOpen(false)}>Keep editing</Button>
                  <Button variant="danger" onClick={discardDraft}>Discard</Button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
