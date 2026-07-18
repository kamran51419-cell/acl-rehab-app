import { doc, onSnapshot, setDoc } from "firebase/firestore";

export function normalizeLegacyRehabData(saved = {}) {
  return {
    weeks: Array.isArray(saved.weeks) ? saved.weeks : [],
    customExercises: Array.isArray(saved.customExercises) ? saved.customExercises : [],
    surgeryDate: typeof saved.surgeryDate === "string" ? saved.surgeryDate : "",
  };
}

export function subscribeLegacyRehabData(db, uid, onData, onError) {
  const ref = doc(db, "rehabData", uid);

  return onSnapshot(
    ref,
    (snap) => {
      onData(snap.exists() ? normalizeLegacyRehabData(snap.data()) : normalizeLegacyRehabData());
    },
    onError
  );
}

export function saveLegacyRehabData(db, uid, { weeks, customExercises, surgeryDate }) {
  return setDoc(
    doc(db, "rehabData", uid),
    {
      weeks,
      customExercises,
      surgeryDate,
    },
    { merge: true }
  );
}
