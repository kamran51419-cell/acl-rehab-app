import { completedWorkoutHistory } from "./workoutDisplay.js";

export const REHAB_AGE_MODES = Object.freeze(["months", "weeks", "days", "date"]);

export function nextRehabAgeMode(mode) {
  const index = REHAB_AGE_MODES.indexOf(mode);
  return REHAB_AGE_MODES[(index + 1) % REHAB_AGE_MODES.length];
}

export function readRehabAgeMode(storage, key) {
  const saved = storage?.getItem(key);
  return REHAB_AGE_MODES.includes(saved) ? saved : "months";
}

export function persistRehabAgeMode(storage, key, mode) {
  if (REHAB_AGE_MODES.includes(mode)) storage?.setItem(key, mode);
  return mode;
}

function dayDifference(date, today) {
  if (!date) return null;
  const start = new Date(`${date}T00:00:00Z`);
  const end = new Date(`${today}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.floor((end - start) / 86400000));
}

export function longDate(date) {
  if (!date) return "";
  const value = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(value.getTime())) return date;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(value);
}

export function rehabAgeLabel(surgeryDate, mode, today) {
  const days = dayDifference(surgeryDate, today);
  if (days === null) return "";
  if (mode === "date") return longDate(surgeryDate);
  if (mode === "weeks") return `${Math.floor(days / 7)} weeks post-op`;
  if (mode === "days") return `${days} days post-op`;
  const start = new Date(`${surgeryDate}T00:00:00Z`);
  const end = new Date(`${today}T00:00:00Z`);
  const months = Math.max(0, (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth() - (end.getUTCDate() < start.getUTCDate() ? 1 : 0));
  return `${months} months post-op`;
}

export function latestCompletedWorkout(workouts = []) {
  return completedWorkoutHistory(workouts)[0] || null;
}
