function text(element) {
  return (element?.textContent || "").trim();
}

function selectorInSession(session) {
  if (!session) return null;
  const heading = [...session.querySelectorAll("strong")]
    .find((item) => ["Exercise picker", "Exercise selector"].includes(text(item)));
  return heading?.closest(".rounded-xl.border-dashed") || null;
}

function alignSelectorToTop(selector) {
  if (!selector?.isConnected) return;
  const results = selector.querySelector(".overflow-y-auto");
  if (results) results.scrollTop = 0;
  selector.scrollIntoView({ behavior: "auto", block: "start", inline: "nearest" });
}

export function installMobileExerciseSelectorScrollFix() {
  if (typeof document === "undefined") return () => {};

  const timers = new Set();
  const later = (callback, delay) => {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  };

  const handleClick = (event) => {
    const button = event.target?.closest?.("button");
    if (!button || text(button) !== "Add exercise") return;

    const session = button.closest('[id^="programme-session-"]');
    if (!session) return;

    let attempts = 0;
    const waitForSelector = () => {
      const selector = selectorInSession(session);
      if (!selector) {
        attempts += 1;
        if (attempts < 40) later(waitForSelector, 25);
        return;
      }

      alignSelectorToTop(selector);
      later(() => alignSelectorToTop(selector), 80);
      later(() => alignSelectorToTop(selector), 180);
      later(() => alignSelectorToTop(selector), 350);
    };

    requestAnimationFrame(waitForSelector);
  };

  document.addEventListener("click", handleClick, true);
  return () => {
    document.removeEventListener("click", handleClick, true);
    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();
  };
}
