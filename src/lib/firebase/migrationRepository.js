import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { v2Paths } from "./v2Repository";

export function migrationRunIdForFingerprint(sourceFingerprint) {
  return `legacy-${sourceFingerprint}`;
}

export async function readLegacyRehabData(db, uid) {
  const ref = doc(db, "rehabData", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : {};
}

export function migrationRunRef(db, uid, runId) {
  return doc(db, "users", uid, "migrationRuns", runId);
}

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

export async function writeMigrationRun(db, uid, runId, data) {
  await setDoc(migrationRunRef(db, uid, runId), stripUndefined(data), { merge: true });
}

export function firebaseMigrationClock() {
  return serverTimestamp();
}

export function migrationSourcePath(uid) {
  return `rehabData/${uid}`;
}

export function migrationDestinationPaths(uid) {
  return v2Paths(uid);
}
