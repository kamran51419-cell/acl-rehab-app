import React, { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { db } from "../../firebase";
import {
  EXERCISE_TYPE,
  REP_TARGET_TYPE,
  TARGET_WEIGHT_MODE,
  createBlankPlan,
  createDefaultPrescription,
  createLibraryExercise,
  createPlanExercise,
  createPlanSession,
  createStrengthBlock,
  duplicatePlanExercise,
  duplicatePlan,
  filterExerciseLibrary,
  fixedReps,
  nextPlanForSave,
  planPrescriptionSummary,
  reorderItems,
  repRange,
  validatePlan,
} from "../../lib/domain/plans";
import { SIDE } from "../../lib/domain/v2Models";
import { makeId } from "../../lib/domain/legacyWorkouts";
import {
  archiveExerciseDefinition,
  archivePlan,
  createPlan,
  duplicatePlanDocument,
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
  [EXERCISE_TYPE.TIMED_HOLD]: "Timed hold",
  [EXERCISE_TYPE.CARDIO]: "Cardio",
  [EXERCISE_TYPE.MOBILITY]: "Mobility",
  [EXERCISE_TYPE.FOAM_ROLLING]: "Foam rolling",
};

function exerciseTypeLabel(type) {
  return EXERCISE_TYPE_LABELS[type] || "Strength";
}

function friendlyErrorMessage(error, fallback) {
  const code = error?.code || "";
  const message = error?.message || "";
  if (code.includes("permission-denied") || /permission/i.test(message)) {
    return "We could not access your plans right now. Please check that you are signed in and try again.";
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
  if (typeof value === "string") return value;
  if (value?.toDate) return value.toDate().toLocaleDateString("en-GB");
  return "—";
}

function PlanCard({ plan, onEdit, onDuplicate, onToggleActive, onArchive, onRestore }) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-slate-900">{plan.name || "Untitled plan"}</div>
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

function PrescriptionEditor({ exercise, onChange }) {
  const updatePrescription = (prescription) => onChange({ ...exercise, prescription });
  if (exercise.exerciseType === EXERCISE_TYPE.STRENGTH) {
    const blocks = exercise.prescription?.blocks || [];
    const updateBlock = (index, patch) => updatePrescription({ blocks: blocks.map((block, idx) => (idx === index ? { ...block, ...patch } : block)) });
    const updateReps = (index, patch) => updateBlock(index, { targetReps: { ...blocks[index].targetReps, ...patch } });
    return (
      <div className="space-y-3">
        {blocks.map((block, index) => (
          <div key={block.id} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-slate-800">Block {index + 1}</div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => updatePrescription({ blocks: reorderItems(blocks, index, index - 1) })} disabled={index === 0}>Up</Button>
                <Button size="sm" variant="outline" onClick={() => updatePrescription({ blocks: reorderItems(blocks, index, index + 1) })} disabled={index === blocks.length - 1}>Down</Button>
                <Button size="sm" variant="outline" onClick={() => updatePrescription({ blocks: [...blocks, { ...block, id: `block-${makeId()}`, sortOrder: blocks.length }] })}>Duplicate</Button>
                <Button size="sm" variant="danger" onClick={() => updatePrescription({ blocks: blocks.filter((_, idx) => idx !== index).map((item, idx) => ({ ...item, sortOrder: idx })) })}>Remove</Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Side">
                <Select value={block.side} onChange={(e) => updateBlock(index, { side: e.target.value })}>
                  <option value={SIDE.BOTH}>Both legs</option>
                  <option value={SIDE.LEFT}>Left only</option>
                  <option value={SIDE.RIGHT}>Right only</option>
                </Select>
              </Field>
              <Field label="Sets"><Input inputMode="numeric" value={block.targetSets} onChange={(e) => updateBlock(index, { targetSets: Number(e.target.value) })} /></Field>
              <Field label="Reps type">
                <Select value={block.targetReps?.type || REP_TARGET_TYPE.FIXED} onChange={(e) => updateBlock(index, { targetReps: e.target.value === REP_TARGET_TYPE.RANGE ? repRange(8, 12) : fixedReps(10) })}>
                  <option value={REP_TARGET_TYPE.FIXED}>Fixed</option>
                  <option value={REP_TARGET_TYPE.RANGE}>Range</option>
                </Select>
              </Field>
              {block.targetReps?.type === REP_TARGET_TYPE.RANGE ? (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Min"><Input inputMode="numeric" value={block.targetReps.min} onChange={(e) => updateReps(index, { min: Number(e.target.value) })} /></Field>
                  <Field label="Max"><Input inputMode="numeric" value={block.targetReps.max} onChange={(e) => updateReps(index, { max: Number(e.target.value) })} /></Field>
                </div>
              ) : (
                <Field label="Reps"><Input inputMode="numeric" value={block.targetReps?.value || ""} onChange={(e) => updateReps(index, { value: Number(e.target.value) })} /></Field>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Weight mode">
                <Select value={block.targetWeight?.mode || TARGET_WEIGHT_MODE.NONE} onChange={(e) => updateBlock(index, { targetWeight: { mode: e.target.value } })}>
                  <option value={TARGET_WEIGHT_MODE.PREVIOUS}>Previous</option>
                  <option value={TARGET_WEIGHT_MODE.MANUAL}>Manual</option>
                  <option value={TARGET_WEIGHT_MODE.NONE}>None</option>
                </Select>
              </Field>
              {block.targetWeight?.mode === TARGET_WEIGHT_MODE.MANUAL ? <Field label="Weight"><Input inputMode="decimal" value={block.targetWeight?.value || ""} onChange={(e) => updateBlock(index, { targetWeight: { ...block.targetWeight, value: Number(e.target.value) } })} /></Field> : null}
              <Field label="Unit"><Select value={block.unit || "kg"} onChange={(e) => updateBlock(index, { unit: e.target.value })}><option value="kg">kg</option><option value="lb">lb</option></Select></Field>
              <Field label="Rest (seconds)"><Input inputMode="numeric" value={block.restSeconds ?? ""} onChange={(e) => updateBlock(index, { restSeconds: e.target.value === "" ? undefined : Number(e.target.value) })} /></Field>
              <Field label="Notes"><Input value={block.notes || ""} onChange={(e) => updateBlock(index, { notes: e.target.value })} /></Field>
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={() => updatePrescription({ blocks: [...blocks, createStrengthBlock({ sortOrder: blocks.length })] })}><Plus className="mr-1 h-4 w-4" /> Add block</Button>
      </div>
    );
  }

  if (exercise.exerciseType === EXERCISE_TYPE.TIMED_HOLD) {
    const p = exercise.prescription || {};
    return (
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Side"><Select value={p.side || SIDE.BOTH} onChange={(e) => updatePrescription({ ...p, side: e.target.value })}><option value={SIDE.BOTH}>Both sides</option><option value={SIDE.LEFT}>Left only</option><option value={SIDE.RIGHT}>Right only</option></Select></Field>
        <Field label="Sets"><Input inputMode="numeric" value={p.targetSets || ""} onChange={(e) => updatePrescription({ ...p, targetSets: Number(e.target.value) })} /></Field>
        <Field label="Duration (seconds)"><Input inputMode="numeric" value={p.targetDurationSeconds || ""} onChange={(e) => updatePrescription({ ...p, targetDurationSeconds: Number(e.target.value) })} /></Field>
        <Field label="Rest (seconds)"><Input inputMode="numeric" value={p.restSeconds ?? ""} onChange={(e) => updatePrescription({ ...p, restSeconds: e.target.value === "" ? undefined : Number(e.target.value) })} /></Field>
      </div>
    );
  }

  if (exercise.exerciseType === EXERCISE_TYPE.CARDIO) {
    const p = exercise.prescription || {};
    return (
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Duration minutes"><Input inputMode="numeric" value={Math.round((p.targetDurationSeconds || 0) / 60)} onChange={(e) => updatePrescription({ ...p, targetDurationSeconds: Number(e.target.value) * 60 })} /></Field>
        <Field label="Resistance"><Input value={p.resistance ?? ""} onChange={(e) => updatePrescription({ ...p, resistance: e.target.value || undefined })} /></Field>
        <Field label="Incline"><Input value={p.incline ?? ""} onChange={(e) => updatePrescription({ ...p, incline: e.target.value || undefined })} /></Field>
        <Field label="Distance"><Input value={p.distance ?? ""} onChange={(e) => updatePrescription({ ...p, distance: e.target.value || undefined })} /></Field>
        <Field label="Effort target"><Input value={p.effortTarget || ""} onChange={(e) => updatePrescription({ ...p, effortTarget: e.target.value })} /></Field>
      </div>
    );
  }

  const items = exercise.prescription?.items || [];
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={item.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2">
          <Input value={item.name} onChange={(e) => updatePrescription({ ...exercise.prescription, items: items.map((row, idx) => (idx === index ? { ...row, name: e.target.value } : row)) })} />
          <Button size="sm" variant="outline" onClick={() => updatePrescription({ ...exercise.prescription, items: reorderItems(items, index, index - 1) })} disabled={index === 0}>Up</Button>
          <Button size="sm" variant="outline" onClick={() => updatePrescription({ ...exercise.prescription, items: reorderItems(items, index, index + 1) })} disabled={index === items.length - 1}>Down</Button>
          <Button size="sm" variant="danger" onClick={() => updatePrescription({ ...exercise.prescription, items: items.filter((_, idx) => idx !== index).map((row, idx) => ({ ...row, sortOrder: idx })) })}>Remove</Button>
        </div>
      ))}
      <Button variant="outline" onClick={() => updatePrescription({ ...exercise.prescription, items: [...items, { id: `item-${makeId()}`, name: "", sortOrder: items.length }] })}>Add {exercise.exerciseType === EXERCISE_TYPE.MOBILITY ? "stretch" : "area"}</Button>
    </div>
  );
}

function PlanEditor({ draft, setDraft, original, exercises, onSave, onClose, saving, saveMessage }) {
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [selectedType, setSelectedType] = useState(EXERCISE_TYPE.STRENGTH);
  const validation = validatePlan(draft);
  const filteredExercises = filterExerciseLibrary(exercises, { query: exerciseQuery, includeArchived });

  const setSessions = (sessions) => setDraft({ ...draft, sessions });
  const updateSession = (sessionIndex, patch) => setSessions(draft.sessions.map((session, index) => (index === sessionIndex ? { ...session, ...patch } : session)));
  const addSession = () => setSessions([...draft.sessions, createPlanSession({ name: `Session ${draft.sessions.length + 1}`, sortOrder: draft.sessions.length })]);

  function addExerciseToSession(sessionIndex) {
    const libraryExercise = exercises.find((exercise) => exercise.id === selectedExerciseId);
    if (!libraryExercise) return;
    const session = draft.sessions[sessionIndex];
    const exerciseType = selectedType || libraryExercise.exerciseType || EXERCISE_TYPE.STRENGTH;
    const planExercise = createPlanExercise({
      exerciseId: libraryExercise.id,
      exerciseNameSnapshot: libraryExercise.name,
      exerciseType,
      sortOrder: session.exercises.length,
      prescription: createDefaultPrescription(exerciseType),
    });
    updateSession(sessionIndex, { exercises: [...session.exercises, planExercise] });
  }

  return (
    <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{original ? "Edit plan" : "Create plan"}</h2>
          <p className="text-sm text-slate-500">Plan changes do not alter completed workouts.</p>
        </div>
        <div className="flex gap-2"><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={onSave} disabled={saving || !validation.valid}>{saving ? "Saving…" : "Save plan"}</Button></div>
      </div>

      {saveMessage ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{saveMessage}</div> : null}
      {!validation.valid ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{validation.errors.slice(0, 4).join(" ")}</div> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Plan name"><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="ACL rehab plan" /></Field>
        <Field label="Description"><Input value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Optional" /></Field>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Active plan</label>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Sessions</h3><Button variant="outline" onClick={addSession}><Plus className="mr-1 h-4 w-4" /> Add session</Button></div>
        {draft.sessions.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No sessions yet. Add Lower A, Upper, ACL Rehab, Push, Pull, or any reusable session name.</div> : null}
        {draft.sessions.map((session, sessionIndex) => (
          <div key={session.id} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
                <div key={exercise.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
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
                  <PrescriptionEditor exercise={exercise} onChange={(next) => updateSession(sessionIndex, { exercises: session.exercises.map((item, index) => (index === exerciseIndex ? next : item)) })} />
                </div>
              ))}

              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3">
                <div className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
                  <Field label="Find exercise"><Input value={exerciseQuery} onChange={(e) => setExerciseQuery(e.target.value)} placeholder="Search library" /></Field>
                  <Field label="Type"><Select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>{Object.values(EXERCISE_TYPE).map((type) => <option key={type} value={type}>{exerciseTypeLabel(type)}</option>)}</Select></Field>
                  <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} /> Include archived</label>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                  <Select value={selectedExerciseId} onChange={(e) => setSelectedExerciseId(e.target.value)}>
                    <option value="">Select exercise…</option>
                    {filteredExercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}{exercise.isArchived ? " (archived)" : ""}</option>)}
                  </Select>
                  <Button onClick={() => addExerciseToSession(sessionIndex)} disabled={!selectedExerciseId}>Add exercise</Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExerciseLibrary({ user, exercises, onChanged }) {
  const [name, setName] = useState("");
  const [exerciseType, setExerciseType] = useState(EXERCISE_TYPE.STRENGTH);
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const visibleExercises = filterExerciseLibrary(exercises, { query, includeArchived });
  const activeCount = exercises.filter((exercise) => !exercise.isArchived).length;
  const archivedCount = exercises.filter((exercise) => exercise.isArchived).length;

  async function saveNewExercise() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setMessage("");
    try {
      await saveExerciseDefinition(db, user.uid, createLibraryExercise({ name, exerciseType, notes }), { updatedAtToken: token() });
      setName("");
      setNotes("");
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

  return (
    <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Exercise library</h2>
          <p className="text-sm text-slate-500">Save exercises once, then reuse them in any workout plan.</p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {activeCount} active{archivedCount ? ` · ${archivedCount} archived` : ""}
        </div>
      </div>

      {message ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{message}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 font-medium text-slate-900">Add an exercise</div>
        <div className="grid gap-3 md:grid-cols-[1fr_170px]">
          <Field label="Exercise name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Leg extension" /></Field>
          <Field label="Default type"><Select value={exerciseType} onChange={(e) => setExerciseType(e.target.value)}>{Object.values(EXERCISE_TYPE).map((type) => <option key={type} value={type}>{exerciseTypeLabel(type)}</option>)}</Select></Field>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
          <Field label="Exercise notes"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Slow eccentric, pause at top, physio cue…" /></Field>
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
                  <div className="truncate font-medium text-slate-900">{exercise.name}</div>
                  <div className="text-xs text-slate-500">{exerciseTypeLabel(exercise.exerciseType || exercise.trackingType)}{exercise.notes ? ` · ${exercise.notes}` : ""}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {exercise.isArchived ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">Archived</span> : null}
                  <Button size="sm" variant="outline" onClick={() => toggleArchive(exercise)}>{exercise.isArchived ? "Restore" : "Archive"}</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlansScreen({ user }) {
  const [plans, setPlans] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(null);
  const [original, setOriginal] = useState(null);
  const [loadedToken, setLoadedToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (!user?.uid) return undefined;
    setLoading(true);
    const unsubPlans = subscribePlans(db, user.uid, (next) => { setPlans(next); setLoading(false); }, (err) => { setError(friendlyErrorMessage(err, "We could not load your plans. Please try again.")); setLoading(false); });
    const unsubExercises = subscribeExerciseDefinitions(db, user.uid, setExercises, (err) => setError(friendlyErrorMessage(err, "We could not load your exercise library. Please try again.")));
    return () => { unsubPlans(); unsubExercises(); };
  }, [user?.uid]);

  const activePlans = useMemo(() => sectionPlans(plans, (plan) => !plan.isArchived && plan.isActive), [plans]);
  const inactivePlans = useMemo(() => sectionPlans(plans, (plan) => !plan.isArchived && !plan.isActive), [plans]);
  const archivedPlans = useMemo(() => sectionPlans(plans, (plan) => plan.isArchived), [plans]);

  function openNewPlan() {
    setOriginal(null);
    setLoadedToken("");
    setDraft(createBlankPlan({ userId: user.uid, name: "New workout plan" }));
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
      setOriginal(structuredClone(saved));
      setDraft(structuredClone(saved));
      setLoadedToken(saveToken);
      setSaveMessage("Plan saved.");
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
      setError(friendlyErrorMessage(err, "We could not duplicate that plan. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(plan) {
    try { await setPlanActive(db, user.uid, plan, !plan.isActive, { updatedAtToken: token() }); } catch (err) { setError(friendlyErrorMessage(err, "We could not update that plan. Please try again.")); }
  }

  async function handleArchive(plan) {
    if (!window.confirm(`Archive ${plan.name}? Archived plans stay readable and can be restored.`)) return;
    try { await archivePlan(db, user.uid, plan, { updatedAtToken: token() }); } catch (err) { setError(friendlyErrorMessage(err, "We could not archive that plan. Please try again.")); }
  }

  async function handleRestore(plan) {
    try { await restorePlan(db, user.uid, plan, { updatedAtToken: token() }); } catch (err) { setError(friendlyErrorMessage(err, "We could not restore that plan. Please try again.")); }
  }

  const renderSection = (title, items, empty) => (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {items.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">{empty}</div> : <div className="grid gap-3 lg:grid-cols-2">{items.map((plan) => <PlanCard key={plan.id} plan={plan} onEdit={openPlan} onDuplicate={handleDuplicate} onToggleActive={handleToggleActive} onArchive={handleArchive} onRestore={handleRestore} />)}</div>}
    </section>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Workout plans</h1><p className="text-sm text-slate-500">Create reusable plans for gym training, rehab sessions and mobility work.</p></div>
        <Button onClick={openNewPlan}><Plus className="mr-1 h-4 w-4" /> Create plan</Button>
      </div>
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">Loading plans…</div> : null}
      {!loading && plans.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"><div className="font-semibold text-slate-900">No plans yet</div><p className="mt-1 text-sm text-slate-500">Create your first reusable workout plan so sessions do not need to be recreated every week.</p><Button className="mt-4" onClick={openNewPlan}>Create first plan</Button></div> : null}
      {draft ? <PlanEditor draft={draft} setDraft={setDraft} original={original} exercises={exercises} onSave={saveDraft} onClose={closeEditor} saving={saving} saveMessage={saveMessage} /> : null}
      <ExerciseLibrary user={user} exercises={exercises} />
      {renderSection("Active", activePlans, "Activate any plan when you are ready to use it regularly.")}
      {renderSection("Inactive and draft", inactivePlans, "Plans you deactivate will appear here.")}
      {renderSection("Archived", archivedPlans, "Archived plans will appear here and can be restored later.")}
    </div>
  );
}
