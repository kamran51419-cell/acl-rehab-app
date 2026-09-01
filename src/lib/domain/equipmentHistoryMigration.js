export const EQUIPMENT_HISTORY_MIGRATION_CUTOFF = "2026-08-28";

function baseProgrammeExerciseId(value) {
  return String(value || "").replace(/-(left|right)$/, "");
}

function workoutPlanId(workout) {
  return workout?.planId || workout?.programmeId || "";
}

function workoutDate(workout) {
  return String(workout?.date || workout?.workoutDate || "");
}

function isCompleted(workout) {
  return workout?.status === "completed" || workout?.completed === true;
}

function equipmentLabel(value) {
  return { standard: "Standard", machine: "Machine", cable: "Cable", free_weight: "Free weight" }[value || "standard"] || "Standard";
}

function migrationDefaults(plan) {
  const defaults = new Map();
  (plan?.sessions || []).forEach((session) => {
    (session.exercises || []).forEach((exercise) => {
      if (exercise?.exerciseType !== "strength" || !exercise?.id || !exercise?.exerciseId) return;
      defaults.set(`${session.id}:${exercise.id}`, {
        sessionId: session.id,
        sessionName: session.name || "Session",
        exerciseOccurrenceId: exercise.id,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseNameSnapshot || exercise.name || "Exercise",
        equipmentType: exercise.equipmentType || "standard",
      });
    });
  });
  return defaults;
}

export function buildEquipmentHistoryMigration(plan, workouts = []) {
  const defaults = migrationDefaults(plan);
  const detailCounts = new Map();
  const updatedWorkouts = [];
  let exerciseRecordsChanged = 0;
  let occurrencesChanged = 0;
  let skippedManual = 0;
  let unmatchedRecords = 0;

  (workouts || []).forEach((workout) => {
    const date = workoutDate(workout);
    if (!isCompleted(workout) || workoutPlanId(workout) !== plan?.id || !workout?.sessionId || !date || date >= EQUIPMENT_HISTORY_MIGRATION_CUTOFF) return;

    let changed = false;
    const changedOccurrences = new Set();
    const exercises = (workout.exercises || []).map((exercise) => {
      if (!exercise?.exerciseId || exercise?.exerciseType !== "strength") return exercise;
      const occurrenceId = baseProgrammeExerciseId(exercise.id);
      const info = defaults.get(`${workout.sessionId}:${occurrenceId}`);
      if (!info || String(info.exerciseId) !== String(exercise.exerciseId)) {
        unmatchedRecords += 1;
        return exercise;
      }
      if (exercise.equipmentSource === "manual") {
        skippedManual += 1;
        return exercise;
      }

      const targetType = info.equipmentType || "standard";
      const currentType = exercise.equipmentType || "standard";
      if (targetType === "standard" && currentType === "standard") return exercise;

      changed = true;
      exerciseRecordsChanged += 1;
      changedOccurrences.add(occurrenceId);
      const detailKey = `${workout.sessionId}:${occurrenceId}:${targetType}`;
      if (!detailCounts.has(detailKey)) detailCounts.set(detailKey, { ...info, equipmentLabel: equipmentLabel(targetType), occurrences: new Set() });
      detailCounts.get(detailKey).occurrences.add(`${workout.id}:${occurrenceId}`);
      return { ...exercise, equipmentType: targetType, equipmentSource: "manual" };
    });

    if (changed) {
      occurrencesChanged += changedOccurrences.size;
      updatedWorkouts.push({ id: workout.id, exercises });
    }
  });

  return {
    planId: plan?.id || "",
    planName: plan?.name || "Programme",
    updatedWorkouts,
    workoutsChanged: updatedWorkouts.length,
    exerciseRecordsChanged,
    occurrencesChanged,
    skippedManual,
    unmatchedRecords,
    details: [...detailCounts.values()].map((detail) => ({
      sessionId: detail.sessionId,
      sessionName: detail.sessionName,
      exerciseOccurrenceId: detail.exerciseOccurrenceId,
      exerciseId: detail.exerciseId,
      exerciseName: detail.exerciseName,
      equipmentType: detail.equipmentType,
      equipmentLabel: detail.equipmentLabel,
      occurrences: detail.occurrences.size,
    })).sort((a, b) => a.sessionName.localeCompare(b.sessionName) || a.exerciseName.localeCompare(b.exerciseName)),
  };
}
