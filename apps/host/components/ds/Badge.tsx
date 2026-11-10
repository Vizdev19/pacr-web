"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type BadgeTone =
  | "neutral" | "success" | "warning" | "danger" | "info"
  | "lime" | "orange" | "red" | "sky" | "amber" | "yellow" | "violet" | "pink" | "green" | "magenta" | "navy" | "ink";
export type BadgeVariant = "soft" | "solid" | "outline";

const ALIAS: Record<string, string> = { success: "lime", warning: "orange", danger: "red", info: "sky" };
const DARK_TEXT: Record<string, number> = { amber: 1, lime: 1, yellow: 1, orange: 1 };

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: "md" | "lg";
  dot?: boolean;
  icon?: IconName;
  children?: ReactNode;
}

export function Badge({ tone = "neutral", variant = "soft", size = "md", dot = false, icon, className = "", style, children, ...rest }: BadgeProps) {
  const t = ALIAS[tone] || tone;
  let s: CSSProperties;
  if (t === "neutral") s = variant === "solid" ? { background: "var(--ink-700)", color: "#fff" } : variant === "outline" ? { boxShadow: "inset 0 0 0 1px var(--border-default)", color: "var(--text-body)" } : { background: "var(--surface-sunken)", color: "var(--ink-600)" };
  else if (variant === "solid") s = { background: "var(--" + t + "-500)", color: DARK_TEXT[t] ? "var(--ink-900)" : "#fff" };
  else if (variant === "outline") s = { boxShadow: "inset 0 0 0 1px var(--" + t + "-100)", color: "var(--" + t + "-700)", background: "rgba(255,255,255,.6)" };
  else s = { background: "var(--" + t + "-50)", color: "var(--" + t + "-700)" };
  return (
    <span className={"pc-badge" + (size === "lg" ? " pc-badge--lg" : "") + (className ? " " + className : "")} style={{ ...s, ...style }} {...rest}>
      {dot ? <span className="pc-badge__dot" /> : null}
      {icon ? <Icon name={icon} size={size === "lg" ? 13 : 12} strokeWidth={2.25} /> : null}
      {children}
    </span>
  );
}
