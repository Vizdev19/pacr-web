"use client";

import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";
import type { ButtonSize, ButtonVariant } from "./Button";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: IconName;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  round?: boolean;
  dot?: boolean;
}

export function IconButton({ icon, label, variant = "ghost", size = "md", round = false, dot = false, className = "", style, ...rest }: IconButtonProps) {
  const cls = ["pc-btn", "pc-btn--" + variant, size !== "md" ? "pc-btn--" + size : "", "pc-iconbtn", round ? "pc-btn--round" : "", className].filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} aria-label={label} title={label} style={{ position: "relative", ...style }} {...rest}>
      <Icon name={icon} size={size === "sm" ? 16 : size === "lg" ? 20 : 18} />
      {dot ? <span className="pc-iconbtn__dot" /> : null}
    </button>
  );
}
