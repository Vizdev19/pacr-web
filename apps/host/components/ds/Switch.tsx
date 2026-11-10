"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
  pop?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Switch({ checked, defaultChecked = false, onChange, label, pop = false, disabled, className = "", style }: SwitchProps) {
  const [inner, setInner] = useState(defaultChecked);
  const on = checked !== undefined ? checked : inner;
  const toggle = () => { const v = !on; if (checked === undefined) setInner(v); if (onChange) onChange(v); };
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={toggle}
      className={"pc-switch" + (on ? " is-on" : "") + (pop ? " pc-switch--pop" : "") + (className ? " " + className : "")} style={style}>
      <span className="pc-switch__track"><span className="pc-switch__thumb" /></span>
      {label ? <span>{label}</span> : null}
    </button>
  );
}
