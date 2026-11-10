"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

const ALIAS: Record<string, string> = { success: "lime", warning: "orange", danger: "red", info: "sky" };

export type ProgressTone = "pop" | "navy" | "success" | "warning" | "danger" | "info" | "lime" | "orange" | "red" | "sky" | "amber" | "yellow" | "violet" | "pink" | "green" | "magenta" | "ink";

export interface ProgressBarProps {
  value?: number;
  max?: number;
  label?: ReactNode;
  showValue?: boolean;
  valueLabel?: ReactNode;
  tone?: ProgressTone;
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: CSSProperties;
}

export function ProgressBar({ value = 0, max = 100, label, showValue = false, valueLabel, tone = "pop", size = "md", className = "", style }: ProgressBarProps) {
  const [w, setW] = useState(0);
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  useEffect(() => { const r = requestAnimationFrame(() => setW(pct)); return () => cancelAnimationFrame(r); }, [pct]);
  const t = ALIAS[tone] || tone;
  const bg = tone === "pop" ? "var(--grad-pop)" : tone === "navy" ? "var(--navy-700)" : "var(--" + t + "-500)";
  return (
    <div className={"pc-progress" + (size !== "md" ? " pc-progress--" + size : "") + (className ? " " + className : "")} style={style}>
      {label || showValue ? (
        <div className="pc-progress__row">
          <span>{label}</span>
          {showValue ? <span className="pc-progress__val">{valueLabel || Math.round(pct) + "%"}</span> : null}
        </div>
      ) : null}
      <div className="pc-progress__track" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
        <div className="pc-progress__fill" style={{ width: w + "%", background: bg }} />
      </div>
    </div>
  );
}
