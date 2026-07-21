function reactControlledValue(select) {
  const keys = Object.keys(select);

  const propsKey = keys.find((key) => key.startsWith("__reactProps$"));
  const propsValue = propsKey ? select[propsKey]?.value : null;
  if (typeof propsValue === "string" && propsValue) return propsValue;

  const fiberKey = keys.find((key) => key.startsWith("__reactFiber$"));
  let fiber = fiberKey ? select[fiberKey] : null;
  while (fiber) {
    const value = fiber.memoizedProps?.value ?? fiber.pendingProps?.value;
    if (typeof value === "string" && value) return value;
    fiber = fiber.return;
  }

  return select.dataset.savedRoutineTimeValue || select.value || "";
}

function isRoutineTimeSelect(select) {
  const field = select.closest("label, div");
  return (field?.textContent || "").trim().startsWith("Time of day");
}

function preserveSelectValue(select) {
  if (!isRoutineTimeSelect(select)) return;

  const value = reactControlledValue(select);
  if (!value || value === "anytime" || value === "morning" || value === "afternoon" || value === "evening") return;

  select.dataset.savedRoutineTimeValue = value;

  if (![...select.options].some((option) => option.value === value)) {
    select.add(new Option(value, value));
  }

  if (select.value !== value) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
    setter?.call(select, value);
  }

  if (select.dataset.multiRoutineTime === "true") {
    select.dispatchEvent(new Event("change", { bubbles: false }));
  }
}

function enhance() {
  document.querySelectorAll("select").forEach(preserveSelectValue);
}

export function installRoutineCustomTimePersistenceFix() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};

  enhance();
  const observer = new MutationObserver(() => requestAnimationFrame(enhance));
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
