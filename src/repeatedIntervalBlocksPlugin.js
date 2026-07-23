function replaceOnce(code, oldText, newText, id) {
  if (!code.includes(oldText)) {
    throw new Error(`Repeated interval blocks transform could not find expected source in ${id}`)
  }
  return code.replace(oldText, newText)
}

function transformPlans(code, id) {
  let next = code

  next = replaceOnce(
    next,
    `  if (method === EXERCISE_LOGGING_METHOD.INTERVALS) {
    const stages = asArray(exercise.prescription?.stages);
    if (!stages.length) errors.push(\`${'${path}'} intervals must include at least one stage.\`);
    pushDuplicateErrors(stages, \`${'${path}'}.stages\`, errors);
    stages.forEach((stage, index) => {
      if (![INTERVAL_PHASE.WORK, INTERVAL_PHASE.REST].includes(stage.phase)) errors.push(\`${'${path}'}.stages[${'${index}'}] has an invalid phase.\`);
      if (!positiveInt(stage.durationSeconds)) errors.push(\`${'${path}'}.stages[${'${index}'}] must have a positive duration.\`);
    });
  } else if (method === EXERCISE_LOGGING_METHOD.DISTANCE) {`,
    `  if (method === EXERCISE_LOGGING_METHOD.INTERVALS) {
    const repeatedGroups = asArray(exercise.prescription?.repeatedGroups);
    if (exercise.prescription?.intervalFormat === "repeated") {
      if (!repeatedGroups.length) errors.push(\`${'${path}'} repeated intervals must include at least one block.\`);
      pushDuplicateErrors(repeatedGroups, \`${'${path}'}.repeatedGroups\`, errors);
      repeatedGroups.forEach((group, groupIndex) => {
        const groupPath = \`${'${path}'}.repeatedGroups[${'${groupIndex}'}]\`;
        if (!positiveInt(group.repeatCount)) errors.push(\`${'${groupPath}'} must repeat at least once.\`);
        const groupStages = asArray(group.stages);
        if (!groupStages.length) errors.push(\`${'${groupPath}'} must include at least one interval.\`);
        pushDuplicateErrors(groupStages, \`${'${groupPath}'}.stages\`, errors);
        groupStages.forEach((stage, stageIndex) => {
          if (![INTERVAL_PHASE.WORK, INTERVAL_PHASE.REST].includes(stage.phase)) errors.push(\`${'${groupPath}'}.stages[${'${stageIndex}'}] has an invalid phase.\`);
          if (!positiveInt(stage.durationSeconds)) errors.push(\`${'${groupPath}'}.stages[${'${stageIndex}'}] must have a positive duration.\`);
        });
      });
    } else {
      const stages = asArray(exercise.prescription?.stages);
      if (!stages.length) errors.push(\`${'${path}'} intervals must include at least one stage.\`);
      pushDuplicateErrors(stages, \`${'${path}'}.stages\`, errors);
      stages.forEach((stage, index) => {
        if (![INTERVAL_PHASE.WORK, INTERVAL_PHASE.REST].includes(stage.phase)) errors.push(\`${'${path}'}.stages[${'${index}'}] has an invalid phase.\`);
        if (!positiveInt(stage.durationSeconds)) errors.push(\`${'${path}'}.stages[${'${index}'}] must have a positive duration.\`);
      });
    }
  } else if (method === EXERCISE_LOGGING_METHOD.DISTANCE) {`,
    id,
  )

  next = next.replaceAll(
    'if (exercise.loggingMethod === EXERCISE_LOGGING_METHOD.INTERVALS) return `${asArray(exercise.prescription?.stages).length} intervals`;',
    'if (exercise.loggingMethod === EXERCISE_LOGGING_METHOD.INTERVALS) return exercise.prescription?.intervalFormat === "repeated" ? `${asArray(exercise.prescription?.repeatedGroups).length} interval blocks` : `${asArray(exercise.prescription?.stages).length} intervals`;',
  )

  return next
}

function transformPlansScreen(code, id) {
  return replaceOnce(
    code,
    `  if (selectedMethod === EXERCISE_LOGGING_METHOD.INTERVALS) {
    const p = exercise.prescription || {};
    const stages = p.stages || [];
    const updateStages = (next) => updatePrescription({ ...p, stages: next.map((stage, index) => ({ ...stage, sortOrder: index })) });
    return (
      <div className="space-y-3">
        <div className="max-w-xs">{methodField}</div>
        {stages.map((stage, index) => (
          <div key={stage.id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="grid gap-2 md:grid-cols-[140px_1fr_1fr]">
              <Field label="Stage">
                <Select value={stage.phase} onChange={(event) => updateStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, phase: event.target.value } : item))}>
                  <option value={INTERVAL_PHASE.WORK}>Work</option>
                  <option value={INTERVAL_PHASE.REST}>Rest</option>
                </Select>
              </Field>
              <DurationInput
                seconds={stage.durationSeconds}
                durationUnit={stage.durationUnit}
                onChange={({ seconds, unit }) => updateStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, durationSeconds: seconds, durationUnit: unit } : item))}
              />
              <Field label="Label (optional)"><Input value={stage.label || ""} onChange={(event) => updateStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} /></Field>
            </div>
            <Button size="sm" variant="danger" onClick={() => updateStages(stages.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => updateStages([...stages, createIntervalStage({ phase: INTERVAL_PHASE.WORK, durationSeconds: 0, durationUnit: "seconds", sortOrder: stages.length })])}>Add work</Button>
          <Button variant="outline" onClick={() => updateStages([...stages, createIntervalStage({ phase: INTERVAL_PHASE.REST, durationSeconds: 0, durationUnit: "seconds", sortOrder: stages.length })])}>Add rest</Button>
        </div>
      </div>
    );
  }`,
    `  if (selectedMethod === EXERCISE_LOGGING_METHOD.INTERVALS) {
    const p = exercise.prescription || {};
    const intervalFormat = p.intervalFormat || "individual";
    const stages = p.stages || [];
    const repeatedGroups = p.repeatedGroups || [];
    const updateStages = (next) => updatePrescription({ ...p, intervalFormat: "individual", stages: next.map((stage, index) => ({ ...stage, sortOrder: index })) });
    const updateGroups = (next) => updatePrescription({ ...p, intervalFormat: "repeated", repeatedGroups: next.map((group, index) => ({ ...group, sortOrder: index, stages: (group.stages || []).map((stage, stageIndex) => ({ ...stage, sortOrder: stageIndex })) })) });
    const changeFormat = (format) => {
      if (format === "repeated") {
        const firstStages = stages.length ? stages : [
          createIntervalStage({ phase: INTERVAL_PHASE.WORK, durationSeconds: 30, durationUnit: "seconds", sortOrder: 0 }),
          createIntervalStage({ phase: INTERVAL_PHASE.REST, durationSeconds: 30, durationUnit: "seconds", sortOrder: 1 }),
        ];
        updatePrescription({ ...p, intervalFormat: "repeated", repeatedGroups: repeatedGroups.length ? repeatedGroups : [{ id: \`interval-group-${'${makeId()}'}\`, repeatCount: 5, sortOrder: 0, stages: firstStages }] });
      } else {
        updatePrescription({ ...p, intervalFormat: "individual", stages: stages.length ? stages : [
          createIntervalStage({ phase: INTERVAL_PHASE.WORK, durationSeconds: 30, durationUnit: "seconds", sortOrder: 0 }),
          createIntervalStage({ phase: INTERVAL_PHASE.REST, durationSeconds: 30, durationUnit: "seconds", sortOrder: 1 }),
        ] });
      }
    };
    const updateGroup = (groupIndex, patch) => updateGroups(repeatedGroups.map((group, index) => index === groupIndex ? { ...group, ...patch } : group));
    const updateGroupStages = (groupIndex, nextStages) => updateGroup(groupIndex, { stages: nextStages });
    return (
      <div className="space-y-3">
        <div className="max-w-xs">{methodField}</div>
        <Field label="Interval format">
          <Select value={intervalFormat} onChange={(event) => changeFormat(event.target.value)}>
            <option value="individual">Individual intervals</option>
            <option value="repeated">Repeated blocks</option>
          </Select>
        </Field>
        {intervalFormat === "individual" ? <>
          {stages.map((stage, index) => (
            <div key={stage.id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="grid gap-2 md:grid-cols-[140px_1fr_1fr]">
                <Field label="Stage">
                  <Select value={stage.phase} onChange={(event) => updateStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, phase: event.target.value } : item))}>
                    <option value={INTERVAL_PHASE.WORK}>Work</option>
                    <option value={INTERVAL_PHASE.REST}>Rest</option>
                  </Select>
                </Field>
                <DurationInput seconds={stage.durationSeconds} durationUnit={stage.durationUnit} onChange={({ seconds, unit }) => updateStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, durationSeconds: seconds, durationUnit: unit } : item))} />
                <Field label="Label (optional)"><Input value={stage.label || ""} onChange={(event) => updateStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} /></Field>
              </div>
              <Button size="sm" variant="danger" onClick={() => updateStages(stages.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => updateStages([...stages, createIntervalStage({ phase: INTERVAL_PHASE.WORK, durationSeconds: 0, durationUnit: "seconds", sortOrder: stages.length })])}>Add work</Button>
            <Button variant="outline" onClick={() => updateStages([...stages, createIntervalStage({ phase: INTERVAL_PHASE.REST, durationSeconds: 0, durationUnit: "seconds", sortOrder: stages.length })])}>Add rest</Button>
          </div>
        </> : <>
          {repeatedGroups.map((group, groupIndex) => (
            <div key={group.id} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <Field label="Repeat"><Input inputMode="numeric" value={group.repeatCount || ""} onChange={(event) => updateGroup(groupIndex, { repeatCount: Number(event.target.value) })} /></Field>
                <Button size="sm" variant="danger" onClick={() => updateGroups(repeatedGroups.filter((_, index) => index !== groupIndex))}>Remove block</Button>
              </div>
              {(group.stages || []).map((stage, stageIndex) => (
                <div key={stage.id} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[140px_1fr_1fr_auto]">
                  <Field label="Stage"><Select value={stage.phase} onChange={(event) => updateGroupStages(groupIndex, group.stages.map((item, index) => index === stageIndex ? { ...item, phase: event.target.value } : item))}><option value={INTERVAL_PHASE.WORK}>Work</option><option value={INTERVAL_PHASE.REST}>Rest</option></Select></Field>
                  <DurationInput seconds={stage.durationSeconds} durationUnit={stage.durationUnit} onChange={({ seconds, unit }) => updateGroupStages(groupIndex, group.stages.map((item, index) => index === stageIndex ? { ...item, durationSeconds: seconds, durationUnit: unit } : item))} />
                  <Field label="Label (optional)"><Input value={stage.label || ""} onChange={(event) => updateGroupStages(groupIndex, group.stages.map((item, index) => index === stageIndex ? { ...item, label: event.target.value } : item))} /></Field>
                  <Button size="sm" variant="danger" onClick={() => updateGroupStages(groupIndex, group.stages.filter((_, index) => index !== stageIndex))}>Remove</Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => updateGroupStages(groupIndex, [...(group.stages || []), createIntervalStage({ phase: INTERVAL_PHASE.WORK, durationSeconds: 0, durationUnit: "seconds", sortOrder: group.stages?.length || 0 })])}>Add work</Button>
                <Button size="sm" variant="outline" onClick={() => updateGroupStages(groupIndex, [...(group.stages || []), createIntervalStage({ phase: INTERVAL_PHASE.REST, durationSeconds: 0, durationUnit: "seconds", sortOrder: group.stages?.length || 0 })])}>Add rest</Button>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => updateGroups([...repeatedGroups, { id: \`interval-group-${'${makeId()}'}\`, repeatCount: 5, sortOrder: repeatedGroups.length, stages: [createIntervalStage({ phase: INTERVAL_PHASE.WORK, durationSeconds: 30, durationUnit: "seconds", sortOrder: 0 }), createIntervalStage({ phase: INTERVAL_PHASE.REST, durationSeconds: 30, durationUnit: "seconds", sortOrder: 1 })] }])}>Add repeated block</Button>
            <Button variant="outline" onClick={() => updateGroups([...repeatedGroups, { id: \`interval-group-${'${makeId()}'}\`, repeatCount: 1, sortOrder: repeatedGroups.length, stages: [createIntervalStage({ phase: INTERVAL_PHASE.WORK, durationSeconds: 60, durationUnit: "seconds", sortOrder: 0 })] }])}>Add single interval</Button>
          </div>
        </>}
      </div>
    );
  }`,
    id,
  )
}

export function repeatedIntervalBlocksPlugin() {
  return {
    name: 'repeated-interval-blocks',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\', '/')
      if (cleanId.endsWith('/src/lib/domain/plans.js')) return transformPlans(code, id)
      if (cleanId.endsWith('/src/features/plans/PlansScreen.jsx')) return transformPlansScreen(code, id)
      return null
    },
  }
}
