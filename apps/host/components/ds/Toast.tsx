"use client";

import { useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./Icon";
import { IconButton } from "./IconButton";

export type ToastTone = "success" | "warning" | "danger" | "info" | "pop" | "neutral";

const TONES: Record<ToastTone, [string, IconName]> = {
  success: ["lime", "circle-check"], warning: ["orange", "triangle-alert"], danger: ["red", "circle-x"],
  info: ["ink", "info"], pop: ["lime", "sparkles"], neutral: ["ink", "bell"],
};

const subscribe = () => () => {};
const useMounted = () => useSyncExternalStore(subscribe, () => true, () => false);

export interface ToastProps {
  tone?: ToastTone;
  title?: ReactNode;
  message?: ReactNode;
  icon?: IconName;
  action?: ReactNode;
  onClose?: () => void;
  style?: CSSProperties;
}

export function Toast({ tone = "success", title, message, icon, action, onClose, style }: ToastProps) {
  const [hue, def] = TONES[tone] || TONES.neutral;
  return (
    <div className="pc-toast" role="status" style={style}>
      <span className="pc-toast__icon" style={tone === "pop" ? { background: "var(--fill-lime)", color: "var(--ink-900)" } : { background: "var(--" + hue + "-50)", color: "var(--" + hue + "-700)" }}>
        <Icon name={icon || def} size={17} />
      </span>
      <div className="pc-toast__body">
        {title ? <div className="pc-toast__title">{title}</div> : null}
        {message ? <div className="pc-toast__msg">{message}</div> : null}
        {action ? <div style={{ marginTop: 8 }}>{action}</div> : null}
      </div>
      {onClose ? <IconButton icon="x" label="Dismiss" size="sm" onClick={onClose} /> : null}
    </div>
  );
}

export interface ToastStackProps {
  children?: ReactNode;
}

export function ToastStack({ children }: ToastStackProps) {
  const mounted = useMounted();
  if (!mounted) return null;
  return createPortal(<div className="pc-toast-stack">{children}</div>, document.body);
}
