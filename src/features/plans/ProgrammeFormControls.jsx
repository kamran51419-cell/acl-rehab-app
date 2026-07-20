import React from "react";
import { REP_TARGET_TYPE, fixedReps, repRange } from "../../lib/domain/plans";
import { SIDE } from "../../lib/domain/v2Models";

export function Field({ label, children }) {
  return (
    <label className="block space-y-1 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Input(props) {
  return <input className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" {...props} />;
}

export function Select(props) {
  return <select className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" {...props} />;
}

export function Textarea(props) {
  return <textarea className="min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" {...props} />;
}

export function DurationInput({ seconds, durationUnit, onChange }) {
  const unit = durationUnit || (Number(seconds || 0) >= 60 && Number(seconds || 0) % 60 === 0 ? "minutes" : "seconds");
  const value = unit === "minutes" ? Number(seconds || 0) / 60 : Number(seconds || 0);

  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Duration">
        <Input
          inputMode="decimal"
          value={value || ""}
          onChange={(event) => onChange({ seconds: Number(event.target.value) * (unit === "minutes" ? 60 : 1), unit })}
        />
      </Field>
      <Field label="Unit">
        <Select value={unit} onChange={(event) => onChange({ seconds: Number(seconds || 0), unit: event.target.value })}>
          <option value="seconds">Seconds</option>
          <option value="minutes">Minutes</option>
        </Select>
      </Field>
    </div>
  );
}

export function DirectStrengthPrescription({
  prescription,
  onChange,
  showNotes = true,
  bothLabel = "Both legs",
  trainingMode = "gym",
}) {
  const updateReps = (patch) => onChange({ ...prescription, targetReps: { ...prescription.targetReps, ...patch } });

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Side">
          <Select value={prescription.side || SIDE.BOTH} onChange={(event) => onChange({ ...prescription, side: event.target.value })}>
            <option value={SIDE.BOTH}>Standard</option>
            <option value={SIDE.SEPARATE}>Left & right</option>

{trainingMode === "rehab" && (
  <>
    <option value={SIDE.LEFT}>Left only</option>
    <option value={SIDE.RIGHT}>Right only</option>
  </>
)}
          </Select>
        </Field>
        <Field label="Sets">
          <Input inputMode="numeric" value={prescription.targetSets || ""} onChange={(event) => onChange({ ...prescription, targetSets: Number(event.target.value) })} />
        </Field>
        <Field label="Reps type">
          <Select
            value={prescription.targetReps?.type || REP_TARGET_TYPE.FIXED}
            onChange={(event) => onChange({ ...prescription, targetReps: event.target.value === REP_TARGET_TYPE.RANGE ? repRange(8, 12) : fixedReps(10) })}
          >
            <option value={REP_TARGET_TYPE.FIXED}>Fixed</option>
            <option value={REP_TARGET_TYPE.RANGE}>Range</option>
          </Select>
        </Field>
        {prescription.targetReps?.type === REP_TARGET_TYPE.RANGE ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Min"><Input inputMode="numeric" value={prescription.targetReps.min} onChange={(event) => updateReps({ min: Number(event.target.value) })} /></Field>
            <Field label="Max"><Input inputMode="numeric" value={prescription.targetReps.max} onChange={(event) => updateReps({ max: Number(event.target.value) })} /></Field>
          </div>
        ) : (
          <Field label="Reps"><Input inputMode="numeric" value={prescription.targetReps?.value || ""} onChange={(event) => updateReps({ value: Number(event.target.value) })} /></Field>
        )}
      </div>
      {showNotes ? <Field label="Notes"><Input value={prescription.notes || ""} onChange={(event) => onChange({ ...prescription, notes: event.target.value })} /></Field> : null}
    </div>
  );
}
