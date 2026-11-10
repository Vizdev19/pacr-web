"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export interface SelectOption {
  value: string;
  label: ReactNode;
  icon?: IconName;
}

function norm(o: string | SelectOption): SelectOption { return typeof o === "string" ? { value: o, label: o } : o; }

export interface SelectProps {
  options?: (string | SelectOption)[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: ReactNode;
  label?: ReactNode;
  hint?: ReactNode;
  icon?: IconName;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Select({ options = [], value, defaultValue, onChange, placeholder = "Select…", label, hint, icon, size = "md", disabled, className = "", style }: SelectProps) {
  const opts = options.map(norm);
  const [inner, setInner] = useState(defaultValue);
  const cur = value !== undefined ? value : inner;
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const selected = opts.find(o => o.value === cur);

  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open]);

  const pick = (v: string) => { if (value === undefined) setInner(v); if (onChange) onChange(v); setOpen(false); };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi(h => Math.min(opts.length - 1, h + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(0, h - 1)); }
    else if (e.key === "Enter" && open && hi >= 0) { e.preventDefault(); pick(opts[hi].value); }
  };
  const triggerIcon = (selected && selected.icon) || icon;

  return (
    <div className={"pc-field " + className} style={style}>
      {label ? <span className="pc-label">{label}</span> : null}
      <div ref={ref} className={"pc-select" + (open ? " is-open" : "")}>
        <button type="button" disabled={disabled} onKeyDown={onKey}
          className={"pc-inputwrap pc-select__trigger" + (size === "sm" ? " pc-inputwrap--sm" : "") + (disabled ? " is-disabled" : "")}
          style={open ? { borderColor: "var(--border-focus)", boxShadow: "var(--focus-ring)", background: "#fff" } : undefined}
          onClick={() => { setOpen(o => !o); setHi(opts.findIndex(o => o.value === cur)); }} aria-haspopup="listbox" aria-expanded={open}>
          {triggerIcon ? <Icon name={triggerIcon} size={16} /> : null}
          <span className={"pc-select__value" + (selected ? "" : " is-placeholder")}>{selected ? selected.label : placeholder}</span>
          <Icon name="chevron-down" size={16} className="pc-select__chev" />
        </button>
        {open ? (
          <div className="pc-menu" role="listbox">
            {opts.map((o, i) => (
              <button type="button" key={o.value} role="option" aria-selected={o.value === cur}
                className={"pc-option" + (o.value === cur ? " is-selected" : "") + (i === hi ? " is-active" : "")}
                onMouseEnter={() => setHi(i)} onClick={() => pick(o.value)}>
                {o.icon ? <Icon name={o.icon} size={16} /> : null}
                <span style={{ flex: 1 }}>{o.label}</span>
                {o.value === cur ? <Icon name="check" size={16} /> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {hint ? <span className="pc-hint">{hint}</span> : null}
    </div>
  );
}
