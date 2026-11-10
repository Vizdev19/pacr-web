"use client";

import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { Button, type ButtonVariant } from "./Button";
import { IconButton } from "./IconButton";

export interface ActionCardAction {
  label: ReactNode;
  icon?: IconName;
  variant?: ButtonVariant;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

export interface ActionCardProps {
  icon?: IconName;
  tone?: "neutral" | "accent" | "danger" | "warning";
  kind?: ReactNode;
  title?: ReactNode;
  reason?: ReactNode;
  children?: ReactNode;
  primary?: ActionCardAction;
  secondary?: ActionCardAction;
  onDismiss?: () => void;
  done?: boolean;
  doneLabel?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function ActionCard({ icon = "circle-alert", tone = "neutral", kind, title, reason, children, primary, secondary, onDismiss, done = false, doneLabel, className = "", style }: ActionCardProps) {
  const act = (a: ActionCardAction | undefined, v: ButtonVariant) => a ? <Button size="sm" variant={a.variant || v} icon={a.icon} onClick={a.onClick} disabled={done}>{a.label}</Button> : null;
  return (
    <div className={"pc-action" + (done ? " is-done" : "") + (className ? " " + className : "")} style={style}>
      <span className={"pc-action__icon" + (tone !== "neutral" ? " pc-action__icon--" + tone : "")}><Icon name={done ? "check" : icon} size={18} /></span>
      <div className="pc-action__body">
        {kind ? <div className="pc-action__kind">{kind}</div> : null}
        <div className="pc-action__title">{title}</div>
        {reason ? <div className="pc-action__reason">{done && doneLabel ? doneLabel : reason}</div> : null}
        {children && !done ? <div className="pc-action__extra">{children}</div> : null}
      </div>
      <div className="pc-action__acts">
        {act(secondary, "secondary")}{act(primary, "primary")}
        {onDismiss ? <IconButton icon="x" label="Dismiss" variant="ghost" size="sm" onClick={onDismiss} /> : null}
      </div>
    </div>
  );
}
