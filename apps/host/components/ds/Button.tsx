"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "pop" | "on-dark";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  block?: boolean;
  children?: ReactNode;
}

export function Button({ variant = "primary", size = "md", icon, iconRight, loading = false, block = false, disabled, className = "", children, type = "button", ...rest }: ButtonProps) {
  const cls = ["pc-btn", "pc-btn--" + variant, size !== "md" ? "pc-btn--" + size : "", block ? "pc-btn--block" : "", className].filter(Boolean).join(" ");
  const is = size === "sm" ? 15 : size === "lg" ? 19 : 17;
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="pc-spinner" /> : icon ? <Icon name={icon} size={is} /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={is} /> : null}
    </button>
  );
}
