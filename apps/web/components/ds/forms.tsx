"use client";
// components/forms/SearchInput and ChipSelect of the pacr Web Design System, ported to TSX.
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Icon } from "./core";

export function SearchInput({ value, onChange, onSubmit, placeholder = "Search", size = "md", loading = false, fill = true, name }:
  { value?: string; onChange?: (v: string) => void; onSubmit?: (v: string) => void; placeholder?: string; size?: "sm" | "md"; loading?: boolean; fill?: boolean; name?: string }) {
  const [v, setV] = useState(value || "");
  const val = value != null ? value : v;
  return <div className="pw-search">
    <form role="search" onSubmit={e => { e.preventDefault(); onSubmit?.(val); }}>
      <label className={"pw-field__box" + (size === "sm" ? " pw-field__box--sm" : "") + (fill ? " pw-field__box--fill" : "")} style={{ borderRadius: "var(--radius-pill)" }}>
        <Icon name="search" size={18} />
        <input className="pw-field__input" type="search" name={name} placeholder={placeholder} value={val} aria-label={placeholder} style={size === "sm" ? { fontSize: 15 } : undefined}
          onChange={e => { setV(e.target.value); onChange?.(e.target.value); }} />
        {loading ? <span className="pw-spinner" /> : val ? <button type="button" aria-label="Clear" onClick={() => { setV(""); onChange?.(""); }} style={{ border: 0, background: "none", color: "inherit", padding: 0, display: "inline-flex", cursor: "pointer" }}><Icon name="x" size={16} /></button> : null}
      </label>
    </form>
  </div>;
}

export function Chip({ selected = false, icon, count, children, ...rest }: { selected?: boolean; icon?: string; count?: number; children?: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className="pw-chip" aria-pressed={selected} {...rest}>{selected && !icon ? <Icon name="check" size={16} strokeWidth={2.2} /> : icon ? <Icon name={icon} size={16} /> : null}{children}{count != null ? <span className="pw-chip__count">{count}</span> : null}</button>;
}

export type ChipOption = { id: string; label: string; icon?: string; count?: number; disabled?: boolean };
export function ChipSelect({ options = [], value = [], onChange, multi = true, scroll = false, label }:
  { options: ChipOption[]; value: string[] | string; onChange?: (v: string[]) => void; multi?: boolean; scroll?: boolean; label?: string }) {
  const sel = Array.isArray(value) ? value : [value];
  const toggle = (id: string) => { if (!onChange) return; if (multi) onChange(sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]); else onChange([id]); };
  return <div className={"pw-chips" + (scroll ? " pw-chips--scroll" : "")} role="group" aria-label={label}>
    {options.map(op => <Chip key={op.id} selected={sel.includes(op.id)} icon={op.icon} count={op.count} disabled={op.disabled} onClick={() => toggle(op.id)}>{op.label}</Chip>)}
  </div>;
}
