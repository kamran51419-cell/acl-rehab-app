export const ROUTINE_TIME = Object.freeze({
  ANYTIME: "anytime",
  MORNING: "morning",
  AFTERNOON: "afternoon",
  EVENING: "evening",
});

export const ROUTINE_STATUS = Object.freeze({
  PENDING: "pending",
  COMPLETED: "completed",
  SKIPPED: "skipped",
});

export const WEEKDAYS = Object.freeze(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]);
export const ROUTINE_TIME_ORDER = Object.freeze([ROUTINE_TIME.MORNING, ROUTINE_TIME.AFTERNOON, ROUTINE_TIME.EVENING, ROUTINE_TIME.ANYTIME]);

const STANDARD_TIME_MINUTES = Object.freeze({
  [ROUTINE_TIME.MORNING]: 8 * 60,
  [ROUTINE_TIME.AFTERNOON]: 14 * 60,
  [ROUTINE_TIME.EVENING]: 19 * 60,
  [ROUTINE_TIME.ANYTIME]: 24 * 60,
});

export function routineTasksForPlan(plan) {
  return Array.isArray(plan?.routineTasks) ? plan.routineTasks : [];
}

export function encodeRoutineTimes(times = []) {
  const unique = [...new Set(times.filter(Boolean))];
  if (!unique.length || unique.includes(ROUTINE_TIME.ANYTIME)) return ROUTINE_TIME.ANYTIME;
  return `multi:${JSON.stringify(unique)}`;
}

export function routineTimesForTask(task) {
  if (Array.isArray(task?.times) && task.times.length) return task.times;
  const stored = task?.timeOfDay || ROUTINE_TIME.ANYTIME;
  if (typeof stored === "string" && stored.startsWith("multi:")) {
    try {
      const parsed = JSON.parse(stored.slice(6));
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      return [ROUTINE_TIME.ANYTIME];
    }
  }
  return [stored];
}

export function routineTimeLabel(value) {
  if (/^\d{2}:\d{2}$/.test(value || "")) return value;
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : "Anytime";
}

export function routineTimeMinutes(value) {
  if (/^\d{2}:\d{2}$/.test(value || "")) {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  }
  return STANDARD_TIME_MINUTES[value] ?? STANDARD_TIME_MINUTES[ROUTINE_TIME.ANYTIME];
}

export function createRoutineTask({ id, name = "", notes = "", days = [], timeOfDay = ROUTINE_TIME.ANYTIME, times, sortOrder = 0, createdAt = null, updatedAt = null } = {}) {
  return { id, name, notes, days, timeOfDay: times ? encodeRoutineTimes(times) : timeOfDay, sortOrder, createdAt, updatedAt };
}

export function scheduledRoutineTasks(plan, date) {
  const day = WEEKDAYS[date.getDay()];
  return routineTasksForPlan(plan)
    .filter((task) => Array.isArray(task.days) && task.days.includes(day))
    .flatMap((task) => routineTimesForTask(task).map((time) => ({
      ...task,
      baseTaskId: task.id,
      occurrenceTimeKey: time,
      timeOfDay: time,
      timeLabel: routineTimeLabel(time),
    })))
    .sort((a, b) => routineTimeMinutes(a.occurrenceTimeKey) - routineTimeMinutes(b.occurrenceTimeKey) || Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

export function occurrenceId(programmeId, scheduledDate, taskId, occurrenceTimeKey = "") {
  return `${programmeId}_${scheduledDate}_${taskId}${occurrenceTimeKey ? `_${occurrenceTimeKey.replace(":", "-")}` : ""}`;
}

export function mergeRoutineOccurrences(tasks, occurrences = []) {
  const byTask = new Map(occurrences.map((item) => [`${item.taskId}_${item.occurrenceTimeKey || ""}`, item]));
  return tasks.map((task) => {
    const occurrence = byTask.get(`${task.baseTaskId || task.id}_${task.occurrenceTimeKey || ""}`);
    return { ...task, status: occurrence?.status || ROUTINE_STATUS.PENDING, occurrence: occurrence || null };
  });
}
