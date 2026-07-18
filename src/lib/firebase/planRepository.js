import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
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

export function exerciseCollectionPath(uid) {
  return `users/${uid}/exercises`;
}

function logExerciseRepository(event, details) {
  if (import.meta.env?.DEV) console.info(`[exerciseRepository] ${event}`, details);
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
  if (isActive) {
    const snapshot = await getDocs(plansCollection(db, uid));
    const batch = writeBatch(db);
    const states = exclusiveActiveProgrammeStates(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })), plan.id);
    snapshot.docs.forEach((item) => {
      const current = item.data();
      const selected = states.find((state) => state.id === item.id)?.isActive;
      if (current.isActive !== selected) batch.update(item.ref, stripUndefined({ isActive: selected, status: current.isArchived ? "archived" : selected ? "active" : "draft", activatedAt: selected ? serverTimestamp() : null, updatedAt: serverTimestamp(), updatedAtToken: selected ? updatedAtToken : `deactivated-${updatedAtToken}` }));
    });
    await batch.commit();
    return;
  }
  await updateDoc(planRef(db, uid, plan.id), stripUndefined({
    isActive,
    status: plan.isArchived ? "archived" : isActive ? "active" : "draft",
    activatedAt: isActive ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
    updatedAtToken,
  }));
}

export function exclusiveActiveProgrammeStates(plans, selectedId) {
  return plans.map((plan) => ({ id: plan.id, isActive: plan.id === selectedId, status: plan.isArchived ? "archived" : plan.id === selectedId ? "active" : "draft" }));
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
  const path = `${exerciseCollectionPath(uid)}/${exercise.id}`;
  logExerciseRepository("save start", { uid, path });
  try {
    await setDoc(
      exerciseRef(db, uid, exercise.id),
      stripUndefined({ ...exercise, userId: uid, updatedAt: serverTimestamp(), updatedAtToken }),
      { merge: true }
    );
    logExerciseRepository("save complete", { uid, path });
  } catch (error) {
    console.error("Exercise library Firestore save failed", { uid, path, code: error?.code, message: error?.message, error });
    throw error;
  }
}

export async function archiveExerciseDefinition(db, uid, exerciseId, isArchived, { updatedAtToken }) {
  const path = `${exerciseCollectionPath(uid)}/${exerciseId}`;
  logExerciseRepository(isArchived ? "archive start" : "restore start", { uid, path });
  try {
    await updateDoc(exerciseRef(db, uid, exerciseId), stripUndefined({ isArchived, archivedAt: isArchived ? serverTimestamp() : null, updatedAt: serverTimestamp(), updatedAtToken }));
    logExerciseRepository(isArchived ? "archive complete" : "restore complete", { uid, path });
  } catch (error) {
    console.error("Exercise library Firestore archive/restore failed", { uid, path, code: error?.code, message: error?.message, error });
    throw error;
  }
}

export async function deleteExerciseDefinition(db, uid, exerciseId, { deleteDocument = deleteDoc, referenceFactory = exerciseRef } = {}) {
  const path = `${exerciseCollectionPath(uid)}/${exerciseId}`;
  logExerciseRepository("delete start", { uid, path });
  try {
    await deleteDocument(referenceFactory(db, uid, exerciseId));
    logExerciseRepository("delete complete", { uid, path });
  } catch (error) {
    console.error("Exercise library Firestore delete failed", { uid, path, code: error?.code, message: error?.message, error });
    throw error;
  }
}

export function subscribeWorkouts(db, uid, onNext, onError) {
  return onSnapshot(collection(db, "users", uid, "workouts"), (snapshot) => onNext(snapshot.docs.map((item) => item.data())), onError);
}

export function subscribeExerciseDefinitions(db, uid, onNext, onError) {
  const path = exerciseCollectionPath(uid);
  logExerciseRepository("subscription start", { uid, path });
  return onSnapshot(
    collection(db, "users", uid, "exercises"),
    (snapshot) => {
      logExerciseRepository("subscription snapshot", { uid, path, size: snapshot.size });
      onNext(snapshot.docs.map((item) => item.data()).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))));
    },
    (error) => {
      console.error("Exercise library Firestore subscription failed", { uid, path, code: error?.code, message: error?.message, error });
      onError(error);
    }
  );
}

export const __testables = { stripUndefined, preparePlanWrite, planPaths, exerciseCollectionPath };
