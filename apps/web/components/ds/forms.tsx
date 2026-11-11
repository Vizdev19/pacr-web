"use client";
// components/forms/* of the pacr Web Design System, ported to TSX (PhotoPicker and DateTimeField aren't needed yet).
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ChangeEvent, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type TextareaHTMLAttributes } from "react";
import { Icon, IconButton } from "./core";

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

/* FieldMessage, Input, Select */
const MSG_IC: Record<string, string> = { error: "circle-alert", success: "circle-check", warning: "triangle-alert" };
export function FieldMessage({ tone = "hint", children }: { tone?: "hint" | "error" | "success" | "warning"; children: ReactNode }) {
  return <div className={"pw-msg pw-msg--" + tone} role={tone === "error" ? "alert" : undefined}>{MSG_IC[tone] ? <Icon name={MSG_IC[tone]} size={15} /> : null}<span>{children}</span></div>;
}

type InputExtra = { label?: string; optional?: boolean; hint?: ReactNode; error?: ReactNode; success?: ReactNode; icon?: string; suffix?: ReactNode; size?: "sm" | "md"; fill?: boolean };
export function Input({ label, optional = false, hint, error, success, icon, suffix, size = "md", fill = false, disabled, id, className, ...rest }: InputExtra & Omit<InputHTMLAttributes<HTMLInputElement>, "size">) {
  const fid = id || (label ? "f-" + label.toLowerCase().replace(/\W+/g, "-") : undefined);
  return <div className={"pw-field" + (error ? " pw-field--error" : success ? " pw-field--success" : "") + (disabled ? " pw-field--disabled" : "") + (className ? " " + className : "")}>
    {label ? <label className="pw-field__label" htmlFor={fid}>{label}{optional ? <small>Optional</small> : null}</label> : null}
    <label className={"pw-field__box" + (size === "sm" ? " pw-field__box--sm" : "") + (fill ? " pw-field__box--fill" : "")}>
      {icon ? <Icon name={icon} size={18} /> : null}
      <input id={fid} className="pw-field__input" disabled={disabled} aria-invalid={!!error || undefined} {...rest} />
      {suffix ? <span className="pw-field__suffix">{suffix}</span> : null}
    </label>
    {error ? <FieldMessage tone="error">{error}</FieldMessage> : success ? <FieldMessage tone="success">{success}</FieldMessage> : hint ? <FieldMessage>{hint}</FieldMessage> : null}
  </div>;
}
export function TextArea({ label, optional = false, hint, error, disabled, id, ...rest }: InputExtra & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const fid = id || (label ? "t-" + label.toLowerCase().replace(/\W+/g, "-") : undefined);
  return <div className={"pw-field" + (error ? " pw-field--error" : "") + (disabled ? " pw-field--disabled" : "")}>
    {label ? <label className="pw-field__label" htmlFor={fid}>{label}{optional ? <small>Optional</small> : null}</label> : null}
    <label className="pw-field__box pw-field__box--multi"><textarea id={fid} className="pw-field__input" disabled={disabled} aria-invalid={!!error || undefined} {...rest} /></label>
    {error ? <FieldMessage tone="error">{error}</FieldMessage> : hint ? <FieldMessage>{hint}</FieldMessage> : null}
  </div>;
}

export type SelectOption = { value: string; label: string; disabled?: boolean };
export function Select({ label, options, value, onChange, hint, error, disabled, icon, size = "md", id }:
  { label?: string; options: SelectOption[]; value: string; onChange: (v: string) => void; hint?: ReactNode; error?: ReactNode; disabled?: boolean; icon?: string; size?: "sm" | "md"; id?: string }) {
  const fid = id || (label ? "s-" + label.toLowerCase().replace(/\W+/g, "-") : undefined);
  return <div className={"pw-field" + (error ? " pw-field--error" : "") + (disabled ? " pw-field--disabled" : "")}>
    {label ? <label className="pw-field__label" htmlFor={fid}>{label}</label> : null}
    <label className={"pw-field__box" + (size === "sm" ? " pw-field__box--sm" : "")} style={{ position: "relative", cursor: "pointer" }}>
      {icon ? <Icon name={icon} size={18} /> : null}
      <select id={fid} className="pw-field__input" value={value} disabled={disabled} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
      </select><Icon name="chevron-down" size={18} style={{ pointerEvents: "none" }} />
    </label>
    {error ? <FieldMessage tone="error">{error}</FieldMessage> : hint ? <FieldMessage>{hint}</FieldMessage> : null}
  </div>;
}

/* Checkbox, Radio, RadioGroup, Switch */
export function Checkbox({ label, description, checked, indeterminate = false, disabled, onChange }: { label: ReactNode; description?: ReactNode; checked: boolean; indeterminate?: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  const r = useRef<HTMLInputElement>(null);
  useEffect(() => { if (r.current) r.current.indeterminate = indeterminate; }, [indeterminate]);
  return <label className={"pw-check" + (disabled ? " pw-check--disabled" : "")}><span style={{ position: "relative", display: "inline-flex" }}><input ref={r} type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
    <span className="pw-check__box">{indeterminate ? <Icon name="minus" size={16} strokeWidth={3} /> : checked ? <Icon name="check" size={16} strokeWidth={3} /> : null}</span></span>
    <span>{label}{description ? <span className="pw-check__desc">{description}</span> : null}</span></label>;
}
export function Radio({ label, description, checked, disabled, onChange, name, value }: { label: ReactNode; description?: ReactNode; checked: boolean; disabled?: boolean; onChange: (v: string) => void; name: string; value: string }) {
  return <label className={"pw-check pw-check--radio" + (disabled ? " pw-check--disabled" : "")}><span style={{ position: "relative", display: "inline-flex" }}><input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={() => onChange(value)} /><span className="pw-check__box" /></span>
    <span>{label}{description ? <span className="pw-check__desc">{description}</span> : null}</span></label>;
}
export function RadioGroup({ name, options, value, onChange, label }: { name: string; options: { value: string; label: ReactNode; description?: ReactNode; disabled?: boolean }[]; value: string; onChange: (v: string) => void; label?: string }) {
  return <div role="radiogroup" aria-label={label}>{options.map(o => <Radio key={o.value} name={name} value={o.value} label={o.label} description={o.description} checked={value === o.value} disabled={o.disabled} onChange={onChange} />)}</div>;
}
export function Switch({ label, description, checked, disabled, onChange }: { label?: ReactNode; description?: ReactNode; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return <label className={"pw-switch" + (disabled ? " pw-switch--disabled" : "")}>
    {label ? <span className="pw-switch__text">{label}{description ? <span className="pw-check__desc">{description}</span> : null}</span> : null}
    <span style={{ position: "relative", display: "inline-flex" }}><input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} /><span className="pw-switch__track" /></span></label>;
}

/* CodeInput: six digits, paste-friendly */
export function CodeInput({ length = 6, value = "", onChange, error = false, success = false, disabled, autoFocus }: { length?: number; value: string; onChange: (v: string) => void; error?: boolean; success?: boolean; disabled?: boolean; autoFocus?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const set = (i: number, ch: string) => { const a = value.padEnd(length, " ").split(""); a[i] = ch || " "; onChange(a.join("").replace(/\s+$/, "")); };
  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus(); };
  const onIn = (i: number, e: ChangeEvent<HTMLInputElement>) => {
    const d = e.target.value.replace(/\D/g, "");
    if (d.length > 1) { onChange(d.slice(0, length)); refs.current[Math.min(d.length, length) - 1]?.focus(); return; }
    set(i, d); if (d && i < length - 1) refs.current[i + 1]?.focus();
  };
  const cells: ReactNode[] = [];
  for (let i = 0; i < length; i++) {
    if (length === 6 && i === 3) cells.push(<span key="s" className="pw-code__sep" />);
    cells.push(<input key={i} ref={el => { refs.current[i] = el; }} className="pw-code__cell" inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} maxLength={length} value={(value[i] || "").trim()} disabled={disabled} autoFocus={autoFocus && i === 0} aria-label={"Digit " + (i + 1)} onChange={e => onIn(i, e)} onKeyDown={e => onKey(i, e)} />);
  }
  return <div className={"pw-code" + (error ? " pw-code--error" : success ? " pw-code--success" : "")} role="group" aria-label="6-digit code">{cells}</div>;
}

/* QuantityStepper */
export function QuantityStepper({ value = 0, min = 0, max = 10, onChange, label = "Quantity" }: { value: number; min?: number; max?: number; onChange: (v: number) => void; label?: string }) {
  return <div className="pw-stepper" role="group" aria-label={label}>
    <IconButton icon="minus" label="Remove one" disabled={value <= min} onClick={() => onChange(value - 1)} />
    <span className="pw-stepper__val" aria-live="polite">{value}</span>
    <IconButton icon="plus" label="Add one" disabled={value >= max} onClick={() => onChange(value + 1)} />
  </div>;
}
