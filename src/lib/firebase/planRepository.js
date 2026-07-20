import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { duplicatePlan, nextPlanForSave } from "../domain/plans.js";

function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value && typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype) return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, stripUndefined(item)])
    );
  }
  return value;
}

const recentWorkoutSnapshots = new Map();
const deletedWorkoutIds = new Set();

function workoutCacheKey(uid, workoutId) {
  return `${uid}:${workoutId}`;
}

export function mergeWorkoutSnapshots(uid, remote) {
  const visible = remote.filter((workout) => !deletedWorkoutIds.has(workoutCacheKey(uid, workout.id))).map((workout) => {
    const recent = recentWorkoutSnapshots.get(workoutCacheKey(uid, workout.id));
    return workout.status === "in_progress" && recent?.status === "in_progress" ? recent : workout;
  });
  const remoteIds = new Set(remote.map((workout) => workout.id));
  const recent = [...recentWorkoutSnapshots.entries()].filter(([key]) => key.startsWith(`${uid}:`)).map(([, workout]) => workout).filter((workout) => workout.status === "in_progress" && !remoteIds.has(workout.id));
  return visible.concat(recent);
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

function workoutRef(db, uid, workoutId) {
  return doc(db, "users", uid, "workouts", workoutId);
}

function routineOccurrenceRef(db, uid, occurrenceId) {
  return doc(db, "users", uid, "routineTaskOccurrences", occurrenceId);
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
    routineTaskOccurrences: `users/${uid}/routineTaskOccurrences/{occurrenceId}`,
  };
}

export function subscribeRoutineOccurrences(db, uid, programmeId, scheduledDate, onNext, onError) {
  return onSnapshot(collection(db, "users", uid, "routineTaskOccurrences"), (snapshot) => {
    onNext(snapshot.docs.map((item) => item.data()).filter((item) => item.programmeId === programmeId && item.scheduledDate === scheduledDate));
  }, onError);
}

export async function setRoutineOccurrenceStatus(db, uid, { id, programmeId, taskId, scheduledDate, status }) {
  const actionAt = new Date().toISOString();
  const data = { id, userId: uid, programmeId, taskId, scheduledDate, status, actionAt, updatedAt: serverTimestamp() };
  await setDoc(routineOccurrenceRef(db, uid, id), data, { merge: true });
  return { ...data, updatedAt: actionAt };
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
      if (current.isActive !== selected || current.isArchived) batch.update(item.ref, stripUndefined({ isActive: selected, isArchived: false, status: selected ? "active" : "draft", activatedAt: selected ? serverTimestamp() : null, updatedAt: serverTimestamp(), updatedAtToken: selected ? updatedAtToken : `deactivated-${updatedAtToken}` }));
    });
    await batch.commit();
    return;
  }
  await updateDoc(planRef(db, uid, plan.id), stripUndefined({
    isActive,
    isArchived: false,
    status: isActive ? "active" : "draft",
    activatedAt: isActive ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
    updatedAtToken,
  }));
}

export function exclusiveActiveProgrammeStates(plans, selectedId) {
  return plans.map((plan) => ({ id: plan.id, isActive: plan.id === selectedId, status: plan.id === selectedId ? "active" : "draft" }));
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

export async function deletePlan(db, uid, planId, { deleteDocument = deleteDoc, referenceFactory = planRef } = {}) {
  await deleteDocument(referenceFactory(db, uid, planId));
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
  return onSnapshot(collection(db, "users", uid, "workouts"), (snapshot) => onNext(mergeWorkoutSnapshots(uid, snapshot.docs.map((item) => item.data()))), onError);
}

export async function createInProgressWorkoutDocument(db, uid, workout) {
  const existing = await getDocs(collection(db, "users", uid, "workouts"));
  if (existing.docs.some((item) => item.data()?.status === "in_progress" && item.id !== workout.id)) {
    const error = new Error("An unfinished workout already exists.");
    error.code = "workout/already-in-progress";
    throw error;
  }
  const data = stripUndefined({ ...workout, userId: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await setDoc(workoutRef(db, uid, workout.id), data, { merge: false });
  const saved = { ...workout, userId: uid };
  deletedWorkoutIds.delete(workoutCacheKey(uid, workout.id));
  recentWorkoutSnapshots.set(workoutCacheKey(uid, workout.id), saved);
  return saved;
}

export async function updateInProgressWorkoutDocument(db, uid, workout, { run = runTransaction, referenceFactory = workoutRef, timestamp = serverTimestamp() } = {}) {
  const ref = referenceFactory(db, uid, workout.id);
  const written = await run(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists() && (snapshot.data()?.status === "completed" || snapshot.data()?.completed === true)) return false;
    transaction.set(ref, stripUndefined({ ...workout, userId: uid, status: "in_progress", updatedAt: timestamp }), { merge: true });
    return true;
  });
  if (written) {
    deletedWorkoutIds.delete(workoutCacheKey(uid, workout.id));
    recentWorkoutSnapshots.set(workoutCacheKey(uid, workout.id), { ...workout, userId: uid, status: "in_progress" });
  }
  return written;
}

export async function finishWorkoutDocument(db, uid, workout, { timestamp = serverTimestamp(), completedAtValue = new Date().toISOString(), run = runTransaction, referenceFactory = workoutRef, readDocument = getDoc } = {}) {
  const ref = referenceFactory(db, uid, workout.id);
  const persisted = stripUndefined({
    ...workout,
    id: workout.id,
    userId: uid,
    planId: workout.planId,
    programmeId: workout.programmeId || workout.planId,
    sessionId: workout.sessionId,
    date: workout.date || workout.workoutDate,
    workoutDate: workout.workoutDate || workout.date,
    status: "completed",
    completed: true,
    completedAt: timestamp,
    updatedAt: timestamp,
  });
  await run(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists() && (snapshot.data()?.status === "completed" || snapshot.data()?.completed === true)) return;
    transaction.set(ref, persisted, { merge: true });
  });
  const verifiedSnapshot = await readDocument(ref);
  if (!verifiedSnapshot.exists() || (verifiedSnapshot.data()?.status !== "completed" && verifiedSnapshot.data()?.completed !== true)) throw new Error("Completed workout could not be verified after saving.");
  const verified = verifiedSnapshot.data();
  const completed = { ...persisted, ...verified, completedAt: verified.completedAt || completedAtValue, updatedAt: verified.updatedAt || completedAtValue };
  recentWorkoutSnapshots.delete(workoutCacheKey(uid, workout.id));
  return completed;
}

export async function deleteWorkoutDocument(db, uid, workoutId, { deleteDocument = deleteDoc, referenceFactory = workoutRef } = {}) {
  await deleteDocument(referenceFactory(db, uid, workoutId));
  recentWorkoutSnapshots.delete(workoutCacheKey(uid, workoutId));
  deletedWorkoutIds.add(workoutCacheKey(uid, workoutId));
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

function resetWorkoutCache() { recentWorkoutSnapshots.clear(); deletedWorkoutIds.clear(); }

export const __testables = { stripUndefined, preparePlanWrite, planPaths, exerciseCollectionPath, resetWorkoutCache };
