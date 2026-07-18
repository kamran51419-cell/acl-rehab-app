import React, { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { db } from "../../firebase";
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
  fixedReps,
  insertItemAfter,
  loggingMethodsForExerciseType,
  nextPlanForSave,
  planPrescriptionSummary,
  reorderItems,
  repRange,
  validatePlan,
} from "../../lib/domain/plans";
import { SIDE } from "../../lib/domain/v2Models";
import { makeId } from "../../lib/domain/legacyWorkouts";
import { formatDate } from "../../lib/domain/date";
import {
  archiveExerciseDefinition,
  archivePlan,
  createPlan,
  duplicatePlanDocument,
  deleteExerciseDefinition,
  restorePlan,
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

function Button({ variant = "primary", size = "md", className = "", ...props }) {
  return (
    <button
      type="button"
      className={cls(
        "inline-flex items-center justify-center rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" ? "px-3 py-2 text-xs" : "px-4 py-2 text-sm",
        variant === "primary" && "bg-slate-900 text-white hover:bg-slate-800",
        variant === "outline" && "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        variant === "danger" && "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
        className
      )}
      {...props}
    />
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Input(props) {
  return <input className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" {...props} />;
}

function Select(props) {
  return <select className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" {...props} />;
}

function Textarea(props) {
  return <textarea className="min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" {...props} />;
}

function sectionPlans(plans, predicate) {
  return plans.filter(predicate);
}

function dateLabel(value) {
  if (!value) return "—";
  if (typeof value === "string") return formatDate(value.slice(0, 10));
  if (value?.toDate) return formatDate(value.toDate().toISOString().slice(0, 10));
  return "—";
}

function PlanCard({ plan, onEdit, onDuplicate, onToggleActive, onArchive, onRestore }) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-slate-900">{plan.name || "Untitled programme"}</div>
          {plan.description ? <div className="mt-1 text-sm text-slate-500">{plan.description}</div> : null}
        </div>
        <span className={cls("rounded-full px-2 py-1 text-xs font-medium", plan.isArchived ? "bg-slate-100 text-slate-600" : plan.isActive ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{plan.isArchived ? "Archived" : plan.isActive ? "Active" : "Inactive"}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
        <div>{plan.sessions?.length || 0} sessions</div>
        <div>Version {plan.version || 1}</div>
        <div>Updated {dateLabel(plan.updatedAt)}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onEdit(plan)}>Open / edit</Button>
        <Button size="sm" variant="outline" onClick={() => onDuplicate(plan)}>Duplicate</Button>
        {plan.isArchived ? (
          <Button size="sm" variant="outline" onClick={() => onRestore(plan)}>Restore</Button>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => onToggleActive(plan)}>{plan.isActive ? "Deactivate" : "Activate"}</Button>
            <Button size="sm" variant="danger" onClick={() => onArchive(plan)}>Archive</Button>
          </>
        )}
      </div>
    </div>
  );
}

function DurationInput({ seconds, durationUnit, onChange }) {
  const unit = durationUnit || (Number(seconds || 0) >= 60 && Number(seconds || 0) % 60 === 0 ? "minutes" : "seconds");
  const value = unit === "minutes" ? Number(seconds || 0) / 60 : Number(seconds || 0);
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Duration"><Input inputMode="decimal" value={value || ""} onChange={(event) => onChange({ seconds: Number(event.target.value) * (unit === "minutes" ? 60 : 1), unit })} /></Field>
      <Field label="Unit"><Select value={unit} onChange={(event) => onChange({ seconds: Number(seconds || 0), unit: event.target.value })}><option value="seconds">Seconds</option><option value="minutes">Minutes</option></Select></Field>
    </div>
  );
}

function DirectStrengthPrescription({ prescription, onChange, showNotes = true, bothLabel = "Both legs" }) {
  const updateReps = (patch) => onChange({ ...prescription, targetReps: { ...prescription.targetReps, ...patch } });
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Side"><Select value={prescription.side || SIDE.BOTH} onChange={(event) => onChange({ ...prescription, side: event.target.value })}><option value={SIDE.BOTH}>{bothLabel}</option><option value={SIDE.LEFT}>Left only</option><option value={SIDE.RIGHT}>Right only</option></Select></Field>
        <Field label="Sets"><Input inputMode="numeric" value={prescription.targetSets || ""} onChange={(event) => onChange({ ...prescription, targetSets: Number(event.target.value) })} /></Field>
        <Field label="Reps type"><Select value={prescription.targetReps?.type || REP_TARGET_TYPE.FIXED} onChange={(event) => onChange({ ...prescription, targetReps: event.target.value === REP_TARGET_TYPE.RANGE ? repRange(8, 12) : fixedReps(10) })}><option value={REP_TARGET_TYPE.FIXED}>Fixed</option><option value={REP_TARGET_TYPE.RANGE}>Range</option></Select></Field>
        {prescription.targetReps?.type === REP_TARGET_TYPE.RANGE ? <div className="grid grid-cols-2 gap-2"><Field label="Min"><Input inputMode="numeric" value={prescription.targetReps.min} onChange={(event) => updateReps({ min: Number(event.target.value) })} /></Field><Field label="Max"><Input inputMode="numeric" value={prescription.targetReps.max} onChange={(event) => updateReps({ max: Number(event.target.value) })} /></Field></div> : <Field label="Reps"><Input inputMode="numeric" value={prescription.targetReps?.value || ""} onChange={(event) => updateReps({ value: Number(event.target.value) })} /></Field>}
      </div>
      {showNotes ? <Field label="Notes"><Input value={prescription.notes || ""} onChange={(event) => onChange({ ...prescription, notes: event.target.value })} /></Field> : null}
    </div>
  );
}

function PrescriptionEditor({ exercise, onChange }) {
  const updatePrescription = (prescription) => onChange({ ...exercise, prescription });
  const methods = loggingMethodsForExerciseType(exercise.exerciseType);
  const isLegacyCompleted = exercise.loggingMethod === EXERCISE_LOGGING_METHOD.COMPLETED;
  const selectedMethod = methods.includes(exercise.loggingMethod) ? exercise.loggingMethod : methods[0];
  const changeLoggingMethod = (loggingMethod) => onChange({ ...exercise, loggingMethod, prescription: createDefaultPrescription(exercise.exerciseType, loggingMethod) });
  const methodField = <Field label="Prescription method"><Select value={selectedMethod} onChange={(event) => changeLoggingMethod(event.target.value)}>{methods.map((method) => <option key={method} value={method}>{loggingMethodLabel(method)}</option>)}</Select></Field>;
  if (isLegacyCompleted) return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Existing completion-only prescription. It remains available in workouts for compatibility.</div>;
  if (exercise.exerciseType === EXERCISE_TYPE.PLYOMETRIC) return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Existing Plyometric exercise: {planPrescriptionSummary(exercise)}</div>;
  if (exercise.exerciseType === EXERCISE_TYPE.STRENGTH && exercise.prescription?.blocks) return <div className="space-y-3"><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">This existing exercise uses the earlier multi-prescription format. It remains readable below.</div>{exercise.prescription.blocks.map((item, index) => <div key={item.id || index} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="font-medium">Prescription {index + 1}</div><div className="text-sm text-slate-600">{item.side === SIDE.LEFT ? "Left only" : item.side === SIDE.RIGHT ? "Right only" : "Both legs"} · {item.targetSets} × {item.targetReps?.type === REP_TARGET_TYPE.RANGE ? `${item.targetReps.min}–${item.targetReps.max}` : item.targetReps?.value}</div></div>)}</div>;

  if ([EXERCISE_LOGGING_METHOD.REPS, EXERCISE_LOGGING_METHOD.REPS_WEIGHT].includes(selectedMethod)) {
    return <div className="space-y-3"><div className="max-w-xs">{methodField}</div><DirectStrengthPrescription prescription={exercise.prescription || {}} onChange={updatePrescription} bothLabel={exercise.exerciseType === EXERCISE_TYPE.BALANCE ? "Both sides" : "Both legs"} /></div>;
  }

  if (selectedMethod === EXERCISE_LOGGING_METHOD.TIME) {
    const p = exercise.prescription || {};
    const duration = <DurationInput seconds={p.targetDurationSeconds} durationUnit={p.durationUnit} onChange={({ seconds, unit }) => updatePrescription({ ...p, targetDurationSeconds: seconds, durationUnit: unit })} />;
    if (exercise.exerciseType === EXERCISE_TYPE.BALANCE || exercise.exerciseType === EXERCISE_TYPE.TIMED_HOLD) return <div className="space-y-3"><div className="max-w-xs">{methodField}</div><div className="grid gap-3 md:grid-cols-3"><Field label="Side"><Select value={p.side || SIDE.BOTH} onChange={(event) => updatePrescription({ ...p, side: event.target.value })}><option value={SIDE.BOTH}>Both sides</option><option value={SIDE.LEFT}>Left only</option><option value={SIDE.RIGHT}>Right only</option></Select></Field><Field label="Sets"><Input inputMode="numeric" value={p.targetSets || ""} onChange={(event) => updatePrescription({ ...p, targetSets: Number(event.target.value) })} /></Field>{duration}</div></div>;
    return <div className="space-y-3"><div className="max-w-xs">{methodField}</div>{duration}</div>;
  }

  if (selectedMethod === EXERCISE_LOGGING_METHOD.DISTANCE) {
    const p = exercise.prescription || {};
    return <div className="space-y-3"><div className="max-w-xs">{methodField}</div><Field label="Distance (km)"><Input inputMode="decimal" value={p.targetDistance ?? p.distance ?? ""} onChange={(event) => updatePrescription({ ...p, targetDistance: Number(event.target.value) })} /></Field></div>;
  }

  if (selectedMethod === EXERCISE_LOGGING_METHOD.INTERVALS) {
    const p = exercise.prescription || {};
    const stages = p.stages || [];
    const updateStages = (next) => updatePrescription({ ...p, stages: next.map((stage, index) => ({ ...stage, sortOrder: index })) });
    return <div className="space-y-3"><div className="max-w-xs">{methodField}</div>{stages.map((stage, index) => <div key={stage.id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="grid gap-2 md:grid-cols-[140px_1fr_1fr]"><Field label="Stage"><Select value={stage.phase} onChange={(event) => updateStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, phase: event.target.value } : item))}><option value={INTERVAL_PHASE.WORK}>Work</option><option value={INTERVAL_PHASE.REST}>Rest</option></Select></Field><DurationInput seconds={stage.durationSeconds} durationUnit={stage.durationUnit} onChange={({ seconds, unit }) => updateStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, durationSeconds: seconds, durationUnit: unit } : item))} /><Field label="Label (optional)"><Input value={stage.label || ""} onChange={(event) => updateStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} /></Field></div><div className="flex gap-2"><Button size="sm" variant="outline" disabled={index === 0} onClick={() => updateStages(reorderItems(stages, index, index - 1))}>Up</Button><Button size="sm" variant="outline" disabled={index === stages.length - 1} onClick={() => updateStages(reorderItems(stages, index, index + 1))}>Down</Button><Button size="sm" variant="danger" onClick={() => updateStages(stages.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button></div></div>)}<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => updateStages([...stages, createIntervalStage({ phase: INTERVAL_PHASE.WORK, sortOrder: stages.length })])}>Add work</Button><Button variant="outline" onClick={() => updateStages([...stages, createIntervalStage({ phase: INTERVAL_PHASE.REST, sortOrder: stages.length })])}>Add rest</Button></div></div>;
  }

  return <div className="text-sm text-slate-500">No configurable prescription method is available for this legacy exercise type.</div>;
}

function PlanEditor({ draft, setDraft, original, exercises, onSave, onClose, saving, saveMessage }) {
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [pickerSession, setPickerSession] = useState(null);
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [pickerMessage, setPickerMessage] = useState("");
  const [activePrescriptionId, setActivePrescriptionId] = useState("");
  const [newExercise, setNewExercise] = useState({ name: "", exerciseType: EXERCISE_TYPE.STRENGTH });
  const validation = validatePlan(draft);
  const filteredExercises = filterExerciseLibrary(exercises, { query: exerciseQuery });

  const setSessions = (sessions) => setDraft({ ...draft, sessions });
  const updateSession = (sessionIndex, patch) => setSessions(draft.sessions.map((session, index) => (index === sessionIndex ? { ...session, ...patch } : session)));
  const addSession = () => setSessions([...draft.sessions, createPlanSession({ name: "New session", sortOrder: draft.sessions.length })]);
  const insertSessionAfter = (sessionIndex) => {
    const session = createPlanSession({ name: "New session", sortOrder: sessionIndex + 1 });
    setSessions(insertItemAfter(draft.sessions, sessionIndex, session));
    requestAnimationFrame(() => document.getElementById(`programme-session-${session.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  function addExerciseToSession(sessionIndex, libraryExercise) {
    const session = draft.sessions[sessionIndex];
    const exerciseType = libraryExercise.exerciseType || libraryExercise.trackingType || EXERCISE_TYPE.STRENGTH;
    const planExercise = createPlanExercise({
      exerciseId: libraryExercise.id,
      exerciseNameSnapshot: libraryExercise.name,
      exerciseType,
      sortOrder: session.exercises.length,
      prescription: createDefaultPrescription(exerciseType),
      loggingMethod: defaultLoggingMethodForExerciseType(exerciseType),
    });
    updateSession(sessionIndex, { exercises: [...session.exercises, planExercise] });
    setActivePrescriptionId(planExercise.id);
    setExerciseQuery("");
    setPickerSession(null);
  }

  async function createAndAddExercise(sessionIndex) {
    if (!newExercise.name.trim()) return;
    setPickerMessage("");
    try {
      const libraryExercise = createLibraryExercise(newExercise);
      await saveExerciseDefinition(db, draft.userId, libraryExercise, { updatedAtToken: token() });
      addExerciseToSession(sessionIndex, libraryExercise);
      setNewExercise({ name: "", exerciseType: EXERCISE_TYPE.STRENGTH });
      setCreatingExercise(false);
    } catch (error) {
      setPickerMessage(friendlyErrorMessage(error, "We could not save and add that exercise. Please try again.", "exercise library"));
    }
  }

  return (
    <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{original ? "Edit programme" : "Create programme"}</h2>
          <p className="text-sm text-slate-500">Programme changes do not alter completed workouts.</p>
        </div>
        <div className="flex gap-2"><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={onSave} disabled={saving || !validation.valid}>{saving ? "Saving…" : "Save programme"}</Button></div>
      </div>

      {saveMessage ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{saveMessage}</div> : null}
      {!validation.valid ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{validation.errors.slice(0, 4).join(" ")}</div> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Programme name"><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="ACL rehab programme" /></Field>
        <Field label="Description"><Input value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Optional" /></Field>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Active programme</label>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Sessions</h3><Button variant="outline" onClick={addSession}><Plus className="mr-1 h-4 w-4" /> Add session</Button></div>
        {draft.sessions.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No sessions yet. Add Lower A, Upper, ACL Rehab, Push, Pull, or any reusable session name.</div> : null}
        {draft.sessions.map((session, sessionIndex) => (
          <div id={`programme-session-${session.id}`} key={session.id} className="scroll-mt-4 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <Field label="Session name"><Input value={session.name} onChange={(e) => updateSession(sessionIndex, { name: e.target.value })} /></Field>
              <Field label="Notes"><Input value={session.notes || ""} onChange={(e) => updateSession(sessionIndex, { notes: e.target.value })} /></Field>
              <div className="flex flex-wrap items-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setSessions(reorderItems(draft.sessions, sessionIndex, sessionIndex - 1))} disabled={sessionIndex === 0}>Up</Button>
                <Button size="sm" variant="outline" onClick={() => setSessions(reorderItems(draft.sessions, sessionIndex, sessionIndex + 1))} disabled={sessionIndex === draft.sessions.length - 1}>Down</Button>
                <Button size="sm" variant="outline" onClick={() => setSessions([...draft.sessions, { ...duplicatePlan({ ...draft, sessions: [session] }).sessions[0], sortOrder: draft.sessions.length }])}>Duplicate</Button>
                <Button size="sm" variant="danger" onClick={() => window.confirm("Remove this session from the plan editor?") && setSessions(draft.sessions.filter((_, index) => index !== sessionIndex).map((item, index) => ({ ...item, sortOrder: index })))}>Remove</Button>
              </div>
            </div>

            <div className="space-y-3">
              {session.exercises.map((exercise, exerciseIndex) => (
                <div key={exercise.id} className={cls("space-y-3 rounded-xl border bg-white p-3", activePrescriptionId === exercise.id ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div><div className="font-semibold">{exercise.exerciseNameSnapshot}</div><div className="text-sm text-slate-500">{planPrescriptionSummary(exercise)}</div></div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => updateSession(sessionIndex, { exercises: reorderItems(session.exercises, exerciseIndex, exerciseIndex - 1) })} disabled={exerciseIndex === 0}>Up</Button>
                      <Button size="sm" variant="outline" onClick={() => updateSession(sessionIndex, { exercises: reorderItems(session.exercises, exerciseIndex, exerciseIndex + 1) })} disabled={exerciseIndex === session.exercises.length - 1}>Down</Button>
                      <Button size="sm" variant="outline" onClick={() => updateSession(sessionIndex, { exercises: [...session.exercises, duplicatePlanExercise(exercise, { sortOrder: session.exercises.length })] })}>Duplicate</Button>
                      <Button size="sm" variant="danger" onClick={() => updateSession(sessionIndex, { exercises: session.exercises.filter((_, index) => index !== exerciseIndex).map((item, index) => ({ ...item, sortOrder: index })) })}><Trash2 className="mr-1 h-4 w-4" /> Remove</Button>
                    </div>
                  </div>
                  <Field label="Session-specific notes"><Textarea value={exercise.notes || ""} onChange={(e) => updateSession(sessionIndex, { exercises: session.exercises.map((item, index) => (index === exerciseIndex ? { ...item, notes: e.target.value } : item)) })} /></Field>
                  <div className="border-t border-slate-100 pt-3"><div className="mb-3"><div className="font-semibold text-slate-900">Prescription</div><p className="text-xs text-slate-500">Configure this exercise for this session.</p></div><PrescriptionEditor exercise={exercise} onChange={(next) => updateSession(sessionIndex, { exercises: session.exercises.map((item, index) => (index === exerciseIndex ? next : item)) })} /></div>
                </div>
              ))}

              {pickerSession !== sessionIndex ? (
                <Button variant="outline" onClick={() => { setPickerSession(sessionIndex); setCreatingExercise(false); }}><Plus className="mr-1 h-4 w-4" /> Add Exercise</Button>
              ) : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3">
                <div className="mb-3 flex items-center justify-between"><strong>Exercise Picker</strong><Button size="sm" variant="outline" onClick={() => setPickerSession(null)}>Close</Button></div>
                {pickerMessage ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{pickerMessage}</div> : null}
                {creatingExercise ? <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Exercise name"><Input autoFocus value={newExercise.name} onChange={(e) => setNewExercise({ ...newExercise, name: e.target.value })} /></Field>
                    <Field label="Exercise type"><Select value={newExercise.exerciseType} onChange={(e) => setNewExercise({ ...newExercise, exerciseType: e.target.value })}>{LIBRARY_EXERCISE_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{exerciseTypeLabel(type)}</option>)}</Select></Field>
                  </div>
                  <div className="flex gap-2"><Button onClick={() => createAndAddExercise(sessionIndex)}>Save and add to session</Button><Button variant="outline" onClick={() => setCreatingExercise(false)}>Back to library</Button></div>
                </div> : <>
                <Field label="Search exercises"><Input autoFocus value={exerciseQuery} onChange={(e) => setExerciseQuery(e.target.value)} placeholder="Search by exercise name" /></Field>
                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                  {filteredExercises.length ? filteredExercises.map((exercise) => <div key={exercise.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div className="min-w-0"><div className="truncate font-medium">{exercise.name}</div><div className="text-xs text-slate-500">{exerciseTypeLabel(exercise.exerciseType || exercise.trackingType)}</div></div><Button size="sm" onClick={() => addExerciseToSession(sessionIndex, exercise)}>Add</Button></div>) : <div className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">No matching exercises.</div>}
                </div>
                <Button className="mt-3" variant="outline" onClick={() => setCreatingExercise(true)}><Plus className="mr-1 h-4 w-4" /> Create New Exercise</Button>
                </>}
              </div>}
            </div>
            <Button variant="outline" onClick={() => insertSessionAfter(sessionIndex)}><Plus className="mr-1 h-4 w-4" /> Add session</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExerciseLibrary({ user, exercises, onChanged }) {
  const [name, setName] = useState("");
  const [exerciseType, setExerciseType] = useState(EXERCISE_TYPE.STRENGTH);
  const [editingExercise, setEditingExercise] = useState(null);
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  const visibleExercises = filterExerciseLibrary(exercises, { query, includeArchived });
  const activeCount = exercises.filter((exercise) => !exercise.isArchived).length;
  const archivedCount = exercises.filter((exercise) => exercise.isArchived).length;

  async function saveNewExercise() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setMessage("");
    try {
      await saveExerciseDefinition(db, user.uid, createLibraryExercise({ name, exerciseType }), { updatedAtToken: token() });
      setName("");
      setMessage("Exercise added to your library.");
      onChanged?.();
    } catch (error) {
      setMessage(friendlyErrorMessage(error, "We could not save that exercise. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchive(exercise) {
    try {
      await archiveExerciseDefinition(db, user.uid, exercise.id, !exercise.isArchived, { updatedAtToken: token() });
      setMessage(exercise.isArchived ? "Exercise restored." : "Exercise archived.");
    } catch (error) {
      setMessage(friendlyErrorMessage(error, "We could not update that exercise. Please try again."));
    }
  }

  async function saveEditedExercise() {
    if (!editingExercise?.name.trim()) return;
    try {
      await saveExerciseDefinition(db, user.uid, { ...editingExercise, name: editingExercise.name.trim(), exerciseType: editingExercise.exerciseType, trackingType: editingExercise.exerciseType }, { updatedAtToken: token() });
      setEditingExercise(null);
      setMessage("Exercise updated.");
    } catch (error) {
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
      setMessage(friendlyErrorMessage(error, "We could not delete that exercise. Please try again.", "exercise library"));
    }
  }

  return (
    <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Exercise library</h2>
          <p className="text-sm text-slate-500">Define what an exercise is. Configure how to perform it inside a programme.</p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {activeCount} active{archivedCount ? ` · ${archivedCount} archived` : ""}
        </div>
      </div>

      {message ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{message}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 font-medium text-slate-900">Add an exercise</div>
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <Field label="Exercise name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Leg extension" /></Field>
          <Field label="Exercise type"><Select value={exerciseType} onChange={(e) => setExerciseType(e.target.value)}>{LIBRARY_EXERCISE_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{exerciseTypeLabel(type)}</option>)}</Select></Field>
          <div className="flex items-end"><Button onClick={saveNewExercise} disabled={saving || !name.trim()}>{saving ? "Saving…" : "Add exercise"}</Button></div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Field label="Search exercises">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" />
            </div>
          </Field>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
            Show archived
          </label>
        </div>

        {exercises.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
            <div className="font-semibold text-slate-900">No reusable exercises yet</div>
            <p className="mt-1 text-sm text-slate-500">Add your common gym, rehab and mobility exercises here so plan building feels quick later.</p>
          </div>
        ) : visibleExercises.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">No exercises match your search.</div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {visibleExercises.map((exercise) => (
              <div key={exercise.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                <div className="min-w-0">
                  {editingExercise?.id === exercise.id ? <div className="grid gap-2 md:grid-cols-2"><Input value={editingExercise.name} onChange={(event) => setEditingExercise({ ...editingExercise, name: event.target.value })} /><Select value={editingExercise.exerciseType || editingExercise.trackingType} onChange={(event) => setEditingExercise({ ...editingExercise, exerciseType: event.target.value })}>{!LIBRARY_EXERCISE_TYPE_OPTIONS.includes(editingExercise.exerciseType) ? <option value={editingExercise.exerciseType}>{exerciseTypeLabel(editingExercise.exerciseType)} (existing)</option> : null}{LIBRARY_EXERCISE_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{exerciseTypeLabel(type)}</option>)}</Select></div> : <><div className="truncate font-medium text-slate-900">{exercise.name}</div><div className="text-xs text-slate-500">{exerciseTypeLabel(exercise.exerciseType || exercise.trackingType)}</div></>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {exercise.isArchived ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">Archived</span> : null}
                  {editingExercise?.id === exercise.id ? <><Button size="sm" onClick={saveEditedExercise}>Save</Button><Button size="sm" variant="outline" onClick={() => setEditingExercise(null)}>Cancel</Button><Button size="sm" variant="danger" onClick={() => setDeleteCandidate(exercise)}>Delete exercise</Button></> : <Button size="sm" variant="outline" onClick={() => setEditingExercise({ ...exercise, exerciseType: exercise.exerciseType || exercise.trackingType || EXERCISE_TYPE.STRENGTH })}>Edit</Button>}
                  <Button size="sm" variant="outline" onClick={() => toggleArchive(exercise)}>{exercise.isArchived ? "Restore" : "Archive"}</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {deleteCandidate ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"><h3 className="text-lg font-semibold">Delete {deleteCandidate.name} permanently?</h3><p className="mt-2 text-sm text-slate-600">It will be removed from your Exercise Library and cannot be added to new programme sessions. Existing programme and workout records will not be rewritten.</p><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleteCandidate(null)}>Cancel</Button><Button variant="danger" onClick={deleteExercise}>Delete permanently</Button></div></div></div> : null}
    </div>
  );
}

export default function PlansScreen({ user, view = "programme" }) {
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

  useEffect(() => {
    if (!user?.uid) return undefined;
    setExercisesLoading(true);
    setExercisesError("");
    const unsubExercises = subscribeExerciseDefinitions(db, user.uid, (next) => { setExercises(next); setExercisesLoading(false); }, (err) => { setExercisesError(friendlyErrorMessage(err, "We could not load your exercise library. Please try again.", "exercise library")); setExercisesLoading(false); });
    if (view === "exercises") return unsubExercises;

    setPlansLoading(true);
    setPlansError("");
    const unsubPlans = subscribePlans(db, user.uid, (next) => { setPlans(next); setPlansLoading(false); }, (err) => { setPlansError(friendlyErrorMessage(err, "We could not load your programmes. Please try again.", "programmes")); setPlansLoading(false); });
    return () => { unsubPlans(); unsubExercises(); };
  }, [user?.uid, view]);

  const activePlans = useMemo(() => sectionPlans(plans, (plan) => !plan.isArchived && plan.isActive), [plans]);
  const inactivePlans = useMemo(() => sectionPlans(plans, (plan) => !plan.isArchived && !plan.isActive), [plans]);
  const archivedPlans = useMemo(() => sectionPlans(plans, (plan) => plan.isArchived), [plans]);

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
    if (draft && original && JSON.stringify(draft) !== JSON.stringify(original) && !window.confirm("Discard unsaved plan changes?")) return;
    if (draft && !original && !window.confirm("Discard this new unsaved plan?")) return;
    setDraft(null);
    setOriginal(null);
    setSaveMessage("");
  }

  async function saveDraft() {
    if (!draft || saving) return;
    const validation = validatePlan(draft);
    if (!validation.valid) { setSaveMessage(validation.errors.join(" ")); return; }
    setSaving(true);
    setSaveMessage("");
    try {
      const saveToken = token();
      const planToSave = nextPlanForSave(original, draft);
      const saved = original
        ? await updatePlan(db, user.uid, original, planToSave, { expectedUpdatedAtToken: loadedToken, updatedAtToken: saveToken })
        : await createPlan(db, user.uid, planToSave, { updatedAtToken: saveToken });
      if (saved.isActive) await setPlanActive(db, user.uid, saved, true, { updatedAtToken: saveToken });
      setOriginal(structuredClone(saved));
      setDraft(structuredClone(saved));
      setLoadedToken(saveToken);
      setSaveMessage("Programme saved.");
    } catch (err) {
      setSaveMessage(friendlyErrorMessage(err, "We could not save this plan. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate(plan) {
    if (saving) return;
    setSaving(true);
    try {
      await duplicatePlanDocument(db, user.uid, plan, { newPlanId: `plan-${makeId()}`, updatedAtToken: token() });
    } catch (err) {
      setPlansError(friendlyErrorMessage(err, "We could not duplicate that programme. Please try again.", "programmes"));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(plan) {
    try { await setPlanActive(db, user.uid, plan, !plan.isActive, { updatedAtToken: token() }); } catch (err) { setPlansError(friendlyErrorMessage(err, "We could not update that programme. Please try again.", "programmes")); }
  }

  async function handleArchive(plan) {
    if (!window.confirm(`Archive ${plan.name}? Archived plans stay readable and can be restored.`)) return;
    try { await archivePlan(db, user.uid, plan, { updatedAtToken: token() }); } catch (err) { setPlansError(friendlyErrorMessage(err, "We could not archive that programme. Please try again.", "programmes")); }
  }

  async function handleRestore(plan) {
    try { await restorePlan(db, user.uid, plan, { updatedAtToken: token() }); } catch (err) { setPlansError(friendlyErrorMessage(err, "We could not restore that programme. Please try again.", "programmes")); }
  }

  const renderSection = (title, items, empty) => (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {items.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">{empty}</div> : <div className="grid gap-3 lg:grid-cols-2">{items.map((plan) => <PlanCard key={plan.id} plan={plan} onEdit={openPlan} onDuplicate={handleDuplicate} onToggleActive={handleToggleActive} onArchive={handleArchive} onRestore={handleRestore} />)}</div>}
    </section>
  );

  return (
    <div className="space-y-6">
      {view === "exercises" ? <><div><h1 className="text-2xl font-semibold tracking-tight">Manage Exercises</h1><p className="text-sm text-slate-500">Create, search, archive and restore your reusable exercise library.</p></div>{exercisesError ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{exercisesError}</div> : null}{exercisesLoading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">Loading exercise library…</div> : <ExerciseLibrary user={user} exercises={exercises} />}</> : <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Programme</h1><p className="text-sm text-slate-500">Build reusable, named sessions and train them in any order.</p></div>
        <Button onClick={openNewPlan}><Plus className="mr-1 h-4 w-4" /> Create programme</Button>
      </div>
      {plansError ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{plansError}</div> : null}
      {exercisesError ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">The exercise library could not be loaded. Programme exercises already saved remain editable.</div> : null}
      {plansLoading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">Loading programmes…</div> : null}
      {!plansLoading && plans.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"><div className="font-semibold text-slate-900">No programmes yet</div><p className="mt-1 text-sm text-slate-500">Create your first programme and give each workout session a useful name.</p><Button className="mt-4" onClick={openNewPlan}>Create first programme</Button></div> : null}
      {draft ? <PlanEditor draft={draft} setDraft={setDraft} original={original} exercises={exercises} onSave={saveDraft} onClose={closeEditor} saving={saving} saveMessage={saveMessage} /> : null}
      {renderSection("Active", activePlans, "Activate any plan when you are ready to use it regularly.")}
      {renderSection("Inactive and draft", inactivePlans, "Plans you deactivate will appear here.")}
      {renderSection("Archived", archivedPlans, "Archived plans will appear here and can be restored later.")}
      </>}
    </div>
  );
}
