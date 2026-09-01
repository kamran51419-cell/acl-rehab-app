import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import Button from "../../components/ui/Button";
import { db } from "../../firebase";
import { buildEquipmentHistoryMigration, EQUIPMENT_HISTORY_MIGRATION_CUTOFF } from "../../lib/domain/equipmentHistoryMigration";

function migrationRef(uid, planId) {
  return doc(db, "users", uid, "migrations", `equipment-history-v1-${planId}`);
}

async function loadPlans(uid) {
  const snapshot = await getDocs(collection(db, "users", uid, "plans"));
  return snapshot.docs.map((item) => ({ ...item.data(), id: item.data().id || item.id }))
    .sort((a, b) => Number(Boolean(b.isActive)) - Number(Boolean(a.isActive)) || String(a.name || "").localeCompare(String(b.name || "")));
}

async function loadWorkouts(uid) {
  const snapshot = await getDocs(collection(db, "users", uid, "workouts"));
  return snapshot.docs.map((item) => ({ ...item.data(), id: item.data().id || item.id, __ref: item.ref }));
}

export default function EquipmentHistoryMigration({ user }) {
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [message, setMessage] = useState("");

  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === selectedPlanId) || null, [plans, selectedPlanId]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.uid) return undefined;
    setLoading(true);
    loadPlans(user.uid)
      .then((items) => {
        if (cancelled) return;
        setPlans(items);
        setSelectedPlanId((current) => current || items[0]?.id || "");
      })
      .catch((error) => {
        console.error("Could not load programmes for equipment migration", error);
        if (!cancelled) setMessage("Could not load programmes. Try again.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.uid]);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    setCompleted(false);
    setMessage("");
    if (!user?.uid || !selectedPlanId) return undefined;
    getDoc(migrationRef(user.uid, selectedPlanId))
      .then((snapshot) => { if (!cancelled) setCompleted(snapshot.exists() && snapshot.data()?.completed === true); })
      .catch((error) => console.error("Could not read equipment migration state", error));
    return () => { cancelled = true; };
  }, [user?.uid, selectedPlanId]);

  async function previewMigration() {
    if (!selectedPlan || checking || completed) return;
    setChecking(true);
    setMessage("");
    try {
      const workouts = await loadWorkouts(user.uid);
      setPreview(buildEquipmentHistoryMigration(selectedPlan, workouts));
    } catch (error) {
      console.error("Could not preview equipment history migration", error);
      setMessage("Could not preview the migration. Try again.");
    } finally {
      setChecking(false);
    }
  }

  async function applyMigration() {
    if (!selectedPlan || !preview || applying || completed || preview.workoutsChanged === 0) return;
    setApplying(true);
    setMessage("");
    try {
      const marker = migrationRef(user.uid, selectedPlan.id);
      const existingMarker = await getDoc(marker);
      if (existingMarker.exists() && existingMarker.data()?.completed === true) {
        setCompleted(true);
        setMessage("This programme migration has already been applied.");
        return;
      }

      const workouts = await loadWorkouts(user.uid);
      const fresh = buildEquipmentHistoryMigration(selectedPlan, workouts);
      const refById = new Map(workouts.map((workout) => [workout.id, workout.__ref]));

      for (let index = 0; index < fresh.updatedWorkouts.length; index += 400) {
        const batch = writeBatch(db);
        fresh.updatedWorkouts.slice(index, index + 400).forEach((update) => {
          const ref = refById.get(update.id);
          if (ref) batch.update(ref, { exercises: update.exercises, updatedAt: serverTimestamp() });
        });
        await batch.commit();
      }

      await setDoc(marker, {
        completed: true,
        planId: selectedPlan.id,
        planName: selectedPlan.name || "Programme",
        cutoffDate: EQUIPMENT_HISTORY_MIGRATION_CUTOFF,
        workoutsChanged: fresh.workoutsChanged,
        occurrencesChanged: fresh.occurrencesChanged,
        exerciseRecordsChanged: fresh.exerciseRecordsChanged,
        completedAt: serverTimestamp(),
      });

      setPreview(fresh);
      setCompleted(true);
      setMessage(`Done. Updated ${fresh.occurrencesChanged} historical exercise occurrence${fresh.occurrencesChanged === 1 ? "" : "s"} across ${fresh.workoutsChanged} workout${fresh.workoutsChanged === 1 ? "" : "s"}. You can still edit any of them individually in Workout History.`);
    } catch (error) {
      console.error("Could not apply equipment history migration", error);
      setMessage("The migration could not be completed. No completion marker was saved, so you can safely try again.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="font-semibold text-slate-900">One-time equipment history migration</div>
      <p className="mt-1 text-sm text-slate-600">After you save the correct equipment in each programme session, use this once to copy those session-specific choices to completed workouts before 28 Aug 2026.</p>
      <p className="mt-2 text-xs text-slate-500">It matches programme + session + exercise, skips historical exercises you already changed manually, and never changes Quick Workouts or newer workouts. Later programme edits will not change history. Historical workouts remain individually editable afterwards.</p>

      {loading ? <p className="mt-3 text-sm text-slate-500">Loading programmes…</p> : plans.length ? (
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700">Programme
            <select className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}>
              {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name || "Programme"}{plan.isActive ? " (active)" : ""}</option>)}
            </select>
          </label>

          {completed ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Migration already completed for this programme. Future programme changes will not rewrite its history.</div> : (
            <Button type="button" variant="outline" onClick={previewMigration} disabled={checking || applying}>{checking ? "Checking…" : "Preview changes"}</Button>
          )}

          {preview && !completed ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-sm font-medium text-slate-900">Preview: {preview.occurrencesChanged} exercise occurrence{preview.occurrencesChanged === 1 ? "" : "s"} in {preview.workoutsChanged} workout{preview.workoutsChanged === 1 ? "" : "s"}</div>
              {preview.details.length ? <div className="space-y-1.5">{preview.details.map((detail) => (
                <div key={`${detail.sessionId}:${detail.exerciseOccurrenceId}:${detail.equipmentType}`} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0"><span className="font-medium text-slate-800">{detail.sessionName}</span><span className="text-slate-500"> · {detail.exerciseName}</span></span>
                  <span className="shrink-0 text-slate-600">{detail.equipmentLabel} · {detail.occurrences}</span>
                </div>
              ))}</div> : <p className="text-sm text-slate-500">Nothing needs changing for the saved programme configuration.</p>}
              {preview.skippedManual ? <p className="text-xs text-slate-500">Skipped {preview.skippedManual} historical record{preview.skippedManual === 1 ? "" : "s"} you had already edited manually.</p> : null}
              {preview.unmatchedRecords ? <p className="text-xs text-slate-500">Left {preview.unmatchedRecords} record{preview.unmatchedRecords === 1 ? "" : "s"} unchanged because they could not be matched confidently to the current session structure.</p> : null}
              <Button type="button" onClick={applyMigration} disabled={applying || preview.workoutsChanged === 0}>{applying ? "Applying…" : "Apply once"}</Button>
            </div>
          ) : null}
        </div>
      ) : <p className="mt-3 text-sm text-slate-500">No programmes found.</p>}

      {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}
    </div>
  );
}
