import React, { useEffect, useRef } from "react";

function classes(...parts) {
  return parts.filter(Boolean).join(" ");
}

function polishAppBranding() {
  const title = [...document.querySelectorAll("h1")].find((element) => element.textContent?.trim() === "ACL Rehab Tracker");
  if (title) title.textContent = "Gym & Rehab Tracker";
  const badge = [...document.querySelectorAll("div")].find((element) => element.textContent?.trim() === "Rehab logging dashboard" && element.children.length === 0);
  badge?.remove();
  if (document.title.includes("ACL Rehab")) document.title = document.title.replace("ACL Rehab", "Gym & Rehab");
}

let brandingObserver = null;
function ensureBrandingObserver() {
  if (typeof document === "undefined") return;
  polishAppBranding();
  if (brandingObserver || typeof MutationObserver === "undefined") return;
  brandingObserver = new MutationObserver(polishAppBranding);
  brandingObserver.observe(document.body, { childList: true, subtree: true });
}

export default function Button({ variant = "primary", size = "md", className = "", children, onClick, ...props }) {
  const destructive = variant === "danger" || variant === "destructive";
  const opened = useRef(false);

  useEffect(() => {
    ensureBrandingObserver();
  }, []);

  useEffect(() => {
    if (!opened.current && onClick && children === "Workout history") {
      opened.current = true;
      onClick();
    }
  }, [children, onClick]);

  return (
    <button
      type="button"
      className={classes(
        "inline-flex items-center justify-center rounded-xl font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" ? "min-h-9 px-3 py-2 text-xs" : "min-h-10 px-4 py-2 text-sm",
        variant === "primary" && "bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:bg-blue-800",
        variant === "secondary" && "border border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100 active:bg-blue-100",
        variant === "outline" && "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100",
        destructive && "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200",
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
