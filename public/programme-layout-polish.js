(() => {
  function buttonText(button) {
    return button?.textContent?.replace(/\s+/g, " ").trim() || "";
  }

  function polishProgramme() {
    const heading = [...document.querySelectorAll("h2")].find((item) => {
      const text = item.textContent?.trim();
      return text === "Edit programme" || text === "Create programme";
    });
    const editor = heading?.closest("div.rounded-3xl") || heading?.parentElement?.parentElement;
    if (!editor) return;

    const mobile = window.matchMedia("(max-width: 639px)").matches;

    [...editor.querySelectorAll("button")]
      .filter((button) => buttonText(button) === "Change exercise")
      .forEach((changeButton) => {
        const card = changeButton.closest("div.rounded-xl.border.bg-white");
        const actions = changeButton.parentElement;
        const header = actions?.parentElement;
        if (!card || !actions || !header) return;

        const reactDisclosure = [...card.querySelectorAll("button[aria-expanded]")]
          .find((button) => !button.hasAttribute("data-collapse-exercise"));
        const legacyDisclosure = card.querySelector("button[data-collapse-exercise]");
        if (reactDisclosure && legacyDisclosure) legacyDisclosure.remove();

        if (mobile) {
          header.style.flexWrap = "wrap";
          header.style.alignItems = "center";
          actions.style.display = "grid";
          actions.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
          actions.style.width = "100%";
          actions.style.marginLeft = "0";
          actions.style.gap = "8px";
          [...actions.querySelectorAll("button")].forEach((button) => {
            button.style.width = "100%";
            button.style.justifyContent = "center";
            button.style.minHeight = "38px";
            button.style.paddingLeft = "10px";
            button.style.paddingRight = "10px";
            button.style.fontSize = "0.8rem";
          });
        } else {
          header.style.flexWrap = "";
          header.style.alignItems = "";
          actions.style.display = "flex";
          actions.style.gridTemplateColumns = "";
          actions.style.width = "";
          actions.style.marginLeft = "auto";
          actions.style.gap = "6px";
          [...actions.querySelectorAll("button")].forEach((button) => {
            button.style.width = "";
            button.style.justifyContent = "";
            button.style.minHeight = "";
          });
        }
      });
  }

  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => requestAnimationFrame(polishProgramme));
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("resize", schedule);
  document.addEventListener("DOMContentLoaded", schedule);
  schedule();
})();
