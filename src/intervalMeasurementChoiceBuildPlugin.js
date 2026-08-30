function transformWorkoutScreen(code) {
  const oldText = `<WorkoutEditField label={isDistance ? "Distance" : "Duration"}><WorkoutEditInput inputMode="decimal" value={value || ""} onChange={(event) => { const numeric = Number(event.target.value); onStageChange(isDistance ? { ...stage, distance: numeric } : { ...stage, durationSeconds: numeric * (unit === "minutes" ? 60 : 1) }); }}/></WorkoutEditField><WorkoutEditField label="Unit"><WorkoutEditSelect value={(isDistance ? "distance:" : "time:") + unit} onChange={(event) => { const [kind, nextUnit] = event.target.value.split(":"); onStageChange(kind === "distance" ? { ...stage, distance: stage.distance ?? 0, distanceUnit: nextUnit, durationSeconds: undefined, durationUnit: undefined } : { ...stage, durationSeconds: stage.durationSeconds ?? 0, durationUnit: nextUnit, distance: undefined, distanceUnit: undefined }); }}><option value="time:seconds">Seconds</option><option value="time:minutes">Minutes</option><option value="distance:m">Metres</option><option value="distance:km">Kilometres</option></WorkoutEditSelect></WorkoutEditField>`;

  const newText = `<WorkoutEditField label="Measure by"><WorkoutEditSelect value={isDistance ? "distance" : "time"} onChange={(event) => onStageChange(event.target.value === "distance" ? { ...stage, distance: 0, distanceUnit: "m", durationSeconds: undefined, durationUnit: undefined } : { ...stage, durationSeconds: 0, durationUnit: "seconds", distance: undefined, distanceUnit: undefined })}><option value="time">Time</option><option value="distance">Distance</option></WorkoutEditSelect></WorkoutEditField><WorkoutEditField label={isDistance ? "Distance" : "Duration"}><WorkoutEditInput inputMode="decimal" value={value || ""} onChange={(event) => { const numeric = Number(event.target.value); onStageChange(isDistance ? { ...stage, distance: numeric, distanceUnit: unit } : { ...stage, durationSeconds: numeric * (unit === "minutes" ? 60 : 1), durationUnit: unit }); }}/></WorkoutEditField><WorkoutEditField label="Unit">{isDistance ? <WorkoutEditSelect value={unit} onChange={(event) => { const nextUnit = event.target.value; const currentDistance = Number(stage.distance ?? 0); const convertedDistance = unit !== nextUnit ? nextUnit === "km" ? currentDistance / 1000 : currentDistance * 1000 : currentDistance; onStageChange({ ...stage, distance: convertedDistance, distanceUnit: nextUnit }); }}><option value="m">Metres</option><option value="km">Kilometres</option></WorkoutEditSelect> : <WorkoutEditSelect value={unit} onChange={(event) => onStageChange({ ...stage, durationSeconds: stage.durationSeconds ?? 0, durationUnit: event.target.value })}><option value="seconds">Seconds</option><option value="minutes">Minutes</option></WorkoutEditSelect>}</WorkoutEditField>`;

  return code.includes(oldText) ? code.replace(oldText, newText) : code;
}

export function intervalMeasurementChoiceBuildPlugin() {
  return {
    name: 'interval-measurement-choice',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/');
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code);
      return null;
    },
  };
}
