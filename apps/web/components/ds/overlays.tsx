"use client";
// components/feedback/{Dialog,Toast,Banner,Drawer,Tooltip} of the pacr Web
// Design System, ported to TSX, plus a toast provider so any page can say
// "Posted" without owning a stack.
import { createContext, useCallback, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Icon, IconButton } from "./core";

function useEsc(open: boolean, onClose?: () => void) {
  useEffect(() => {
    if (!open || !onClose) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open, onClose]);
}

export function Dialog({ open, title, children, actions, onClose, width = 440 }: { open: boolean; title?: string; children?: ReactNode; actions?: ReactNode; onClose?: () => void; width?: number }) {
  useEsc(open, onClose);
  if (!open) return null;
  return <div className="pw-dialog-wrap"><div className="pw-scrim" onClick={onClose} /><div className="pw-dialog" role="dialog" aria-modal="true" aria-label={title} style={{ "--dw": width + "px" } as CSSProperties}>
    {onClose ? <IconButton className="pw-dialog__x" icon="x" label="Close" size="sm" onClick={onClose} /> : null}
    {title ? <h2 className="pw-dialog__title">{title}</h2> : null}<div className="pw-dialog__body">{children}</div>{actions ? <div className="pw-dialog__acts">{actions}</div> : null}</div></div>;
}

const TOAST_IC: Record<string, [string | null, string?]> = { success: ["circle-check", "var(--success)"], error: ["circle-alert", "var(--danger)"], info: ["info", "var(--info)"], neutral: [null] };
export type ToastTone = "success" | "error" | "info" | "neutral";
export function Toast({ title, message, tone = "success", action, onAction, onClose }: { title: string; message?: string; tone?: ToastTone; action?: string; onAction?: () => void; onClose?: () => void }) {
  const ic = TOAST_IC[tone] || TOAST_IC.neutral;
  return <div className="pw-toast" role="status" aria-live="polite">{ic[0] ? <span style={{ color: `color-mix(in oklab, ${ic[1]}, var(--text-inverse) 35%)`, display: "inline-flex" }}><Icon name={ic[0]} size={20} /></span> : null}
    <div className="pw-toast__body"><b>{title}</b>{message ? <span>{message}</span> : null}</div>
    {action ? <button className="pw-toast__act" onClick={onAction}>{action}</button> : null}{onClose ? <IconButton icon="x" label="Dismiss" size="sm" onClick={onClose} /> : null}</div>;
}
export function ToastStack({ children }: { children?: ReactNode }) { return <div className="pw-toasts">{children}</div>; }

type ToastInput = { title: string; message?: string; tone?: ToastTone; action?: string; onAction?: () => void; ms?: number };
const ToastCtx = createContext<(t: ToastInput) => void>(() => {});
/** `const toast = useToast(); toast({ title: "Hidden", action: "Undo", onAction })` */
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<(ToastInput & { k: number })[]>([]);
  const drop = useCallback((k: number) => setList(x => x.filter(y => y.k !== k)), []);
  const push = useCallback((t: ToastInput) => {
    const k = Date.now() + Math.random();
    setList(x => [...x.slice(-2), { ...t, k }]);
    setTimeout(() => drop(k), t.ms ?? (t.action ? 6000 : 4000));
  }, [drop]);
  return <ToastCtx.Provider value={push}>{children}
    {list.length ? <ToastStack>{list.map(t => <Toast key={t.k} title={t.title} message={t.message} tone={t.tone} action={t.action}
      onAction={() => { t.onAction?.(); drop(t.k); }} onClose={() => drop(t.k)} />)}</ToastStack> : null}
  </ToastCtx.Provider>;
}

const BANNER_IC = { info: "info", warning: "triangle-alert", error: "circle-alert", success: "circle-check", neutral: "info" } as const;
export function Banner({ tone = "info", title, children, icon, actions, onClose }: { tone?: keyof typeof BANNER_IC; title?: string; children?: ReactNode; icon?: string; actions?: ReactNode; onClose?: () => void }) {
  return <div className={"pw-banner pw-banner--" + tone} role={tone === "error" ? "alert" : "status"}><Icon name={icon || BANNER_IC[tone]} size={20} />
    <div className="pw-banner__body">{title ? <b>{title}</b> : null}{children ? <p>{children}</p> : null}{actions ? <div className="pw-banner__act">{actions}</div> : null}</div>
    {onClose ? <IconButton icon="x" label="Dismiss" size="sm" onClick={onClose} style={{ margin: "-6px -6px 0 0" }} /> : null}</div>;
}

export function Drawer({ open, side = "right", title, children, footer, onClose }: { open: boolean; side?: "left" | "right"; title: string; children?: ReactNode; footer?: ReactNode; onClose: () => void }) {
  useEsc(open, onClose);
  if (!open) return null;
  return <><div className="pw-scrim" onClick={onClose} /><aside className={"pw-drawer pw-drawer--" + side} role="dialog" aria-modal="true" aria-label={title}>
    <div className="pw-drawer__head"><h2 className="t-h4" style={{ flex: 1 }}>{title}</h2><IconButton icon="x" label="Close" onClick={onClose} /></div>
    <div className="pw-drawer__body">{children}</div>{footer ? <div className="pw-drawer__foot">{footer}</div> : null}</aside></>;
}

export function Tooltip({ label, side = "top", open, children }: { label: string; side?: "top" | "bottom"; open?: boolean; children: ReactNode }) {
  return <span className="pw-tip-wrap">{children}<span role="tooltip" className={"pw-tip" + (side === "bottom" ? " pw-tip--bottom" : "") + (open ? " is-open" : "")}>{label}</span></span>;
}
