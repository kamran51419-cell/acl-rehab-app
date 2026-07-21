const STANDARD = ["anytime", "morning", "afternoon", "evening"];
const WEEKDAY_DISPLAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function parseTimes(value) {
  if (typeof value === "string" && value.startsWith("multi:")) {
    try {
      const parsed = JSON.parse(value.slice(6));
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      return ["anytime"];
    }
  }
  return [value || "anytime"];
}

function encodeTimes(times) {
  const unique = [...new Set(times.filter(Boolean))];
  if (!unique.length || unique.includes("anytime")) return "anytime";
  return `multi:${JSON.stringify(unique)}`;
}

function labelFor(value) {
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function commit(select, times) {
  const value = encodeTimes(times);
  if (![...select.options].some((option) => option.value === value)) {
    select.add(new Option(value, value));
  }
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function button(text, selected, onClick) {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = `${selected ? "✓ " : ""}${text}`;
  element.className = `min-h-10 rounded-lg border px-3 py-2 text-sm font-medium ${selected ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700"}`;
  element.addEventListener("click", onClick);
  return element;
}

function renderEditor(select, host) {
  const selected = parseTimes(select.value);
  host.replaceChildren();

  const options = document.createElement("div");
  options.className = "flex flex-wrap gap-2";
  STANDARD.forEach((value) => {
    const isSelected = selected.includes(value);
    options.appendChild(button(labelFor(value), isSelected, () => {
      if (value === "anytime") {
        commit(select, ["anytime"]);
        return;
      }
      const withoutAnytime = selected.filter((item) => item !== "anytime");
      const next = isSelected ? withoutAnytime.filter((item) => item !== value) : [...withoutAnytime, value];
      commit(select, next.length ? next : ["anytime"]);
    }));
  });

  const addCustom = button("+ Custom", false, () => {
    if (host.querySelector("input[type='time']")) return;
    const row = document.createElement("div");
    row.className = "mt-2 flex items-center gap-2";
    const input = document.createElement("input");
    input.type = "time";
    input.className = "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm";
    const add = button("Add", false, () => {
      if (!input.value) return;
      const withoutAnytime = selected.filter((item) => item !== "anytime");
      commit(select, [...withoutAnytime, input.value]);
    });
    row.append(input, add);
    host.appendChild(row);
    input.focus();
  });
  options.appendChild(addCustom);
  host.appendChild(options);

  const customTimes = selected.filter((value) => !STANDARD.includes(value));
  if (customTimes.length) {
    const customList = document.createElement("div");
    customList.className = "mt-2 flex flex-wrap gap-2";
    customTimes.sort().forEach((time) => {
      const chip = button(`${time} ×`, true, () => {
        const next = selected.filter((item) => item !== time);
        commit(select, next.length ? next : ["anytime"]);
      });
      chip.setAttribute("aria-label", `Remove ${time}`);
      customList.appendChild(chip);
    });
    host.appendChild(customList);
  }

  const hint = document.createElement("p");
  hint.className = "mt-2 text-xs text-slate-500";
  hint.textContent = selected.includes("anytime")
    ? "Anytime cannot be combined with another time."
    : "Each selected time appears as a separate task on Home.";
  host.appendChild(hint);
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
    if (walker.currentNode.nodeValue?.includes("multi:[")) nodes.push(walker.currentNode);
  }
  nodes.forEach((node) => {
    node.nodeValue = node.nodeValue.replace(/multi:(\[[^\]]*\])/g, (_, json) => {
      try {
        return JSON.parse(json).map(labelFor).join(", ");
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
