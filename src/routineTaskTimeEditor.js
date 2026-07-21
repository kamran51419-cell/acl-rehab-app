const STANDARD = ["anytime", "morning", "afternoon", "evening"];
const WEEKDAY_DISPLAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function parseState(value) {
  if (typeof value === "string" && value.startsWith("multi:")) {
    try {
      const parsed = JSON.parse(value.slice(6));
      if (Array.isArray(parsed) && parsed.length) {
        return {
          selected: parsed,
          customTimes: parsed.filter((item) => !STANDARD.includes(item)),
        };
      }
      if (parsed && typeof parsed === "object") {
        const selected = Array.isArray(parsed.selected) && parsed.selected.length ? parsed.selected : ["anytime"];
        const customTimes = Array.isArray(parsed.customTimes)
          ? parsed.customTimes.filter((item) => /^\d{2}:\d{2}$/.test(item))
          : selected.filter((item) => !STANDARD.includes(item));
        return { selected, customTimes: [...new Set(customTimes)] };
      }
    } catch {
      return { selected: ["anytime"], customTimes: [] };
    }
  }
  const selected = [value || "anytime"];
  return { selected, customTimes: selected.filter((item) => !STANDARD.includes(item)) };
}

function encodeState(selected, customTimes) {
  const uniqueSelected = [...new Set(selected.filter(Boolean))];
  const uniqueCustomTimes = [...new Set(customTimes.filter((item) => /^\d{2}:\d{2}$/.test(item)))];
  const normalisedSelected = !uniqueSelected.length || uniqueSelected.includes("anytime") ? ["anytime"] : uniqueSelected;
  if (normalisedSelected.length === 1 && normalisedSelected[0] === "anytime" && !uniqueCustomTimes.length) return "anytime";
  return `multi:${JSON.stringify({ selected: normalisedSelected, customTimes: uniqueCustomTimes })}`;
}

function labelFor(value) {
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function commit(select, selected, customTimes) {
  const value = encodeState(selected, customTimes);
  if (![...select.options].some((option) => option.value === value)) {
    select.add(new Option(value, value));
  }
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function choiceButton(text, selected, onClick) {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = `${selected ? "✓ " : ""}${text}`;
  element.className = `min-h-10 rounded-lg border px-3 py-2 text-sm font-medium ${selected ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700"}`;
  element.addEventListener("click", onClick);
  return element;
}

function customTimeBox(time, selected, onToggle, onDelete) {
  const wrapper = document.createElement("div");
  wrapper.className = `inline-flex min-h-10 items-stretch overflow-hidden rounded-lg border ${selected ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = `px-3 py-2 text-sm font-medium ${selected ? "text-emerald-800" : "text-slate-700"}`;
  toggle.textContent = `${selected ? "✓ " : ""}${time}`;
  toggle.addEventListener("click", onToggle);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = `border-l px-2.5 text-base ${selected ? "border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-500"}`;
  remove.textContent = "×";
  remove.setAttribute("aria-label", `Delete ${time}`);
  remove.addEventListener("click", onDelete);

  wrapper.append(toggle, remove);
  return wrapper;
}

function renderEditor(select, host) {
  const { selected, customTimes } = parseState(select.value);
  host.replaceChildren();

  const options = document.createElement("div");
  options.className = "flex flex-wrap gap-2";

  STANDARD.forEach((value) => {
    const isSelected = selected.includes(value);
    options.appendChild(choiceButton(labelFor(value), isSelected, () => {
      if (value === "anytime") {
        commit(select, ["anytime"], customTimes);
        return;
      }
      const withoutAnytime = selected.filter((item) => item !== "anytime");
      const next = isSelected ? withoutAnytime.filter((item) => item !== value) : [...withoutAnytime, value];
      commit(select, next.length ? next : ["anytime"], customTimes);
    }));
  });

  customTimes.sort().forEach((time) => {
    const isSelected = selected.includes(time);
    options.appendChild(customTimeBox(
      time,
      isSelected,
      () => {
        const withoutAnytime = selected.filter((item) => item !== "anytime");
        const next = isSelected ? withoutAnytime.filter((item) => item !== time) : [...withoutAnytime, time];
        commit(select, next.length ? next : ["anytime"], customTimes);
      },
      () => {
        const nextCustomTimes = customTimes.filter((item) => item !== time);
        const nextSelected = selected.filter((item) => item !== time);
        commit(select, nextSelected.length ? nextSelected : ["anytime"], nextCustomTimes);
      },
    ));
  });

  const addCustom = document.createElement("button");
  addCustom.type = "button";
  addCustom.textContent = "+ Custom";
  addCustom.className = "min-h-10 rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800";
  addCustom.addEventListener("click", () => {
    if (host.querySelector("input[type='time']")) return;
    const row = document.createElement("div");
    row.className = "mt-2 flex items-center gap-2";
    const input = document.createElement("input");
    input.type = "time";
    input.className = "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm";
    const add = choiceButton("Add", false, () => {
      if (!input.value) return;
      const nextCustomTimes = [...new Set([...customTimes, input.value])];
      const withoutAnytime = selected.filter((item) => item !== "anytime");
      commit(select, [...withoutAnytime, input.value], nextCustomTimes);
    });
    row.append(input, add);
    host.appendChild(row);
    input.focus();
  });
  options.appendChild(addCustom);
  host.appendChild(options);
}

function enhanceSelect(select) {
  if (select.dataset.multiRoutineTime === "true") return;
  const field = select.closest("label, div");
  const labelText = field?.textContent || "";
  if (!labelText.trim().startsWith("Time of day")) return;
  select.dataset.multiRoutineTime = "true";
  select.classList.add("hidden");
  const host = document.createElement("div");
  host.dataset.routineTimeEditor = "true";
  host.className = "mt-1";
  select.insertAdjacentElement("afterend", host);
  renderEditor(select, host);
  select.addEventListener("change", () => requestAnimationFrame(() => renderEditor(select, host)));
}

function orderRoutineWeekdaysMondayFirst() {
  document.querySelectorAll("fieldset").forEach((fieldset) => {
    const legend = fieldset.querySelector(":scope > legend");
    if (legend?.textContent?.trim() !== "Days") return;

    const labels = [...fieldset.querySelectorAll(":scope > div > label")];
    if (labels.length !== 7) return;

    const byDay = new Map(labels.map((label) => [label.textContent.trim().slice(0, 3).toLowerCase(), label]));
    if (!WEEKDAY_DISPLAY_ORDER.every((day) => byDay.has(day))) return;

    const container = labels[0].parentElement;
    if (!container || container.dataset.weekdaysMondayFirst === "true") return;

    WEEKDAY_DISPLAY_ORDER.forEach((day) => container.appendChild(byDay.get(day)));
    container.dataset.weekdaysMondayFirst = "true";
  });
}

function formatEncodedSummaries() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    if (walker.currentNode.nodeValue?.includes("multi:")) nodes.push(walker.currentNode);
  }
  nodes.forEach((node) => {
    node.nodeValue = node.nodeValue.replace(/multi:(\{[^}]*\}|\[[^\]]*\])/g, (_, json) => {
      try {
        const parsed = JSON.parse(json);
        const values = Array.isArray(parsed) ? parsed : parsed.selected;
        return Array.isArray(values) ? values.map(labelFor).join(", ") : "Anytime";
      } catch {
        return "Anytime";
      }
    });
  });
}

function enhance() {
  document.querySelectorAll("select").forEach(enhanceSelect);
  orderRoutineWeekdaysMondayFirst();
  formatEncodedSummaries();
}

export function installRoutineTaskTimeEditor() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};
  enhance();
  const observer = new MutationObserver(() => requestAnimationFrame(enhance));
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
