import { doc, onSnapshot, setDoc } from "firebase/firestore";

export function normalizeLegacyRehabData(saved = {}) {
  const surgeryDate = typeof saved.surgeryDate === "string" ? saved.surgeryDate : "";
  return {
    weeks: Array.isArray(saved.weeks) ? saved.weeks : [],
    customExercises: Array.isArray(saved.customExercises) ? saved.customExercises : [],
    surgeryDate,
    trainingMode: saved.trainingMode === "rehab" || saved.trainingMode === "gym" ? saved.trainingMode : surgeryDate ? "rehab" : "gym",
  };
}

export function subscribeLegacyRehabData(db, uid, onData, onError) {
  const ref = doc(db, "rehabData", uid);

  return onSnapshot(
    ref,
    (snap) => {
      const raw = snap.exists() ? snap.data() : {};
      const normalized = normalizeLegacyRehabData(raw);
      onData(normalized);
      if (!snap.exists() || (raw.trainingMode !== "gym" && raw.trainingMode !== "rehab")) {
        setDoc(ref, { trainingMode: normalized.trainingMode }, { merge: true }).catch((error) => console.error("Training mode migration failed", error));
      }
    },
    onError
  );
}

export function saveLegacyRehabData(db, uid, { weeks, customExercises, surgeryDate, trainingMode = surgeryDate ? "rehab" : "gym" }) {
  return setDoc(
    doc(db, "rehabData", uid),
    {
      weeks,
      customExercises,
      surgeryDate,
      trainingMode,
    },
    { merge: true }
  );
}
