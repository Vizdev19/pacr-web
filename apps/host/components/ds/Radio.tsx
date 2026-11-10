"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";

export interface RadioProps {
  checked?: boolean;
  onChange?: (value: string) => void;
  label?: ReactNode;
  description?: ReactNode;
  name?: string;
  value: string;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Radio({ checked = false, onChange, label, description, name, value, disabled, className = "", style }: RadioProps) {
  return (
    <label className={"pc-check pc-check--radio" + (checked ? " is-on" : "") + (disabled ? " is-disabled" : "") + (className ? " " + className : "")} style={style}>
      <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={() => { if (onChange) onChange(value); }} />
      <span className="pc-check__box" style={checked ? { borderColor: "var(--control-on)" } : undefined}><span className="pc-check__dot" /></span>
      {label || description ? (
        <span className="pc-check__label">{label}{description ? <span className="pc-check__desc">{description}</span> : null}</span>
      ) : null}
    </label>
  );
}

export interface RadioOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
}

export interface RadioGroupProps {
  options?: (string | RadioOption)[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  direction?: "row" | "column";
  gap?: number | string;
  disabled?: boolean;
}

export function RadioGroup({ options = [], value, defaultValue, onChange, name, direction = "column", gap = 12, disabled }: RadioGroupProps) {
  const auto = useId();
  const [inner, setInner] = useState(defaultValue);
  const cur = value !== undefined ? value : inner;
  const pick = (v: string) => { if (value === undefined) setInner(v); if (onChange) onChange(v); };
  return (
    <div role="radiogroup" style={{ display: "flex", flexDirection: direction, gap, flexWrap: "wrap" }}>
      {options.map(o => {
        const opt: RadioOption = typeof o === "string" ? { value: o, label: o } : o;
        return <Radio key={opt.value} name={name || auto} value={opt.value} label={opt.label} description={opt.description} checked={cur === opt.value} onChange={pick} disabled={disabled} />;
      })}
    </div>
  );
}
