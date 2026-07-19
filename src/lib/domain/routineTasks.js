const WEEKDAY_KEYS = Object.freeze([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

export const ROUTINE_TIME_OF_DAY = Object.freeze({
  MORNING: "morning",
  AFTERNOON: "afternoon",
  EVENING: "evening",
  ANYTIME: "anytime",
});

export const ROUTINE_TIME_OF_DAY_OPTIONS = Object.freeze([
  ROUTINE_TIME_OF_DAY.MORNING,
  ROUTINE_TIME_OF_DAY.AFTERNOON,
  ROUTINE_TIME_OF_DAY.EVENING,
  ROUTINE_TIME_OF_DAY.ANYTIME,
]);

export const ROUTINE_TASK_STATUS = Object.freeze({
  PENDING: "pending",
  COMPLETED: "completed",
  COMPLETED_LATE: "completed_late",
  SKIPPED: "skipped",
});

function generatedId(prefix = "routine-task") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function validIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

export function normalizeRoutineDays(days = []) {
  const selected = new Set((Array.isArray(days) ? days : []).map((day) => String(day).toLowerCase()));
  return WEEKDAY_KEYS.filter((day) => selected.has(day));
}

export function createRoutineTask({
  id = generatedId(),
  name = "",
  notes = "",
  days = [],
  timeOfDay = ROUTINE_TIME_OF_DAY.ANYTIME,
  sortOrder = 0,
  isArchived = false,
} = {}) {
  return {
    id,
    name: String(name || "").trim(),
    notes: String(notes || ""),
    days: normalizeRoutineDays(days),
    timeOfDay: ROUTINE_TIME_OF_DAY_OPTIONS.includes(timeOfDay) ? timeOfDay : ROUTINE_TIME_OF_DAY.ANYTIME,
    sortOrder: Number(sortOrder || 0),
    isArchived: Boolean(isArchived),
  };
}

export function validateRoutineTask(task) {
  const errors = [];
  if (!String(task?.name || "").trim()) errors.push("Routine task name is required.");
  if (!normalizeRoutineDays(task?.days).length) errors.push("Choose at least one day for the routine task.");
  if (!ROUTINE_TIME_OF_DAY_OPTIONS.includes(task?.timeOfDay)) errors.push("Choose a valid time of day.");
  return { valid: errors.length === 0, errors };
}

export function weekdayKeyForDate(dateString) {
  if (!validIsoDate(dateString)) return null;
  const date = new Date(`${dateString}T12:00:00`);
  const sundayFirst = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return sundayFirst[date.getDay()] || null;
}

export function isRoutineTaskScheduledForDate(task, dateString) {
  const weekday = weekdayKeyForDate(dateString);
  return Boolean(weekday && !task?.isArchived && normalizeRoutineDays(task?.days).includes(weekday));
}

export function routineCompletionId(taskId, scheduledDate) {
  return `${taskId}__${scheduledDate}`;
}

export function createRoutineCompletion({
  taskId,
  programmeId,
  scheduledDate,
  actualCompletionDate = null,
  status = ROUTINE_TASK_STATUS.PENDING,
  completedAt = null,
  skippedAt = null,
} = {}) {
  if (!taskId) throw new Error("taskId is required.");
  if (!programmeId) throw new Error("programmeId is required.");
  if (!validIsoDate(scheduledDate)) throw new Error("scheduledDate must use YYYY-MM-DD.");
  if (actualCompletionDate && !validIsoDate(actualCompletionDate)) throw new Error("actualCompletionDate must use YYYY-MM-DD.");

  return {
    id: routineCompletionId(taskId, scheduledDate),
    taskId,
    programmeId,
    scheduledDate,
    actualCompletionDate,
    status,
    completedAt,
    skippedAt,
  };
}

export function completeRoutineTask(completion, actualCompletionDate) {
  if (!validIsoDate(actualCompletionDate)) throw new Error("actualCompletionDate must use YYYY-MM-DD.");
  const completedLate = actualCompletionDate !== completion.scheduledDate;
  return {
    ...completion,
    actualCompletionDate,
    status: completedLate ? ROUTINE_TASK_STATUS.COMPLETED_LATE : ROUTINE_TASK_STATUS.COMPLETED,
    completedAt: new Date().toISOString(),
    skippedAt: null,
  };
}

export function skipRoutineTask(completion) {
  return {
    ...completion,
    status: ROUTINE_TASK_STATUS.SKIPPED,
    skippedAt: new Date().toISOString(),
  };
}

export function dueRoutineTasks(programme, dateString, completions = []) {
  const completionByTask = new Map(
    (Array.isArray(completions) ? completions : [])
      .filter((item) => item?.scheduledDate === dateString)
      .map((item) => [item.taskId, item])
  );

  return (Array.isArray(programme?.routineTasks) ? programme.routineTasks : [])
    .filter((task) => isRoutineTaskScheduledForDate(task, dateString))
    .slice()
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    .map((task) => ({ task, completion: completionByTask.get(task.id) || null }));
}

export function missedRoutineTasks(programme, beforeDate, completions = []) {
  if (!validIsoDate(beforeDate)) return [];
  const completionMap = new Map((Array.isArray(completions) ? completions : []).map((item) => [item.id, item]));
  const tasks = Array.isArray(programme?.routineTasks) ? programme.routineTasks : [];
  const results = [];

  for (const task of tasks) {
    for (const completion of completionMap.values()) {
      if (completion.taskId !== task.id || completion.scheduledDate >= beforeDate) continue;
      if (completion.status !== ROUTINE_TASK_STATUS.PENDING) continue;
      results.push({ task, completion });
    }
  }

  return results.sort((a, b) => a.completion.scheduledDate.localeCompare(b.completion.scheduledDate));
}

export { WEEKDAY_KEYS };
