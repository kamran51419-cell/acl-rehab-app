export const blankSet = () => ({ reps: "", weight: "" });
export const defaultSets = () => [blankSet(), blankSet(), blankSet()];
export const blankSide = () => ({ sets: defaultSets() });

export function setVolume(set) {
  return Number(set?.reps || 0) * Number(set?.weight || 0);
}

export function bestSet(sets = []) {
  if (!sets.length) return null;
  let best = null;
  for (const s of sets) {
    const vol = setVolume(s);
    if (!best || vol > best.volume) {
      best = { reps: s.reps || "", weight: s.weight || "", volume: vol };
    }
  }
  return best && best.volume > 0 ? best : null;
}

export function bestSetSym(leftSets = [], rightSets = []) {
  const bestL = Math.max(0, ...leftSets.map(setVolume));
  const bestR = Math.max(0, ...rightSets.map(setVolume));
  if (!bestL || !bestR) return null;
  return Math.round((Math.min(bestL, bestR) / Math.max(bestL, bestR)) * 100);
}

export function setsSummaryLines(sets = []) {
  if (!sets.length || sets.every((s) => !s.reps && !s.weight)) return ["—"];
  return sets.map((s, i) => `${i + 1}. ${s.reps || "?"} reps, ${s.weight || "?"} kg`);
}
