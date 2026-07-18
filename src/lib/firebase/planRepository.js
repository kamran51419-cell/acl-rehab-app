import { collection, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { duplicatePlan, nextPlanForSave } from "../domain/plans.js";

function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, stripUndefined(item)])
    );
  }
  return value;
}

function plansCollection(db, uid) {
  return collection(db, "users", uid, "plans");
}

function planRef(db, uid, planId) {
  return doc(db, "users", uid, "plans", planId);
}

function exerciseRef(db, uid, exerciseId) {
  return doc(db, "users", uid, "exercises", exerciseId);
}

export function planPaths(uid, planId = "{planId}") {
  return {
    plans: `users/${uid}/plans/{planId}`,
    plan: `users/${uid}/plans/${planId}`,
    exercises: `users/${uid}/exercises/{exerciseId}`,
  };
}

export function preparePlanWrite(plan, { created = false, timestamp = serverTimestamp(), updatedAtToken } = {}) {
  return stripUndefined({
    ...plan,
    updatedAt: timestamp,
    updatedAtToken,
    createdAt: created ? timestamp : plan.createdAt,
  });
}

export function subscribePlans(db, uid, onNext, onError) {
  return onSnapshot(
    plansCollection(db, uid),
    (snapshot) => {
      const plans = snapshot.docs.map((item) => item.data()).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      onNext(plans);
    },
    onError
  );
}

export async function readPlan(db, uid, planId) {
  const snap = await getDoc(planRef(db, uid, planId));
  return snap.exists() ? snap.data() : null;
}

export async function createPlan(db, uid, plan, { updatedAtToken }) {
  const ref = planRef(db, uid, plan.id);
  await setDoc(ref, preparePlanWrite({ ...plan, userId: uid }, { created: true, updatedAtToken }), { merge: false });
  return { ...plan, userId: uid, updatedAtToken };
}

export async function updatePlan(db, uid, originalPlan, draftPlan, { expectedUpdatedAtToken, updatedAtToken }) {
  const ref = planRef(db, uid, draftPlan.id);
  const planToSave = nextPlanForSave(originalPlan, { ...draftPlan, userId: uid });
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("Plan no longer exists. Reload plans and try again.");
    const current = snap.data();
    if ((current.updatedAtToken || "") !== (expectedUpdatedAtToken || "")) {
      const error = new Error("This plan changed since you opened it. Reload before saving to avoid overwriting newer changes.");
      error.code = "conflict";
      throw error;
    }
    transaction.set(ref, preparePlanWrite(planToSave, { updatedAtToken }), { merge: true });
  });
  return { ...planToSave, updatedAtToken };
}

export async function duplicatePlanDocument(db, uid, sourcePlan, { newPlanId, updatedAtToken }) {
  const copy = duplicatePlan(sourcePlan, { id: newPlanId, userId: uid });
  await createPlan(db, uid, copy, { updatedAtToken });
  return { ...copy, updatedAtToken };
}

export async function setPlanActive(db, uid, plan, isActive, { updatedAtToken }) {
  await updateDoc(planRef(db, uid, plan.id), stripUndefined({
    isActive,
    status: plan.isArchived ? "archived" : isActive ? "active" : "draft",
    activatedAt: isActive ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
    updatedAtToken,
  }));
}

export async function archivePlan(db, uid, plan, { updatedAtToken }) {
  await updateDoc(planRef(db, uid, plan.id), stripUndefined({
    isArchived: true,
    isActive: false,
    status: "archived",
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedAtToken,
  }));
}

export async function restorePlan(db, uid, plan, { updatedAtToken }) {
  await updateDoc(planRef(db, uid, plan.id), stripUndefined({
    isArchived: false,
    isActive: false,
    status: "draft",
    archivedAt: null,
    updatedAt: serverTimestamp(),
    updatedAtToken,
  }));
}

export async function saveExerciseDefinition(db, uid, exercise, { updatedAtToken }) {
  await setDoc(
    exerciseRef(db, uid, exercise.id),
    stripUndefined({ ...exercise, userId: uid, updatedAt: serverTimestamp(), updatedAtToken }),
    { merge: true }
  );
}

export async function archiveExerciseDefinition(db, uid, exerciseId, isArchived, { updatedAtToken }) {
  await updateDoc(exerciseRef(db, uid, exerciseId), stripUndefined({ isArchived, archivedAt: isArchived ? serverTimestamp() : null, updatedAt: serverTimestamp(), updatedAtToken }));
}

export function subscribeExerciseDefinitions(db, uid, onNext, onError) {
  return onSnapshot(
    collection(db, "users", uid, "exercises"),
    (snapshot) => onNext(snapshot.docs.map((item) => item.data()).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))),
    onError
  );
}

export const __testables = { stripUndefined, preparePlanWrite, planPaths };
