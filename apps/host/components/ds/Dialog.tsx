"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./Icon";
import { IconButton } from "./IconButton";

const ALIAS: Record<string, string> = { success: "lime", warning: "orange", danger: "red", info: "ink", neutral: "ink", navy: "ink" };

const subscribe = () => () => {};
const useMounted = () => useSyncExternalStore(subscribe, () => true, () => false);

export type DialogTone = "success" | "warning" | "danger" | "info" | "neutral" | "navy";

export interface DialogProps {
  open?: boolean;
  onClose?: () => void;
  title?: ReactNode;
  description?: ReactNode;
  icon?: IconName;
  tone?: DialogTone;
  width?: number | string;
  footer?: ReactNode;
  children?: ReactNode;
}

export function Dialog({ open = false, onClose, title, description, icon, tone = "neutral", width = 480, footer, children }: DialogProps) {
  const mounted = useMounted();
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open || !mounted) return null;
  const t = ALIAS[tone] || tone;
  return createPortal(
    <div className="pc-overlay" onMouseDown={e => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className="pc-dialog" role="dialog" aria-modal="true" style={{ maxWidth: width }}>
        <div className="pc-dialog__head">
          {icon ? <span className="pc-dialog__icon" style={{ background: "var(--" + t + "-50)", color: "var(--" + t + "-700)" }}><Icon name={icon} size={20} /></span> : null}
          <div style={{ flex: 1, minWidth: 0 }}>
            {title ? <div className="pc-dialog__title">{title}</div> : null}
            {description ? <div className="pc-dialog__desc">{description}</div> : null}
          </div>
          {onClose ? <IconButton icon="x" label="Close" size="sm" onClick={onClose} style={{ marginTop: -4, marginRight: -6 }} /> : null}
        </div>
        {children ? <div className="pc-dialog__body">{children}</div> : null}
        {footer ? <div className="pc-dialog__foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
