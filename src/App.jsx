import React, { useEffect, useMemo, useState } from "react";
import { ClipboardList, Home, Table2, Dumbbell, Settings, Plus, Trash2, X } from "lucide-react";
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
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "./firebase";
import PlansScreen from "./features/plans/PlansScreen";
import WorkoutScreen from "./features/workout/WorkoutScreen";
import HomeScreen from "./features/home/HomeScreen";
import ProgressScreen from "./features/progress/ProgressScreen";
import Button from "./components/ui/Button";
import { saveLegacyRehabData, subscribeLegacyRehabData } from "./lib/firebase/legacyRehabRepository";
import { calculateWeekFromSurgeryDate, todayString } from "./lib/domain/date";
import { blankSet, defaultSets } from "./lib/domain/sets";
import {
  DEFAULT_EXERCISES,
  aggregateWeekExerciseSessions,
  bestSetSym,
  blankForm,
  compactDate,
  compactExerciseSummary,
  emptyWeek,
  makeBilateralSession,
  makeId,
  makeSingleLegSession,
  sessionSummary,
} from "./lib/domain/legacyWorkouts";

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function authenticationMessage(error, action = "sign in") {
  const code = error?.code || "";
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(code)) return "The email or password is incorrect.";
  if (code === "auth/email-already-in-use") return "An account already exists for this email.";
  if (code === "auth/weak-password") return "Choose a stronger password with at least 6 characters.";
  if (code === "auth/invalid-email") return "Enter a valid email address.";
  if (code === "auth/too-many-requests") return "Too many attempts. Wait a moment and try again.";
  if (/network|unavailable/i.test(error?.message || "")) return "Check your connection and try again.";
  return `Something went wrong while trying to ${action}. Please try again.`;
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

function Input({ className = "", ...props }) {
  return (
    <input
      className={cls("h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm", className)}
      {...props}
    />
  );
}

function Label({ className = "", ...props }) {
  return <label className={cls("block text-sm font-medium text-slate-700", className)} {...props} />;
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
  const [libraryFromProgramme, setLibraryFromProgramme] = useState(false);
  const [workoutIntent, setWorkoutIntent] = useState(null);
  const [progressTab, setProgressTab] = useState("all");
  const [graphsTab, setGraphsTab] = useState("combined");
  const [surgeryDate, setSurgeryDate] = useState("");
  const [trainingMode, setTrainingMode] = useState("gym");
  const [customExercises, setCustomExercises] = useState([]);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseSingleLeg, setNewExerciseSingleLeg] = useState(true);
  const [weekManuallyEdited, setWeekManuallyEdited] = useState(false);

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (import.meta.env.DEV) console.info("[auth] state changed", { uid: firebaseUser?.uid || null });
      setUser(firebaseUser || null);
      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setWeeks([]);
      setCustomExercises([]);
      setSurgeryDate("");
      setTrainingMode("gym");
      return;
    }

    if (["programme", "workout"].includes(activeTab)) return;

    return subscribeLegacyRehabData(
      db,
      user.uid,
      (saved) => {
        setWeeks(saved.weeks);
        setCustomExercises(saved.customExercises);
        setSurgeryDate(saved.surgeryDate);
        setTrainingMode(saved.trainingMode);
      },
      (error) => {
        console.error("Failed to load rehab data from Firestore", error);
      }
    );
  }, [user, authLoading, activeTab]);

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthError("");
    setAuthNotice("");

    try {
      if (authMode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      setEmail("");
      setPassword("");
    } catch (error) {
      console.error("Authentication failed", error);
      setAuthError(authenticationMessage(error, authMode === "signup" ? "create your account" : "sign in"));
    }
  }

  async function handleLogout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Failed to sign out", error);
    }
  }

  async function handleResetPassword() {
    if (!email) {
      setAuthError("Enter your email first");
      setAuthNotice("");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setAuthError("");
      setAuthNotice("Password reset email sent.");
    } catch (error) {
      console.error("Password reset failed", error);
      setAuthNotice("");
      setAuthError(authenticationMessage(error, "send the password reset email"));
    }
  }

  const exerciseKeys = useMemo(() => [...DEFAULT_EXERCISES, ...customExercises], [customExercises]);
  const selectedExercise = exerciseKeys.find((e) => e.id === form.exerciseId) || exerciseKeys[0];
  const singleLegExercises = exerciseKeys.filter((e) => e.singleLeg);
  const customExercisesPresent = customExercises.filter((e) =>
    weeks.some((w) => (w.sessions || []).some((s) => s.exerciseId === e.id))
  );

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

  async function addCustomExercise() {
    const name = newExerciseName.trim();
    if (!name) return;

    const id = `custom-${makeId()}`;
    const item = { id, label: name, singleLeg: newExerciseSingleLeg, builtIn: false };
    const nextCustomExercises = [...customExercises, item];

    setCustomExercises(nextCustomExercises);
    setForm((prev) => ({ ...prev, exerciseId: id }));
    setNewExerciseName("");
    setNewExerciseSingleLeg(true);

    await saveAllData(weeks, nextCustomExercises, surgeryDate);
  }

  async function saveAllData(nextWeeks = weeks, nextCustomExercises = customExercises, nextSurgeryDate = surgeryDate, nextTrainingMode = trainingMode) {
    if (!user) return;
    await saveLegacyRehabData(db, user.uid, {
      weeks: nextWeeks,
      customExercises: nextCustomExercises,
      surgeryDate: nextSurgeryDate,
      trainingMode: nextTrainingMode,
    });
  }

  async function deleteCustomExercise(id) {
    const next = customExercises.filter((item) => item.id !== id);
    setCustomExercises(next);
    if (form.exerciseId === id) setForm((prev) => ({ ...prev, exerciseId: DEFAULT_EXERCISES[0].id }));
    await saveAllData(weeks, next, surgeryDate);
  }

  async function submitSession() {
    let nextWeeks;
    setWeeks((prev) => {
      const existing = prev.find((w) => String(w.week) === String(form.week));
      const base = existing ? { ...existing, sessions: [...(existing.sessions || [])] } : emptyWeek(form.week);

      if (editing) {
        base.sessions = base.sessions.map((session) => {
          if (session.id !== editing.sessionId) return session;
          return selectedExercise?.singleLeg
            ? makeSingleLegSession(form.exerciseId, form.date, form.left.sets, form.right.sets, form.notes, session.id)
            : makeBilateralSession(form.exerciseId, form.date, form.bilateral.sets, form.notes, session.id);
        });
      } else {
        const session = selectedExercise?.singleLeg
          ? makeSingleLegSession(form.exerciseId, form.date, form.left.sets, form.right.sets, form.notes)
          : makeBilateralSession(form.exerciseId, form.date, form.bilateral.sets, form.notes);
        base.sessions.push(session);
      }

      const filtered = prev.filter((w) => String(w.week) !== String(form.week));
      nextWeeks = [...filtered, base].sort((a, b) => Number(a.week) - Number(b.week));
      return nextWeeks;
    });

    setEditing(null);
    setWeekManuallyEdited(false);

    const nextExerciseId = form.exerciseId;

    setForm((prev) => ({
      ...blankForm,
      week: surgeryDate ? calculateWeekFromSurgeryDate(surgeryDate, todayString()) : prev.week ? String(Number(prev.week) + 1) : "",
      date: todayString(),
      exerciseId: nextExerciseId,
    }));

    await saveAllData(nextWeeks, customExercises, surgeryDate);
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
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md text-center">Loading...</div>
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
            <p className="mt-2 text-sm text-slate-500">Sign in to access your rehab data on phone and laptop.</p>
          </div>

          <div className="mb-4 flex gap-2">
            <TabButton active={authMode === "login"} onClick={() => setAuthMode("login")}>Log in</TabButton>
            <TabButton active={authMode === "signup"} onClick={() => setAuthMode("signup")}>Sign up</TabButton>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" />
            </div>

            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete={authMode === "login" ? "current-password" : "new-password"} />
            </div>

            {authError ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{authError}</div> : null}
            {authNotice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{authNotice}</div> : null}

            <Button type="submit" className="w-full">{authMode === "signup" ? "Create account" : "Log in"}</Button>
            <Button type="button" variant="outline" className="w-full" onClick={handleResetPassword}>Forgot password</Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={cls("min-h-screen bg-slate-50 p-4 md:p-8 md:pb-8", activeTab === "home" ? "pb-36" : "pb-24")}> 
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="hidden md:flex flex-wrap gap-2">
          <TabButton active={activeTab === "home"} onClick={() => setActiveTab("home")}>Home</TabButton>
          <TabButton active={activeTab === "programme"} onClick={() => setActiveTab("programme")}>Programme</TabButton>
          <TabButton active={activeTab === "workout"} onClick={() => setActiveTab("workout")}>Workout</TabButton>
          <TabButton active={["progress", "workout-history", "table", "graphs"].includes(activeTab)} onClick={() => setActiveTab("progress")}>Progress</TabButton>
          <TabButton active={activeTab === "more"} onClick={() => setActiveTab("more")}>Settings</TabButton>
        </div>

        {activeTab === "home" && <HomeScreen user={user} surgeryDate={surgeryDate} trainingMode={trainingMode} fromProgramme={libraryFromProgramme} onBackToProgramme={() => { setLibraryFromProgramme(false); setActiveTab("programme"); }} onOpenWorkout={(intent) => { setWorkoutIntent({ ...intent, token: Date.now() }); setActiveTab("workout"); }} />}
        {activeTab === "programme" && <PlansScreen user={user} trainingMode={trainingMode} onOpenExerciseLibrary={() => { setLibraryFromProgramme(true); setActiveTab("home"); }} />}
        {activeTab === "workout" && <WorkoutScreen user={user} intent={workoutIntent} trainingMode={trainingMode} />}
        {activeTab === "progress" && <ProgressScreen user={user} trainingMode={trainingMode} />}
        {activeTab === "more" && <div className="space-y-4"><CardShell title="Settings"><div className="space-y-4"><div><Label>Training mode</Label><div className="mt-2 flex gap-2"><TabButton active={trainingMode === "gym"} onClick={() => { setTrainingMode("gym"); saveAllData(weeks, customExercises, surgeryDate, "gym"); }}>Gym</TabButton><TabButton active={trainingMode === "rehab"} onClick={() => { setTrainingMode("rehab"); saveAllData(weeks, customExercises, surgeryDate, "rehab"); }}>Rehab</TabButton></div></div>{trainingMode === "rehab" ? <div><Label>Surgery date</Label><Input type="date" value={surgeryDate} onChange={(e) => { setSurgeryDate(e.target.value); saveAllData(weeks, customExercises, e.target.value); }} /></div> : null}<Button variant="outline" onClick={handleLogout}>Log out</Button></div></CardShell></div>}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 p-2">
          <button type="button" onClick={() => setActiveTab("home")} className={cls("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs", activeTab === "home" ? "bg-slate-100 font-medium" : "text-slate-500")}><Home className="h-4 w-4" />Home</button>
          <button type="button" onClick={() => setActiveTab("programme")} className={cls("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs", activeTab === "programme" ? "bg-slate-100 font-medium" : "text-slate-500")}><ClipboardList className="h-4 w-4" />Programme</button>
          <button type="button" onClick={() => setActiveTab("workout")} className={cls("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs", activeTab === "workout" ? "bg-slate-100 font-medium" : "text-slate-500")}><Dumbbell className="h-4 w-4" />Workout</button>
          <button type="button" onClick={() => setActiveTab("progress")} className={cls("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs", ["progress", "workout-history", "table", "graphs"].includes(activeTab) ? "bg-slate-100 font-medium" : "text-slate-500")}><Table2 className="h-4 w-4" />Progress</button>
          <button type="button" onClick={() => setActiveTab("more")} className={cls("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs", activeTab === "more" ? "bg-slate-100 font-medium" : "text-slate-500")}><Settings className="h-4 w-4" />Settings</button>
        </div>
      </div>
    </div>
  );
}
