import React, { useEffect, useMemo, useState } from "react";
import { ClipboardList, Home, Table2, Dumbbell, Menu, Plus, Trash2, X } from "lucide-react";
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
      // The legacy app clears user-scoped data immediately on sign-out.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWeeks([]);
      setCustomExercises([]);
      setSurgeryDate("");
      setTrainingMode("gym");
      return;
    }

    // Programme and Workout use only their v2 user-scoped repositories. Home
    // and Settings retain the legacy surgery-date field until it is migrated by
    // a future, explicit data-model change.
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
      // Keep Phase 0 behavior identical: date/surgery-date changes update the legacy week field.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
async function saveAllData(nextWeeks = weeks, nextCustomExercises = customExercises, nextSurgeryDate = surgeryDate, nextTrainingMode = trainingMode) {
  if (!user?.uid) return;

  try {
    await saveLegacyRehabData(db, user.uid, {
      weeks: nextWeeks,
      customExercises: nextCustomExercises,
      surgeryDate: nextSurgeryDate,
      trainingMode: nextTrainingMode,
    });
  } catch (error) {
    console.error("Failed to save rehab data to Firestore", error);
  }
}
async function saveSession() {
  if (!form.week || !user?.uid) return;

  let nextWeeks = [];

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
            {authNotice ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {authNotice}
              </div>
            ) : null}

            <Button type="submit" className="w-full">
              {authMode === "signup" ? "Create account" : "Log in"}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleResetPassword}
            >
              Forgot password
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
          <TabButton active={activeTab === "programme"} onClick={() => setActiveTab("programme")}>Programme</TabButton>
          <TabButton active={activeTab === "workout"} onClick={() => setActiveTab("workout")}>Workout</TabButton>
          <TabButton active={["progress", "workout-history", "table", "graphs"].includes(activeTab)} onClick={() => setActiveTab("progress")}>Progress</TabButton>
          <TabButton active={activeTab === "more"} onClick={() => setActiveTab("more")}>More</TabButton>
        </div>

        {activeTab === "home" && <HomeScreen user={user} surgeryDate={surgeryDate} trainingMode={trainingMode} fromProgramme={libraryFromProgramme} onBackToProgramme={() => { setLibraryFromProgramme(false); setActiveTab("programme"); }} onOpenProgramme={() => { setLibraryFromProgramme(false); setActiveTab("programme"); }} onOpenWorkout={(intent) => { setWorkoutIntent({ ...intent, token: Date.now() }); setActiveTab("workout"); }} />}

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

        {activeTab === "programme" && <PlansScreen user={user} onManageExerciseLibrary={() => { setLibraryFromProgramme(true); setActiveTab("home"); requestAnimationFrame(() => document.getElementById("exercise-library")?.scrollIntoView({ behavior: "smooth" })); }} />}
        {activeTab === "workout" && <WorkoutScreen user={user} intent={workoutIntent} onIntentHandled={() => setWorkoutIntent(null)} onFinished={() => setActiveTab("workout-history")} onDiscarded={() => setActiveTab("home")} />}
        {["progress", "workout-history"].includes(activeTab) && <ProgressScreen key={activeTab} user={user} trainingMode={trainingMode} initialTab={activeTab === "workout-history" ? "history" : "stats"} />}
        {activeTab === "more" && <div className="space-y-4"><div><h1 className="text-2xl font-semibold">More</h1><p className="text-sm text-slate-500">Manage app preferences.</p></div><CardShell title="Settings"><div className="max-w-md space-y-4"><div><Label>Training mode</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={trainingMode} onChange={async (event) => { const nextMode = event.target.value; setTrainingMode(nextMode); await saveAllData(weeks, customExercises, surgeryDate, nextMode); }}><option value="gym">Gym</option><option value="rehab">Rehab</option></select></div>{trainingMode === "rehab" ? <div><Label>Surgery date (optional)</Label><Input className="mt-1" type="date" value={surgeryDate} onChange={async (event) => { const nextDate = event.target.value; setSurgeryDate(nextDate); setWeekManuallyEdited(false); await saveAllData(weeks, customExercises, nextDate, trainingMode); }} />{surgeryDate ? <div className="mt-2 flex items-center justify-between gap-3"><p className="text-sm text-slate-500">{new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" }).format(new Date(`${surgeryDate}T00:00:00Z`))}</p><Button size="sm" variant="outline" onClick={async () => { setSurgeryDate(""); await saveAllData(weeks, customExercises, "", trainingMode); }}>Remove</Button></div> : null}</div> : null}</div></CardShell></div>}

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
        <div className="mx-auto grid max-w-md grid-cols-5 p-2">
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
            onClick={() => setActiveTab("programme")}
            className={cls("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs", activeTab === "programme" ? "bg-slate-100 font-medium" : "text-slate-500")}
          >
            <ClipboardList className="h-4 w-4" />
            Programme
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("workout")}
            className={cls("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs", activeTab === "workout" ? "bg-slate-100 font-medium" : "text-slate-500")}
          >
            <Dumbbell className="h-4 w-4" />
            Workout
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("progress")}
            className={cls("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs", ["progress", "workout-history", "table", "graphs"].includes(activeTab) ? "bg-slate-100 font-medium" : "text-slate-500")}
          >
            <Table2 className="h-4 w-4" />
            Progress
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("more")}
            className={cls("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs", activeTab === "more" ? "bg-slate-100 font-medium" : "text-slate-500")}
          >
            <Menu className="h-4 w-4" />
            More
          </button>
        </div>
      </div>
    </div>
  );
}
