"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./IconButton";

const subscribe = () => () => {};
const useMounted = () => useSyncExternalStore(subscribe, () => true, () => false);

export interface DrawerProps {
  open?: boolean;
  onClose?: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  headerActions?: ReactNode;
  footer?: ReactNode;
  width?: number;
  children?: ReactNode;
}

export function Drawer({ open, onClose, title, subtitle, leading, headerActions, footer, width, children }: DrawerProps) {
  const mounted = useMounted();
  useEffect(() => {
    if (!open) return;
    const f = (e: KeyboardEvent) => { if (e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [open, onClose]);
  if (!open || !mounted) return null;
  return createPortal(
    <>
      <div className="pc-drawer-scrim" onClick={onClose} />
      <aside className="pc-drawer" role="dialog" aria-modal="true" style={width ? { width: "min(" + width + "px, calc(100vw - 16px))" } : undefined}>
        <div className="pc-drawer__head">
          {leading}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="pc-drawer__title">{title}</div>
            {subtitle ? <div className="pc-drawer__sub">{subtitle}</div> : null}
          </div>
          {headerActions}
          <IconButton icon="x" label="Close" variant="secondary" size="sm" onClick={onClose} />
        </div>
        <div className="pc-drawer__body">{children}</div>
        {footer ? <div className="pc-drawer__foot">{footer}</div> : null}
      </aside>
    </>,
    document.body,
  );
}
