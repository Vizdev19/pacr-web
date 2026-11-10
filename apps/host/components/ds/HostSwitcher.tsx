"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

const STATUS: Record<string, string> = { pending: "Pending review", rejected: "Not approved" };

export interface HostOption {
  id: string;
  name: string;
  kind?: "squad" | "organizer";
  role?: string;
  meta?: string;
  status?: string;
  verified?: boolean;
  badge?: number | string;
  src?: string;
}

export interface HostSwitcherProps {
  hosts?: HostOption[];
  value?: string;
  onChange?: (id: string) => void;
  defaultOpen?: boolean;
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function HostSwitcher({ hosts = [], value, onChange, defaultOpen = false, footer, className = "", style }: HostSwitcherProps) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLDivElement>(null);
  const cur: Partial<HostOption> = hosts.find(h => h.id === value) || hosts[0] || {};
  useEffect(() => {
    if (!open) return;
    const f = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", f);
    return () => document.removeEventListener("mousedown", f);
  }, [open]);
  const groups: [string, HostOption[]][] = ([["Squads", hosts.filter(h => h.kind !== "organizer")], ["Organizer accounts", hosts.filter(h => h.kind === "organizer")]] as [string, HostOption[]][]).filter(g => g[1].length);
  return (
    <div ref={ref} className={"pc-hostsw" + (open ? " is-open" : "") + (className ? " " + className : "")} style={style}>
      <button type="button" className="pc-hostsw__btn" onClick={() => setOpen(o => !o)} aria-expanded={open} title={cur.name}>
        <Avatar name={cur.name} src={cur.src} size={34} style={{ borderRadius: cur.kind === "organizer" ? 8 : "50%" }} />
        <span className="pc-hostsw__txt">
          <span className="pc-hostsw__name">{cur.name}{cur.verified ? <span className="pc-verified" title="Verified"><Icon name="badge-check" size={14} strokeWidth={2} /></span> : null}</span>
          <span className="pc-hostsw__role">{cur.role}{cur.status && STATUS[cur.status] ? " · " + STATUS[cur.status] : ""}</span>
        </span>
        <span className="pc-hostsw__chev" style={{ color: "var(--text-muted)", display: "inline-flex" }}><Icon name="chevrons-up-down" size={15} /></span>
      </button>
      {open ? (
        <div className="pc-hostsw__menu" role="listbox">
          {groups.map(([label, list]) => (
            <div key={label}>
              <div className="pc-hostsw__group">{label}</div>
              {list.map(h => (
                <button key={h.id} type="button" role="option" aria-selected={h.id === cur.id} className={"pc-hostsw__opt" + (h.id === cur.id ? " is-active" : "")} onClick={() => { setOpen(false); if (onChange) onChange(h.id); }}>
                  <Avatar name={h.name} src={h.src} size={30} style={{ borderRadius: h.kind === "organizer" ? 7 : "50%" }} />
                  <span className="pc-hostsw__txt">
                    <span className="pc-hostsw__name">{h.name}{h.verified ? <span className="pc-verified"><Icon name="badge-check" size={13} strokeWidth={2} /></span> : null}</span>
                    <span className="pc-hostsw__role">{h.role}{h.meta ? " · " + h.meta : ""}{h.status && STATUS[h.status] ? " · " + STATUS[h.status] : ""}</span>
                  </span>
                  {h.id === cur.id ? <Icon name="check" size={15} /> : h.badge ? <span className="pc-nav__badge">{h.badge}</span> : null}
                </button>
              ))}
            </div>
          ))}
          {footer ? (
            <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "6px -6px 0", padding: "6px 6px 0" }}>{footer}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
