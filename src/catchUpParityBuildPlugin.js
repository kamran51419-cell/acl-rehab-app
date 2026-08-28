function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`Catch-up parity transform could not find expected source in ${id}`)
  return code.replace(oldText, newText)
}

function transformWorkoutScreen(code, id) {
  let next = code
  const oldDateClass = 'date-field-clip mt-1 block w-full max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white'
  if ((next.split(oldDateClass).length - 1) < 2) throw new Error(`Catch-up parity transform could not find both date fields in ${id}`)
  next = next.replaceAll(oldDateClass, 'date-field-clip mt-1 block w-[11.5rem] max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white')
  next = replaceRequired(
    next,
    'function AutoGrowTextarea({ className = "", onInput, style, ...props }) {\n  const ref = useRef(null);\n  const resize = useCallback(() => { const node = ref.current; if (!node) return; node.style.height = "36px"; if (String(node.value || "").includes("\\n") || node.scrollHeight > 36) node.style.height = Math.max(36, node.scrollHeight) + "px"; }, []);\n  useEffect(resize, [props.value, resize]);\n  return <textarea ref={ref} rows={1} {...props} style={{ height: 36, ...style }} onInput={(event) => { resize(); onInput?.(event); }} className={className} />;\n}',
    'function AutoGrowTextarea({ className = "", onInput, style, ...props }) {\n  const ref = useRef(null);\n  const resize = useCallback(() => { const node = ref.current; if (!node) return; node.style.height = "0px"; node.style.height = Math.max(36, node.scrollHeight) + "px"; }, []);\n  useEffect(resize, [props.value, resize]);\n  return <textarea ref={ref} rows={1} {...props} style={{ height: 36, minHeight: 36, maxHeight: 180, overflowY: "hidden", ...style }} onInput={(event) => { resize(); onInput?.(event); }} className={className} />;\n}',
    id,
  )
  return next
}

export function catchUpParityBuildPlugin() {
  return {
    name: 'catch-up-parity',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (cleanId.endsWith('/src/features/workout/WorkoutScreen.jsx')) return transformWorkoutScreen(code, id)
      return null
    },
  }
}
