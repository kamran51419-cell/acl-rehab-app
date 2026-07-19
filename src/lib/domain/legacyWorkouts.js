import { formatDate, todayString } from "./date.js";
import { bestSet, bestSetSym, blankSide, defaultSets, setsSummaryLines, setVolume } from "./sets.js";

export const DEFAULT_EXERCISES = [
  { id: "lp", label: "Leg Press", singleLeg: true, builtIn: true },
  { id: "le", label: "Leg Extension", singleLeg: true, builtIn: true },
  { id: "hc", label: "Hamstring Curl", singleLeg: true, builtIn: true },
];

export const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const blankForm = {
  week: "",
  date: todayString(),
  exerciseId: "lp",
  left: blankSide(),
  right: blankSide(),
  bilateral: { sets: defaultSets() },
  notes: "",
};

export function compactDate(sessions) {
  const dates = [...new Set((sessions || []).map((s) => s.date).filter(Boolean))].map(formatDate);
  if (!dates.length) return "—";
  return dates.join(", ");
}

export function makeSingleLegSession(exerciseId, date, leftSets, rightSets, notes) {
  return {
    id: makeId(),
    exerciseId,
    date,
    singleLeg: true,
    leftSets,
    rightSets,
    notes,
  };
}

export function makeBilateralSession(exerciseId, date, sets, notes) {
  return {
    id: makeId(),
    exerciseId,
    date,
    singleLeg: false,
    sets,
    notes,
  };
}

export function emptyWeek(week) {
  return { week, sessions: [] };
}

export function aggregateWeekExerciseSessions(week, exerciseId) {
  return (week.sessions || []).filter((s) => s.exerciseId === exerciseId);
}

export function latestNonEmptySession(data, exerciseId, sideKey) {
  for (let i = data.length - 1; i >= 0; i -= 1) {
    const matches = (data[i].sessions || []).filter(
      (s) => s.exerciseId === exerciseId && s.singleLeg && (s[sideKey] || []).some((x) => x.reps || x.weight)
    );
    if (matches.length) return matches[matches.length - 1][sideKey];
  }
  return [];
}

export function latestBestSetForExercise(data, exerciseId, sideKey) {
  return bestSet(latestNonEmptySession(data, exerciseId, sideKey));
}

export function latestSymmetryForExercise(data, exerciseId) {
  for (let i = data.length - 1; i >= 0; i -= 1) {
    const matches = (data[i].sessions || []).filter((s) => s.exerciseId === exerciseId && s.singleLeg);
    for (let j = matches.length - 1; j >= 0; j -= 1) {
      const sym = bestSetSym(matches[j].leftSets || [], matches[j].rightSets || []);
      if (sym !== null) return sym;
    }
  }
  return null;
}

export function compactExerciseSummary(week, exercise) {
  const sessions = aggregateWeekExerciseSessions(week, exercise.id);
  if (!sessions.length) return null;
  const last = sessions[sessions.length - 1];
  if (exercise.singleLeg) {
    const left = bestSet(last.leftSets || []);
    const right = bestSet(last.rightSets || []);
    const sym = bestSetSym(last.leftSets || [], last.rightSets || []);
    return {
      type: "single",
      dates: compactDate(sessions),
      left: left ? `${left.reps} × ${left.weight} kg` : "—",
      right: right ? `${right.reps} × ${right.weight} kg` : "—",
      symmetry: sym,
    };
  }
  const best = bestSet(last.sets || []);
  return {
    type: "bilateral",
    dates: compactDate(sessions),
    value: best ? `${best.reps} × ${best.weight} kg` : "—",
  };
}

export function sessionSummary(session) {
  if (!session) {
    return { date: "—", notes: "—", left: ["—"], right: ["—"], sets: ["—"], symmetry: null };
  }
  if (session.singleLeg) {
    return {
      date: formatDate(session.date),
      notes: session.notes || "—",
      left: setsSummaryLines(session.leftSets || []),
      right: setsSummaryLines(session.rightSets || []),
      sets: [],
      symmetry: bestSetSym(session.leftSets || [], session.rightSets || []),
    };
  }
  return {
    date: formatDate(session.date),
    notes: session.notes || "—",
    left: [],
    right: [],
    sets: setsSummaryLines(session.sets || []),
    symmetry: null,
  };
}

export { bestSet, bestSetSym, setVolume };
