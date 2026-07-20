export const ROUTINE_TIME = Object.freeze({
  MORNING: "morning",
  AFTERNOON: "afternoon",
  EVENING: "evening",
  ANYTIME: "anytime",
});

export const ROUTINE_STATUS = Object.freeze({
  PENDING: "pending",
  COMPLETED: "completed",
  SKIPPED: "skipped",
});

export const WEEKDAYS = Object.freeze(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]);
export const ROUTINE_TIME_ORDER = Object.freeze([ROUTINE_TIME.MORNING, ROUTINE_TIME.AFTERNOON, ROUTINE_TIME.EVENING, ROUTINE_TIME.ANYTIME]);

export function routineTasksForPlan(plan) {
  return Array.isArray(plan?.routineTasks) ? plan.routineTasks : [];
}

export function createRoutineTask({ id, name = "", notes = "", days = [], timeOfDay = ROUTINE_TIME.ANYTIME, sortOrder = 0, createdAt = null, updatedAt = null } = {}) {
  return { id, name, notes, days, timeOfDay, sortOrder, createdAt, updatedAt };
}

export function scheduledRoutineTasks(plan, date) {
  const day = WEEKDAYS[date.getDay()];
  return routineTasksForPlan(plan)
    .filter((task) => Array.isArray(task.days) && task.days.includes(day))
    .slice()
    .sort((a, b) => ROUTINE_TIME_ORDER.indexOf(a.timeOfDay) - ROUTINE_TIME_ORDER.indexOf(b.timeOfDay) || Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

export function occurrenceId(programmeId, scheduledDate, taskId) {
  return `${programmeId}_${scheduledDate}_${taskId}`;
}

export function mergeRoutineOccurrences(tasks, occurrences = []) {
  const byTask = new Map(occurrences.map((item) => [item.taskId, item]));
  return tasks.map((task) => ({ ...task, status: byTask.get(task.id)?.status || ROUTINE_STATUS.PENDING, occurrence: byTask.get(task.id) || null }));
}
