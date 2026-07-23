function text(element) {
  return (element?.textContent || "").trim();
}

function selectorInSession(session) {
  if (!session) return null;
  const heading = [...session.querySelectorAll("strong")]
    .find((item) => ["Exercise picker", "Exercise selector"].includes(text(item)));
  return heading?.closest(".rounded-xl.border-dashed") || null;
}

function scrollContainerFor(element) {
  let current = element?.parentElement;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    if (/(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight) return current;
    current = current.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

function alignSelectorToTop(selector) {
  if (!selector?.isConnected) return;

  const results = selector.querySelector(".overflow-y-auto");
  if (results) results.scrollTop = 0;

  const scroller = scrollContainerFor(selector);
  const selectorRect = selector.getBoundingClientRect();

  if (scroller === document.scrollingElement || scroller === document.documentElement) {
    window.scrollTo({ top: window.scrollY + selectorRect.top - 8, behavior: "auto" });
    return;
  }

  const scrollerRect = scroller.getBoundingClientRect();
  scroller.scrollTop += selectorRect.top - scrollerRect.top - 8;
}

export function installMobileExerciseSelectorScrollFix() {
  if (typeof document === "undefined") return () => {};

  const timers = new Set();
  let activeSelector = null;

  const later = (callback, delay) => {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  };

  const realignActiveSelector = () => {
    if (activeSelector?.isConnected) alignSelectorToTop(activeSelector);
  };

  const handleClick = (event) => {
    const button = event.target?.closest?.("button");
    if (!button || text(button) !== "Add exercise") return;

    const session = button.closest('[id^="programme-session-"]');
    if (!session) return;

    activeSelector = null;
    let attempts = 0;
    const waitForSelector = () => {
      const selector = selectorInSession(session);
      if (!selector) {
        attempts += 1;
        if (attempts < 40) later(waitForSelector, 25);
        return;
      }

      activeSelector = selector;
      [0, 60, 140, 260, 450, 700, 1000].forEach((delay) => later(realignActiveSelector, delay));
    };

    requestAnimationFrame(waitForSelector);
  };

  document.addEventListener("click", handleClick, true);
  window.visualViewport?.addEventListener("resize", realignActiveSelector);
  window.visualViewport?.addEventListener("scroll", realignActiveSelector);

  return () => {
    document.removeEventListener("click", handleClick, true);
    window.visualViewport?.removeEventListener("resize", realignActiveSelector);
    window.visualViewport?.removeEventListener("scroll", realignActiveSelector);
    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();
    activeSelector = null;
  };
}
