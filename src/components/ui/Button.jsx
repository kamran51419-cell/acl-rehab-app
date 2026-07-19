import React, { useEffect, useRef } from "react";

function classes(...parts) {
  return parts.filter(Boolean).join(" ");
}

export default function Button({ variant = "primary", size = "md", className = "", children, onClick, ...props }) {
  const destructive = variant === "danger" || variant === "destructive";
  const opened = useRef(false);
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
        "inline-flex items-center justify-center rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" ? "px-3 py-2 text-xs" : "px-4 py-2 text-sm",
        variant === "primary" && "bg-slate-900 text-white hover:bg-slate-800",
        variant === "outline" && "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        destructive && "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
