import React, { useEffect, useMemo, useState } from "react";
import { Home, Table2, LineChart as LineChartIcon, Plus, Trash2, X } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";

import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const DEFAULT_EXERCISES = [
  { id: "lp", label: "Leg Press", singleLeg: true, builtIn: true },
  { id: "le", label: "Leg Extension", singleLeg: true, builtIn: true },
  { id: "hc", label: "Hamstring Curl", singleLeg: true, builtIn: true },
];

const blankSet = () => ({ reps: "", weight: "" });
const defaultSets = () => [blankSet(), blankSet(), blankSet()];
const blankSide = () => ({ sets: defaultSets() });
const todayString = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const blankForm = {
  week: "",
  date: todayString(),
  exerciseId: "lp",
  left: blankSide(),
  right: blankSide(),
  bilateral: { sets: defaultSets() },
  notes: "",
};

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function Button({ children, variant = "default", size = "default", className = "", ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-xl border text-sm font-medium transition focus:outline-none disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    default: "bg-slate-900 text-white border-slate-900 hover:bg-slate-800",
    outline: "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
    destructive: "bg-red-600 text-white border-red-600 hover:bg-red-700",
  };
  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 px-3 py-2 text-xs",
  };
  return (
    <button className={cls(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
}

function Input(props) {
  return (
    <input
      className={cls("h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm", props.className)}
      {...props}
    />
  );
}

function Label({ children, className = "", ...props }) {
  return (
    <label className={cls("mb-1 block text-sm font-medium text-slate-700", className)} {...props}>
      {children}
    </label>
  );
}

function setVolume(set) {
  return Number(set?.reps || 0) * Number(set?.weight || 0);
}

function bestSet(sets = []) {
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

function bestSetSym(leftSets = [], rightSets = []) {
  const bestL = Math.max(0, ...leftSets.map(setVolume));
  const bestR = Math.max(0, ...rightSets.map(setVolume));
  if (!bestL || !bestR) return null;
  return Math.round((Math.min(bestL, bestR) / Math.max(bestL, bestR)) * 100);
}

function setsSummaryLines(sets = []) {
  if (!sets.length || sets.every((s) => !s.reps && !s.weight)) return ["—"];
  return sets.map((s, i) => `${i + 1}. ${s.reps || "?"} reps, ${s.weight || "?"} kg`);
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const d = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateString);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function calculateWeekFromSurgeryDate(surgeryDate, logDate) {
  if (!surgeryDate || !logDate) return "";
  const surgery = new Date(`${surgeryDate}T00:00:00`);
  const logged = new Date(`${logDate}T00:00:00`);
  const diffMs = logged.getTime() - surgery.getTime();
  if (Number.isNaN(diffMs)) return "";
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 0) return "";
  return String(Math.floor(diffDays / 7) + 1);
}

function calculateDaysSinceSurgery(surgeryDate) {
  if (!surgeryDate) return null;
  const surgery = new Date(`${surgeryDate}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = today.getTime() - surgery.getTime();
  if (Number.isNaN(diffMs)) return null;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 0) return null;
  return diffDays + 1;
}

function compactDate(sessions) {
  const dates = [...new Set((sessions || []).map((s) => s.date).filter(Boolean))].map(formatDate);
  if (!dates.length) return "—";
  return dates.join(", ");
}

function makeSingleLegSession(exerciseId, date, leftSets, rightSets, notes) {
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

function makeBilateralSession(exerciseId, date, sets, notes) {
  return {
    id: makeId(),
    exerciseId,
    date,
    singleLeg: false,
    sets,
    notes,
  };
}

function emptyWeek(week) {
  return { week, sessions: [] };
}

function aggregateWeekExerciseSessions(week, exerciseId) {
  return (week.sessions || []).filter((s) => s.exerciseId === exerciseId);
}

function latestNonEmptySession(data, exerciseId, sideKey) {
  for (let i = data.length - 1; i >= 0; i -= 1) {
    const matches = (data[i].sessions || []).filter(
      (s) => s.exerciseId === exerciseId && s.singleLeg && (s[sideKey] || []).some((x) => x.reps || x.weight)
    );
    if (matches.length) return matches[matches.length - 1][sideKey];
  }
  return [];
}

function latestBestSetForExercise(data, exerciseId, sideKey) {
  return bestSet(latestNonEmptySession(data, exerciseId, sideKey));
}

function latestSymmetryForExercise(data, exerciseId) {
  for (let i = data.length - 1; i >= 0; i -= 1) {
    const matches = (data[i].sessions || []).filter((s) => s.exerciseId === exerciseId && s.singleLeg);
    for (let j = matches.length - 1; j >= 0; j -= 1) {
      const sym = bestSetSym(matches[j].leftSets || [], matches[j].rightSets || []);
      if (sym !== null) return sym;
    }
  }
  return null;
}

function compactExerciseSummary(week, exercise) {
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
      left: left ? `${left.reps} x ${left.weight}kg` : "—",
      right: right ? `${right.reps} x ${right.weight}kg` : "—",
      symmetry: sym,
    };
  }
  const best = bestSet(last.sets || []);
  return {
    type: "bilateral",
    dates: compactDate(sessions),
    value: best ? `${best.reps} x ${best.weight}kg` : "—",
  };
}

function sessionSummary(session) {
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

function CardShell({ title, right, children }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-md">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function SummaryCard({ title, value, subtitle }) {
  return (
    <div className="space-y-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="text-xl font-semibold leading-tight text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{subtitle}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cls(
        "rounded-xl border px-3 py-2 text-sm transition",
        active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

function SetsInput({ title, data, setData }) {
  const updateSet = (i, key, val) => {
    const next = data.sets.map((s, idx) => (idx === i ? { ...s, [key]: val } : s));
    setData({ sets: next });
  };

  const addSet = () => {
    setData({ sets: [...data.sets, blankSet()] });
  };

  const removeSet = (i) => {
    const filtered = data.sets.filter((_, idx) => idx !== i);
    setData({ sets: filtered.length ? filtered : defaultSets() });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="font-semibold text-slate-900">{title}</div>

      {data.sets.map((set, i) => (
        <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="mb-2 text-sm text-slate-500">Set {i + 1}</div>

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px] items-center gap-2">
            <Input
              placeholder="Reps"
              value={set.reps}
              onChange={(e) => updateSet(i, "reps", e.target.value)}
              inputMode="numeric"
            />

            <Input
              placeholder="Weight (kg)"
              value={set.weight}
              onChange={(e) => updateSet(i, "weight", e.target.value)}
              inputMode="decimal"
            />

            <button
              type="button"
              onClick={() => removeSet(i)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addSet}>
        <Plus className="mr-1 h-4 w-4" /> Add set
      </Button>
    </div>
  );
}

function ExerciseGraph({ title, dataKey, data }) {
  return (
    <CardShell title={title}>
      <div className="h-[360px] rounded-2xl bg-slate-50 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <ReferenceLine y={90} stroke="#94a3b8" strokeDasharray="4 4" />
            <Line type="monotone" dataKey={dataKey} name={title} stroke="#2563eb" strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </CardShell>
  );
}

export default function ACLTrackerApp() {
  const [weeks, setWeeks] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [editing, setEditing] = useState(null);
  const [showAllRows, setShowAllRows] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [progressTab, setProgressTab] = useState("all");
  const [graphsTab, setGraphsTab] = useState("combined");
  const [surgeryDate, setSurgeryDate] = useState("");
  const [customExercises, setCustomExercises] = useState([]);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseSingleLeg, setNewExerciseSingleLeg] = useState(true);
  const [weekManuallyEdited, setWeekManuallyEdited] = useState(false);

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");
useEffect(() => {
  const unsub = onAuthStateChanged(auth, (firebaseUser) => {
    setUser(firebaseUser || null);
    setAuthLoading(false);
  });

  return () => unsub();
}, []);

useEffect(() => {
  async function loadUserData() {
    if (!user) {
      setWeeks([]);
      setCustomExercises([]);
      setSurgeryDate("");
      setDataLoading(false);
      return;
    }

    setDataLoading(true);

    try {
      const ref = doc(db, "rehabData", user.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const saved = snap.data();
        setWeeks(Array.isArray(saved.weeks) ? saved.weeks : []);
        setCustomExercises(Array.isArray(saved.customExercises) ? saved.customExercises : []);
        setSurgeryDate(typeof saved.surgeryDate === "string" ? saved.surgeryDate : "");
      } else {
        setWeeks([]);
        setCustomExercises([]);
        setSurgeryDate("");
      }
    } catch (error) {
      console.error("Failed to load rehab data from Firestore", error);
    } finally {
      setDataLoading(false);
    }
  }

  if (!authLoading) {
    loadUserData();
  }
}, [user, authLoading]);

useEffect(() => {
  async function saveUserData() {
    if (!user || authLoading || dataLoading) return;

    try {
      await setDoc(doc(db, "rehabData", user.uid), {
        weeks,
        customExercises,
        surgeryDate,
      });
    } catch (error) {
      console.error("Failed to save rehab data to Firestore", error);
    }
  }

  saveUserData();
}, [user, authLoading, dataLoading, weeks, customExercises, surgeryDate]);

async function handleAuthSubmit(e) {
  e.preventDefault();
  setAuthError("");

  try {
    if (authMode === "signup") {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }

    setEmail("");
    setPassword("");
  } catch (error) {
    setAuthError(error.message || "Authentication failed");
  }
}

async function handleLogout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Failed to sign out", error);
  }
}

const exerciseKeys = useMemo(() => [...DEFAULT_EXERCISES, ...customExercises], [customExercises]);
const selectedExercise = exerciseKeys.find((e) => e.id === form.exerciseId) || exerciseKeys[0];
const singleLegExercises = exerciseKeys.filter((e) => e.singleLeg);
const customExercisesPresent = customExercises.filter((e) =>
  weeks.some((w) => (w.sessions || []).some((s) => s.exerciseId === e.id))
);
const daysSinceSurgery = calculateDaysSinceSurgery(surgeryDate);

const currentSymmetry = useMemo(() => {
  if (!selectedExercise?.singleLeg) return null;
  return bestSetSym(form.left.sets, form.right.sets);
}, [selectedExercise, form.left.sets, form.right.sets]);

  useEffect(() => {
    if (surgeryDate && !weekManuallyEdited) {
      const autoWeek = calculateWeekFromSurgeryDate(surgeryDate, form.date);
      setForm((prev) => ({ ...prev, week: autoWeek }));
    }
  }, [surgeryDate, form.date, weekManuallyEdited]);

  const displayedWeeks = showAllRows ? weeks : weeks.slice(-8);

  const latestLPSym = latestSymmetryForExercise(weeks, "lp");
  const latestLESym = latestSymmetryForExercise(weeks, "le");
  const latestHCSym = latestSymmetryForExercise(weeks, "hc");
  const latestLPLeft = latestBestSetForExercise(weeks, "lp", "leftSets");
  const latestLPRight = latestBestSetForExercise(weeks, "lp", "rightSets");
  const latestLELeft = latestBestSetForExercise(weeks, "le", "leftSets");
  const latestLERight = latestBestSetForExercise(weeks, "le", "rightSets");
  const latestHCLeft = latestBestSetForExercise(weeks, "hc", "leftSets");
  const latestHCRight = latestBestSetForExercise(weeks, "hc", "rightSets");
  const builtInTabs = DEFAULT_EXERCISES.filter((e) => exerciseKeys.some((x) => x.id === e.id));

  const graphData = weeks.map((week) => {
    const row = { week: `W${week.week}` };
    singleLegExercises.forEach((exercise) => {
      const exSessions = aggregateWeekExerciseSessions(week, exercise.id).filter((s) => s.singleLeg);
      const last = exSessions.length ? exSessions[exSessions.length - 1] : null;
      row[exercise.id] = last ? bestSetSym(last.leftSets || [], last.rightSets || []) : null;
    });
    return row;
  });

  function addCustomExercise() {
    const name = newExerciseName.trim();
    if (!name) return;
    const id = `custom-${Date.now()}`;
    const item = { id, label: name, singleLeg: newExerciseSingleLeg, builtIn: false };
    setCustomExercises((prev) => [...prev, item]);
    setForm((prev) => ({ ...prev, exerciseId: id }));
    setNewExerciseName("");
    setNewExerciseSingleLeg(true);
  }

  function deleteCustomExercise(exerciseId) {
    setCustomExercises((prev) => prev.filter((e) => e.id !== exerciseId));
    setWeeks((prev) =>
      prev
        .map((w) => ({ ...w, sessions: (w.sessions || []).filter((s) => s.exerciseId !== exerciseId) }))
        .filter((w) => (w.sessions || []).length > 0)
    );
    if (form.exerciseId === exerciseId) setForm((prev) => ({ ...prev, exerciseId: "lp" }));
    if (graphsTab === exerciseId) setGraphsTab("combined");
    if (progressTab === exerciseId || progressTab === "custom") setProgressTab("all");
  }

  function saveSession() {
    if (!form.week) return;
    setWeeks((prev) => {
      const existing = prev.find((w) => String(w.week) === String(form.week));
      const base = existing ? { ...existing, sessions: [...(existing.sessions || [])] } : emptyWeek(String(form.week));
      base.week = String(form.week);

      if (editing) {
        base.sessions = base.sessions.map((session) => {
          if (session.id !== editing.sessionId) return session;
          if (selectedExercise?.singleLeg) {
            return {
              ...session,
              exerciseId: form.exerciseId,
              date: form.date,
              singleLeg: true,
              leftSets: form.left.sets,
              rightSets: form.right.sets,
              notes: form.notes,
            };
          }
          return {
            ...session,
            exerciseId: form.exerciseId,
            date: form.date,
            singleLeg: false,
            sets: form.bilateral.sets,
            notes: form.notes,
          };
        });
      } else {
        const session = selectedExercise?.singleLeg
          ? makeSingleLegSession(form.exerciseId, form.date, form.left.sets, form.right.sets, form.notes)
          : makeBilateralSession(form.exerciseId, form.date, form.bilateral.sets, form.notes);
        base.sessions.push(session);
      }

      const filtered = prev.filter((w) => String(w.week) !== String(form.week));
      return [...filtered, base].sort((a, b) => Number(a.week) - Number(b.week));
    });

    setEditing(null);
    setWeekManuallyEdited(false);
    setForm((prev) => ({
      ...blankForm,
      week: surgeryDate ? calculateWeekFromSurgeryDate(surgeryDate, todayString()) : prev.week ? String(Number(prev.week) + 1) : "",
      date: todayString(),
      exerciseId: prev.exerciseId,
    }));
  }

  function editSession(weekData, session) {
    const nextDate = session.date || todayString();
    const autoWeek = surgeryDate ? calculateWeekFromSurgeryDate(surgeryDate, nextDate) : "";
    setEditing({ week: String(weekData.week), sessionId: session.id });
    setWeekManuallyEdited(false);
    setForm({
      week: autoWeek || String(weekData.week),
      date: nextDate,
      exerciseId: session.exerciseId,
      left: { sets: session.leftSets?.length ? session.leftSets : defaultSets() },
      right: { sets: session.rightSets?.length ? session.rightSets : defaultSets() },
      bilateral: { sets: session.sets?.length ? session.sets : defaultSets() },
      notes: session.notes || "",
    });
    setActiveTab("log");
  }

  function deleteSession(weekValue, sessionId) {
    setWeeks((prev) =>
      prev
        .map((w) => (String(w.week) === String(weekValue) ? { ...w, sessions: (w.sessions || []).filter((s) => s.id !== sessionId) } : w))
        .filter((w) => (w.sessions || []).length > 0)
    );
    if (editing?.sessionId === sessionId) {
      setEditing(null);
      setForm(blankForm);
      setWeekManuallyEdited(false);
    }
  }
if (authLoading) {
  return (
    <div className="min-h-screen bg-slate-50 p-4 flex items-center justify-center">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md text-center">
        Loading...
      </div>
    </div>
  );
}

if (!user) {
  return (
    <div className="min-h-screen bg-slate-50 p-4 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
        <div className="mb-6">
          <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
            Rehab logging dashboard
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">ACL Rehab Tracker</h1>
          <p className="mt-2 text-sm text-slate-500">
            Sign in to access your rehab data on phone and laptop.
          </p>
        </div>

        <div className="mb-4 flex gap-2">
          <TabButton active={authMode === "login"} onClick={() => setAuthMode("login")}>
            Log in
          </TabButton>
          <TabButton active={authMode === "signup"} onClick={() => setAuthMode("signup")}>
            Sign up
          </TabButton>
        </div>

        <form onSubmit={handleAuthSubmit} className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
            />
          </div>

          <div>
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={authMode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {authError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {authError}
            </div>
          ) : null}

          <Button type="submit" className="w-full">
            {authMode === "signup" ? "Create account" : "Log in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-24 md:p-8 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-start justify-between gap-4">
  <div className="space-y-2">
    <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
      Rehab logging dashboard
    </div>
    <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">ACL Rehab Tracker</h1>
    <div className="text-sm text-slate-500">{user.email}</div>
  </div>

  <Button variant="outline" onClick={handleLogout}>
    Log out
  </Button>
</div>

        <div className="hidden md:flex flex-wrap gap-2">
          <TabButton active={activeTab === "home"} onClick={() => setActiveTab("home")}>Home</TabButton>
          <TabButton active={activeTab === "log"} onClick={() => setActiveTab("log")}>Log Session</TabButton>
          <TabButton active={activeTab === "table"} onClick={() => setActiveTab("table")}>Progress</TabButton>
          <TabButton active={activeTab === "graphs"} onClick={() => setActiveTab("graphs")}>Graphs</TabButton>
        </div>

        {activeTab === "home" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 md:gap-4">
              <SummaryCard
  title="Leg Press"
  value={`${latestLPLeft ? `${latestLPLeft.reps} x ${latestLPLeft.weight}kg` : "—"} / ${latestLPRight ? `${latestLPRight.reps} x ${latestLPRight.weight}kg` : "—"}`}
  subtitle="L / R"
/>
<SummaryCard title="Leg Press symmetry" value={latestLPSym != null ? `${latestLPSym}%` : "—"} />

<SummaryCard
  title="Leg Extension"
  value={`${latestLELeft ? `${latestLELeft.reps} x ${latestLELeft.weight}kg` : "—"} / ${latestLERight ? `${latestLERight.reps} x ${latestLERight.weight}kg` : "—"}`}
  subtitle="L / R"
/>
<SummaryCard title="Leg Extension symmetry" value={latestLESym != null ? `${latestLESym}%` : "—"} />

<SummaryCard
  title="Hamstring Curl"
  value={`${latestHCLeft ? `${latestHCLeft.reps} x ${latestHCLeft.weight}kg` : "—"} / ${latestHCRight ? `${latestHCRight.reps} x ${latestHCRight.weight}kg` : "—"}`}
  subtitle="L / R"
/>
<SummaryCard title="Hamstring Curl symmetry" value={latestHCSym != null ? `${latestHCSym}%` : "—"} />
            </div>

            <CardShell title="Setup">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Surgery date (optional)</Label>
                  <Input
                    type="date"
                    value={surgeryDate}
                    onChange={(e) => {
                      setSurgeryDate(e.target.value);
                      setWeekManuallyEdited(false);
                    }}
                  />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  {surgeryDate
                    ? "Week auto-calculates from Date by default, but you can still type over it manually if needed."
                    : "No surgery date set. Week starts manual, then defaults to the next week after a save."}
                </div>
              </div>
            </CardShell>

            <CardShell title="Recovery home">
              <div className="grid gap-4 md:grid-cols-2">
                <SummaryCard
                  title="Days since surgery"
                  value={daysSinceSurgery != null ? String(daysSinceSurgery) : "—"}
                  subtitle={surgeryDate ? "Based on today" : "Add surgery date"}
                />
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  This updates from the surgery date using today’s date. Add or change the surgery date above.
                </div>
              </div>
            </CardShell>
          </div>
        )}

        {activeTab === "log" && (
          <div className="space-y-6">
            <CardShell title="Custom exercises">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[1fr_180px_120px]">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">New exercise name</Label>
                    <Input value={newExerciseName} onChange={(e) => setNewExerciseName(e.target.value)} placeholder="e.g. Squat" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Single leg</Label>
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setNewExerciseSingleLeg(true)}
                        className={cls(
                          "rounded-md border px-3 py-2 text-sm",
                          newExerciseSingleLeg ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"
                        )}
                      >
                        On
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewExerciseSingleLeg(false)}
                        className={cls(
                          "rounded-md border px-3 py-2 text-sm",
                          !newExerciseSingleLeg ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"
                        )}
                      >
                        Off
                      </button>
                    </div>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={addCustomExercise} className="w-full">Add exercise</Button>
                  </div>
                </div>

                {customExercises.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {customExercises.map((exercise) => (
                      <div key={exercise.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
                        <span>{exercise.label}</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-500">{exercise.singleLeg ? "Single leg" : "Both legs"}</span>
                        <button
                          type="button"
                          onClick={() => deleteCustomExercise(exercise.id)}
                          className="inline-flex items-center justify-center rounded-full border border-slate-200 p-1 hover:bg-slate-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardShell>

            <CardShell title={editing ? `Edit session — Week ${editing.week}` : "Add Session"}>
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Week</Label>
                    <Input
                      value={form.week}
                      onChange={(e) => {
                        setWeekManuallyEdited(true);
                        setForm({ ...form, week: e.target.value });
                      }}
                      placeholder={surgeryDate ? "Auto" : "Enter week"}
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Date</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Exercise</Label>
                    <select
                      value={form.exerciseId}
                      onChange={(e) => setForm({ ...form, exerciseId: e.target.value })}
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      {exerciseKeys.map((ex) => (
                        <option key={ex.id} value={ex.id}>{ex.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedExercise?.singleLeg ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <SetsInput title="Left" data={form.left} setData={(v) => setForm({ ...form, left: v })} />
                      <SetsInput title="Right" data={form.right} setData={(v) => setForm({ ...form, right: v })} />
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                      <span className="font-medium">Symmetry: </span>
                      {currentSymmetry ?? "—"}
                      {currentSymmetry != null ? "%" : ""}
                    </div>
                  </>
                ) : (
                  <SetsInput title="Sets" data={form.bilateral} setData={(v) => setForm({ ...form, bilateral: v })} />
                )}

                <div>
                  <Label className="text-sm font-medium text-slate-700">Notes</Label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes for this session" />
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => { saveSession(); setActiveTab("table"); }}>
                    {editing ? "Update Session" : "Save Session"}
                  </Button>
                  {editing && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditing(null);
                        setForm({ ...blankForm, date: todayString(), exerciseId: form.exerciseId });
                        setWeekManuallyEdited(false);
                        setActiveTab("table");
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </CardShell>
          </div>
        )}

        {activeTab === "table" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <TabButton active={progressTab === "all"} onClick={() => setProgressTab("all")}>All</TabButton>
              {builtInTabs.map((exercise) => (
                <TabButton key={exercise.id} active={progressTab === exercise.id} onClick={() => setProgressTab(exercise.id)}>
                  {exercise.label}
                </TabButton>
              ))}
              {customExercisesPresent.length > 0 && (
                <TabButton active={progressTab === "custom"} onClick={() => setProgressTab("custom")}>Custom</TabButton>
              )}
            </div>

            {progressTab === "all" && (
              <CardShell
                title="Weekly Overview"
                right={<Button variant="outline" onClick={() => setShowAllRows((v) => !v)}>{showAllRows ? "Show last 8 weeks" : "Show all weeks"}</Button>}
              >
                <div className="space-y-4 md:hidden">
                  {displayedWeeks.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">No sessions saved yet.</div>
                  ) : (
                    displayedWeeks.map((week) => (
                      <div key={week.week} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-lg font-semibold text-slate-900">Week {week.week}</div>
                          <div className="text-xs text-slate-500">{compactDate(week.sessions || [])}</div>
                        </div>
                        <div className="space-y-3">
                          {exerciseKeys.map((exercise) => {
                            const summary = compactExerciseSummary(week, exercise);
                            if (!summary) return null;
                            return (
                              <div key={`${week.week}-${exercise.id}-mobile`} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                                <div className="text-sm font-semibold text-slate-900">{exercise.label}</div>
                                <div className="mt-1 text-xs text-slate-500">{summary.dates}</div>
                                {summary.type === "single" ? (
                                  <>
                                    <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                                      <span>L: {summary.left}</span>
                                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600">
                                        {summary.symmetry != null ? `${summary.symmetry}%` : "—"}
                                      </span>
                                    </div>
                                    <div className="mt-1 text-sm">R: {summary.right}</div>
                                  </>
                                ) : (
                                  <div className="mt-2 text-sm">{summary.value}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
                  <table className="w-full min-w-[1200px] border-collapse text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="border-b p-3 text-left font-semibold">Week</th>
                        {exerciseKeys.map((exercise) => (
                          <React.Fragment key={exercise.id}>
                            <th className="border-b p-3 text-left font-semibold">{exercise.label}</th>
                            {exercise.singleLeg && <th className="border-b p-3 text-left font-semibold">{exercise.label} Symmetry</th>}
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayedWeeks.length === 0 ? (
                        <tr>
                          <td colSpan={1 + exerciseKeys.length + exerciseKeys.filter((e) => e.singleLeg).length} className="p-8 text-center text-slate-500">
                            No sessions saved yet.
                          </td>
                        </tr>
                      ) : (
                        displayedWeeks.map((week, idx) => (
                          <tr key={week.week} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                            <td className="border-b p-3 align-top font-medium whitespace-nowrap">Week {week.week}</td>
                            {exerciseKeys.flatMap((exercise) => {
                              const summary = compactExerciseSummary(week, exercise);
                              const cells = [];
                              cells.push(
                                <td key={`${week.week}-${exercise.id}-main`} className="border-b p-3 align-top min-w-[220px]">
                                  {!summary ? (
                                    <span className="text-slate-400">—</span>
                                  ) : summary.type === "single" ? (
                                    <div className="space-y-1">
                                      <div className="text-xs text-slate-500">{summary.dates}</div>
                                      <div className="text-sm">L: {summary.left}</div>
                                      <div className="text-sm">R: {summary.right}</div>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <div className="text-xs text-slate-500">{summary.dates}</div>
                                      <div className="text-sm">{summary.value}</div>
                                    </div>
                                  )}
                                </td>
                              );
                              if (exercise.singleLeg) {
                                cells.push(
                                  <td key={`${week.week}-${exercise.id}-sym`} className="border-b p-3 align-top min-w-[120px]">
                                    {summary && summary.type === "single" ? (summary.symmetry != null ? `${summary.symmetry}%` : "—") : <span className="text-slate-400">—</span>}
                                  </td>
                                );
                              }
                              return cells;
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardShell>
            )}

            {builtInTabs.map((exercise) => progressTab === exercise.id && (
              <CardShell
                key={exercise.id}
                title={exercise.label}
                right={<Button variant="outline" onClick={() => setShowAllRows((v) => !v)}>{showAllRows ? "Show last 8 weeks" : "Show all weeks"}</Button>}
              >
                <div className="space-y-4">
                  {displayedWeeks.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">No sessions saved yet.</div>
                  ) : (
                    displayedWeeks.map((week) => {
                      const exSessions = aggregateWeekExerciseSessions(week, exercise.id);
                      if (!exSessions.length) return null;
                      return (
                        <div key={`${exercise.id}-${week.week}`} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="text-lg font-semibold">Week {week.week}</div>
                          {exSessions.map((session, idx) => {
                            const sum = sessionSummary(session);
                            return (
                              <div key={session.id} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="text-sm font-medium">Session {idx + 1} • {sum.date}</div>
                                  <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => editSession(week, session)}>Edit</Button>
                                    <Button variant="destructive" size="sm" onClick={() => deleteSession(week.week, session.id)}>
                                      <Trash2 className="mr-1 h-4 w-4" /> Delete
                                    </Button>
                                  </div>
                                </div>
                                {session.singleLeg ? (
                                  <div className="grid gap-4 md:grid-cols-3">
                                    <div><div className="mb-1 text-sm font-medium">Left</div>{sum.left.map((line, i) => <div key={i} className="text-sm">{line}</div>)}</div>
                                    <div><div className="mb-1 text-sm font-medium">Right</div>{sum.right.map((line, i) => <div key={i} className="text-sm">{line}</div>)}</div>
                                    <div><div className="mb-1 text-sm font-medium">Symmetry</div><div className="text-sm">{sum.symmetry ?? "—"}{sum.symmetry != null ? "%" : ""}</div></div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="mb-1 text-sm font-medium">Sets</div>
                                    {sum.sets.map((line, i) => <div key={i} className="text-sm">{line}</div>)}
                                  </div>
                                )}
                                <div className="rounded-xl bg-white p-3 text-sm text-slate-700"><span className="font-medium">Notes: </span>{sum.notes}</div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })
                  )}
                </div>
              </CardShell>
            ))}

            {progressTab === "custom" && (
              <CardShell
                title="Custom exercises"
                right={<Button variant="outline" onClick={() => setShowAllRows((v) => !v)}>{showAllRows ? "Show last 8 weeks" : "Show all weeks"}</Button>}
              >
                <div className="space-y-6">
                  {customExercisesPresent.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">No custom exercise sessions saved yet.</div>
                  ) : customExercisesPresent.map((exercise) => (
                    <div key={exercise.id} className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-lg font-semibold">{exercise.label}</h3>
                        <div className="text-sm text-slate-500">{exercise.singleLeg ? "Single leg" : "Both legs"}</div>
                      </div>
                      {displayedWeeks.map((week) => {
                        const exSessions = aggregateWeekExerciseSessions(week, exercise.id);
                        if (!exSessions.length) return null;
                        return (
                          <div key={`${exercise.id}-${week.week}`} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="text-base font-semibold">Week {week.week}</div>
                            {exSessions.map((session, idx) => {
                              const sum = sessionSummary(session);
                              return (
                                <div key={session.id} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="text-sm font-medium">Session {idx + 1} • {sum.date}</div>
                                    <div className="flex gap-2">
                                      <Button variant="outline" size="sm" onClick={() => editSession(week, session)}>Edit</Button>
                                      <Button variant="destructive" size="sm" onClick={() => deleteSession(week.week, session.id)}>
                                        <Trash2 className="mr-1 h-4 w-4" /> Delete
                                      </Button>
                                    </div>
                                  </div>
                                  {session.singleLeg ? (
                                    <div className="grid gap-4 md:grid-cols-3">
                                      <div><div className="mb-1 text-sm font-medium">Left</div>{sum.left.map((line, i) => <div key={i} className="text-sm">{line}</div>)}</div>
                                      <div><div className="mb-1 text-sm font-medium">Right</div>{sum.right.map((line, i) => <div key={i} className="text-sm">{line}</div>)}</div>
                                      <div><div className="mb-1 text-sm font-medium">Symmetry</div><div className="text-sm">{sum.symmetry ?? "—"}{sum.symmetry != null ? "%" : ""}</div></div>
                                    </div>
                                  ) : (
                                    <div>
                                      <div className="mb-1 text-sm font-medium">Sets</div>
                                      {sum.sets.map((line, i) => <div key={i} className="text-sm">{line}</div>)}
                                    </div>
                                  )}
                                  <div className="rounded-xl bg-white p-3 text-sm text-slate-700"><span className="font-medium">Notes: </span>{sum.notes}</div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </CardShell>
            )}
          </div>
        )}

        {activeTab === "graphs" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <TabButton active={graphsTab === "combined"} onClick={() => setGraphsTab("combined")}>Combined</TabButton>
              {singleLegExercises.map((exercise) => (
                <TabButton key={exercise.id} active={graphsTab === exercise.id} onClick={() => setGraphsTab(exercise.id)}>
                  {exercise.label}
                </TabButton>
              ))}
            </div>

            {graphsTab === "combined" && (
              <CardShell title="Symmetry over time">
                <div className="h-[360px] rounded-2xl bg-slate-50 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={graphData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <ReferenceLine y={90} stroke="#94a3b8" strokeDasharray="4 4" />
                      {singleLegExercises.map((exercise, idx) => (
                        <Line
                          key={exercise.id}
                          type="monotone"
                          dataKey={exercise.id}
                          name={exercise.label}
                          stroke={["#2563eb", "#16a34a", "#ea580c", "#7c3aed", "#dc2626", "#0891b2"][idx % 6]}
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardShell>
            )}

            {singleLegExercises.map((exercise) => (
              graphsTab === exercise.id ? <ExerciseGraph key={exercise.id} title={`${exercise.label} symmetry`} dataKey={exercise.id} data={graphData} /> : null
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 p-2">
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className={cls("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs", activeTab === "home" ? "bg-slate-100 font-medium" : "text-slate-500")}
          >
            <Home className="h-4 w-4" />
            Home
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("log")}
            className={cls("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs", activeTab === "log" ? "bg-slate-100 font-medium" : "text-slate-500")}
          >
            <Plus className="h-4 w-4" />
            Log
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("table")}
            className={cls("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs", activeTab === "table" ? "bg-slate-100 font-medium" : "text-slate-500")}
          >
            <Table2 className="h-4 w-4" />
            Progress
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("graphs")}
            className={cls("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs", activeTab === "graphs" ? "bg-slate-100 font-medium" : "text-slate-500")}
          >
            <LineChartIcon className="h-4 w-4" />
            Graphs
          </button>
        </div>
      </div>
    </div>
  );
}