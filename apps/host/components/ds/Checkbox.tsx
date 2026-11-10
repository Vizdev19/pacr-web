"use client";

import { useState, type ChangeEvent, type CSSProperties, type ReactNode } from "react";
import { Icon } from "./Icon";

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  indeterminate?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Checkbox({ checked, defaultChecked = false, onChange, label, description, indeterminate = false, disabled, className = "", style }: CheckboxProps) {
  const [inner, setInner] = useState(defaultChecked);
  const on = checked !== undefined ? checked : inner;
  const toggle = (e: ChangeEvent<HTMLInputElement>) => { const v = e.target.checked; if (checked === undefined) setInner(v); if (onChange) onChange(v); };
  return (
    <label className={"pc-check" + (on || indeterminate ? " is-on" : "") + (disabled ? " is-disabled" : "") + (className ? " " + className : "")} style={style}>
      <input type="checkbox" checked={on} onChange={toggle} disabled={disabled} />
      <span className="pc-check__box"><Icon name={indeterminate ? "minus" : "check"} size={13} strokeWidth={3} className="pc-check__mark" /></span>
      {label || description ? (
        <span className="pc-check__label">{label}{description ? <span className="pc-check__desc">{description}</span> : null}</span>
      ) : null}
    </label>
  );
}
