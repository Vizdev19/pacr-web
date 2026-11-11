"use client";
// components/feedback/* (EmptyState, ErrorState, Skeleton, BottomSheet) of the pacr Web Design System, ported to TSX.
import { useEffect, type CSSProperties, type ReactNode } from "react";
import { Button, Icon, IconButton } from "./core";

export function EmptyState({ icon = "calendar-x", title, body, action, onAction, href, boxed = false, kind }:
  { icon?: string; title: string; body?: string; action?: string; onAction?: () => void; href?: string; boxed?: boolean; kind?: "error" | "offline" }) {
  return <div className={"pw-empty" + (boxed ? " pw-empty--boxed" : "") + (kind ? " pw-empty--" + kind : "")}><span className="pw-empty__ico"><Icon name={icon} size={26} /></span>
    <h3 className="pw-empty__t">{title}</h3>{body ? <p className="pw-empty__b">{body}</p> : null}
    {action ? (href ? <Button variant="secondary" href={href}>{action}</Button> : <Button variant="secondary" onClick={onAction}>{action}</Button>) : null}</div>;
}

export function ErrorState({ kind = "error", title, body, onRetry, action, onAction, href }:
  { kind?: "error" | "offline" | "notfound"; title?: string; body?: string; onRetry?: () => void; action?: string; onAction?: () => void; href?: string }) {
  const d = ({
    error: ["circle-alert", "Something went wrong on our side", "Try again in a moment."],
    offline: ["wifi-off", "You're offline", "Check your connection. We'll load this when you're back."],
    notfound: ["search-x", "We can't find that page", "The link may be old, or it was removed."],
  } as const)[kind];
  return <EmptyState kind={kind === "notfound" ? undefined : kind} icon={d[0]} title={title || d[1]} body={body || d[2]} action={action || (onRetry ? "Try again" : undefined)} onAction={onAction || onRetry} href={href} />;
}

const B = ({ w = "100%", h = 12, r, c, style }: { w?: number | string; h?: number | string; r?: number | string; c?: boolean; style?: CSSProperties }) =>
  <span className={"pw-skel" + (c ? " pw-skel--circle" : "")} style={{ width: w, height: h, borderRadius: r, ...style }} />;
export function Skeleton({ variant = "text", lines = 3 }: { variant?: "text" | "squad" | "run" | "event" | "post" | "runner" | "stat" | "ticket"; lines?: number }) {
  const box = (ch: ReactNode) => <div className="pw-card" style={{ padding: 0 }} aria-busy="true" aria-label="Loading">{ch}</div>;
  if (variant === "squad") return box(<><B h="auto" r={0} style={{ aspectRatio: "5 / 2" }} /><div className="pw-skel-card" style={{ padding: 16 }}><B w="60%" h={16} /><B w="80%" /><B w="40%" /></div></>);
  if (variant === "run") return box(<div style={{ display: "flex", gap: 14, padding: 16 }}><B w={64} h={84} r={8} /><div className="pw-skel-card" style={{ flex: 1 }}><B w="30%" /><B w="70%" h={16} /><B w="55%" /><B w="40%" /></div></div>);
  if (variant === "event") return <div className="pw-skel-card" aria-busy="true"><B h="auto" r="var(--radius-lg)" style={{ aspectRatio: "2 / 3" }} /><B w="40%" /><B w="85%" h={16} /><B w="60%" /></div>;
  if (variant === "post") return box(<div className="pw-skel-card" style={{ padding: 16 }}><div style={{ display: "flex", gap: 12, alignItems: "center" }}><B w={40} h={40} c /><div className="pw-skel-card" style={{ flex: 1, gap: 6 }}><B w="40%" /><B w="25%" h={10} /></div></div><B /><B w="70%" /><B h="auto" r={8} style={{ aspectRatio: "4 / 5" }} /></div>);
  if (variant === "runner") return <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0" }} aria-busy="true"><B w={44} h={44} c /><div className="pw-skel-card" style={{ flex: 1, gap: 6 }}><B w="45%" /><B w="30%" h={10} /></div><B w={84} h={36} r={8} /></div>;
  if (variant === "stat") return <div className="pw-stat" aria-busy="true"><B w="50%" /><B w="70%" h={28} /><B w="40%" h={10} /></div>;
  if (variant === "ticket") return box(<div className="pw-skel-card" style={{ padding: 20, alignItems: "center" }}><B w="50%" /><B w="80%" h={18} /><B w={200} h={200} r={12} /></div>);
  return <div className="pw-skel-card" aria-busy="true">{Array.from({ length: lines }).map((_, i) => <B key={i} w={i === lines - 1 ? "60%" : "100%"} />)}</div>;
}

/** Closes on Escape, like the kit's Menu. */
export function useEscape(open: boolean, onClose?: () => void) {
  useEffect(() => {
    if (!open || !onClose) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open, onClose]);
}

export function BottomSheet({ open, title, children, footer, onClose, adaptive = true }:
  { open: boolean; title?: string; children?: ReactNode; footer?: ReactNode; onClose?: () => void; adaptive?: boolean }) {
  useEscape(open, onClose);
  if (!open) return null;
  return <><div className="pw-scrim" onClick={onClose} /><div className={"pw-sheet" + (adaptive ? " pw-sheet--adaptive" : "")} role="dialog" aria-modal="true" aria-label={title}>
    <div className="pw-sheet__grab" />{title || onClose ? <div className="pw-sheet__head"><h2 className="pw-sheet__title">{title}</h2>{onClose ? <IconButton icon="x" label="Close" onClick={onClose} /> : null}</div> : null}
    <div className="pw-sheet__body">{children}</div>{footer ? <div className="pw-sheet__foot">{footer}</div> : null}</div></>;
}
