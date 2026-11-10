"use client";

import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { Button, type ButtonVariant } from "./Button";

export type EmptyStateVariant = "empty" | "error" | "locked" | "done";

const ICON: Record<EmptyStateVariant, IconName> = { empty: "inbox", error: "wifi-off", locked: "lock", done: "check" };

export interface EmptyStateAction {
  label: ReactNode;
  icon?: IconName;
  variant?: ButtonVariant;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  icon?: IconName;
  title?: ReactNode;
  message?: ReactNode;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  boxed?: boolean;
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function EmptyState({ variant = "empty", icon, title, message, action, secondaryAction, boxed = true, compact = false, className = "", style }: EmptyStateProps) {
  const cls = "pc-empty pc-empty--" + variant + (boxed && variant !== "locked" ? " pc-empty--boxed" : "") + (compact ? " pc-empty--compact" : "") + (className ? " " + className : "");
  return (
    <div className={cls} style={style} role={variant === "error" ? "alert" : undefined}>
      <span className="pc-empty__icon"><Icon name={icon || ICON[variant]} size={20} /></span>
      {title ? <div className="pc-empty__title">{title}</div> : null}
      {message ? <div className="pc-empty__msg">{message}</div> : null}
      {action || secondaryAction ? (
        <div className="pc-empty__acts">
          {secondaryAction ? <Button size="sm" variant="secondary" icon={secondaryAction.icon} onClick={secondaryAction.onClick}>{secondaryAction.label}</Button> : null}
          {action ? <Button size="sm" variant={action.variant || "primary"} icon={action.icon || (variant === "error" ? "rotate-cw" : undefined)} onClick={action.onClick}>{action.label}</Button> : null}
        </div>
      ) : null}
    </div>
  );
}
